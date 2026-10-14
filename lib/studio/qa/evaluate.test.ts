import { describe, expect, it } from 'vitest'
import {
  captionProblems,
  computeShots,
  evaluateCaptions,
  evaluateCopy,
  evaluateVerdictWords,
  evaluateEndcardTiming,
  evaluateHook,
  evaluateNumbers,
  evaluateReview,
  evaluateSafeArea,
  judgeLoudness,
  endcardStartFromPixels,
  leadingNumber,
  shotsCutoff,
  numberProblems,
  shortHolds,
  silentFilmDeclared,
  voiceoverRequired,
  fixedRow,
  supplyRow,
  verdictsIn,
} from './evaluate'
import type { ManifestBeat, ManifestCaption, ManifestEndcard, ManifestText, ManifestVoice } from './manifest'

const card = (over: Partial<ManifestText> = {}): ManifestText => ({
  text: '63% cut their price', start: 0.2, end: 3.1, box: { x: 90, y: 400, w: 860, h: 220 }, kind: 'card', ...over,
})

describe('the end card start the pixels show (checks 5 and 12)', () => {
  const frames = (from: number, values: number[]) => values.map((fraction, i) => ({ t: Math.round((from + i / 10) * 1000) / 1000, fraction }))

  it('is the start of the cream run that holds the golden probe', () => {
    const f = frames(11.9, [0.001, 0.001, 0.001, 0.997, 0.93, 0.93, 0.86, 0.85, 0.85])
    expect(endcardStartFromPixels(f, 12.6)).toBe(12.2)
  })

  it('is null when the probe frame is not the cream card', () => {
    expect(endcardStartFromPixels(frames(0, [0.9, 0.9, 0.1, 0.1]), 0.3)).toBeNull()
    expect(endcardStartFromPixels([], 1)).toBeNull()
  })

  it('never lets a start claimed early hide real cuts', () => {
    // review finding: computeShots trusted manifest.endcard.start, so an early start ignored every later cut
    expect(shotsCutoff(2, 12.2)).toBe(12.2)
    expect(shotsCutoff(12.25, 12.2)).toBe(12.25)
    expect(shotsCutoff(12.2, null)).toBeNull()
    expect(shotsCutoff(null, 12.2)).toBeNull()
    const cuts = [3.3, 6, 7.2, 8.7, 12.2, 12.6, 13]
    expect(computeShots(cuts, 15.3, shotsCutoff(2, 12.2)).shots.map((x) => x.duration)).toContain(1.2)
  })
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
  it('needs no voice, a silent audio block, and a type and brief that ask for no voiceover', () => {
    expect(silentFilmDeclared(null, audio, false)).toBe(true)
    expect(silentFilmDeclared(null, { ...audio, silent: false }, false)).toBe(false)
    expect(silentFilmDeclared({ engine: 'e', model: 'm', voiceId: 'v', words: [] }, audio, false)).toBe(false)
  })

  it('never passes a silent film when a voiceover is required', () => {
    expect(silentFilmDeclared(null, audio, true)).toBe(false)
  })
})

