/**
 * lib/studio/score/reverb.ts — the room the score sits in.
 *
 * "Lots of air" is most of what makes a few soft notes read as expensive, so
 * the reverb is a real one: Freeverb's topology (eight parallel low-pass
 * feedback combs into four series allpasses, per channel, the right channel's
 * delays offset for stereo width), with its delay lengths scaled from 44.1 kHz
 * to the 48 kHz of the film. Freeverb's single feedback constant is replaced by
 * a feedback per comb, set from the delay so every comb decays 60 dB in the
 * same stated time: the tail length is a parameter, not a side effect, and a
 * test measures it.
 */
import { SAMPLE_RATE } from './types'

/** Freeverb's tunings at 44.1 kHz, in samples. */
const COMB_TUNING = [1116, 1188, 1277, 1356, 1422, 1491, 1557, 1617]
const ALLPASS_TUNING = [556, 441, 341, 225]
const STEREO_SPREAD = 23
const SCALE = SAMPLE_RATE / 44100

export type ReverbOptions = {
  /** Time for the low end of the tail to fall 60 dB, seconds. */
  rt60: number
  /** 0 to 1: how much the high end of each comb's feedback is rolled off (a darker room). */
  damp: number
}

/** The room used by the score: about a two-second tail, a little dark. */
export const SCORE_ROOM: ReverbOptions = { rt60: 2.6, damp: 0.3 }

class Comb {
  private readonly buffer: Float32Array
  private index = 0
  private store = 0
  constructor(
    length: number,
    private readonly feedback: number,
    private readonly damp: number,
  ) {
    this.buffer = new Float32Array(length)
  }
  process(x: number): number {
    const out = this.buffer[this.index]
    this.store = out * (1 - this.damp) + this.store * this.damp
    this.buffer[this.index] = x + this.store * this.feedback
    if (++this.index === this.buffer.length) this.index = 0
    return out
  }
}

/**
 * A Schroeder lattice allpass, gain 0.5. Freeverb's own allpass cell (output =
 * held - input) is not unity gain: it swings between 1.0 and 1.67 across the
 * spectrum, and four in series add about 10 dB of colour and level. This form
 * is exactly unity at every frequency, so the wet normalisation below holds.
 */
class Allpass {
  private readonly buffer: Float32Array
  private index = 0
  constructor(length: number) {
    this.buffer = new Float32Array(length)
  }
  process(x: number): number {
    const held = this.buffer[this.index]
    const through = x + held * 0.5
    this.buffer[this.index] = through
    if (++this.index === this.buffer.length) this.index = 0
    return held - through * 0.5
  }
}

const normalisations = new Map<string, number>()

/**
 * The gain that brings the eight combs' summed output back to the RMS of a
 * white-noise input. A white-noise input's output power is the sum of squares
 * of the impulse response, so each comb is run on an impulse until it has
 * decayed (to about -90 dB) and its energy is added; the allpasses are unity.
 * The combs are fed the same input but their delays differ, so their outputs
 * add as uncorrelated power. Computed once per room and kept.
 */
function wetNormalisation(options: ReverbOptions): number {
  const key = `${options.rt60}|${options.damp}`
  const cached = normalisations.get(key)
  if (cached !== undefined) return cached
  const steps = Math.ceil(options.rt60 * 1.5 * SAMPLE_RATE)
  let power = 0
  for (const tuning of COMB_TUNING) {
    const length = Math.round(tuning * SCALE)
    const comb = new Comb(length, Math.pow(10, (-3 * length) / (SAMPLE_RATE * options.rt60)), options.damp)
    for (let i = 0; i < steps; i++) {
      const y = comb.process(i === 0 ? 1 : 0)
      power += y * y
    }
  }
  const gain = 1 / Math.sqrt(power)
  normalisations.set(key, gain)
  return gain
}

/**
 * Run a mono input through the room and return the stereo wet signal. The wet
 * gain is normalised so white noise in comes out at the same RMS: a send level
 * of 0.5 then means what it says, whatever the room size.
 */
export function renderReverb(input: Float32Array, options: ReverbOptions = SCORE_ROOM): { left: Float32Array; right: Float32Array } {
  const n = input.length
  const channels = [0, 1].map((side) => {
    const spread = side * Math.round(STEREO_SPREAD * SCALE)
    const combs = COMB_TUNING.map((tuning) => {
      const length = Math.round(tuning * SCALE) + spread
      // 60 dB of decay over rt60: each trip around the comb loses 60 * (length / fs) / rt60 dB.
      const feedback = Math.pow(10, (-3 * length) / (SAMPLE_RATE * options.rt60))
      return new Comb(length, feedback, options.damp)
    })
    const allpasses = ALLPASS_TUNING.map((tuning) => new Allpass(Math.round(tuning * SCALE) + spread))
    return { combs, allpasses }
  })

  const wetGain = wetNormalisation(options)

  const out = [new Float32Array(n), new Float32Array(n)]
  for (let side = 0; side < 2; side++) {
    const { combs, allpasses } = channels[side]
    const dest = out[side]
    for (let i = 0; i < n; i++) {
      const x = input[i]
      let sum = 0
      for (let c = 0; c < combs.length; c++) sum += combs[c].process(x)
      for (let a = 0; a < allpasses.length; a++) sum = allpasses[a].process(sum)
      dest[i] = sum * wetGain
    }
  }
  return { left: out[0], right: out[1] }
}
