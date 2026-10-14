/**
 * lib/studio/voice/mix.ts: the voiceover over the score, one deliverable audio track.
 *
 * What it does, in order:
 *  1. Places the voice in the film (an optional offset) and conditions it: an
 *     80 Hz high-pass (plosive thump, mic rumble), then a gain to a fixed
 *     integrated loudness so the mix balance never depends on how loud the
 *     engine happened to render.
 *  2. Sets the music bed a fixed number of LU under the voice, then ducks it
 *     under speech: a gain envelope built from the word timings, -10 dB while a
 *     word is being said, an attack of 120 ms that is complete AT the word's
 *     first sample (the timings are known, so the music is already down when
 *     the word starts; a real sidechain would be late) and a release of 300 ms
 *     after the last word. Words closer together than attack + release share
 *     one duck, so the bed does not pump between words. Raised-cosine curves,
 *     computed per sample in TypeScript: the same words give the same samples.
 *  3. Sums, then masters with the score's own chain (lib/studio/score/master.ts:
 *     high-pass, mono bass, glue, a measured loop to the target loudness, and
 *     the 4x-oversampled true-peak limiter) to -14 LUFS integrated, true peak
 *     at or under -1.0 dBTP. The loudness meter is the score's BS.1770-4 meter
 *     (loudness.ts); there is no second one.
 *  4. Encodes the 16-bit WAV the muxer takes, then reads the numbers back OFF
 *     THOSE BYTES, so the report is of what ships.
 *
 * The score passed in is the one composeScore wrote (already mastered); it is
 * rebalanced against the voice here and mastered again as part of the mix.
 * Pure and deterministic: no clock, no randomness beyond the seeded dither.
 */
import { clamp, dbToGain, filterInPlace, highpass, smoothstep } from '../score/dsp'
import { integratedLoudness, truePeakDb } from '../score/loudness'
import { masterMix } from '../score/master'
import { SAMPLE_RATE } from '../score/types'
import { encodeWav } from '../score/wav'
import { parseWav } from './decode'
import type { SpokenWord, StereoAudio } from './types'

export type MixOptions = {
  /** Seconds into the film where the voice's first sample plays, and the shift applied to `words`. Default 0. */
  voiceOffsetSeconds?: number
  /** How far the music drops under a word, dB. Default 10. */
  duckDepthDb?: number
  /** Seconds to reach full duck, finishing at the word's start. Default 0.12. */
  attackSeconds?: number
  /** Seconds to recover after the last word of a phrase. Default 0.3. */
  releaseSeconds?: number
  /** Words this close share one duck. Default attack + release (a duck always recovers fully before the next begins). */
  mergeGapSeconds?: number
  /**
   * Seconds added to each phrase's end before the release begins. The engine
   * closes a word at its last letter, and the voice rings on for a tenth of a
   * second or more after it (measured on the 2026-10-13 smoke line: "so" ended
   * at 0.88 s in the alignment and the audio was still at -13 dB at 0.96 s).
   * Default 0.1.
   */
  tailPadSeconds?: number
  /** The voice's integrated loudness before the master, LUFS. Default -16. */
  voiceLufs?: number
  /** The music bed's integrated loudness under the voice's, LU, before ducking. Default 9. */
  bedBelowVoiceLu?: number
  voiceHighpassHz?: number
  /** Default -14. */
  targetLufs?: number
  /** The true-peak ceiling the result must meet, dBTP. Default -1.0. */
  truePeakCeilingDb?: number
  /** A closing fade-out; 0 keeps the voice and the score's own tail untouched. Default 0. */
  fadeSeconds?: number
  /** Seeds the WAV's dither. Default 'voice-mix'. */
  seed?: string
}

export type MixReport = {
  /** Integrated loudness of the WAV bytes, LUFS (BS.1770-4). */
  lufs: number
  /** True peak of the WAV bytes, dBTP (4x oversampled). */
  truePeakDb: number
  targetLufs: number
  /** Seconds the music spends ducked (at full depth), after merging. */
  duckedSeconds: number
  /** How deep the master's limiter pulled down, dB. */
  limiterMaxReductionDb: number
  /** Loudness passes the master ran. */
  passes: number
  warnings: string[]
}