describe('voiceoverRequired', () => {
  it('is required by default, by the type, or by the brief', () => {
    expect(voiceoverRequired({ requires_voiceover: true }, null)).toBe(true)
    expect(voiceoverRequired(null, null)).toBe(true)
    expect(voiceoverRequired({ requires_voiceover: false }, { spec_rules: { voiceover: { engine: 'elevenlabs_v3' } } })).toBe(true)
  })

  it('is not required only when the type says so and the brief names none', () => {
    expect(voiceoverRequired({ requires_voiceover: false }, { spec_rules: {} })).toBe(false)
    expect(voiceoverRequired({ requires_voiceover: false }, null)).toBe(false)
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
  const trace = { source: 's', window: 'w', geography: 'g', definition: 'd' }
  const voiceOf = (text: string): ManifestVoice => ({
    engine: 'elevenlabs', model: 'eleven_v3', voiceId: 'v',
    words: text.split(' ').map((word, i) => ({ word, start: i * 0.3, end: i * 0.3 + 0.25 })),
  })

  it('passes figures with complete rows and ignores the locked phone', () => {
    const f = evaluateNumbers([card(), card({ kind: 'endcard', text: 'Call now 541.703.3095' })], [], [row], null)
    expect(f.tokens).toEqual(['63%'])
    expect(numberProblems(f)).toEqual([])
  })

  it('reads captions too', () => {
    const f = evaluateNumbers([], [{ text: '$475K', start: 0, end: 1, words: [0] }], [row], null)
    expect(f.unmatched).toEqual(['"$475K" in captions[0] "$475K"'])
  })

  it('matches whole tokens with their unit or prefix, never a substring', () => {
    // review finding: "4" passed against "4 mo", "10" against "10 mo", "$475" against "$475K"
    expect(evaluateNumbers([card({ text: 'under 4' })], [], [{ ...row, onScreen: '4 mo' }], null).unmatched).toHaveLength(1)
    expect(evaluateNumbers([card({ text: '10 homes' })], [], [{ ...row, onScreen: '10 mo' }], null).unmatched).toHaveLength(1)
    expect(evaluateNumbers([card({ text: '$475 down' })], [], [{ ...row, onScreen: '$475K' }], null).unmatched).toHaveLength(1)
    expect(evaluateNumbers([card({ text: '$475K median' })], [], [{ ...row, onScreen: 'median $475K' }], null).unmatched).toEqual([])
    expect(evaluateNumbers([card({ text: '4 mo' })], [], [{ ...row, onScreen: '4 MO' }], null).unmatched).toEqual([])
  })

  it('lets an authored row cover only its own drawn box, never a caption, the voice or another box', () => {
    const box = { x: 243, y: 510, w: 70, h: 39 }
    const mark = { onScreen: '4 mo', ...trace, boxes: [box] }
    expect(numberProblems(evaluateNumbers([card({ text: '4 mo', box })], [], [mark], null))).toEqual([])
    expect(evaluateNumbers([card({ text: '4 mo', box: { ...box, y: 900 } })], [], [mark], null).unmatched).toHaveLength(1)
    const cap = evaluateNumbers([], [{ text: 'under 4 mo', start: 0, end: 1, words: [0, 1, 2] }], [mark], voiceOf('under four months'))
    expect(cap.unmatched).toEqual(['"4 mo" in captions[0] "under 4 mo"'])
    expect(evaluateNumbers([], [], [mark], voiceOf('it is 4 mo')).unmatched).toEqual(['"4 mo" in the voice'])
  })

  it('reads ranks and figures glued to punctuation', () => {
    expect(evaluateNumbers([card({ text: '#1 in Bend' })], [], [row], null).unmatched).toEqual(['"#1" in texts[0] "#1 in Bend"'])
    expect(evaluateNumbers([card({ text: 'prices fell,12%' })], [], [row], null).unmatched).toEqual(['"12%" in texts[0] "prices fell,12%"'])
  })

  it('fails a figure with no row', () => {
    expect(evaluateNumbers([card({ text: '12 days' })], [], [row], null).unmatched).toEqual(['"12 days" in texts[0] "12 days"'])
  })

  it('carries the unit: one row does not cover the same digits in another unit (F3)', () => {
    // review finding: "3.5 days to pending" and "4 days on market" passed beside the
    // months-of-supply row "3.5" and the threshold row "4".
    const mos = { onScreen: '3.5', source: 'market_metric', window: '2026-04-17..2026-10-13', geography: 'Bend', definition: 'Months of supply: active listings over monthly sales' }
    const threshold = { onScreen: '4', source: 'lib/market/classify.ts', window: 'none: a fixed threshold, not a measurement', geography: 'every market', definition: 'The months-of-supply threshold' }
    const f = evaluateNumbers([card({ text: '3.5 days to pending' }), card({ text: '4 days on market' })], [], [mos, threshold], null)
    expect(f.unmatched).toEqual(['"3.5 days" in texts[0] "3.5 days to pending"', '"4 days" in texts[1] "4 days on market"'])
    expect(numberProblems(f)).toHaveLength(2)
    // The same row covers its figure bare (the meter) and in its own unit (a caption).
    expect(numberProblems(evaluateNumbers([card({ text: '3.5' })], [{ text: '3.5 months of homes', start: 0, end: 1, words: [0, 1, 2, 3] }], [mos], null))).toEqual([])
    // A row whose own figure carries a unit needs that unit.
    expect(evaluateNumbers([card({ text: '45 days' })], [], [{ ...mos, onScreen: '45 mo' }], null).unmatched).toHaveLength(1)
    // Fullwidth digits are figures.
    expect(evaluateNumbers([card({ text: '１２％ of homes' })], [], [mos], null).unmatched).toEqual(['"12%" in texts[0] "１２％ of homes"'])
    expect(evaluateNumbers([card({ text: '１２％ of homes' })], [], [{ ...row, onScreen: '12%' }], null).unmatched).toEqual([])
  })

  it('lets a threshold row (window "none") cover only its own bound box, never a caption or the voice (F3)', () => {
    const box = { x: 10, y: 20, w: 30, h: 40 }
    const threshold = { onScreen: '4', source: 'lib/market/classify.ts', window: 'none: a fixed threshold', geography: 'every market', definition: 'The months-of-supply threshold' }
    expect(fixedRow(threshold)).toBe(true)
    expect(fixedRow({ window: '2026-01-01..2026-09-30' })).toBe(false)
    // Unbound: covers nothing anywhere.
    expect(evaluateNumbers([card({ text: '4' })], [], [threshold], null).unmatched).toHaveLength(1)
    const voice = voiceOf('under four months')
    const caps: ManifestCaption[] = [{ text: 'under 4 months', start: 0, end: 1, words: [0, 1, 2] }]
    const said = evaluateNumbers([], caps, [threshold], voice)
    expect(said.unmatched).toEqual(['"4 mo" in captions[0] "under 4 months"'])
    expect(said.spokenUnsourced[0]).toContain('shown as "4 mo", which no brief numbers row covers')
    // Bound to its box: covers that card only.
    const bound = { ...threshold, boxes: [box] }
    expect(evaluateNumbers([card({ text: '4', box })], [], [bound], null).unmatched).toEqual([])
    expect(evaluateNumbers([card({ text: '4', box: { ...box, y: 900 } })], [], [bound], null).unmatched).toHaveLength(1)
    expect(evaluateNumbers([], caps, [bound], voice).spokenUnsourced).toHaveLength(1)
  })

  it('fails a figure said in words that no caption shows as a sourced figure', () => {
    // review finding: "prices fell twelve percent" with no display rule and no row passed
    const voice = voiceOf('prices fell twelve percent')
    const caps: ManifestCaption[] = [{ text: 'prices fell twelve percent', start: 0, end: 1.2, words: [0, 1, 2, 3] }]
    const f = evaluateNumbers([], caps, [row], voice)
    expect(f.spokenUnsourced[0]).toContain('"twelve percent" is not shown as a figure')
    expect(f.wordsOnScreen).toEqual(['"twelve percent" in captions[0] "prices fell twelve percent"'])
    const shown = evaluateNumbers([], [{ ...caps[0], text: 'prices fell 12%' }], [row], voice)
    expect(shown.spokenUnsourced[0]).toContain('shown as "12%", which no brief numbers row covers')
    const sourced = evaluateNumbers([], [{ ...caps[0], text: 'prices fell 12%' }], [{ ...row, onScreen: '12%' }], voice)
    expect(numberProblems(sourced)).toEqual([])
    expect(sourced.spoken).toEqual(['"twelve percent" shown as "12%"'])
  })

  it('does not let an authored row source a spoken figure', () => {
    const voice = voiceOf('under four months')
    const caps: ManifestCaption[] = [{ text: 'under 4 months', start: 0, end: 1, words: [0, 1, 2] }]
    const f = evaluateNumbers([], caps, [{ onScreen: '4', ...trace, boxes: [{ x: 0, y: 0, w: 10, h: 10 }] }], voice)
    expect(f.spokenUnsourced[0]).toContain('no brief numbers row covers')
    expect(numberProblems(evaluateNumbers([], caps, [{ onScreen: '4', ...trace, definition: 'months of supply' }], voice))).toEqual([])
  })

  it("refuses the review's quantity words unless a caption shows each as a sourced figure (F4)", () => {
    const said = 'Prices doubled in a dozen neighborhoods and half the listings cut their price by a quarter'
    const voice = voiceOf(said)
    const all = said.split(' ').map((_, i) => i)
    const asWords = evaluateNumbers([], [{ text: said, start: 0, end: 5, words: all }], [row], voice)
    expect(asWords.spokenUnsourced).toHaveLength(4)
    expect(asWords.wordsOnScreen).toHaveLength(4)
    // Shown through display rules as figures, each still needs a brief row.
    const shown = 'Prices 2x in 12 neighborhoods and 50% the listings cut their price by 25%'
    const unsourced = evaluateNumbers([], [{ text: shown, start: 0, end: 5, words: all }], [row], voice)
    expect(unsourced.spokenUnsourced).toEqual([
      'spoken "doubled" is shown as "2 times", which no brief numbers row covers',
      'spoken "a dozen" is shown as "12 neighborhoods", which no brief numbers row covers',
      'spoken "half" is shown as "50%", which no brief numbers row covers',
      'spoken "a quarter" is shown as "25%", which no brief numbers row covers',
    ])
    const rows = ['2x', '12 neighborhoods', '50%', '25%'].map((onScreen) => ({ ...row, onScreen }))
    expect(evaluateNumbers([], [{ text: shown, start: 0, end: 5, words: all }], rows, voice).spokenUnsourced).toEqual([])
    // A vague quantity has no figure to show.
    expect(evaluateNumbers([], [], [row], voiceOf('most buyers wait')).spokenUnsourced[0]).toContain('is a quantity with no single figure')
  })

  it('fails a spoken figure on no caption, and a figure written in words on a card', () => {
    const f = evaluateNumbers([card({ text: 'Up three hundred homes' })], [], [row], voiceOf('three hundred homes'))
    expect(f.spokenUnsourced[0]).toContain('is on no caption')
    expect(f.wordsOnScreen).toEqual(['"three hundred" in texts[0] "Up three hundred homes"'])
  })

  it('allows the short list of non-statistical number words', () => {
    const voice = voiceOf('one of the best and this one')
    const f = evaluateNumbers([card({ text: 'One of a kind' })], [{ text: 'one of the best', start: 0, end: 1, words: [0, 1, 2, 3] }, { text: 'and this one', start: 1, end: 2, words: [4, 5, 6] }], [], voice)
    expect(numberProblems(f)).toEqual([])
  })

  it('names the missing trace fields, including blank ones', () => {
    const f = evaluateNumbers([card()], [], [{ onScreen: '63%', source: 'x', window: ' ', definition: 'y' }], null)
    expect(f.incompleteRows).toEqual(['"63%" is missing window, geography'])
  })

  it('passes a film with no figures', () => {
    expect(numberProblems(evaluateNumbers([card({ text: 'Bend homes' })], [], [], null))).toEqual([])
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

  it('scans every text, caption and the voice with video_gate\'s fair housing, address and name lists', () => {
    const flags = ['family-friendly', 'young professionals']
    const voice: ManifestVoice = { engine: 'e', model: 'm', voiceId: 'v', words: ['A', 'family-friendly', 'street'].map((word, i) => ({ word, start: i, end: i + 1 })) }
    const hits = evaluateCopy([card({ text: 'Perfect for young professionals' })], [{ text: 'Mr Smith sold', start: 0, end: 1, words: [] }, { text: '123 Main Street', start: 1, end: 2, words: [] }], voice, banned, flags)
    expect(hits).toEqual([
      { where: 'texts[0]', what: 'fair housing flag "young professionals" (describe homes and places, never people)' },
      { where: 'captions[0]', what: 'a person\'s name "Mr Smith" (no buyer or seller names)' },
      { where: 'captions[1]', what: 'an address "123 Main Street" (no addresses anywhere)' },
      { where: 'voice', what: 'fair housing flag "family-friendly" (describe homes and places, never people)' },
    ])
  })
})

describe('evaluateVerdictWords', () => {
  const mos = (onScreen: string) => ({ onScreen, source: "market_metric stat_id='months_of_supply'", definition: 'Months of supply: active / (closed_180d / 6)' })
  const say = (text: string) => [card({ text })]

  it('refuses buyer-side words beside a seller-band figure (the 3.5 leverage film)', () => {
    expect(evaluateVerdictWords([mos('3.5')], say('Buyers have leverage'), [], null)).toEqual([
      { where: 'texts[0]', what: '"buyers have leverage" beside 3.5 months of supply, which is the sellers band' },
    ])
  })

  it('refuses a seller verdict beside a balanced figure, as in the 4.3 example', () => {
    expect(evaluateVerdictWords([mos('4.3')], say("A seller\u2019s market"), [], null).map((h) => h.what)).toEqual([
      '"seller\'s market" beside 4.3 months of supply, which is the balanced band',
    ])
  })

  it('reads captions and the voice too', () => {
    const voice: ManifestVoice = { engine: 'e', model: 'm', voiceId: 'v', words: ['Buyers', 'have', 'leverage.'].map((word, i) => ({ word, start: i, end: i + 1 })) }
    const hits = evaluateVerdictWords([mos('3.5')], [], [{ text: 'buyers have leverage', start: 0, end: 1, words: [] }], voice)
    expect(hits.map((h) => h.where)).toEqual(['captions[0]', 'voice'])
  })

  it('passes words that agree with the band', () => {
    expect(evaluateVerdictWords([mos('7.1')], say('Buyers have leverage'), [], null)).toEqual([])
    expect(evaluateVerdictWords([mos('3.5')], say('Sellers have the edge'), [], null)).toEqual([])
  })

  it('reads only the measured figure, not the meter scale marks', () => {
    const mark = { onScreen: '4 mo', window: 'none: a fixed scale mark on the meter, not a measurement', definition: 'scale mark at 4 months of supply' }
    expect(evaluateVerdictWords([mark], say("Seller's market"), [], null)).toEqual([])
  })

  it('parses the leading number of a figure such as "3.5 months"', () => {
    // review finding: the check skipped "3.5 months" because it wanted a bare number
    expect(leadingNumber('3.5 months')).toBe(3.5)
    expect(leadingNumber('Bend 3.5')).toBeNull()
    expect(evaluateVerdictWords([mos('3.5 months')], say('Buyers have leverage'), [], null)).toHaveLength(1)
  })

  it('knows the other ways to say who the market favors', () => {
    expect(evaluateVerdictWords([mos('3.5')], say('The market favors buyers'), [], null)).toHaveLength(1)
    expect(evaluateVerdictWords([mos('3.5')], say('A buyer-friendly spring'), [], null)).toHaveLength(1)
    expect(evaluateVerdictWords([mos('7')], say('A seller-friendly spring'), [], null)).toHaveLength(1)
    expect(evaluateVerdictWords([mos('7')], say('Sellers are in control'), [], null)).toHaveLength(1)
    expect(evaluateVerdictWords([mos('7')], say('The market favors sellers'), [], null)).toHaveLength(1)
    expect(evaluateVerdictWords([mos('5')], say('Buyers are in control'), [], null)).toHaveLength(1)
  })

  it("hits all five of the review's phrasings, and the ellipsis the voice keeps (F5)", () => {
    // review finding: an inserted word, a reordered line or "Buyers..." slipped past the exact phrases
    for (const line of ['Buyers now have leverage', 'Buyers have real leverage', 'The edge goes to buyers', 'Buyers are in charge', 'Buyers... have the edge.']) {
      expect(evaluateVerdictWords([mos('3.5')], say(line), [], null), line).toHaveLength(1)
    }
    const voice: ManifestVoice = { engine: 'e', model: 'm', voiceId: 'v', words: ['Buyers...', 'have', 'the', 'edge.'].map((word, i) => ({ word, start: i, end: i + 1 })) }
    expect(evaluateVerdictWords([mos('3.5')], [], [], voice)).toEqual([{ where: 'voice', what: '"buyers have the edge" beside 3.5 months of supply, which is the sellers band' }])
  })

  it('reads a side word within four words of an edge word, and who loses or is denied the edge', () => {
    expect(verdictsIn('Buyers have the upper hand')).toEqual([{ side: 'buyers', words: 'buyers have the upper hand' }])
    expect(verdictsIn('the advantage is with sellers')[0].side).toBe('sellers')
    expect(verdictsIn('buying power is with buyers')[0].side).toBe('buyers')
    expect(verdictsIn('Sellers have the edge over buyers')).toEqual([{ side: 'sellers', words: 'sellers have the edge' }])
    expect(verdictsIn('Buyers have no leverage')).toEqual([{ side: 'sellers', words: 'buyers have no leverage' }])
    expect(verdictsIn('buyers in this town still say the edge is real')).toEqual([])
    expect(verdictsIn("Send this to whoever you're house hunting with")).toEqual([])
    // Beside 3.5 months, a line that agrees is fine; one that does not is caught.
    expect(evaluateVerdictWords([mos('3.5')], say('Sellers have the edge over buyers'), [], null)).toEqual([])
    expect(evaluateVerdictWords([mos('3.5')], say('Buyers have no leverage'), [], null)).toEqual([])
    expect(evaluateVerdictWords([mos('7')], say('Buyers have no leverage'), [], null)).toHaveLength(1)
  })

  it('finds the supply row by its stat id or by its definition, not only by the words "months of supply" (F5)', () => {
    // review finding: a row defined as "active listings divided by monthly closed sales" switched the check off
    const byDefinition = { onScreen: '3.5', source: 'Supabase market_metric', definition: 'active listings divided by monthly closed sales' }
    expect(evaluateVerdictWords([byDefinition], say('Buyers have leverage'), [], null)).toHaveLength(1)
    expect(supplyRow({ source: "market_metric stat_id='months_of_supply'", definition: 'x' })).toBe(true)
    expect(supplyRow({ source: 's', definition: 'Active single-family listings over the six-month average of closed sales' })).toBe(true)
    expect(supplyRow({ source: 's', definition: 'share of listings with a price cut' })).toBe(false)
  })

  it('reads only brief rows, not authored rows with boxes', () => {
    expect(evaluateVerdictWords([{ ...mos('3.5'), boxes: [{ x: 0, y: 0, w: 1, h: 1 }] }], say('Buyers have leverage'), [], null)).toEqual([])
  })

  it('ignores films with no months-of-supply figure', () => {
    expect(evaluateVerdictWords([{ onScreen: '63%', definition: 'share of listings with a price cut' }], say('Buyers have leverage'), [], null)).toEqual([])
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
    const at = (start: number): ManifestBeat[] => [{ id: 'b', role: 'body', start: 0, end: start || 1 }, { id: 'e', role: 'endcard', start, end: start + 3 }]
    expect(evaluateEndcardTiming({ start: 0, quality: 0, local: 0.4, service: 0.8, call: 1.25, out: 3.05 }, at(0), 3.05).problems).toEqual([])
    expect(evaluateEndcardTiming({ start: 34.521, quality: 34.521, local: 34.93, service: 35.34, call: 36.165, out: 39.452 }, at(34.521), 39.452).problems).toEqual([])
  })

  it('fails an endcard.start that is not the end card beat\'s start', () => {
    // review finding: endcard.start was a free claim, separate from the beats
    const early = { ...ec, start: 2 }
    expect(evaluateEndcardTiming(early, beats, 27.5).problems.join()).toContain("is not the end card beat's start 24.45s")
    expect(evaluateEndcardTiming({ ...ec, start: 24.45 + 1 / 30 }, beats, 27.5).problems.join()).not.toContain('beat')
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
    expect(evaluateReview({ ...ok, sha256: 'b'.repeat(64) }, sha, 'claude', true)[0]).toContain('different file')
    expect(evaluateReview({ ...ok, reviewer: '  ' }, sha, 'claude', true)[0]).toContain('no reviewer')
    expect(evaluateReview({ ...ok, reviewer: 'Claude ' }, sha, 'claude', true)[0]).toContain('is the builder')
    expect(evaluateReview({ ...ok, watched: false }, sha, 'claude', true)[0]).toContain('not watched')
    expect(evaluateReview({ ...ok, verdict: 'fix' }, sha, 'claude', true)[0]).toContain('"ship"')
    expect(evaluateReview({}, sha, 'claude', true).length).toBeGreaterThanOrEqual(4)
  })

  it('refuses a reviewer id that starts with the builder\'s, and a manifest with no builder', () => {
    expect(evaluateReview({ ...ok, reviewer: 'claude-reviewer' }, sha, 'claude', true)[0]).toContain('may not equal or start with')
    expect(evaluateReview({ ...ok, reviewer: 'grok' }, sha, 'claude-2', true)).toEqual([])
    expect(evaluateReview(ok, sha, undefined, true)[0]).toContain('names no builder')
    expect(evaluateReview(ok, sha, '  ', true)[0]).toContain('names no builder')
  })

  it('compares the hash case insensitively', () => {
    expect(evaluateReview({ ...ok, sha256: sha.toUpperCase() }, sha, 'claude', true)).toEqual([])
  })
})
