import { describe, expect, it } from 'vitest'
import { mulberry32 } from '../score/rng'
import {
  CaptionRuleError,
  MAX_CARD_WORDS,
  MIN_CARD_SECONDS,
  buildCaptions,
  planCaptions,
  validateCaptions,
} from './captions'
import type { CaptionCard, SpokenWord } from './types'
import { alignmentToWords } from './words'

/**
 * Words said one after another: each `dur` seconds long, `gap` seconds apart,
 * with per-word overrides of the gap AFTER that word index.
 */
function speak(text: string, opts: { dur?: number; gap?: number; gaps?: Record<number, number>; from?: number } = {}): SpokenWord[] {
  const { dur = 0.3, gap = 0.04, gaps = {}, from = 0 } = opts
  let t = from
  return text.split(/\s+/).map((word, i) => {
    const w = { word, start: t, end: t + dur }
    t = w.end + (gaps[i] ?? gap)
    return w
  })
}

const texts = (cards: CaptionCard[]) => cards.map((c) => c.text)

/** The properties every set of cards must have, whatever the script. */
function expectRulesHold(cards: CaptionCard[], words: SpokenWord[]): void {
  expect(validateCaptions(cards, words)).toEqual([])
  // Every spoken word appears in exactly one card, in order.
  expect(cards.flatMap((c) => c.words)).toEqual(words.map((_, i) => i))
  cards.forEach((card, i) => {
    const count = card.text.split(/\s+/).length
    expect(count).toBeGreaterThanOrEqual(1)
    expect(count).toBeLessThanOrEqual(MAX_CARD_WORDS)
    expect(card.end - card.start).toBeGreaterThanOrEqual(MIN_CARD_SECONDS - 1e-9)
    // Sync: a card starts at its first word's start, exactly.
    expect(card.start).toBe(words[card.words[0]].start)
    if (i + 1 < cards.length) expect(card.end).toBeLessThanOrEqual(cards[i + 1].start + 1e-9)
  })
}

describe('the real v3 smoke line', () => {
  // The words alignmentToWords gave for "[warm] Okay, so... here's the thing." (see words.test.ts).
  const words: SpokenWord[] = [
    { word: 'Okay,', start: 0.256, end: 0.32 },
    { word: 'so', start: 0.56, end: 0.72 },
    { word: "here's", start: 1.152, end: 1.44 },
    { word: 'the', start: 1.46, end: 1.52 },
    { word: 'thing.', start: 1.56, end: 1.76 },
  ]

  it('breaks at the pause the ellipsis left and at the sentence end, and holds short cards into the silence', () => {
    const cards = buildCaptions(words)
    expect(cards).toEqual([
      { text: 'Okay, so', start: 0.256, end: 0.72, words: [0, 1] },
      { text: "here's the thing.", start: 1.152, end: 1.76, words: [2, 3, 4] },
    ])
    expectRulesHold(cards, words)
  })
})

