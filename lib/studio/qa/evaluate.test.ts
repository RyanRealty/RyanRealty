import { describe, expect, it } from 'vitest'
import {
  captionProblems,
  computeShots,
  evaluateCaptions,
  evaluateCopy,
  evaluateEndcardTiming,
  evaluateHook,
  evaluateNumbers,
  evaluateReview,
  evaluateSafeArea,
  judgeLoudness,
  shortHolds,
  silentFilmDeclared,
} from './evaluate'
import type { ManifestBeat, ManifestCaption, ManifestEndcard, ManifestText, ManifestVoice } from './manifest'

const card = (over: Partial<ManifestText> = {}): ManifestText => ({
  text: '63% cut their price', start: 0.2, end: 3.1, box: { x: 90, y: 400, w: 860, h: 220 }, kind: 'card', ...over,
})

describe('evaluateHook', () => {
  const beats: ManifestBeat[] = [{ id: 'hook', role: 'hook', start: 0, end: 3.1 }, { id: 'b', role: 'body', start: 3.1, end: 6 }]

  it('passes a hook beat first with a card text inside the limit', () => {
    expect(evaluateHook(beats, [card()], 2).problems).toEqual([])
  })

  it('accepts cta and label kinds, and a text exactly at the limit', () => {
    expect(evaluateHook(beats, [card({ kind: 'cta', start: 2 })], 2).problems).toEqual([])
    expect(evaluateHook(beats, [card({ kind: 'label', start: 1.5 })], 1.5).problems).toEqual([])
  })

  it('fails when the first beat is not the hook', () => {
    const r = evaluateHook([{ id: 'i', role: 'intro', start: 0, end: 3 }], [card()], 2)
    expect(r.problems[0]).toContain('must be the hook')
  })

  it('fails a hook beat that starts late', () => {
    expect(evaluateHook([{ id: 'hook', role: 'hook', start: 2.5, end: 5 }], [card()], 2).problems.join()).toContain('after 2s')
  })

  it('fails a late text and a caption-only opening', () => {
    expect(evaluateHook(beats, [card({ start: 2.4 })], 2).problems.join()).toContain('after 2s')
    const r = evaluateHook(beats, [card({ kind: 'caption' }), card({ kind: 'endcard' })], 2)
    expect(r.hookTextStart).toBeNull()
    expect(r.problems.join()).toContain('captions do not count')
  })

  it('fails an empty beat list', () => {
    expect(evaluateHook([], [card()], 2).problems).toContain('the manifest has no beats')
  })
})

describe('computeShots', () => {
  it('cuts the film at scene cuts and stops at the end card', () => {
    const r = computeShots([4, 9.5], 27.5, 24.45)
    expect(r.shots.map((s) => s.duration)).toEqual([4, 5.5, 14.95])
  })

  it('treats cuts inside the end card as word pops, not shots', () => {
    const r = computeShots([4, 24.5, 25, 25.4, 25.7], 27.5, 24.45)
    expect(r.shots).toHaveLength(2)
    expect(r.ignoredCuts).toEqual([24.5, 25, 25.4, 25.7])
  })

  it('counts the cut that starts the end card as the end of the last shot, not a short shot', () => {
    expect(computeShots([4, 24.42], 27.5, 24.45).shots.map((s) => s.duration)).toEqual([4, 20.45])
  })

  it('runs to the end of the film with no end card', () => {
    expect(computeShots([10], 20, null).shots.map((s) => s.duration)).toEqual([10, 10])
  })

  it('finds a short shot between two close cuts', () => {
    const r = computeShots([5, 6], 27.5, 24.45)
    expect(shortHolds(r.shots, 2.5).map((s) => s.duration)).toEqual([1])
  })

  it('returns one shot for a film with no cuts', () => {
    expect(computeShots([], 15, 12).shots).toEqual([{ start: 0, end: 12, duration: 12 }])
  })
})

describe('shortHolds', () => {
  it('flags only holds under the minimum, with float slack', () => {
    expect(shortHolds([{ duration: 2.5 }, { duration: 2.49 }, { duration: 2.4999999 }], 2.5)).toEqual([{ duration: 2.49 }])
  })
})

