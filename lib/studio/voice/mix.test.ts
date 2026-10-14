import { describe, expect, it } from 'vitest'
import { composeScore, integratedLoudness, truePeakDb } from '../score'
import { SAMPLE_RATE } from '../score/types'
import { parseWav } from './decode'
import { duckingCurveDb, mixVoiceOverScore, speechSpans } from './mix'
import type { SpokenWord, StereoAudio } from './types'

const seconds = (n: number) => Math.round(n * SAMPLE_RATE)

/** A steady pad-ish bed: two partials, in both channels, at a modest level. */
function bed(duration: number, hz = 220): StereoAudio {
  const n = seconds(duration)
  const left = new Float32Array(n)
  const right = new Float32Array(n)
  for (let i = 0; i < n; i++) {
    const t = i / SAMPLE_RATE
    left[i] = 0.2 * (Math.sin(2 * Math.PI * hz * t) + 0.5 * Math.sin(2 * Math.PI * hz * 1.5 * t))
    right[i] = 0.2 * (Math.sin(2 * Math.PI * hz * t + 0.3) + 0.5 * Math.sin(2 * Math.PI * hz * 1.5 * t + 0.2))
  }
  return { left, right }
}

/** A stand-in voice: a 1 kHz tone with a 10 ms fade at each word edge, silent between words, centred. */
function voiceFor(words: SpokenWord[], duration: number, hz = 1000): StereoAudio {
  const n = seconds(duration)
  const mono = new Float32Array(n)
  for (const w of words) {
    const from = seconds(w.start)
    const to = Math.min(n, seconds(w.end))
    for (let i = from; i < to; i++) {
      const edge = Math.min(i - from, to - 1 - i) / (0.01 * SAMPLE_RATE)
      mono[i] = 0.3 * Math.min(1, edge) * Math.sin(2 * Math.PI * hz * (i / SAMPLE_RATE))
    }
  }
  return { left: mono, right: new Float32Array(mono) }
}

/** Magnitude of one frequency over [from, to) seconds (Goertzel), left channel. */
function magnitude(x: Float32Array, from: number, to: number, hz: number): number {
  const a = seconds(from)
  const b = seconds(to)
  const w = (2 * Math.PI * hz) / SAMPLE_RATE
  const coeff = 2 * Math.cos(w)
  let s1 = 0
  let s2 = 0
  for (let i = a; i < b; i++) {
    const s0 = x[i] + coeff * s1 - s2
    s2 = s1
    s1 = s0
  }
  return Math.sqrt(s1 * s1 + s2 * s2 - coeff * s1 * s2) / (b - a)
}

const WORDS: SpokenWord[] = [
  { word: 'Okay,', start: 1.0, end: 1.4 },
  { word: 'so', start: 1.5, end: 1.8 },
  { word: 'here', start: 4.0, end: 4.4 },
  { word: 'we', start: 4.5, end: 4.7 },
  { word: 'go.', start: 4.8, end: 5.3 },
]
const DURATION = 9

describe('speechSpans', () => {
  it('shifts by the offset, pads each end, and joins words closer than the merge gap', () => {
    const spans = speechSpans(WORDS, 0.5, 0.42, 0.1)
    // Okay, + so are 0.1 apart and join (so ends 1.8 + 0.5 shift + 0.1 pad); here we go is its own span.
    expect(spans).toHaveLength(2)
    expect(spans[0].start).toBeCloseTo(1.5, 9)
    expect(spans[0].end).toBeCloseTo(2.4, 9)
    expect(spans[1].start).toBeCloseTo(4.5, 9)
    expect(spans[1].end).toBeCloseTo(5.9, 9)
  })

  it('keeps words a full merge gap apart as separate spans', () => {
    expect(speechSpans(WORDS.slice(0, 3), 0, 0.42, 0)).toHaveLength(2)
    expect(speechSpans(WORDS.slice(0, 3), 0, 3, 0)).toHaveLength(1)
  })
})

