/**
 * lib/studio/score/master.ts — from a mix to a deliverable.
 *
 * The chain, in order:
 *  1. A 28 Hz high-pass (rumble and DC) and mono below 120 Hz (the side signal
 *     high-passed, 4th order), so the low end is centred and survives a phone
 *     speaker.
 *  2. A fixed pre-level and soft saturation (tanh), so the glue is the same
 *     depth on every film whatever the stems happened to sum to.
 *  3. The closing fade to exact zero, applied BEFORE loudness is measured: the
 *     number we report is the number of the film as it ends, fade included.
 *  4. Loudness passes. Measure integrated loudness, set the gain to the target,
 *     run the true-peak lookahead limiter, measure again, and repeat until it is
 *     within tolerance (a limiter that bites lowers loudness, so one pass is
 *     rarely enough). The limiter reads the 4x oversampled peak, so an
 *     intersample peak a sample meter misses cannot get through; it looks 4 ms
 *     ahead and lets go over 80 ms; its ceiling is 0.77 (-2.3 dBFS), which
 *     leaves AAC room to add its half dB or so and still come in under -1 dBTP.
 *  5. The 3 ms raised-cosine fade-in from exact zero at sample 0 (a sound
 *     already at level on the first sample clicks) and the last 480 samples
 *     forced to zero, so nothing the limiter did can raise either edge.
 */
import { clamp, dbToGain, filterInPlace, gainToDb, highpass } from './dsp'
import { integratedLoudness, oversampledPeakEnvelope, truePeakDb } from './loudness'
import { TAIL_ZERO_SAMPLES } from './plan'
import { SAMPLE_RATE } from './types'

/** Limiter ceiling, linear: 0.77 is -2.27 dBFS. */
export const LIMITER_CEILING = 0.77
const LOOKAHEAD = Math.round(0.004 * SAMPLE_RATE)
const RELEASE_SECONDS = 0.08
export const HEAD_FADE_SECONDS = 0.003
/** The loudness loop stops when within this many LU of the target. */
const LOUDNESS_TOLERANCE = 0.05
const MAX_PASSES = 6
/** The level the saturation sees. Peaks sit well below the knee, so it only rounds the tallest. */
const PRE_LEVEL_LUFS = -18
const SATURATION_DRIVE = 1.25
const MONO_BELOW_HZ = 120
const RUMBLE_HZ = 28
/** The two section Qs of a 4th-order Butterworth. */
const BUTTERWORTH4_Q = [0.5411961, 1.3065630]

/**
 * The limiter's gain, per sample, for a signal whose oversampled peak envelope
 * is `env` once multiplied by `gain`. A running minimum over the lookahead
 * window, a box filter of the same length (so the gain is already down before
 * the peak arrives and falls as a smooth ramp), then an exponential release.
 * The result is never above what any sample needs, so peaks stay under the ceiling.
 */
export function limiterGains(env: Float32Array, gain: number, ceiling: number = LIMITER_CEILING): Float32Array {
  const n = env.length
  const window = LOOKAHEAD
  // Padded to whole blocks of `window`, and past the end, with 1 (no reduction).
  const padded = Math.ceil((n + window) / window) * window
  const need = new Float32Array(padded).fill(1)
  for (let i = 0; i < n; i++) {
    const peak = env[i] * gain
    if (peak > ceiling) need[i] = ceiling / peak
  }

  // Sliding minimum over [j, j+window): van Herk / Gil-Werman, three passes, no deque.
  const prefix = new Float32Array(padded)
  const suffix = new Float32Array(padded)
  for (let block = 0; block < padded; block += window) {
    prefix[block] = need[block]
    for (let i = block + 1; i < block + window; i++) prefix[i] = Math.min(prefix[i - 1], need[i])
    suffix[block + window - 1] = need[block + window - 1]
    for (let i = block + window - 2; i >= block; i--) suffix[i] = Math.min(suffix[i + 1], need[i])
  }
  const lowest = new Float32Array(n)
  for (let j = 0; j < n; j++) lowest[j] = Math.min(suffix[j], prefix[j + window - 1])

  // Box filter over the `window` samples ending at i: every term's min-window contains i, so the average is no higher than need[i].
  const out = new Float32Array(n)
  const release = Math.exp(-1 / (RELEASE_SECONDS * SAMPLE_RATE))
  let running = window * lowest[0]
  let held = 1
  for (let i = 0; i < n; i++) {
    if (i > 0) running += lowest[i] - lowest[Math.max(0, i - window)]
    const smooth = running / window
    const released = 1 - (1 - held) * release
    held = smooth < released ? smooth : released
    out[i] = held
  }
  return out
}

/**
 * Mono below `fc`: the mid (L+R)/2 is left alone and the side (L-R)/2 goes
 * through a 4th-order Butterworth high-pass, so the stereo difference is 3 dB
 * down at `fc`, 30 dB down an octave and a bit below it, and untouched above.
 * (Replacing each channel's low band with the mid looks equivalent and is not:
 * the complement of a low-pass is only 6 dB/octave at the bottom, which left
 * 50 Hz side content cut by under 5 dB.)
 */
function monoBelow(left: Float32Array, right: Float32Array, fc: number): void {
  const side = new Float32Array(left.length)
  for (let i = 0; i < left.length; i++) side[i] = (left[i] - right[i]) * 0.5
  filterInPlace(side, highpass(fc, BUTTERWORTH4_Q[0]))
  filterInPlace(side, highpass(fc, BUTTERWORTH4_Q[1]))
  for (let i = 0; i < left.length; i++) {
    const mid = (left[i] + right[i]) * 0.5
    left[i] = mid + side[i]
    right[i] = mid - side[i]
  }
}

