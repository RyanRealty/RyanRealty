/**
 * lib/studio/score/plan.ts — the score on paper, before any sound is made.
 *
 * Takes the film's timeline (scene boundaries and events) and decides
 * everything musical that does not need a sample buffer: which key, which chord
 * in each scene and how it is voiced, when each pad chord attacks and releases,
 * where every pulse note falls, and which pitch every event plays. It also
 * cleans the input and says what it changed: an event past the end is dropped,
 * an event inside the closing fade is kept but flagged, overlapping scenes are
 * reported. Because it is pure and cheap, the tests read the plan directly to
 * hold rules like "the V chord is gone by the next downbeat + 80 ms" and "the
 * pulse stops 0.2 s before the lockup" without listening to anything.
 */
import {
  KEYS,
  PENTATONIC_STEPS,
  chooseProgression,
  datumBase,
  datumStep,
  noteAtOrAbove,
  notesInRange,
  noteName,
  voiceChord,
  type KeySpec,
  type PlannedChord,
} from './harmony'
import { rngFor } from './rng'
import { SAMPLE_RATE, type ScoreEvent, type ScoreInput, type ScoreMood } from './types'

/** Measured films: 100 BPM, so one beat is 0.6 s, 18 frames at 30 fps. */
export const PULSE_BPM = 100
export const PULSE_PERIOD = 60 / PULSE_BPM
/** A pulse note this close before the next scene start is dropped, so the downbeat lands clean. */
export const PULSE_CLEARANCE = 0.15
/** The pulse stops this long before the lockup. */
export const LOCKUP_GAP = 0.2
/** The first chord's attack: audible with intent from frame 0, never a slow swell-in. */
export const FIRST_ATTACK = 0.1
/** Chord changes crossfade over this long, starting on the scene start. */
export const CROSSFADE = 0.12
/** A V chord is fully released this long after the next scene start, at the latest. */
export const V_RELEASE_PAST_START = 0.08
/** The closing fade: min(1.0 s, 15% of the film), to exact zero. */
export function endFadeSeconds(duration: number): number {
  return Math.min(1.0, 0.15 * duration)
}
/** The last samples of every score are exactly zero. */
export const TAIL_ZERO_SAMPLES = 480
export const MIN_DURATION = 0.5
export const MAX_DURATION = 120
export const DEFAULT_LUFS = -14

export type PlannedSection = {
  index: number
  start: number
  /** The next scene's start, or the film's end. The chord holds until then. */
  end: number
  chord: PlannedChord
  /** The pad voices ramp up over [attackFrom, attackTo]. */
  attackFrom: number
  attackTo: number
  /** ...and down over [releaseFrom, releaseTo]. */
  releaseFrom: number
  releaseTo: number
}

export type PlannedEvent = {
  event: ScoreEvent
  /** Where the event sits in time (a swell's start). */
  t: number
  /** The pitch it plays, when it has one. */
  midi: number | null
  /** The pitch's name, for the report. */
  note: string | null
}

export type PulseNote = { t: number; section: number; slot: number; midi: number }

export type ScorePlan = {
  duration: number
  samples: number
  seed: string
  mood: ScoreMood
  lufs: number
  fadeSeconds: number
  key: KeySpec
  keyName: string
  sections: PlannedSection[]
  /** Clean events, in time order. */
  events: PlannedEvent[]
  lockupT: number | null
  swells: Array<{ start: number; end: number }>
  pulses: PulseNote[]
  /** Seeded character of this film's pad. */
  pad: { cutoffHz: number; detuneCents: [number, number]; pulseOffsetDb: number }
  warnings: string[]
}

const EVENT_KINDS: ReadonlySet<string> = new Set(['enter', 'land', 'datum', 'swell', 'lockup'])

function fmt(seconds: number): string {
  return `${seconds.toFixed(2)}s`
}

/** The index of the scene whose chord sounds at time t. */
export function sectionAt(sections: PlannedSection[], t: number): number {
  let index = 0
  for (let i = 0; i < sections.length; i++) if (sections[i].start <= t) index = i
  return index
}

/** The pulse's four-note figure through a chord: root, third, fifth, third, in octave 4 to 5. */
function pulsePitch(pcs: number[], slot: number): number {
  const root = noteAtOrAbove(pcs[0], 60)
  const third = noteAtOrAbove(pcs[1], root + 1)
  const fifth = noteAtOrAbove(pcs[2], third + 1)
  return [root, third, fifth, third][slot % 4]
}

