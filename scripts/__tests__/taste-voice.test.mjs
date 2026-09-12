import { describe, expect, it } from 'vitest'
import {
  RECEIPT_VOICE_FROM,
  analystVoiceHits,
  evaluateVoiceResult,
  evaluatorVoiceBrief,
  visitorCopyFromHtml,
  voiceReceiptProblems,
} from '../lib/taste-voice.mjs'

const BROKER_LINES = [
  "It's been listed 106 days. Typical Bend homes go under contract in 23.",
  'I can take you through this home',
]

describe('analystVoiceHits — SITE-99 briefing class, not a banned-word list', () => {
  it('flags the listing fold that talked like a memo', () => {
    const brutal =
      '106 days listed is about 4.6 times the 23 a typical Bend home takes to go under contract; $384 a square foot is 3.7% under the Bend closed median of $399.'
    expect(analystVoiceHits(brutal)).toEqual(['ratio lecture ("N times the T")'])
  })

  it('flags leftover membership, Watch by email, sits N% under, and the close eyebrow', () => {
    const hits = analystVoiceHits(
      'SOURCE leftover membership. Watch 20591 SE Nina Avenue by email. This home\'s price sits 38.7% under the Bend median list. Bend · What to do about this house',
    )
    expect(hits).toEqual([
      'internal leftover membership',
      'Watch X by email',
      'price "sits N% under/over"',
      'What to do about this house',
    ])
  })

  it('lets the rewritten Nina lines through', () => {
    expect(
      analystVoiceHits(
        "It's been listed 106 days. Typical Bend homes go under contract in 23. At $384 a square foot, it's 3.7% under Bend's closed median of $399. Want to see it? We'll email you about 20591 SE Nina Avenue. This home is listed 38.7% under a typical Bend home right now. How homes here sold.",
      ),
    ).toEqual([])
  })
})

describe('evaluateVoiceResult', () => {
  it('fails when the evaluator never quoted the words', () => {
    expect(evaluateVoiceResult(undefined).join('\n')).toMatch(/voice is missing/)
    expect(evaluateVoiceResult({ pass: true, lines: ['one line'] }).join('\n')).toMatch(/at least two/)
  })

  it('fails a pass over leftover analyst copy', () => {
    const p = evaluateVoiceResult(
      { pass: true, lines: BROKER_LINES },
      '106 days listed is about 4.6 times the 23 a typical Bend home takes',
    )
    expect(p.join('\n')).toMatch(/times the/)
    expect(p.join('\n')).toMatch(/cannot be true/)
  })

  it('passes quoted broker lines with clean copy', () => {
    expect(evaluateVoiceResult({ pass: true, lines: BROKER_LINES, findings: [] }, BROKER_LINES.join(' '))).toEqual([])
  })
})

describe('voiceReceiptProblems — new reviews only', () => {
  it('does not rewrite receipts dated before the hold', () => {
    expect(voiceReceiptProblems({ evaluatedAt: '2026-09-11', score: 79 })).toEqual([])
  })

  it(`requires voice on reviews dated ${RECEIPT_VOICE_FROM} or later`, () => {
    expect(voiceReceiptProblems({ evaluatedAt: RECEIPT_VOICE_FROM, score: 80 }).join('\n')).toMatch(
      /voice is missing/,
    )
    expect(
      voiceReceiptProblems({
        evaluatedAt: RECEIPT_VOICE_FROM,
        voice: { pass: true, lines: BROKER_LINES, findings: [] },
      }),
    ).toEqual([])
    expect(
      voiceReceiptProblems({
        evaluatedAt: RECEIPT_VOICE_FROM,
        voice: { pass: false, lines: BROKER_LINES, findings: ['fold is a briefing'] },
      }).join('\n'),
    ).toMatch(/voice.pass is false/)
  })
})

describe('visitorCopyFromHtml + evaluator brief', () => {
  it('strips tags so the judge can read the words', () => {
    expect(visitorCopyFromHtml('<h2>Want to see it?</h2><script>x</script><p>I can take you through this home</p>')).toBe(
      'Want to see it? I can take you through this home',
    )
  })

  it('loads VOICE.md into the evaluator brief', () => {
    const brief = evaluatorVoiceBrief()
    expect(brief).toMatch(/Voice \(blocking/)
    expect(brief).toMatch(/you\/we/i)
    expect(brief).toMatch(/VOICE.md/)
  })
})