describe('buildCaptions: the rules', () => {
  it('cuts one sentence into cards of 1 to 4 words', () => {
    const words = speak('Bend homes are staying on the market a little longer this fall')
    const cards = buildCaptions(words)
    expectRulesHold(cards, words)
    expect(cards.length).toBeGreaterThanOrEqual(3)
  })

  it('breaks after sentence punctuation, even when the next sentence would fit', () => {
    const words = speak('Okay. Here we go. Ready now.', { dur: 0.45, gap: 0.1 })
    expect(texts(buildCaptions(words))).toEqual(['Okay.', 'Here we go.', 'Ready now.'])
  })

  it('breaks at a pause of 0.25 s or more between words', () => {
    const words = speak('so here is the thing you need', { gaps: { 3: 0.4 } })
    const cards = buildCaptions(words)
    expectRulesHold(cards, words)
    // No card spans the pause after "the" (word 3).
    expect(cards.some((c) => c.words.includes(3) && c.words.includes(4))).toBe(false)
  })

  it('prefers to cut after a comma over cutting mid-clause', () => {
    const words = speak('if you are buying, you have real choices')
    expect(texts(buildCaptions(words))).toEqual(['if you are buying,', 'you have real choices'])
  })

  it('times a card from its first word and carries a short card into the silence, never past the next card', () => {
    const words: SpokenWord[] = [
      { word: 'Yes.', start: 1.0, end: 1.15 },
      { word: 'Really', start: 2.0, end: 2.3 },
      { word: 'now.', start: 2.35, end: 2.6 },
    ]
    const cards = buildCaptions(words)
    expect(cards[0]).toMatchObject({ text: 'Yes.', start: 1.0, words: [0] })
    expect(cards[0].end).toBeCloseTo(1.4, 9)
    expect(cards[0].end).toBeLessThanOrEqual(cards[1].start)
    expectRulesHold(cards, words)
  })

  it('joins words across a sentence break rather than show a card under 0.4 s with no silence to borrow', () => {
    const words: SpokenWord[] = [
      { word: 'No.', start: 0, end: 0.1 },
      { word: 'Really', start: 0.1, end: 0.35 },
      { word: 'yes.', start: 0.35, end: 0.6 },
    ]
    const cards = buildCaptions(words)
    expect(cards).toHaveLength(1)
    expect(cards[0].text).toBe('No. Really yes.')
    expectRulesHold(cards, words)
  })

  it('bridges a silence of 0.12 s or less so the line does not flicker, and leaves a longer silence dark', () => {
    const bridged = buildCaptions(speak('one two three. four five six.', { dur: 0.3, gap: 0.04, gaps: { 2: 0.1 } }))
    expect(bridged[0].end).toBe(bridged[1].start)
    const dark = buildCaptions(speak('one two three. four five six.', { dur: 0.3, gap: 0.04, gaps: { 2: 0.5 } }))
    expect(dark[0].end).toBeLessThan(dark[1].start)
    expect(dark[0].end).toBeCloseTo(dark[0].start + 0.3 * 3 + 0.04 * 2, 9)
  })

  it('never holds the last card past the end of the audio', () => {
    const words: SpokenWord[] = [
      { word: 'Hello', start: 0, end: 0.3 },
      { word: 'there.', start: 0.34, end: 0.6 },
      { word: 'Go.', start: 1.0, end: 1.1 },
    ]
    const plan = planCaptions(words, { endLimitSeconds: 1.2 })
    expect(plan.cards.at(-1)?.end).toBe(1.2)
    expect(plan.violations.some((v) => v.includes('under 0.4'))).toBe(true)
  })

  it('returns no cards for no words', () => {
    expect(buildCaptions([])).toEqual([])
  })

  it('is deterministic', () => {
    const words = speak('Honestly the numbers say you have more choices than you did a year ago')
    expect(buildCaptions(words)).toEqual(buildCaptions(words))
  })

  it('covers every word exactly once and holds every rule on a few hundred random scripts', () => {
    const rand = mulberry32(20261013)
    const vocabulary = 'the a you homes Bend market price we, listing. buyers have more choices right now and it is so good to see'.split(' ')
    for (let run = 0; run < 300; run++) {
      const count = 1 + Math.floor(rand() * 40)
      let t = rand() * 0.5
      const words: SpokenWord[] = []
      for (let i = 0; i < count; i++) {
        const dur = 0.18 + rand() * 0.35
        words.push({ word: vocabulary[Math.floor(rand() * vocabulary.length)], start: t, end: t + dur })
        t += dur + (rand() < 0.15 ? 0.25 + rand() * 0.6 : rand() * 0.12)
      }
      const plan = planCaptions(words)
      expect(plan.violations, `run ${run}`).toEqual([])
      expectRulesHold(plan.cards, words)
    }
  })
})

