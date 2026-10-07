/**
 * lib/studio/score/compose.ts — a timeline in, a finished soundtrack out.
 *
 * composeScore plans the music (plan.ts), renders four dry buses (the pad, the
 * measured pulse, the event notes, the lockup) and one shared reverb, sums them,
 * and masters the sum to a measured loudness and true peak (master.ts). The
 * same input is byte-for-byte the same WAV: every choice is seeded, nothing
 * reads a clock.
 *
 * Levels are never guessed in absolute terms. The pad is rendered first and its
 * RMS is measured; every other voice is set in decibels against that, through a
 * per-voice reference (voices.ts), so "the pulse sits 11 dB under the pad" is a
 * fact about the mix rather than a hope about amplitudes. The final loudness
 * pass then moves everything together to -14 LUFS, so only those relative
 * levels matter.
 *
 * Scale each sound to its cause: an event's `weight` moves it in decibels,
 * 20 log10(weight) clamped to +-6 dB around weight 1. A small figure is a
 * whisper, a big landing is a clear note, and none of them is a slam.
 */
import { clamp, dbToGain, filterInPlace, highpass } from './dsp'
import { encodeWav } from './wav'
import { renderPad } from './pad'
import { masterMix } from './master'
import { planScore, type ScorePlan } from './plan'
import { renderReverb } from './reverb'
import { rngFor } from './rng'
import { SAMPLE_RATE, type ScoreInput, type ScoreResult } from './types'
import { addBell, addFelt, addSub, addTick, stereoRms, voiceReference, type NoteTarget, type StereoBuf } from './voices'

/** Levels in dB against the pad's measured RMS (a tick's is against its peak, see voiceReference). */
const ENTER_DB = -5
const DATUM_DB = -12
const PULSE_DB = -11
const TICK_DB = -15
const BELL_DB = -10
const SUB_DB = -13
/** A datum note's decay, seconds. */
const DATUM_TAU = 0.45
/** Reverb sends, linear: pad moderate, felt and bell higher, tick dry-ish. */
const FELT_SEND = 0.45
const DATUM_SEND = 0.4
const TICK_SEND = 0.1
const BELL_SEND = 0.6
const SUB_SEND = 0.1
/** Events sit nearly centred; the width lives in the pad. */
const EVENT_PAN = 0.15
/** The reverb's return into the mix. */
const REVERB_RETURN = 1.0
/** The reverb send is high-passed so the room never carries the low end. */
const SEND_HIGHPASS_HZ = 250

export type ScoreStems = {
  plan: ScorePlan
  pad: StereoBuf
  pulse: StereoBuf
  events: StereoBuf
  lockup: StereoBuf
  /** The reverb's wet return of everything above, already at its mix level. */
  reverb: StereoBuf
}

function stereo(n: number): StereoBuf {
  return { left: new Float32Array(n), right: new Float32Array(n) }
}

/** 20 log10(weight) clamped to +-6 dB. A missing or non-numeric weight is 1. */
export function weightDb(weight: number): number {
  if (typeof weight !== 'number' || Number.isNaN(weight)) return 0
  if (weight <= 0) return -6
  return clamp(20 * Math.log10(weight), -6, 6)
}

/** A felt note rings longer in the low octaves: 1.15 s at middle C, 0.86 s two octaves up, inside 0.6 to 1.2. */
function feltTau(midi: number): number {
  return clamp(1.15 - 0.012 * (midi - 60), 0.6, 1.2)
}

