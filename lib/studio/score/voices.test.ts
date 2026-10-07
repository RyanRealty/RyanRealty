import { describe, expect, it } from 'vitest'
import { midiToHz } from './dsp'
import { renderScoreStems } from './compose'
import { SAMPLE_RATE, type ScoreEvent, type ScoreInput } from './index'

/** Magnitude of one frequency in a window of a mono signal (Goertzel). */
function magnitude(x: Float32Array, from: number, to: number, hz: number): number {
  const w = (2 * Math.PI * hz) / SAMPLE_RATE
  const coeff = 2 * Math.cos(w)
  let s1 = 0
  let s2 = 0
  for (let i = from; i < to; i++) {
    const s0 = x[i] + coeff * s1 - s2
    s2 = s1
    s1 = s0
  }
  return Math.sqrt(s1 * s1 + s2 * s2 - coeff * s1 * s2) / (to - from)
}

function mono(buf: { left: Float32Array; right: Float32Array }): Float32Array {
  return buf.left.map((v, i) => v + buf.right[i])
}

/** How far (dB) the energy at `midi` stands above the larger of the two semitones beside it. */
function standout(x: Float32Array, fromSec: number, toSec: number, midi: number): number {
  const from = Math.round(fromSec * SAMPLE_RATE)
  const to = Math.round(toSec * SAMPLE_RATE)
  const at = magnitude(x, from, to, midiToHz(midi))
  const beside = Math.max(magnitude(x, from, to, midiToHz(midi - 1)), magnitude(x, from, to, midiToHz(midi + 1)))
  return 20 * Math.log10(at / beside)
}

const calm = (events: ScoreEvent[], duration = 8): ScoreInput => ({ duration, seed: 'tune', mood: 'calm', sections: [], events })

describe('the notes are in tune', () => {
  it('a felt note sounds the pitch the plan names', () => {
    const input = calm([
      { kind: 'enter', t: 1, weight: 1 },
      { kind: 'enter', t: 3, weight: 1 },
      { kind: 'enter', t: 5, weight: 1 },
    ])
    const stems = renderScoreStems(input)
    const events = mono(stems.events)
    for (const planned of stems.plan.events) {
      expect(standout(events, planned.t, planned.t + 0.6, planned.midi as number)).toBeGreaterThan(15)
    }
  })

  it('a datum note sounds the pentatonic pitch for its value, so a rising line is heard rising', () => {
    const values = [5, 30, 55, 80, 100]
    const input = calm(values.map((value, i) => ({ kind: 'datum', t: 1 + i * 1.2, value, min: 0, max: 100, weight: 1 }) as ScoreEvent))
    const stems = renderScoreStems(input)
    const events = mono(stems.events)
    const pitches = stems.plan.events.map((e) => e.midi as number)
    for (let i = 0; i < values.length; i++) {
      expect(standout(events, stems.plan.events[i].t, stems.plan.events[i].t + 0.4, pitches[i])).toBeGreaterThan(15)
      if (i > 0) expect(pitches[i]).toBeGreaterThan(pitches[i - 1])
    }
  })

  it('a land tick rings its fundamental in octave 6', () => {
    const stems = renderScoreStems(calm([{ kind: 'land', t: 2, weight: 1.6 }]))
    const planned = stems.plan.events[0]
    expect(planned.midi).toBeGreaterThanOrEqual(84)
    // The tick is 60 ms of energy: its fundamental stands out of the semitones beside it, as a pitched sound should.
    expect(standout(mono(stems.events), 2, 2.06, planned.midi as number)).toBeGreaterThan(3)
  })

  it('the lockup bell rings the tonic in octave 5, and the dyad underneath is the tonic and fifth', () => {
    const stems = renderScoreStems(calm([{ kind: 'lockup', t: 3 }]))
    const planned = stems.plan.events[0]
    const lockup = mono(stems.lockup)
    const tonic = planned.midi as number
    expect(tonic % 12).toBe(stems.plan.key.tonic)
    expect(tonic).toBeGreaterThanOrEqual(72)
    expect(tonic).toBeLessThanOrEqual(83)
    expect(standout(lockup, 3.02, 4.2, tonic)).toBeGreaterThan(6)
    // Low dyad: tonic in octave 2 to 3 and the fifth above it.
    let low = 36 + stems.plan.key.tonic
    if (low < 45) low += 12
    expect(low).toBeGreaterThanOrEqual(45)
    expect(low).toBeLessThanOrEqual(56)
    expect(standout(lockup, 3.1, 4.5, low)).toBeGreaterThan(10)
    expect(standout(lockup, 3.1, 4.5, low + 7)).toBeGreaterThan(10)
  })

  it('the pad sounds the chord it was voiced as', () => {
    const stems = renderScoreStems(calm([], 6))
    const pad = mono(stems.pad)
    const voicing = stems.plan.sections[0].chord.voicing
    // The bass note stands clear of its neighbours; every chord tone has real energy.
    expect(standout(pad, 1, 2.5, voicing[0])).toBeGreaterThan(6)
    for (const midi of voicing) {
      const at = magnitude(pad, Math.round(1 * SAMPLE_RATE), Math.round(2.5 * SAMPLE_RATE), midiToHz(midi))
      const off = magnitude(pad, Math.round(1 * SAMPLE_RATE), Math.round(2.5 * SAMPLE_RATE), midiToHz(midi + 0.5))
      expect(at).toBeGreaterThan(off * 1.5)
    }
  })

  it('a chord change is a crossfade, not a click: no jump in the pad at a scene start', () => {
    const input: ScoreInput = { duration: 8, seed: 'xfade', mood: 'calm', sections: [{ start: 0, end: 4 }, { start: 4, end: 8 }], events: [] }
    const stems = renderScoreStems(input)
    const x = stems.pad.left
    const around = Math.round(4 * SAMPLE_RATE)
    let jump = 0
    let steady = 0
    for (let i = around - 200; i < around + 6000; i++) jump = Math.max(jump, Math.abs(x[i + 1] - x[i]))
    for (let i = Math.round(2 * SAMPLE_RATE); i < Math.round(2 * SAMPLE_RATE) + 6000; i++) steady = Math.max(steady, Math.abs(x[i + 1] - x[i]))
    expect(jump).toBeLessThan(steady * 2)
  })
})
