/**
 * lib/studio/score/loudness.ts — what a listener (and a platform) will measure.
 *
 * Social players normalise a film to about -14 LUFS and an encoder adds a
 * fraction of a dB of peak on top, so the score is mastered to a measured
 * loudness and a measured true peak, not to a hopeful gain. This is the meter:
 * ITU-R BS.1770-4 integrated loudness (K-weighting, 400 ms blocks at 75%
 * overlap, absolute gate -70 LUFS, relative gate -10 LU) and a true-peak
 * detector (4x oversampling). loudness.test.ts holds it to the standard's own
 * calibration (a full-scale 997 Hz sine in one channel reads -3.01 LUFS) and to
 * ffmpeg's ebur128 on a real render.
 */
import { SAMPLE_RATE } from './types'

/** BS.1770-4 stage 1, the "pre-filter" high shelf, published coefficients at 48 kHz. */
const SHELF_B = [1.53512485958697, -2.69169618940638, 1.19839281085285]
const SHELF_A = [1.0, -1.69065929318241, 0.73248077421585]
/** BS.1770-4 stage 2, the RLB high-pass, published coefficients at 48 kHz. */
const RLB_B = [1.0, -2.0, 1.0]
const RLB_A = [1.0, -1.99004745483398, 0.99007225036621]

/** One block is 400 ms; blocks start every 100 ms (75% overlap). */
const BLOCK = Math.round(0.4 * SAMPLE_RATE)
const HOP = Math.round(0.1 * SAMPLE_RATE)
const ABSOLUTE_GATE = -70
const RELATIVE_GATE = -10

/**
 * Sum, per 100 ms hop, of the squared K-weighted samples of both channels.
 * A 400 ms block is then four consecutive hops, so every block's mean square
 * costs four additions instead of 19,200.
 */
function hopEnergies(left: Float32Array, right: Float32Array): Float64Array {
  const n = Math.min(left.length, right.length)
  const hops = Math.ceil(n / HOP)
  const energy = new Float64Array(hops)
  for (const channel of [left, right]) {
    let s1z1 = 0
    let s1z2 = 0
    let s2z1 = 0
    let s2z2 = 0
    for (let i = 0; i < n; i++) {
      const x = channel[i]
      const y1 = SHELF_B[0] * x + s1z1
      s1z1 = SHELF_B[1] * x - SHELF_A[1] * y1 + s1z2
      s1z2 = SHELF_B[2] * x - SHELF_A[2] * y1
      const y2 = RLB_B[0] * y1 + s2z1
      s2z1 = RLB_B[1] * y1 - RLB_A[1] * y2 + s2z2
      s2z2 = RLB_B[2] * y1 - RLB_A[2] * y2
      energy[(i / HOP) | 0] += y2 * y2
    }
  }
  return energy
}

/**
 * BS.1770-4 integrated loudness (LUFS) of stereo float samples at SAMPLE_RATE.
 * K-weighting, 400 ms blocks at 75% overlap, absolute gate -70 LUFS, relative
 * gate -10 LU. Returns -Infinity for silence. Shorter than one block, the whole
 * signal is read as a single block (the standard has no answer for it).
 */
export function integratedLoudness(left: Float32Array, right: Float32Array): number {
  const n = Math.min(left.length, right.length)
  if (n === 0) return -Infinity
  const energy = hopEnergies(left, right)

  // Mean square of each block, both channels summed (channel weights are 1.0 for L and R).
  const blocks: number[] = []
  if (n < BLOCK) {
    let total = 0
    for (let i = 0; i < energy.length; i++) total += energy[i]
    blocks.push(total / n)
  } else {
    const perBlock = BLOCK / HOP
    const fullHops = Math.floor(n / HOP)
    for (let j = 0; j + perBlock <= fullHops; j++) {
      let total = 0
      for (let k = 0; k < perBlock; k++) total += energy[j + k]
      blocks.push(total / BLOCK)
    }
  }

  const lufs = (meanSquare: number) => -0.691 + 10 * Math.log10(meanSquare)
  const absolute = blocks.filter((z) => z > 0 && lufs(z) > ABSOLUTE_GATE)
  if (absolute.length === 0) return -Infinity
  const mean = (zs: number[]) => zs.reduce((a, b) => a + b, 0) / zs.length
  const relativeThreshold = lufs(mean(absolute)) + RELATIVE_GATE
  const gated = absolute.filter((z) => lufs(z) > relativeThreshold)
  if (gated.length === 0) return -Infinity
  return lufs(mean(gated))
}