describe('judgeLoudness', () => {
  it('passes inside the window and at the edges', () => {
    expect(judgeLoudness(-14, -1.7).problems).toEqual([])
    expect(judgeLoudness(-15, -1).problems).toEqual([])
    expect(judgeLoudness(-13, -3).problems).toEqual([])
  })

  it('fails too quiet, too loud and too hot a peak', () => {
    expect(judgeLoudness(-15.1, -2).problems[0]).toContain('outside -15 to -13')
    expect(judgeLoudness(-12.9, -2).problems[0]).toContain('outside')
    expect(judgeLoudness(-14, -0.9).problems[0]).toContain('above -1')
  })

  it('fails silence and a missing peak', () => {
    expect(judgeLoudness(null, -2).problems[0]).toContain('silence')
    expect(judgeLoudness(-14, null).problems[0]).toContain('no true peak')
  })
})

describe('silentFilmDeclared', () => {
  const audio = { lufs: null, truePeakDb: null, silent: true }
  it('needs no voice and a silent audio block', () => {
    expect(silentFilmDeclared(null, audio)).toBe(true)
    expect(silentFilmDeclared(null, { ...audio, silent: false })).toBe(false)
    expect(silentFilmDeclared({ engine: 'e', model: 'm', voiceId: 'v', words: [] }, audio)).toBe(false)
  })
})

describe('evaluateCaptions', () => {
  const voice: ManifestVoice = {
    engine: 'elevenlabs', model: 'eleven_v3', voiceId: 'v',
    words: [
      { word: 'Okay,', start: 0.12, end: 0.41 },
      { word: 'so', start: 0.45, end: 0.6 },
      { word: 'sixty', start: 0.65, end: 0.9 },
      { word: 'three', start: 0.9, end: 1.1 },
      { word: 'percent', start: 1.1, end: 1.5 },
      { word: 'cut', start: 1.55, end: 1.8 },
    ],
  }
  const caps = (): ManifestCaption[] => [
    { text: 'OKAY SO', start: 0.12, end: 0.6, words: [0, 1] },
    { text: '63% CUT', start: 0.65, end: 1.8, words: [2, 3, 4, 5] },
  ]

  it('passes captions that cover the speech, in sync', () => {
    const f = evaluateCaptions(voice, caps())
    expect(captionProblems(f)).toEqual([])
  })

  it('fails a caption over four words', () => {
    const c = caps()
    c[1].text = 'SIXTY THREE PERCENT CUT NOW'
    expect(evaluateCaptions(voice, c).tooLong).toHaveLength(1)
  })

  it('passes exactly four words and 0.4 seconds', () => {
    const c: ManifestCaption[] = [{ text: 'OKAY SO SIXTY THREE', start: 0.12, end: 0.52, words: [0, 1, 2, 3] }, { text: 'PERCENT CUT', start: 1.1, end: 1.5, words: [4, 5] }]
    const f = evaluateCaptions(voice, c)
    expect(f.tooLong).toEqual([])
    expect(f.tooShort).toEqual([])
  })

  it('fails a caption under 0.4 seconds', () => {
    const c = caps()
    c[0].end = 0.5
    expect(evaluateCaptions(voice, c).tooShort).toHaveLength(1)
  })

  it('fails a caption more than 0.08 s off its first word, and accepts exactly 0.08', () => {
    const c = caps()
    c[1].start = 0.65 + 0.081
    expect(evaluateCaptions(voice, c).offSync).toHaveLength(1)
    c[1].start = 0.65 + 0.08
    expect(evaluateCaptions(voice, c).offSync).toHaveLength(0)
    c[1].start = 0.65 - 0.2
    expect(evaluateCaptions(voice, c).offSync).toHaveLength(1)
  })

  it('fails a spoken word no caption shows', () => {
    const f = evaluateCaptions(voice, [caps()[0]])
    expect(f.uncovered).toHaveLength(4)
    expect(captionProblems(f).join()).toContain('no caption shows')
  })

  it('fails caption text that is not the spoken words', () => {
    const c = caps()
    c[1].text = '64% CUT'
    expect(evaluateCaptions(voice, c).mismatched).toHaveLength(1)
    c[1].text = 'PRICE DROP'
    expect(evaluateCaptions(voice, c).mismatched).toHaveLength(1)
  })

  it('fails indices that point at no spoken word', () => {
    const c = caps()
    c[0].words = [99]
    c.push({ text: 'X', start: 3, end: 4, words: [] })
    expect(evaluateCaptions(voice, c).badIndices).toHaveLength(2)
  })
})