export function planScore(input: ScoreInput): ScorePlan {
  const { duration, seed, mood } = input
  if (!Number.isFinite(duration) || duration < MIN_DURATION || duration > MAX_DURATION) {
    throw new RangeError(`score duration must be ${MIN_DURATION} to ${MAX_DURATION} seconds, got ${duration}`)
  }
  if (mood !== 'calm' && mood !== 'measured') throw new RangeError(`unknown score mood: ${String(mood)}`)
  const lufs = input.lufs ?? DEFAULT_LUFS
  if (!Number.isFinite(lufs) || lufs > -6 || lufs < -40) {
    throw new RangeError(`score loudness target must be -40 to -6 LUFS, got ${lufs}`)
  }
  const warnings: string[] = []
  const samples = Math.round(duration * SAMPLE_RATE)
  const fadeSeconds = endFadeSeconds(duration)
  const fadeStart = duration - fadeSeconds

  // Key and the pad's seeded character.
  const keyRand = rngFor(seed, 'key')
  const key = KEYS[Math.min(KEYS.length - 1, Math.floor(keyRand() * KEYS.length))]
  const characterRand = rngFor(seed, 'character')
  const pad = {
    cutoffHz: 900 + characterRand() * 500,
    detuneCents: [6 + characterRand() * 3, 6 + characterRand() * 3] as [number, number],
    pulseOffsetDb: (characterRand() - 0.5) * 3,
  }

  // Scenes: sorted, valid, one chord from each start to the next.
  const rawSections = input.sections
    .filter((s) => Number.isFinite(s.start) && Number.isFinite(s.end) && s.end > s.start && s.start < duration)
    .map((s, order) => ({ ...s, order }))
    .sort((a, b) => a.start - b.start || a.order - b.order)
  if (rawSections.length < input.sections.length) {
    warnings.push(`${input.sections.length - rawSections.length} section(s) ignored: not finite, empty, or starting past the end`)
  }
  const starts: number[] = []
  for (let i = 0; i < rawSections.length; i++) {
    const s = rawSections[i]
    if (i > 0 && s.start < rawSections[i - 1].end - 1e-6) {
      warnings.push(`sections overlap: one ends at ${fmt(rawSections[i - 1].end)} but the next starts at ${fmt(s.start)}`)
    }
    const previousStart = starts[starts.length - 1]
    if (previousStart !== undefined && s.start <= previousStart + 1e-6) {
      warnings.push(`section at ${fmt(s.start)} starts with the one before it and was merged into it`)
      continue
    }
    starts.push(s.start)
  }
  if (starts.length === 0) starts.push(0)
  if (starts[0] !== 0) {
    if (starts[0] > 0) warnings.push(`first section starts at ${fmt(starts[0])}, not 0: its chord is extended back to 0`)
    starts[0] = 0
  }

  // Events: validate, drop what cannot sound, flag what will be lost.
  const clean: ScoreEvent[] = []
  let lockup: Extract<ScoreEvent, { kind: 'lockup' }> | null = null
  for (const event of input.events) {
    if (!EVENT_KINDS.has(event.kind)) {
      warnings.push(`unknown event kind "${String((event as { kind: unknown }).kind)}" was dropped`)
      continue
    }
    const t = event.kind === 'swell' ? event.start : event.t
    if (!Number.isFinite(t) || (event.kind === 'swell' && !Number.isFinite(event.end))) {
      warnings.push(`${event.kind} event with a non-finite time was dropped`)
      continue
    }
    if (t < 0) {
      warnings.push(`${event.kind} at ${fmt(t)} is before the film starts: dropped`)
      continue
    }
    if (t >= duration) {
      warnings.push(`${event.kind} at ${fmt(t)} is past the film's end (${fmt(duration)}): dropped`)
      continue
    }
    if (event.kind === 'swell') {
      if (event.end <= event.start) {
        warnings.push(`swell [${fmt(event.start)}, ${fmt(event.end)}] is empty: dropped`)
        continue
      }
      clean.push({ kind: 'swell', start: event.start, end: Math.min(event.end, duration) })
      continue
    }
    if (event.kind === 'lockup') {
      if (lockup) {
        warnings.push(`lockup at ${fmt(t)} dropped: only the first lockup (${fmt(lockup.t)}) is scored`)
        continue
      }
      lockup = event
      if (t >= fadeStart) {
        warnings.push(`lockup at ${fmt(t)} starts inside the end fade (from ${fmt(fadeStart)}): the bell will be mostly lost`)
      }
      clean.push(event)
      continue
    }
    if (t >= fadeStart) {
      warnings.push(`${event.kind} at ${fmt(t)} falls inside the end fade (from ${fmt(fadeStart)}): it will be mostly lost`)
    }
    if (event.kind === 'datum' && !(Number.isFinite(event.value) && Number.isFinite(event.min) && Number.isFinite(event.max))) {
      warnings.push(`datum at ${fmt(t)} has a non-finite value or range: it plays mid-scale`)
    }
    clean.push(event)
  }
  // Stable by time: the same input in a different order is the same film.
  const ordered = clean
    .map((event, order) => ({ event, order, t: event.kind === 'swell' ? event.start : event.t }))
    .sort((a, b) => a.t - b.t || a.order - b.order)
  const lockupT = lockup ? lockup.t : null

  // Harmony: one chord per scene, voice-led, resolving on the lockup's scene.
  let lockupIndex: number | null = null
  if (lockupT !== null) {
    lockupIndex = 0
    for (let i = 0; i < starts.length; i++) if (starts[i] <= lockupT) lockupIndex = i
  }
  const picks = chooseProgression(mood, starts.length, lockupIndex, key)
  const voicingRand = rngFor(seed, 'voicing')
  const sections: PlannedSection[] = []
  let previousVoicing: number[] | null = null
  for (let i = 0; i < picks.length; i++) {
    const pick = picks[i]
    // The resolving tonic wants root position; a V chord is a passing colour.
    const rootBias = i === lockupIndex ? 20 : 0
    const voicing = voiceChord(pick.pcs, previousVoicing, voicingRand, rootBias)
    previousVoicing = voicing
    const start = starts[i]
    const end = i + 1 < starts.length ? starts[i + 1] : duration
    const isV = pick.degree === 'V'
    sections.push({
      index: i,
      start,
      end,
      chord: { ...pick, voicing },
      attackFrom: start,
      attackTo: start + (i === 0 ? FIRST_ATTACK : CROSSFADE),
      // A dominant must be gone by the downbeat it resolves into: its release
      // starts a hair early and ends V_RELEASE_PAST_START after the next start.
      releaseFrom: isV && i + 1 < starts.length ? end - 0.04 : end,
      releaseTo: i + 1 < starts.length ? end + (isV ? V_RELEASE_PAST_START : CROSSFADE) : duration,
    })
  }

  // Pitches for the events.
  const enterRand = rngFor(seed, 'enter')
  const landRand = rngFor(seed, 'land')
  let lastEnter = 67
  const events: PlannedEvent[] = ordered.map(({ event, t }) => {
    const chord = sections[sectionAt(sections, t)].chord
    let midi: number | null = null
    if (event.kind === 'enter') {
      // A chord tone in octave 4 to 5, near the last one so a run of cards sings a line, never the same note twice.
      const candidates: number[] = []
      for (const pc of chord.pcs) for (const m of notesInRange(pc, 62, 79)) if (m !== lastEnter) candidates.push(m)
      const weights = candidates.map((m) => 1 / (1 + Math.abs(m - lastEnter) / 3))
      let pick = enterRand() * weights.reduce((a, b) => a + b, 0)
      midi = candidates[candidates.length - 1]
      for (let i = 0; i < candidates.length; i++) {
        pick -= weights[i]
        if (pick <= 0) {
          midi = candidates[i]
          break
        }
      }
      lastEnter = midi
    } else if (event.kind === 'land') {
      // Octave 6, 1.05 to 1.57 kHz, on a chord tone (the octave-7 ear resonance reads as a beep).
      const candidates: number[] = []
      for (const pc of chord.pcs) for (const m of notesInRange(pc, 84, 91)) candidates.push(m)
      if (candidates.length === 0) candidates.push(noteAtOrAbove(chord.pcs[0], 84))
      candidates.sort((a, b) => a - b)
      midi = candidates[Math.floor(landRand() * candidates.length)]
    } else if (event.kind === 'datum') {
      midi = datumBase(key) + PENTATONIC_STEPS[datumStep(event.value, event.min, event.max)]
    } else if (event.kind === 'lockup') {
      midi = noteAtOrAbove(key.tonic, 72)
    }
    return { event, t, midi, note: midi === null ? null : noteName(midi, key.flats) }
  })

  // The measured pulse: phase reset at every scene start so a scene change is a downbeat.
  const pulses: PulseNote[] = []
  if (mood === 'measured') {
    for (const section of sections) {
      for (let k = 0; ; k++) {
        const t = section.start + k * PULSE_PERIOD
        if (t >= section.end - 1e-9) break
        const hasNext = section.index + 1 < sections.length
        if (hasNext && section.end - t < PULSE_CLEARANCE) continue
        if (lockupT !== null && t >= lockupT - LOCKUP_GAP) continue
        if (t >= fadeStart) continue
        pulses.push({ t, section: section.index, slot: k, midi: pulsePitch(section.chord.pcs, k) })
      }
    }
  }

  return {
    duration,
    samples,
    seed,
    mood,
    lufs,
    fadeSeconds,
    key,
    keyName: `${key.name} major`,
    sections,
    events,
    lockupT,
    swells: events.flatMap((e) => (e.event.kind === 'swell' ? [{ start: e.event.start, end: e.event.end }] : [])),
    pulses,
    pad,
    warnings,
  }
}