describe('buildCaptions: numbers stay with their units', () => {
  it('does not split spoken number words from the unit that follows them', () => {
    const words = speak('it costs about a hundred sixty-nine dollars a month')
    const cards = buildCaptions(words)
    expectRulesHold(cards, words)
    const at = (w: string) => words.findIndex((x) => x.word === w)
    const cardOf = (i: number) => cards.findIndex((c) => c.words.includes(i))
    // "sixty-nine dollars" together, "a hundred" together, "a month" together.
    expect(cardOf(at('sixty-nine'))).toBe(cardOf(at('dollars')))
    expect(cardOf(at('hundred'))).toBe(cardOf(at('sixty-nine')))
    expect(cardOf(at('month'))).toBe(cardOf(at('month') - 1))
  })

  it('keeps "63 percent" together without a map', () => {
    const words = speak('and sixty-three percent of sellers cut their price')
    const cards = buildCaptions(words)
    const i = words.findIndex((w) => w.word === 'sixty-three')
    expect(cards.find((c) => c.words.includes(i))?.words).toContain(i + 1)
  })

  it('keeps square feet and a count of homes together', () => {
    const words = speak('about two thousand square feet and four homes')
    const cards = buildCaptions(words)
    const square = words.findIndex((w) => w.word === 'square')
    expect(cards.find((c) => c.words.includes(square))?.words).toContain(square + 1)
    const four = words.findIndex((w) => w.word === 'four')
    expect(cards.find((c) => c.words.includes(four))?.words).toContain(four + 1)
  })
})

describe('the display map', () => {
  it('shows an approved figure where the script says it in words', () => {
    const words = speak('Sixty-three percent of sellers cut their price.')
    const cards = buildCaptions(words, { display: { 'sixty-three percent': '63%' } })
    expect(texts(cards).join(' ')).toBe('63% of sellers cut their price.')
    expectRulesHold(cards, words)
    // The figure's card is timed from the FIRST spoken word of the phrase.
    const figure = cards.find((c) => c.text.startsWith('63%'))!
    expect(figure.start).toBe(words[0].start)
    expect(figure.words.slice(0, 2)).toEqual([0, 1])
  })

  it('matches however the engine split and cased the words', () => {
    for (const phrase of ['Sixty three percent', 'sixty-three percent.', 'SIXTY-THREE Percent']) {
      const words = speak(phrase)
      const cards = buildCaptions(words, { display: { 'sixty-three percent': '63%' } })
      expect(cards.map((c) => c.text.replace(/\.$/, ''))).toEqual(['63%'])
    }
  })

  it('keeps the spoken words trailing punctuation on the figure', () => {
    const words = speak('It is up sixty-three percent.')
    const cards = buildCaptions(words, { display: { 'sixty-three percent': '63%' } })
    expect(cards.at(-1)?.text.endsWith('63%.')).toBe(true)
  })

  it('keeps "$169" with "a month" in one card', () => {
    const words = speak('Okay so it is a hundred sixty-nine dollars a month right now.')
    const cards = buildCaptions(words, { display: { 'a hundred sixty-nine dollars': '$169' } })
    expectRulesHold(cards, words)
    const card = cards.find((c) => c.text.includes('$169'))!
    expect(card.text).toMatch(/\$169 a month/)
  })

  it('prefers the longest phrase when rules overlap', () => {
    const words = speak('three hundred thousand dollars')
    const cards = buildCaptions(words, { display: { 'three hundred thousand dollars': '$300,000', 'three hundred': '300' } })
    expect(texts(cards)).toEqual(['$300,000'])
  })

  it('never writes a figure of its own: with no map the words are the spoken words', () => {
    const words = speak('sixty-three percent of homes sold')
    const text = buildCaptions(words).map((c) => c.text).join(' ')
    expect(text).toBe('sixty-three percent of homes sold')
    expect(text).not.toMatch(/\d/)
  })

  it('says which rule matched nothing', () => {
    const plan = planCaptions(speak('nothing to see here friends'), { display: { 'ninety nine percent': '99%' } })
    expect(plan.warnings).toEqual(['display rule "ninety nine percent" matched no spoken words'])
    expect(plan.violations).toEqual([])
  })

  it('refuses a rule that shows a dash, shows nothing, shows more than 4 words, or repeats another', () => {
    const words = speak('sixty-three percent')
    expect(() => planCaptions(words, { display: { 'sixty-three percent': '63\u2014%' } })).toThrow(/dash/)
    expect(() => planCaptions(words, { display: { 'sixty-three percent': '  ' } })).toThrow(/shows nothing/)
    expect(() => planCaptions(words, { display: { 'sixty-three percent': 'a b c d e' } })).toThrow(/over the 4-word card/)
    expect(() => planCaptions(words, { display: { 'sixty-three percent': '63%', 'Sixty three percent': '63 %' } })).toThrow(/duplicates/)
    expect(() => planCaptions(words, { display: { '...': '63%' } })).toThrow(/no spoken words/)
  })
})