describe('evaluateNumbers', () => {
  const row = { onScreen: '63%', source: 'Supabase', window: '2026-07-01..2026-09-30', geography: 'Bend', definition: 'x' }

  it('passes figures with complete rows and ignores the locked phone', () => {
    const f = evaluateNumbers([card(), card({ kind: 'endcard', text: 'Call now 541.703.3095' })], [], [row])
    expect(f.tokens).toEqual(['63%'])
    expect(f.unmatched).toEqual([])
    expect(f.incompleteRows).toEqual([])
  })

  it('reads captions too', () => {
    const f = evaluateNumbers([], [{ text: '$475K', start: 0, end: 1, words: [0] }], [row])
    expect(f.unmatched).toEqual(['$475K'])
  })

  it('matches a token inside a longer onScreen string, ignoring case and spaces', () => {
    const f = evaluateNumbers([card({ text: '$475K median' })], [], [{ ...row, onScreen: '$475 K median' }])
    expect(f.unmatched).toEqual([])
  })

  it('fails a figure with no row', () => {
    expect(evaluateNumbers([card({ text: '12 days' })], [], [row]).unmatched).toEqual(['12'])
  })

  it('names the missing trace fields, including blank ones', () => {
    const f = evaluateNumbers([card()], [], [{ onScreen: '63%', source: 'x', window: ' ', definition: 'y' }])
    expect(f.incompleteRows).toEqual(['"63%" is missing window, geography'])
  })

  it('passes a film with no figures', () => {
    expect(evaluateNumbers([card({ text: 'Bend homes' })], [], [])).toEqual({ tokens: [], unmatched: [], incompleteRows: [] })
  })
})

describe('evaluateCopy', () => {
  const banned = ['nestled', 'top team', "buyer's market", 'explore']
  const hit = (texts: ManifestText[], voice: ManifestVoice | null = null) => evaluateCopy(texts, [], voice, banned).map((h) => h.what)

  it('passes clean copy', () => {
    expect(hit([card()])).toEqual([])
  })

  it('catches em and en dashes', () => {
    expect(hit([card({ text: 'Bend \u2014 homes' })])).toEqual(['em or en dash'])
    expect(hit([card({ text: '2026\u20132027' })])).toEqual(['em or en dash'])
  })

  it('catches banned phrases on word boundaries, case insensitively, and curly apostrophes', () => {
    expect(hit([card({ text: 'Nestled in Bend' })])).toEqual(['banned phrase "nestled"'])
    expect(hit([card({ text: 'A buyer\u2019s market' })])).toEqual(['banned phrase "buyer\'s market"'])
    expect(hit([card({ text: 'the TOP  TEAM' })])).toEqual(['banned phrase "top team"'])
    expect(hit([card({ text: 'unexplored' })])).toEqual([])
  })

  it('reads the voice words as one line, so a phrase across words is caught', () => {
    const voice: ManifestVoice = { engine: 'e', model: 'm', voiceId: 'v', words: [{ word: 'top', start: 0, end: 1 }, { word: 'team', start: 1, end: 2 }] }
    expect(evaluateCopy([], [], voice, banned)).toEqual([{ where: 'voice', what: 'banned phrase "top team"' }])
  })

  it('reports where each hit is', () => {
    const hits = evaluateCopy([card(), card({ text: 'explore' })], [{ text: 'nestled', start: 0, end: 1, words: [] }], null, banned)
    expect(hits.map((h) => h.where)).toEqual(['texts[1]', 'captions[0]'])
  })
})

describe('evaluateSafeArea', () => {
  const box = (x: number, y: number, w: number, h: number, kind: ManifestText['kind'] = 'card') => card({ box: { x, y, w, h }, kind, text: 'T' })

  it('passes boxes inside 960 by 1640, including exactly on the line', () => {
    expect(evaluateSafeArea([box(90, 400, 870, 220), box(0, 1400, 100, 240)])).toEqual([])
  })

  it('fails the right edge and the bottom edge', () => {
    expect(evaluateSafeArea([box(90, 400, 871, 220)])).toHaveLength(1)
    expect(evaluateSafeArea([box(90, 1500, 100, 141)])).toHaveLength(1)
  })

  it('leaves end card text alone', () => {
    expect(evaluateSafeArea([box(0, 1700, 1080, 200, 'endcard')])).toEqual([])
  })
})

