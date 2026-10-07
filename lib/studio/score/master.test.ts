import { describe, expect, it } from 'vitest'
import { LIMITER_CEILING, limiterGains, masterMix } from './master'
import { integratedLoudness, oversampledPeakEnvelope, truePeakDb } from './loudness'
import { mulberry32 } from './rng'
import { SAMPLE_RATE } from './types'

/** Smooth, music-ish noise: white noise through a one-pole low-pass, at a given RMS. */
function noise(seconds: number, seed: number, rms: number): Float32Array {
  const rand = mulberry32(seed)
  const out = new Float32Array(Math.round(seconds * SAMPLE_RATE))
  let state = 0
  for (let i = 0; i < out.length; i++) {
    state += 0.08 * ((rand() * 2 - 1) - state)
    out[i] = state
  }
  let sum = 0
  for (const v of out) sum += v * v
  const scale = rms / Math.sqrt(sum / out.length)
  for (let i = 0; i < out.length; i++) out[i] *= scale
  return out
}

function tone(seconds: number, hz: number, amplitude: number, phase = 0): Float32Array {
  const out = new Float32Array(Math.round(seconds * SAMPLE_RATE))
  for (let i = 0; i < out.length; i++) out[i] = amplitude * Math.sin(2 * Math.PI * hz * (i / SAMPLE_RATE) + phase)
  return out
}

/** Magnitude of one frequency in a window (Goertzel). */
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

describe('limiterGains', () => {
  it('leaves a quiet signal alone', () => {
    const env = new Float32Array(48000).fill(0.2)
    const gains = limiterGains(env, 1)
    expect(Math.min(...gains)).toBe(1)
  })

  it('never lets a peak through the ceiling, and starts coming down before the peak (lookahead)', () => {
    const n = SAMPLE_RATE
    const env = new Float32Array(n).fill(0.1)
    const spike = 20000
    env[spike] = 2.0
    const gains = limiterGains(env, 1)
    for (let i = 0; i < n; i++) expect(env[i] * gains[i]).toBeLessThanOrEqual(LIMITER_CEILING + 1e-6)
    expect(gains[spike]).toBeLessThanOrEqual(LIMITER_CEILING / 2 + 1e-6)
    // 4 ms is 192 samples of lookahead: the gain is already falling 150 samples ahead, and was untouched 400 ahead.
    expect(gains[spike - 150]).toBeLessThan(1)
    expect(gains[spike - 400]).toBe(1)
    // Release: back to unity by about a third of a second, and it never dips again after the peak.
    for (let i = spike + 1; i < n; i++) expect(gains[i]).toBeGreaterThanOrEqual(gains[i - 1] - 1e-6)
    expect(gains[spike + Math.round(0.4 * SAMPLE_RATE)]).toBeGreaterThan(0.98)
    expect(gains[spike + Math.round(0.02 * SAMPLE_RATE)]).toBeLessThan(0.9)
  })

  it('limits an intersample peak a sample-peak limiter would wave through', () => {
    // fs/4 at 45 degrees: every sample is +-0.76 (under the 0.77 ceiling) but the waveform between them reaches 1.075.
    const x = tone(0.3, SAMPLE_RATE / 4, 1.075, Math.PI / 4)
    let samplePeak = 0
    for (const v of x) samplePeak = Math.max(samplePeak, Math.abs(v))
    expect(samplePeak).toBeLessThan(LIMITER_CEILING)
    expect(truePeakDb(x, x)).toBeGreaterThan(20 * Math.log10(LIMITER_CEILING))
    const env = oversampledPeakEnvelope(x, x)
    const gains = limiterGains(env, 1)
    const limited = x.map((v, i) => v * gains[i])
    expect(truePeakDb(limited, limited)).toBeLessThanOrEqual(20 * Math.log10(LIMITER_CEILING) + 0.1)
  })
})