export type MixResult = { wav: Buffer; samples: number; report: MixReport }

type Span = { start: number; end: number }

/** Word timings to speech spans, shifted, each ending `tailPad` after its word, with spans closer than `mergeGap` joined. */
export function speechSpans(words: SpokenWord[], offsetSeconds: number, mergeGap: number, tailPad = 0): Span[] {
  const sorted = words
    .map((w) => ({ start: w.start + offsetSeconds, end: Math.max(w.start, w.end) + offsetSeconds + tailPad }))
    .sort((a, b) => a.start - b.start)
  const spans: Span[] = []
  for (const w of sorted) {
    const last = spans.at(-1)
    if (last && w.start - last.end < mergeGap) last.end = Math.max(last.end, w.end)
    else spans.push({ ...w })
  }
  return spans
}

/**
 * The music's gain in dB per sample (0 or negative): -depth over every speech
 * span, an attack ramp ending at the span's start, a release ramp beginning at
 * its end, both raised-cosine. Where ramps overlap, the deeper duck wins.
 */
export function duckingCurveDb(
  spans: Span[],
  samples: number,
  depthDb: number,
  attackSeconds: number,
  releaseSeconds: number,
): Float32Array {
  const curve = new Float32Array(samples)
  const at = (t: number) => Math.round(t * SAMPLE_RATE)
  for (const { start, end } of spans) {
    const from = Math.max(0, at(start - attackSeconds))
    const to = Math.min(samples, at(end + releaseSeconds))
    for (let i = from; i < to; i++) {
      const t = i / SAMPLE_RATE
      let db: number
      if (t < start) db = -depthDb * smoothstep((t - (start - attackSeconds)) / attackSeconds)
      else if (t <= end) db = -depthDb
      else db = -depthDb * (1 - smoothstep((t - end) / releaseSeconds))
      if (db < curve[i]) curve[i] = db
    }
  }
  return curve
}

function round2(x: number): number {
  return Number.isFinite(x) ? Math.round(x * 100) / 100 : x
}

/**
 * Mix `voice` over `score`. `words` are in the voice's own time (as
 * alignmentToWords returns them); `voiceOffsetSeconds` moves both the voice and
 * the ducking into film time. Output length is the score's, to the sample.
 *
 * Throws RangeError for input that cannot make a film (empty words, a silent
 * voice, speech that runs past the end of the film), and Error when the mix
 * misses -14 LUFS by more than 1 LU or breaks the true-peak ceiling, so a bad
 * track never goes quietly downstream.
 */