describe('evaluateEndcardTiming', () => {
  const ec: ManifestEndcard = { start: 24.45, quality: 24.45, local: 24.85, service: 25.25, call: 25.7, out: 27.5 }
  const beats: ManifestBeat[] = [{ id: 'b', role: 'body', start: 0, end: 24.45 }, { id: 'e', role: 'endcard', start: 24.45, end: 27.5 }]

  it('passes the spec timing', () => {
    const r = evaluateEndcardTiming(ec, beats, 27.5)
    expect(r.problems).toEqual([])
    expect(r.wordsSpan).toBe(0.8)
    expect(r.callHold).toBe(1.8)
  })

  it('passes the spec defaults, and the song cue example', () => {
    expect(evaluateEndcardTiming({ start: 0, quality: 0, local: 0.4, service: 0.8, call: 1.25, out: 3.05 }, beats, 3.05).problems).toEqual([])
    expect(evaluateEndcardTiming({ start: 34.521, quality: 34.521, local: 34.93, service: 35.34, call: 36.165, out: 39.452 }, beats, 39.452).problems).toEqual([])
  })

  it('fails steps out of order', () => {
    expect(evaluateEndcardTiming({ ...ec, local: 25.5 }, beats, 27.5).problems.join()).toContain('out of order')
    expect(evaluateEndcardTiming({ ...ec, call: 25.0 }, beats, 27.5).problems.join()).toContain('out of order')
    expect(evaluateEndcardTiming({ ...ec, quality: 24.4 + 1 }, beats, 27.5).problems.join()).toContain('out of order')
  })

  it('fails words slower than about a second', () => {
    expect(evaluateEndcardTiming({ ...ec, service: 25.8, call: 26.0 }, beats, 27.5).problems.join()).toContain('the three words take')
  })

  it('fails a call hold under 1.5 s and passes exactly 1.5', () => {
    expect(evaluateEndcardTiming({ ...ec, out: 27.1 }, beats, 27.1).problems.join()).toContain('holds 1.4s')
    expect(evaluateEndcardTiming({ ...ec, out: 27.2 }, beats, 27.2).problems).toEqual([])
  })

  it('fails when the last beat is not the end card or the card outlasts the film', () => {
    expect(evaluateEndcardTiming(ec, [beats[0]], 27.5).problems[0]).toContain('must be the end card')
    expect(evaluateEndcardTiming(ec, beats, 26).problems.join()).toContain('film runs')
    expect(evaluateEndcardTiming(ec, beats, 29).problems.join()).toContain('film runs')
  })
})

describe('evaluateReview', () => {
  const sha = 'a'.repeat(64)
  const ok = { sha256: sha, reviewer: 'grok', watched: true, listened: true, verdict: 'ship' }

  it('passes a complete review by someone else', () => {
    expect(evaluateReview(ok, sha, 'claude', true)).toEqual([])
  })

  it('does not require listening when the film has no audio', () => {
    expect(evaluateReview({ ...ok, listened: false }, sha, 'claude', false)).toEqual([])
    expect(evaluateReview({ ...ok, listened: false }, sha, 'claude', true)).toHaveLength(1)
  })

  it('fails each way a review can be wrong', () => {
    expect(evaluateReview({ ...ok, sha256: 'b'.repeat(64) }, sha, undefined, true)[0]).toContain('different file')
    expect(evaluateReview({ ...ok, reviewer: '  ' }, sha, undefined, true)[0]).toContain('no reviewer')
    expect(evaluateReview({ ...ok, reviewer: 'Claude ' }, sha, 'claude', true)[0]).toContain('built the film')
    expect(evaluateReview({ ...ok, watched: false }, sha, undefined, true)[0]).toContain('not watched')
    expect(evaluateReview({ ...ok, verdict: 'fix' }, sha, undefined, true)[0]).toContain('"ship"')
    expect(evaluateReview({}, sha, undefined, true).length).toBeGreaterThanOrEqual(4)
  })

  it('compares the hash case insensitively', () => {
    expect(evaluateReview({ ...ok, sha256: sha.toUpperCase() }, sha, undefined, true)).toEqual([])
  })
})