/** Zeroth-order modified Bessel function of the first kind, by its power series (for the Kaiser window). */
function besselI0(x: number): number {
  let sum = 1
  let term = 1
  const quarter = (x * x) / 4
  for (let k = 1; k < 40; k++) {
    term *= quarter / (k * k)
    sum += term
    if (term < sum * 1e-14) break
  }
  return sum
}

/**
 * Taps per phase on each side of the sample: a 16-tap polyphase branch, 64
 * taps in the equivalent 4x FIR (the standard's own example is 48).
 */
const HALF = 8
const OVERSAMPLE = 4
const KAISER_BETA = 7.5

let kernels: Float64Array[] | null = null

/**
 * The three interpolation branches (fractional positions 1/4, 2/4, 3/4): a
 * Kaiser-windowed sinc, each branch normalised to unity gain at DC. Phase 0 of
 * the 4x signal is the original sample, which needs no filter.
 */
function interpolationKernels(): Float64Array[] {
  if (kernels) return kernels
  const norm = besselI0(KAISER_BETA)
  kernels = [1, 2, 3].map((phase) => {
    const frac = phase / OVERSAMPLE
    const taps = new Float64Array(2 * HALF)
    let sum = 0
    for (let k = -HALF + 1; k <= HALF; k++) {
      const u = k - frac
      const sinc = Math.abs(u) < 1e-12 ? 1 : Math.sin(Math.PI * u) / (Math.PI * u)
      const ratio = u / HALF
      const window = Math.abs(ratio) >= 1 ? 0 : besselI0(KAISER_BETA * Math.sqrt(1 - ratio * ratio)) / norm
      taps[k + HALF - 1] = sinc * window
      sum += taps[k + HALF - 1]
    }
    for (let k = 0; k < taps.length; k++) taps[k] /= sum
    return taps
  })
  return kernels
}

/**
 * For each sample index i, the largest magnitude of either channel at i or at
 * the three interpolated points between i and i+1. The limiter reads this
 * (so it sees intersample peaks a sample-peak meter cannot) and truePeakDb
 * takes its maximum. Beyond the ends of the buffer the signal is zero.
 */
export function oversampledPeakEnvelope(left: Float32Array, right: Float32Array): Float32Array {
  const n = Math.min(left.length, right.length)
  const env = new Float32Array(n)
  const [k1, k2, k3] = interpolationKernels()
  const taps = 2 * HALF
  for (const channel of [left, right]) {
    // Zero-pad so the inner loop needs no bounds checks.
    const padded = new Float32Array(n + 2 * HALF + 1)
    padded.set(channel.subarray(0, n), HALF)
    for (let i = 0; i < n; i++) {
      const direct = Math.abs(channel[i])
      let peak = direct > env[i] ? direct : env[i]
      // Samples i-HALF+1 .. i+HALF, which sit at padded[i+1 .. i+2*HALF].
      let y1 = 0
      let y2 = 0
      let y3 = 0
      const base = i + 1
      for (let k = 0; k < taps; k++) {
        const x = padded[base + k]
        y1 += k1[k] * x
        y2 += k2[k] * x
        y3 += k3[k] * x
      }
      const a1 = Math.abs(y1)
      const a2 = Math.abs(y2)
      const a3 = Math.abs(y3)
      if (a1 > peak) peak = a1
      if (a2 > peak) peak = a2
      if (a3 > peak) peak = a3
      env[i] = peak
    }
  }
  return env
}

/**
 * True peak in dBTP: 4x oversampling with a windowed-sinc interpolation FIR
 * (16 taps per phase, 64 in all), max |sample| over both channels. Returns
 * -Infinity for silence.
 */
export function truePeakDb(left: Float32Array, right: Float32Array): number {
  const env = oversampledPeakEnvelope(left, right)
  let peak = 0
  for (let i = 0; i < env.length; i++) if (env[i] > peak) peak = env[i]
  return peak > 0 ? 20 * Math.log10(peak) : -Infinity
}