describe('duckingCurveDb', () => {
  const spans = [{ start: 2, end: 3 }]
  const curve = duckingCurveDb(spans, seconds(6), 10, 0.12, 0.3)
  const at = (t: number) => curve[seconds(t)]

  it('is 0 dB well before the attack and well after the release', () => {
    expect(at(0)).toBe(0)
    expect(at(1.8)).toBe(0)
    expect(at(3.31)).toBe(0)
    expect(at(5.9)).toBe(0)
  })

  it('reaches the full -10 dB exactly at the word start (attack 120 ms, complete as the word begins)', () => {
    expect(at(2)).toBeCloseTo(-10, 5)
    expect(at(1.88)).toBeCloseTo(0, 5) // the attack begins 120 ms before
    expect(at(1.94)).toBeCloseTo(-5, 1) // halfway through a raised cosine is half the depth
  })

  it('holds -10 dB under the speech', () => {
    for (const t of [2, 2.4, 2.9, 3]) expect(at(t)).toBeCloseTo(-10, 5)
  })

  it('releases over 300 ms after the last word', () => {
    expect(at(3.15)).toBeCloseTo(-5, 1)
    expect(at(3.3)).toBeCloseTo(0, 1)
    // Monotonic recovery.
    let previous = at(3)
    for (let i = seconds(3); i < seconds(3.3); i++) {
      expect(curve[i]).toBeGreaterThanOrEqual(previous - 1e-6)
      previous = curve[i]
    }
  })

  it('is deterministic and never above 0 dB', () => {
    const again = duckingCurveDb(spans, seconds(6), 10, 0.12, 0.3)
    expect(Array.from(again.subarray(0, 1000))).toEqual(Array.from(curve.subarray(0, 1000)))
    let highest = -Infinity
    for (const db of curve) highest = Math.max(highest, db)
    expect(highest).toBe(0)
  })

  it('lets the deeper duck win where ramps overlap, and clips at the start of the film', () => {
    const overlapped = duckingCurveDb([{ start: 0.05, end: 0.5 }, { start: 0.6, end: 1 }], seconds(2), 10, 0.12, 0.3)
    expect(overlapped[seconds(0.55)]).toBeLessThan(-5)
    expect(overlapped[0]).toBeLessThan(0)
    expect(overlapped[0]).toBeGreaterThan(-10)
  })
})