describe('validateCaptions', () => {
  const words = speak('one two three four five six')

  it('passes good cards', () => {
    expect(validateCaptions(buildCaptions(words), words)).toEqual([])
  })

  it('names each broken rule', () => {
    const base: CaptionCard[] = [
      { text: 'one two three four five', start: 0, end: 2, words: [0, 1, 2, 3, 4] },
      { text: 'six', start: 1.5, end: 1.6, words: [5] },
    ]
    const problems = validateCaptions(base, words)
    expect(problems.some((p) => p.includes('5 words'))).toBe(true)
    expect(problems.some((p) => p.includes('overlaps the next card'))).toBe(true)
    expect(problems.some((p) => p.includes('under 0.4'))).toBe(true)
    expect(problems.some((p) => p.includes('not at its first word'))).toBe(true)
  })

  it('catches a spoken word shown nowhere and one shown twice', () => {
    const cards: CaptionCard[] = [
      { text: 'one two', start: words[0].start, end: words[0].start + 1, words: [0, 1] },
      { text: 'two three', start: words[1].start, end: words[1].start + 1, words: [1, 2] },
    ]
    const problems = validateCaptions(cards, words)
    expect(problems.some((p) => p.includes('"two" is in 2 cards'))).toBe(true)
    expect(problems.some((p) => p.includes('"four" is in no card'))).toBe(true)
  })

  it('catches a dash in caption text', () => {
    const cards: CaptionCard[] = [{ text: 'one\u2014two', start: 0, end: 1, words: [0] }]
    expect(validateCaptions(cards, speak('one'))).toContainEqual(expect.stringContaining('dash'))
  })
})

describe('buildCaptions on speech that cannot hold the rules', () => {
  it('throws CaptionRuleError, naming the break, instead of returning cards that fail downstream', () => {
    // Six words in 0.3 s total: no card can stay up 0.4 s without borrowing time that is not there.
    const words = speak('a b c d e f', { dur: 0.04, gap: 0.01 })
    expect(() => buildCaptions(words)).toThrow(CaptionRuleError)
    const plan = planCaptions(words)
    expect(plan.violations.length).toBeGreaterThan(0)
    expect(plan.cards.flatMap((c) => c.words)).toEqual([0, 1, 2, 3, 4, 5])
  })
})

describe('end to end with the word reader', () => {
  it('turns a tagged, ellipsised script alignment into cards whose words are exactly the spoken words', () => {
    const text = "[warm] Okay, so... sixty-three percent of sellers cut their price."
    const characters = Array.from(text)
    const alignment = {
      characters,
      characterStartTimesSeconds: characters.map((_, i) => i * 0.045),
      characterEndTimesSeconds: characters.map((_, i) => (i + 1) * 0.045),
    }
    const words = alignmentToWords(alignment)
    const cards = buildCaptions(words, { display: { 'sixty-three percent': '63%' } })
    expectRulesHold(cards, words)
    expect(cards.map((c) => c.text).join(' ')).toBe('Okay, so 63% of sellers cut their price.')
    expect(cards.map((c) => c.text).join(' ')).not.toMatch(/\[|\.\.\./)
  })
})