/** Raised-cosine fade to zero over the last `fadeSamples`, reaching exact zero by the last TAIL_ZERO_SAMPLES. */
function applyTail(left: Float32Array, right: Float32Array, fadeSamples: number): void {
  const n = left.length
  const zeroFrom = n - TAIL_ZERO_SAMPLES
  const fadeFrom = Math.max(0, n - fadeSamples)
  const span = Math.max(1, zeroFrom - fadeFrom)
  for (let i = fadeFrom; i < zeroFrom; i++) {
    const w = 0.5 + 0.5 * Math.cos((Math.PI * (i - fadeFrom)) / span)
    left[i] *= w
    right[i] *= w
  }
  for (let i = Math.max(0, zeroFrom); i < n; i++) {
    left[i] = 0
    right[i] = 0
  }
}

/** The 3 ms raised-cosine fade-in from exact zero at sample 0, and the last 480 samples zero. */
function applyEdges(left: Float32Array, right: Float32Array): void {
  const n = left.length
  const head = Math.min(n, Math.round(HEAD_FADE_SECONDS * SAMPLE_RATE))
  for (let i = 0; i < head; i++) {
    const w = 0.5 - 0.5 * Math.cos((Math.PI * i) / (head - 1))
    left[i] *= w
    right[i] *= w
  }
  for (let i = Math.max(0, n - TAIL_ZERO_SAMPLES); i < n; i++) {
    left[i] = 0
    right[i] = 0
  }
}

export type MasterResult = {
  left: Float32Array
  right: Float32Array
  /** Measured integrated loudness of the result. */
  lufs: number
  /** Measured true peak of the result, dBTP. */
  truePeakDb: number
  /** Loudness passes run. */
  passes: number
  /** The deepest the limiter pulled down, dB (positive). */
  limiterMaxReductionDb: number
}

/** Master a summed mix in place of its buffers: the chain above. `left` and `right` are consumed. */
export function masterMix(
  left: Float32Array,
  right: Float32Array,
  options: { targetLufs: number; fadeSamples: number },
): MasterResult {
  const n = left.length
  filterInPlace(left, highpass(RUMBLE_HZ))
  filterInPlace(right, highpass(RUMBLE_HZ))
  monoBelow(left, right, MONO_BELOW_HZ)

  const pre = integratedLoudness(left, right)
  if (pre === -Infinity) {
    applyTail(left, right, options.fadeSamples)
    applyEdges(left, right)
    return { left, right, lufs: -Infinity, truePeakDb: -Infinity, passes: 0, limiterMaxReductionDb: 0 }
  }
  const preGain = dbToGain(PRE_LEVEL_LUFS - pre)
  for (let i = 0; i < n; i++) {
    left[i] = Math.tanh(left[i] * preGain * SATURATION_DRIVE) / SATURATION_DRIVE
    right[i] = Math.tanh(right[i] * preGain * SATURATION_DRIVE) / SATURATION_DRIVE
  }
  applyTail(left, right, options.fadeSamples)

  const faded = integratedLoudness(left, right)
  if (!Number.isFinite(faded)) {
    // Nothing audible survives the fade (a film too short to hold a block): there is no loudness to steer by.
    applyEdges(left, right)
    return { left, right, lufs: faded, truePeakDb: truePeakDb(left, right), passes: 0, limiterMaxReductionDb: 0 }
  }
  const env = oversampledPeakEnvelope(left, right)
  let gainDb = options.targetLufs - faded
  type Candidate = { l: Float32Array; r: Float32Array; error: number; reduction: number }
  let best: Candidate | undefined
  let previous: { gainDb: number; lufs: number } | undefined
  let passes = 0
  while (passes < MAX_PASSES) {
    passes++
    const gain = dbToGain(gainDb)
    const reduction = limiterGains(env, gain)
    const l = new Float32Array(n)
    const r = new Float32Array(n)
    let deepest = 1
    for (let i = 0; i < n; i++) {
      const g = gain * reduction[i]
      l[i] = left[i] * g
      r[i] = right[i] * g
      if (reduction[i] < deepest) deepest = reduction[i]
    }
    const lufs = integratedLoudness(l, r)
    const error = lufs - options.targetLufs
    if (!best || Math.abs(error) < Math.abs(best.error)) best = { l, r, error, reduction: -gainToDb(deepest) }
    if (Math.abs(error) <= LOUDNESS_TOLERANCE) break
    // Secant step on the gain-to-loudness slope (1 when the limiter is idle, lower as it bites).
    let slope = 1
    if (previous && Math.abs(gainDb - previous.gainDb) > 1e-6) {
      slope = clamp((lufs - previous.lufs) / (gainDb - previous.gainDb), 0.25, 1.1)
    }
    previous = { gainDb, lufs }
    gainDb += (options.targetLufs - lufs) / slope
  }
  if (!best) throw new Error('unreachable: the loudness loop always runs at least once')
  applyEdges(best.l, best.r)
  return {
    left: best.l,
    right: best.r,
    lufs: integratedLoudness(best.l, best.r),
    truePeakDb: truePeakDb(best.l, best.r),
    passes,
    limiterMaxReductionDb: best.reduction,
  }
}
