import { describe, expect, it } from 'vitest'
import { integratedLoudness, truePeakDb } from './loudness'
import { SAMPLE_RATE } from './types'

function sine(seconds: number, hz: number, amplitude: number, phase = 0): Float32Array {
  const n = Math.round(seconds * SAMPLE_RATE)
  const out = new Float32Array(n)
  for (let i = 0; i < n; i++) out[i] = amplitude * Math.sin(2 * Math.PI * hz * (i / SAMPLE_RATE) + phase)
  return out
}

describe('integratedLoudness (BS.1770-4)', () => {
  it('reads a full-scale 997 Hz sine in the left channel only as -3.01 LUFS, the standard\'s own calibration', () => {
    const left = sine(10, 997, 1.0)
    const right = new Float32Array(left.length)
    expect(integratedLoudness(left, right)).toBeCloseTo(-3.01, 1)
    expect(Math.abs(integratedLoudness(left, right) - -3.01)).toBeLessThan(0.05)
  })

  it('reads the same sine in both channels as 0 LUFS (twice the power, +3.01 LU)', () => {
    const left = sine(10, 997, 1.0)
    const right = sine(10, 997, 1.0)
    expect(Math.abs(integratedLoudness(left, right))).toBeLessThan(0.1)
  })

  it('reads a -20 dBFS left-only 997 Hz sine as -23.01 LUFS', () => {
    const left = sine(10, 997, 0.1)
    const right = new Float32Array(left.length)
    expect(Math.abs(integratedLoudness(left, right) - -23.01)).toBeLessThan(0.05)
  })

  it('reads silence as -Infinity', () => {
    const silent = new Float32Array(SAMPLE_RATE * 3)
    expect(integratedLoudness(silent, silent)).toBe(-Infinity)
    expect(integratedLoudness(new Float32Array(0), new Float32Array(0))).toBe(-Infinity)
  })

  it('gates out a quiet passage: a loud second plus a very quiet 9 s reads as the loud part', () => {
    // The relative gate sits 10 LU under the average of what passed the absolute gate.
    const loud = sine(4, 997, 0.5)
    const quiet = sine(8, 997, 0.5 * Math.pow(10, -30 / 20))
    const left = new Float32Array(loud.length + quiet.length)
    left.set(loud, 0)
    left.set(quiet, loud.length)
    const reference = integratedLoudness(loud, loud)
    const gated = integratedLoudness(left, left)
    expect(Math.abs(gated - reference)).toBeLessThan(0.3)
  })

  it('does not hear a signal below the -70 LUFS absolute gate', () => {
    const faint = sine(5, 997, Math.pow(10, -85 / 20))
    expect(integratedLoudness(faint, faint)).toBe(-Infinity)
  })
})

describe('truePeakDb', () => {
  it('reads a 0.5 amplitude sine as -6.02 dBTP', () => {
    const x = sine(1, 997, 0.5)
    expect(Math.abs(truePeakDb(x, x) - -6.02)).toBeLessThan(0.1)
  })

  it('finds the intersample peak a sample-peak meter misses: fs/4 at 45 degrees', () => {
    // Samples are +-0.7071 (sample peak -3.01 dB) but the waveform between them reaches 1.0.
    const x = sine(0.5, SAMPLE_RATE / 4, 1.0, Math.PI / 4)
    let samplePeak = 0
    for (const v of x) samplePeak = Math.max(samplePeak, Math.abs(v))
    expect(20 * Math.log10(samplePeak)).toBeCloseTo(-3.01, 1)
    expect(Math.abs(truePeakDb(x, x))).toBeLessThan(0.5)
  })

  it('reads the louder channel', () => {
    const quiet = sine(0.5, 997, 0.1)
    const loud = sine(0.5, 997, 0.8)
    expect(Math.abs(truePeakDb(quiet, loud) - 20 * Math.log10(0.8))).toBeLessThan(0.1)
  })

  it('reads silence as -Infinity', () => {
    const silent = new Float32Array(1000)
    expect(truePeakDb(silent, silent)).toBe(-Infinity)
  })
})
