/**
 * lib/studio/score/pad.ts — the warm bed under everything.
 *
 * Each chord tone is three slightly detuned band-limited saws (the slow beating
 * between them is the pad's chorus), panned across the field. The chord's notes
 * are summed and pushed through one low-pass at 0.9 to 1.4 kHz, so what is left
 * is the soft body of the saw and none of its buzz. That low-pass is the pad's
 * one automated control, and three things move it:
 *
 *  - the start of the film: the level is up in 100 ms (frame 0 carries a chord
 *    with intent, never a slow swell-in), but the filter opens over the first
 *    0.45 s, so the brightness blooms while the sound is already there;
 *  - a `swell` event: the filter opens an octave and the level rises 4 dB across
 *    the span, then settles back over 0.8 s (a map outline drawing on);
 *  - the lockup: from 0.2 s before the bell the upper voices drop away and the
 *    filter closes a little, so the bell lands in air and the pad is thin
 *    after it.
 *
 * Chords change on scene starts as an equal-power crossfade. A voice's phase is
 * a function of absolute time and its pitch, so a note two chords share
 * crossfades into itself without a dip.
 */
import {
  BiquadRunner,
  dbToGain,
  lowpass,
  midiToHz,
  panGains,
  polyBlep,
  smoothstep,
} from './dsp'
import type { ScorePlan } from './plan'
import { fnv1a } from './rng'
import { SAMPLE_RATE } from './types'
import type { StereoBuf } from './voices'

/** How much of the pad goes to the reverb. Moderate: the pad is already a wash. */
export const PAD_SEND = 0.3
/** Level of each stacked voice, bottom up. The bass notes carry; the top ones colour. */
const ROLE_GAIN = [1.0, 0.9, 0.8, 0.65, 0.55]
const VOICE_AMPLITUDE = 0.1
const PAD_Q = 0.6
const SLOT_PANS = [-0.55, 0, 0.55]
/** Control rate of the filter automation, in samples. */
const BLOCK = 32

/** The swell curve at time t, 0 to 1: up across the span, held, back down over 0.8 s. Overlaps take the larger. */
export function swellAmount(swells: Array<{ start: number; end: number }>, t: number): number {
  let amount = 0
  for (const swell of swells) {
    let s = 0
    if (t >= swell.start) {
      s = t <= swell.end ? smoothstep((t - swell.start) / (swell.end - swell.start)) : 1 - smoothstep((t - swell.end) / 0.8)
    }
    if (s > amount) amount = s
  }
  return amount
}

/** How far into its resolution the pad is at time t, 0 to 1: begins 0.2 s before the lockup, done 0.3 s after. */
export function thinAmount(lockupT: number | null, t: number): number {
  return lockupT === null ? 0 : smoothstep((t - (lockupT - 0.2)) / 0.5)
}

export function renderPad(plan: ScorePlan): { bus: StereoBuf; send: Float32Array } {
  const n = plan.samples
  const sumL = new Float32Array(n)
  const sumR = new Float32Array(n)
  const [detuneA, detuneB] = plan.pad.detuneCents
  const detunes = [-detuneA, 0, detuneB]
  const lockupT = plan.lockupT

  for (const section of plan.sections) {
    const from = Math.max(0, Math.round(section.attackFrom * SAMPLE_RATE))
    const to = Math.min(n, Math.round(section.releaseTo * SAMPLE_RATE))
    const attackSpan = section.attackTo - section.attackFrom
    const releaseSpan = section.releaseTo - section.releaseFrom
    const notes = section.chord.voicing
    for (let v = 0; v < notes.length; v++) {
      const role = ROLE_GAIN[Math.min(v, ROLE_GAIN.length - 1)] * VOICE_AMPLITUDE
      const thins = v >= 2
      for (let slot = 0; slot < 3; slot++) {
        const f = midiToHz(notes[v]) * Math.pow(2, detunes[slot] / 1200)
        const dt = f / SAMPLE_RATE
        // Phase is a function of absolute time and pitch, so a shared note stays coherent across a crossfade.
        const offset = fnv1a(`${plan.seed}|${notes[v]}|${slot}`) / 4294967296
        const raw = f * (from / SAMPLE_RATE) + offset
        let phase = raw - Math.floor(raw)
        const [gl, gr] = panGains(SLOT_PANS[slot] + (v - (notes.length - 1) / 2) * 0.05)
        for (let i = from; i < to; i++) {
          const t = i / SAMPLE_RATE
          let env = role
          if (t < section.attackTo) env *= Math.sin((Math.PI / 2) * ((t - section.attackFrom) / attackSpan))
          if (t > section.releaseFrom) env *= Math.cos((Math.PI / 2) * Math.min(1, (t - section.releaseFrom) / releaseSpan))
          if (thins && lockupT !== null) env *= 1 - 0.65 * thinAmount(lockupT, t)
          const sample = (2 * phase - 1 - polyBlep(phase, dt)) * env
          sumL[i] += sample * gl
          sumR[i] += sample * gr
          phase += dt
          if (phase >= 1) phase -= 1
        }
      }
    }
  }

  // The automated low-pass, and the level that rides with it.
  const filterL = new BiquadRunner()
  const filterR = new BiquadRunner()
  const send = new Float32Array(n)
  let gainNow = 1
  for (let block = 0; block < n; block += BLOCK) {
    const t = block / SAMPLE_RATE
    const swell = swellAmount(plan.swells, t)
    const thin = thinAmount(lockupT, t)
    const opening = 0.6 + 0.4 * smoothstep(t / 0.45)
    const cutoff = plan.pad.cutoffHz * opening * (1 + swell) * (1 - 0.25 * thin)
    // The ending subtracts: the pad settles about 5 dB under itself as the mark resolves.
    const gainNext = dbToGain(4 * swell) * (1 - 0.45 * thin)
    const coefs = lowpass(cutoff, PAD_Q)
    const end = Math.min(n, block + BLOCK)
    for (let i = block; i < end; i++) {
      const g = gainNow + ((gainNext - gainNow) * (i - block)) / BLOCK
      const l = filterL.process(sumL[i], coefs) * g
      const r = filterR.process(sumR[i], coefs) * g
      sumL[i] = l
      sumR[i] = r
      send[i] = (l + r) * 0.5 * PAD_SEND
    }
    gainNow = gainNext
  }
  return { bus: { left: sumL, right: sumR }, send }
}