/** The dry buses and the reverb return, before the master. Exposed so tests can look at one cause at a time. */
export function renderScoreStems(input: ScoreInput): ScoreStems {
  const plan = planScore(input)
  const n = plan.samples
  const pad = renderPad(plan)
  const fadeSamples = Math.round(plan.fadeSeconds * SAMPLE_RATE)
  const padRef = Math.max(stereoRms(pad.bus, 0, n - fadeSamples), 1e-6)

  const pulse = stereo(n)
  const events = stereo(n)
  const lockup = stereo(n)
  const send = pad.send
  const pulseTarget: NoteTarget = { bus: pulse, send }
  const eventTarget: NoteTarget = { bus: events, send }
  const lockupTarget: NoteTarget = { bus: lockup, send }

  const felt = voiceReference('felt')
  const tick = voiceReference('tick')
  const bell = voiceReference('bell')
  const sub = voiceReference('sub')
  const feltGain = (db: number) => (padRef * dbToGain(db)) / felt.rms
  const panRand = rngFor(plan.seed, 'pan')
  const at = (t: number) => Math.round(t * SAMPLE_RATE)

  // The measured pulse: soft felt notes on chord tones, alternating sides.
  plan.pulses.forEach((note, i) => {
    addFelt(pulseTarget, {
      start: at(note.t),
      midi: note.midi,
      tau: feltTau(note.midi) * 0.75,
      attack: 0.006,
      gain: feltGain(PULSE_DB + plan.pad.pulseOffsetDb),
      pan: i % 2 === 0 ? -EVENT_PAN : EVENT_PAN,
      send: FELT_SEND,
      rand: rngFor(plan.seed, `pulse:${i}`),
    })
  })

  plan.events.forEach((planned, i) => {
    const { event, midi } = planned
    const pan = (panRand() * 2 - 1) * EVENT_PAN
    if (event.kind === 'enter' && midi !== null) {
      const db = weightDb(event.weight)
      addFelt(eventTarget, {
        start: at(event.t),
        midi,
        tau: feltTau(midi),
        // A heavier card strikes harder: 8 ms at -6 dB, 4 ms at +6 dB.
        attack: 0.006 - 0.002 * (db / 6),
        gain: feltGain(ENTER_DB + db),
        pan,
        send: FELT_SEND,
        rand: rngFor(plan.seed, `enter:${i}`),
      })
    } else if (event.kind === 'datum' && midi !== null) {
      const db = weightDb(event.weight)
      addFelt(eventTarget, {
        start: at(event.t),
        midi,
        // Shorter than a card's note: a chart draws a month every 100 ms or so, and a 1 s ring would smear the line into a chord.
        tau: DATUM_TAU,
        attack: 0.006 - 0.002 * (db / 6),
        gain: feltGain(DATUM_DB + db),
        pan,
        send: DATUM_SEND,
        rand: rngFor(plan.seed, `datum:${i}`),
      })
    } else if (event.kind === 'land' && midi !== null) {
      const db = weightDb(event.weight)
      // 12 to 18 dB under the pad, unless the landing is big (weight >= 1.5): then it may come up.
      const level = event.weight >= 1.5 ? TICK_DB + db : clamp(TICK_DB + db, -18, -12)
      addTick(eventTarget, {
        start: at(event.t),
        midi,
        tau: 0.014,
        gain: (padRef * dbToGain(level)) / tick.peak,
        pan,
        send: TICK_SEND,
        rand: rngFor(plan.seed, `land:${i}`),
      })
    } else if (event.kind === 'lockup' && midi !== null) {
      addBell(lockupTarget, {
        start: at(event.t),
        midi,
        gain: (padRef * dbToGain(BELL_DB)) / bell.rms,
        pan: 0,
        send: BELL_SEND,
      })
      // The low dyad: the tonic in octave 2 to 3 (A2 to G3) and its fifth.
      const tonic = plan.key.tonic
      let low = 36 + tonic
      if (low < 45) low += 12
      addSub(lockupTarget, {
        start: at(event.t),
        midi: low,
        gain: (padRef * dbToGain(SUB_DB)) / sub.rms,
        pan: 0,
        send: SUB_SEND,
      })
    }
  })

  // The room: one reverb for everything, fed by the sends, high-passed at 250 Hz.
  filterInPlace(send, highpass(SEND_HIGHPASS_HZ))
  const wet = renderReverb(send)
  for (let i = 0; i < n; i++) {
    wet.left[i] *= REVERB_RETURN
    wet.right[i] *= REVERB_RETURN
  }
  return { plan, pad: pad.bus, pulse, events, lockup, reverb: wet }
}

/**
 * Compose the soundtrack for a film. Deterministic: the same input gives a
 * byte-identical WAV. Throws RangeError for a duration outside 0.5 to 600 s or
 * a loudness target outside -40 to -6 LUFS; everything else it can repair it
 * repairs and reports in `warnings`.
 */
export function composeScore(input: ScoreInput): ScoreResult {
  const stems = renderScoreStems(input)
  const { plan } = stems
  const n = plan.samples
  const left = new Float32Array(n)
  const right = new Float32Array(n)
  for (let i = 0; i < n; i++) {
    left[i] = stems.pad.left[i] + stems.pulse.left[i] + stems.events.left[i] + stems.lockup.left[i] + stems.reverb.left[i]
    right[i] = stems.pad.right[i] + stems.pulse.right[i] + stems.events.right[i] + stems.lockup.right[i] + stems.reverb.right[i]
  }
  const mastered = masterMix(left, right, {
    targetLufs: plan.lufs,
    fadeSamples: Math.round(plan.fadeSeconds * SAMPLE_RATE),
  })
  const round2 = (x: number) => (Number.isFinite(x) ? Math.round(x * 100) / 100 : x)
  return {
    wav: encodeWav(mastered.left, mastered.right, plan.seed),
    samples: n,
    report: {
      key: plan.keyName,
      chords: plan.sections.map((s) => s.chord.name),
      lufs: round2(mastered.lufs),
      truePeakDb: round2(mastered.truePeakDb),
      events: plan.events.map((e) => (e.note === null ? { kind: e.event.kind, t: e.t } : { kind: e.event.kind, t: e.t, note: e.note })),
      warnings: plan.warnings,
    },
  }
}