export function mixVoiceOverScore(
  input: { score: StereoAudio; voice: StereoAudio; words: SpokenWord[] },
  options: MixOptions = {},
): MixResult {
  const { score, voice, words } = input
  const offset = options.voiceOffsetSeconds ?? 0
  const depthDb = options.duckDepthDb ?? 10
  const attack = options.attackSeconds ?? 0.12
  const release = options.releaseSeconds ?? 0.3
  const mergeGap = options.mergeGapSeconds ?? attack + release
  const voiceLufs = options.voiceLufs ?? -16
  const bedBelow = options.bedBelowVoiceLu ?? 9
  const targetLufs = options.targetLufs ?? -14
  const ceiling = options.truePeakCeilingDb ?? -1
  const warnings: string[] = []

  if (score.left.length !== score.right.length) throw new RangeError('mix: score channels differ in length')
  if (voice.left.length !== voice.right.length) throw new RangeError('mix: voice channels differ in length')
  const n = score.left.length
  if (n < SAMPLE_RATE / 2) throw new RangeError('mix: the score is under 0.5 s')
  if (offset < 0) throw new RangeError('mix: voiceOffsetSeconds cannot be negative')
  if (words.length === 0) throw new RangeError('mix: no spoken words to duck under')
  if (attack <= 0 || release <= 0) throw new RangeError('mix: attack and release must be positive')
  const filmSeconds = n / SAMPLE_RATE
  const lastEnd = Math.max(...words.map((w) => w.end)) + offset
  if (lastEnd > filmSeconds + 1 / SAMPLE_RATE) {
    throw new RangeError(`mix: the voice's last word ends at ${lastEnd.toFixed(3)} s, past the film's ${filmSeconds.toFixed(3)} s`)
  }

  // 1. The voice, placed and conditioned. Samples past the film are trimmed (the words end before it, so this is tail silence).
  const vl = new Float32Array(n)
  const vr = new Float32Array(n)
  const place = Math.round(offset * SAMPLE_RATE)
  const copy = Math.max(0, Math.min(voice.left.length, n - place))
  vl.set(voice.left.subarray(0, copy), place)
  vr.set(voice.right.subarray(0, copy), place)
  let trimmedPeak = 0
  for (let i = copy; i < voice.left.length; i++) trimmedPeak = Math.max(trimmedPeak, Math.abs(voice.left[i]), Math.abs(voice.right[i]))
  if (trimmedPeak > 0.01) warnings.push(`the voice was cut at the film's end with audible sound past it (peak ${trimmedPeak.toFixed(3)})`)
  const hp = options.voiceHighpassHz ?? 80
  if (hp > 0) {
    filterInPlace(vl, highpass(hp))
    filterInPlace(vr, highpass(hp))
  }
  const measuredVoice = integratedLoudness(vl, vr)
  if (!Number.isFinite(measuredVoice)) throw new RangeError('mix: the voice is silent')
  const voiceGain = dbToGain(voiceLufs - measuredVoice)

  // 2. The bed, set under the voice and ducked.
  const measuredScore = integratedLoudness(score.left, score.right)
  let bedGain = 0
  if (Number.isFinite(measuredScore)) bedGain = dbToGain(voiceLufs - bedBelow - measuredScore)
  else warnings.push('the score is silent; the mix is the voice alone')
  const spans = speechSpans(words, offset, mergeGap, options.tailPadSeconds ?? 0.1)
  const duckDb = duckingCurveDb(spans, n, depthDb, attack, release)
  const duckedSeconds = spans.reduce((sum, s) => sum + (Math.min(s.end, filmSeconds) - Math.max(s.start, 0)), 0)

  // 3. Sum and master.
  const left = new Float32Array(n)
  const right = new Float32Array(n)
  for (let i = 0; i < n; i++) {
    const g = bedGain * dbToGain(duckDb[i])
    left[i] = vl[i] * voiceGain + score.left[i] * g
    right[i] = vr[i] * voiceGain + score.right[i] * g
  }
  const mastered = masterMix(left, right, { targetLufs, fadeSamples: Math.round(clamp(options.fadeSeconds ?? 0, 0, filmSeconds) * SAMPLE_RATE) })

  // 4. Encode, then read the numbers off the bytes that ship.
  const wav = encodeWav(mastered.left, mastered.right, options.seed ?? 'voice-mix')
  const decoded = parseWav(wav)
  if (!decoded) throw new Error('mix: the WAV it just wrote does not parse')
  const lufs = integratedLoudness(decoded.left, decoded.right)
  const peak = truePeakDb(decoded.left, decoded.right)
  if (!Number.isFinite(lufs)) throw new Error('mix: the result is silent')
  if (Math.abs(lufs - targetLufs) > 1) {
    throw new Error(`mix: integrated loudness ${lufs.toFixed(2)} LUFS is more than 1 LU from the ${targetLufs} LUFS target`)
  }
  if (peak > ceiling) throw new Error(`mix: true peak ${peak.toFixed(2)} dBTP is over the ${ceiling} dBTP ceiling`)
  return {
    wav,
    samples: n,
    report: {
      lufs: round2(lufs),
      truePeakDb: round2(peak),
      targetLufs,
      duckedSeconds: round2(duckedSeconds),
      limiterMaxReductionDb: round2(mastered.limiterMaxReductionDb),
      passes: mastered.passes,
      warnings,
    },
  }
}