describe('masterMix', () => {
  it('brings quiet and hot mixes alike to -14 LUFS, under the ceiling', () => {
    for (const [rms, seed] of [[0.005, 1], [0.05, 2], [0.4, 3]] as const) {
      const left = noise(8, seed, rms)
      const right = noise(8, seed + 100, rms)
      const result = masterMix(left, right, { targetLufs: -14, fadeSamples: 4800 })
      expect(Math.abs(result.lufs - -14)).toBeLessThan(0.1)
      expect(result.truePeakDb).toBeLessThanOrEqual(-2.2)
      expect(result.passes).toBeLessThanOrEqual(6)
    }
  })

  it('keeps the true peak under the ceiling even when the target cannot be reached without it', () => {
    // Sparse loud clicks over a quiet bed: crest factor far past what -14 LUFS allows under -2.3 dBFS.
    const left = noise(8, 7, 0.01)
    const right = noise(8, 8, 0.01)
    for (let i = 0; i < 8; i++) {
      left[Math.round((i + 0.5) * SAMPLE_RATE)] += 0.9
      right[Math.round((i + 0.5) * SAMPLE_RATE)] -= 0.9
    }
    const result = masterMix(left, right, { targetLufs: -14, fadeSamples: 4800 })
    expect(result.truePeakDb).toBeLessThanOrEqual(-2.2)
    expect(result.passes).toBeLessThanOrEqual(6)
    expect(result.limiterMaxReductionDb).toBeGreaterThan(0)
  })

  it('starts from exact zero over 3 ms even when the mix is already loud on sample 0, and ends on 480 zeros', () => {
    const left = tone(3, 440, 0.5, Math.PI / 2) // a cosine: full level at sample 0
    const right = tone(3, 440, 0.5, Math.PI / 2)
    expect(left[0]).toBeGreaterThan(0.4)
    const result = masterMix(left, right, { targetLufs: -14, fadeSamples: 24000 })
    expect(result.left[0]).toBe(0)
    expect(result.right[0]).toBe(0)
    let peak = 0
    for (let i = 4800; i < 9600; i++) peak = Math.max(peak, Math.abs(result.left[i]))
    // Halfway through the 144-sample fade the cosine is about half level or less, and it is at full level after 3 ms.
    expect(Math.abs(result.left[72])).toBeLessThan(peak * 0.6)
    expect(Math.abs(result.left[3])).toBeLessThan(peak * 0.05)
    for (let i = result.left.length - 480; i < result.left.length; i++) {
      expect(result.left[i]).toBe(0)
      expect(result.right[i]).toBe(0)
    }
  })

  it('fades the last stretch to nothing before the zeros, and counts the fade in the loudness it reports', () => {
    const left = tone(4, 330, 0.3)
    const right = tone(4, 330, 0.3)
    const result = masterMix(left, right, { targetLufs: -14, fadeSamples: 48000 })
    const n = result.left.length
    expect(Math.abs(result.left[n - 480 - 1])).toBeLessThan(1e-3)
    expect(Math.abs(integratedLoudness(result.left, result.right) - result.lufs)).toBeLessThan(1e-9)
    // The fade is a quarter of the film, so the loudness is below what the sustained part alone would read.
    const sustained = result.left.slice(0, n - 48000)
    expect(integratedLoudness(sustained, sustained)).toBeGreaterThan(result.lufs - 0.01)
  })

  it('makes the low end mono: an antiphase 50 Hz is cut hard, an in-phase one is kept', () => {
    const body = tone(6, 2000, 0.1)
    const lowOut = tone(6, 50, 0.3)
    const left = body.map((v, i) => v + lowOut[i])
    const right = body.map((v, i) => v - lowOut[i])
    const mid = (l: Float32Array, r: Float32Array) => l.map((v, i) => (v + r[i]) / 2)
    const side = (l: Float32Array, r: Float32Array) => l.map((v, i) => (v - r[i]) / 2)
    const from = SAMPLE_RATE
    const to = 4 * SAMPLE_RATE
    // masterMix works in place on the buffers it is given, so measure the input first.
    const sideBefore = magnitude(side(left, right), from, to, 50) / magnitude(mid(left, right), from, to, 2000)
    const outOfPhase = masterMix(left, right, { targetLufs: -14, fadeSamples: 4800 })
    const sideAfter = magnitude(side(outOfPhase.left, outOfPhase.right), from, to, 50) / magnitude(mid(outOfPhase.left, outOfPhase.right), from, to, 2000)
    // A 4th-order high-pass on the side: 50 Hz is well over an octave under the 120 Hz corner, about 30 dB down.
    expect(20 * Math.log10(sideAfter / sideBefore)).toBeLessThan(-20)

    const inPhase = masterMix(body.map((v, i) => v + lowOut[i]), body.map((v, i) => v + lowOut[i]), { targetLufs: -14, fadeSamples: 4800 })
    const kept = magnitude(inPhase.left, from, to, 50) / magnitude(inPhase.left, from, to, 2000)
    expect(kept).toBeGreaterThan(1.5) // 0.3 / 0.1 = 3 going in; the 28 Hz rumble filter barely touches 50 Hz
  })

  it('survives silence: nothing to measure, nothing to scale, still a clean file', () => {
    const left = new Float32Array(SAMPLE_RATE)
    const right = new Float32Array(SAMPLE_RATE)
    const result = masterMix(left, right, { targetLufs: -14, fadeSamples: 4800 })
    expect(result.lufs).toBe(-Infinity)
    expect(result.truePeakDb).toBe(-Infinity)
    expect(result.left.every((v) => v === 0)).toBe(true)
  })
})
