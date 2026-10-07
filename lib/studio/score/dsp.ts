/**
 * lib/studio/score/dsp.ts — the small signal-processing parts every voice shares.
 *
 * Plain functions over typed arrays: decibel maths, a constant-power pan law,
 * RBJ biquads, and the PolyBLEP correction that keeps a saw band-limited (so
 * the pad does not alias into a harsh fizz). Filter state is held in doubles
 * even when the buffer is Float32, so a long note does not accumulate rounding.
 */
import { SAMPLE_RATE } from './types'

export const TWO_PI = Math.PI * 2

export function clamp(x: number, lo: number, hi: number): number {
  return x < lo ? lo : x > hi ? hi : x
}

export function dbToGain(db: number): number {
  return Math.pow(10, db / 20)
}

export function gainToDb(gain: number): number {
  return 20 * Math.log10(gain)
}

/** 0 to 1 with zero slope at both ends, clamped outside. */
export function smoothstep(x: number): number {
  const u = clamp(x, 0, 1)
  return u * u * (3 - 2 * u)
}

/** Equal-tempered pitch, A4 = 440 Hz. */
export function midiToHz(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12)
}

/** Constant-power pan: -1 hard left, 0 centre, +1 hard right. Returns [left, right] gains. */
export function panGains(pan: number): [number, number] {
  const angle = ((clamp(pan, -1, 1) + 1) * Math.PI) / 4
  return [Math.cos(angle), Math.sin(angle)]
}

export type Biquad = { b0: number; b1: number; b2: number; a1: number; a2: number }

/** RBJ low-pass. Cutoff is held under 0.45 of the sample rate so a wild automation value cannot go unstable. */
export function lowpass(fc: number, q: number = Math.SQRT1_2, fs: number = SAMPLE_RATE): Biquad {
  const w = (TWO_PI * Math.min(fc, fs * 0.45)) / fs
  const cos = Math.cos(w)
  const alpha = Math.sin(w) / (2 * q)
  const a0 = 1 + alpha
  return {
    b0: (1 - cos) / 2 / a0,
    b1: (1 - cos) / a0,
    b2: (1 - cos) / 2 / a0,
    a1: (-2 * cos) / a0,
    a2: (1 - alpha) / a0,
  }
}

/** RBJ high-pass. */
export function highpass(fc: number, q: number = Math.SQRT1_2, fs: number = SAMPLE_RATE): Biquad {
  const w = (TWO_PI * Math.min(fc, fs * 0.45)) / fs
  const cos = Math.cos(w)
  const alpha = Math.sin(w) / (2 * q)
  const a0 = 1 + alpha
  return {
    b0: (1 + cos) / 2 / a0,
    b1: -(1 + cos) / a0,
    b2: (1 + cos) / 2 / a0,
    a1: (-2 * cos) / a0,
    a2: (1 - alpha) / a0,
  }
}

/** Run a biquad over a buffer in place (transposed direct form II). */
export function filterInPlace(buf: Float32Array | Float64Array, c: Biquad): void {
  let z1 = 0
  let z2 = 0
  const { b0, b1, b2, a1, a2 } = c
  for (let i = 0; i < buf.length; i++) {
    const x = buf[i]
    const y = b0 * x + z1
    z1 = b1 * x - a1 * y + z2
    z2 = b2 * x - a2 * y
    buf[i] = y
  }
}

/** A biquad whose coefficients the caller may swap between samples (the pad's automated low-pass). */
export class BiquadRunner {
  private z1 = 0
  private z2 = 0
  process(x: number, c: Biquad): number {
    const y = c.b0 * x + this.z1
    this.z1 = c.b1 * x - c.a1 * y + this.z2
    this.z2 = c.b2 * x - c.a2 * y
    return y
  }
}

/**
 * PolyBLEP residual for a naive saw at phase `t` in [0, 1) advancing `dt` per
 * sample: subtract it from the naive saw and the discontinuity is smoothed
 * across two samples, which removes nearly all of the aliasing.
 */
export function polyBlep(t: number, dt: number): number {
  if (t < dt) {
    const x = t / dt
    return x + x - x * x - 1
  }
  if (t > 1 - dt) {
    const x = (t - 1) / dt
    return x * x + x + x + 1
  }
  return 0
}