describe('mixVoiceOverScore', () => {
  const score = bed(DURATION)
  const voice = voiceFor(WORDS, DURATION)

  it('masters the mix to -14 LUFS with true peak at or under -1 dBTP, measured off the WAV it returns', () => {
    const result = mixVoiceOverScore({ score, voice, words: WORDS })
    const decoded = parseWav(result.wav)!
    expect(decoded.sampleRate).toBe(SAMPLE_RATE)
    expect(decoded.left.length).toBe(seconds(DURATION))
    expect(result.samples).toBe(seconds(DURATION))
    const lufs = integratedLoudness(decoded.left, decoded.right)
    expect(Math.abs(lufs - -14)).toBeLessThan(0.1)
    expect(truePeakDb(decoded.left, decoded.right)).toBeLessThanOrEqual(-1)
    // The report is of those same bytes.
    expect(result.report.lufs).toBeCloseTo(lufs, 1)
    expect(result.report.truePeakDb).toBeCloseTo(truePeakDb(decoded.left, decoded.right), 1)
    expect(result.report.truePeakDb).toBeLessThanOrEqual(-1)
    expect(result.report.warnings).toEqual([])
  })

  it('ducks the bed about 10 dB under speech and lets it back up between phrases', () => {
    const result = mixVoiceOverScore({ score, voice, words: WORDS })
    const { left } = parseWav(result.wav)!
    // 220 Hz is the bed alone (the voice is 1 kHz). Under "here we go" vs in the long gap before it.
    const under = magnitude(left, 4.1, 4.9, 220)
    const open = magnitude(left, 2.4, 3.6, 220)
    const dropDb = 20 * Math.log10(open / under)
    expect(dropDb).toBeGreaterThan(8)
    expect(dropDb).toBeLessThan(12.5)
  })

  it('puts the voice on top: 1 kHz under the words is well above the bed', () => {
    const { left } = parseWav(mixVoiceOverScore({ score, voice, words: WORDS }).wav)!
    const speech = magnitude(left, 4.1, 4.9, 1000)
    const bedOnly = magnitude(left, 4.1, 4.9, 220)
    expect(speech).toBeGreaterThan(bedOnly * 3)
  })

  it('is deterministic: the same inputs give the same bytes', () => {
    const a = mixVoiceOverScore({ score, voice, words: WORDS })
    const b = mixVoiceOverScore({ score, voice, words: WORDS })
    expect(a.wav.equals(b.wav)).toBe(true)
    expect(a.report).toEqual(b.report)
  })

  it('does not change the buffers it is given', () => {
    const before = [score.left[1234], score.right[5678], voice.left[seconds(4.2)], voice.right[seconds(4.2)]]
    mixVoiceOverScore({ score, voice, words: WORDS })
    expect([score.left[1234], score.right[5678], voice.left[seconds(4.2)], voice.right[seconds(4.2)]]).toEqual(before)
  })

  it('places the voice at the offset and shifts the ducking with it', () => {
    const shifted = mixVoiceOverScore({ score, voice, words: WORDS }, { voiceOffsetSeconds: 2 })
    const { left } = parseWav(shifted.wav)!
    // The first word now sounds at 3.0 s, not 1.0 s.
    expect(magnitude(left, 3.05, 3.35, 1000)).toBeGreaterThan(5 * magnitude(left, 1.05, 1.35, 1000))
    const under = magnitude(left, 6.1, 6.9, 220)
    const open = magnitude(left, 4.4, 5.6, 220)
    expect(20 * Math.log10(open / under)).toBeGreaterThan(8)
  })

  it('is mastered even when the bed is far hotter or quieter than the voice', () => {
    for (const gain of [0.05, 4]) {
      const loud = { left: score.left.map((x) => x * gain), right: score.right.map((x) => x * gain) }
      const result = mixVoiceOverScore({ score: loud, voice, words: WORDS })
      expect(Math.abs(result.report.lufs - -14)).toBeLessThan(0.15)
      expect(result.report.truePeakDb).toBeLessThanOrEqual(-1)
    }
  })

  it('works over a score written by composeScore', () => {
    const composed = composeScore({
      duration: DURATION,
      seed: 'voice-mix-test',
      mood: 'calm',
      sections: [
        { start: 0, end: 4.5 },
        { start: 4.5, end: DURATION },
      ],
      events: [
        { kind: 'enter', t: 0.5, weight: 1 },
        { kind: 'enter', t: 4.5, weight: 1 },
        { kind: 'lockup', t: 7.5 },
      ],
    })
    const music = parseWav(composed.wav)!
    const result = mixVoiceOverScore({ score: { left: music.left, right: music.right }, voice, words: WORDS })
    const out = parseWav(result.wav)!
    expect(out.left.length).toBe(music.left.length)
    expect(Math.abs(integratedLoudness(out.left, out.right) - -14)).toBeLessThan(0.1)
    expect(truePeakDb(out.left, out.right)).toBeLessThanOrEqual(-1)
    // The score's own closing tail survives: the last 480 samples are exact zero.
    expect(Array.from(out.left.subarray(out.left.length - 480)).every((x) => x === 0)).toBe(true)
  }, 60_000)

  it('refuses a film it cannot make', () => {
    expect(() => mixVoiceOverScore({ score, voice, words: [] })).toThrow(RangeError)
    expect(() => mixVoiceOverScore({ score, voice: voiceFor([], DURATION), words: WORDS })).toThrow(/silent/)
    expect(() => mixVoiceOverScore({ score, voice, words: WORDS }, { voiceOffsetSeconds: 5 })).toThrow(/past the film/)
    expect(() => mixVoiceOverScore({ score, voice, words: WORDS }, { voiceOffsetSeconds: -1 })).toThrow(RangeError)
    expect(() => mixVoiceOverScore({ score: bed(0.2), voice, words: WORDS })).toThrow(RangeError)
  })

  it('says so when the voice is cut at the end of the film with sound still in it', () => {
    const long = voiceFor([...WORDS, { word: 'tail', start: 9.2, end: 9.8 }], 10)
    const result = mixVoiceOverScore({ score, voice: long, words: WORDS })
    expect(result.report.warnings.some((w) => w.includes('cut at the film'))).toBe(true)
  })
})
