import { describe, expect, it } from 'vitest'
import { NON_STATISTICAL_SPOKEN, alignCaption, extractNumberTokens, parseCaptionNumber, parseSpokenNumber, spokenFigures, squash, tokenShowsSpoken, tokenizeWords, firstUnitIn, splitFigure } from './spoken'

const words = (s: string) => s.split(' ')

describe('tokenizeWords', () => {
  it('lowercases, trims edge punctuation and splits hyphens', () => {
    expect(tokenizeWords('Okay, so SIXTY-THREE percent!')).toEqual(['okay', 'so', 'sixty', 'three', 'percent'])
  })

  it('keeps digits, %, $ and inner apostrophes', () => {
    expect(tokenizeWords("$475K isn\u2019t 63%")).toEqual(['$475k', "isn't", '63%'])
  })
})

describe('parseSpokenNumber', () => {
  const value = (s: string) => parseSpokenNumber(words(s))

  it('parses whole numbers', () => {
    expect(value('sixty three')?.values).toEqual([63])
    expect(value('four hundred seventy five thousand')?.values).toEqual([475000])
    expect(value('one hundred and five')?.values).toEqual([105])
    expect(value('two thousand twenty six')?.values).toContain(2026)
    expect(value('twelve hundred')?.values).toEqual([1200])
    expect(value('zero')?.values).toEqual([0])
  })

  it('parses decimals and scales after a decimal', () => {
    expect(value('three point five')?.values).toEqual([3.5])
    expect(value('one point two million dollars')).toEqual({ values: [1200000], unit: 'dollar' })
  })

  it('reads a trailing unit', () => {
    expect(value('sixty three percent')).toEqual({ values: [63], unit: 'percent' })
    expect(value('five hundred dollars')).toEqual({ values: [500], unit: 'dollar' })
  })

  it('reads "and a half" as one half more, and nothing looser', () => {
    expect(value('three and a half')).toEqual({ values: [3.5], unit: null })
    expect(value('twenty and a half percent')).toEqual({ values: [20.5], unit: 'percent' })
    expect(value('and a half')).toBeNull()
    // "a half" on its own is a fraction (F4): a ratio that must be shown as a sourced figure.
    expect(value('a half')).toEqual({ values: [0.5], unit: 'ratio' })
    expect(value('three and a')).toBeNull()
  })

  it('reads a spoken year', () => {
    expect(value('twenty twenty six')?.values).toContain(2026)
    expect(value('nineteen ninety nine')?.values).toContain(1999)
  })

  it('rejects things that are not numbers', () => {
    expect(value('sixty twenty')).toBeNull()
    expect(value('percent')).toBeNull()
    expect(value('hello')).toBeNull()
    expect(value('three four')).toBeNull()
    expect(value('hundred')).toBeNull()
  })
})

describe('parseCaptionNumber', () => {
  it('reads figures with units and suffixes', () => {
    expect(parseCaptionNumber('63%')).toMatchObject({ value: 63, unit: 'percent', decimals: 0 })
    expect(parseCaptionNumber('$475k')).toMatchObject({ value: 475000, unit: 'dollar' })
    expect(parseCaptionNumber('$1.2m')).toMatchObject({ value: 1200000, unit: 'dollar' })
    expect(parseCaptionNumber('1,250,000')).toMatchObject({ value: 1250000, unit: null })
    expect(parseCaptionNumber('3.5')).toMatchObject({ value: 3.5, unit: null, decimals: 1 })
    expect(parseCaptionNumber('2x')).toMatchObject({ value: 2, unit: 'ratio' })
  })

  it('returns null for words and mixed tokens', () => {
    expect(parseCaptionNumber('cut')).toBeNull()
    expect(parseCaptionNumber('3br')).toBeNull()
  })
})

describe('alignCaption', () => {
  it('matches plain words case and punctuation insensitively', () => {
    expect(alignCaption('OKAY SO', words('Okay, so')).ok).toBe(true)
  })

  it('matches a figure to the number words that say it', () => {
    expect(alignCaption('63% CUT', words('sixty three percent cut')).ok).toBe(true)
    expect(alignCaption('$475K', words('four hundred seventy five thousand dollars')).ok).toBe(true)
    expect(alignCaption('3.5 MONTHS', words('three point five months')).ok).toBe(true)
    expect(alignCaption('2026', words('twenty twenty six')).ok).toBe(true)
    expect(alignCaption('Bend has 3.5 months', words('Bend has three and a half months')).ok).toBe(true)
    expect(alignCaption('3.5', words('three and a half')).ok).toBe(true)
  })

  it('does not let "and a half" stand in for another value or swallow a plain "a"', () => {
    expect(alignCaption('3.6 months', words('three and a half months')).ok).toBe(false)
    expect(alignCaption('3 a month', words('three a month')).ok).toBe(true)
  })

  it('matches a figure the voice reads out as digits', () => {
    expect(alignCaption('63% CUT', ['63%', 'cut']).ok).toBe(true)
  })

  it('keeps two adjacent figures apart', () => {
    expect(alignCaption('63% 12', words('sixty three percent twelve')).ok).toBe(true)
  })

  it('fails when the figure is a different number', () => {
    const r = alignCaption('63% CUT', words('sixty four percent cut'))
    expect(r.ok).toBe(false)
    expect(r.detail).toContain('63%')
  })

  it('fails when the unit is missing or extra', () => {
    expect(alignCaption('63 CUT', words('sixty three percent cut')).ok).toBe(false)
    expect(alignCaption('63% CUT', words('sixty three cut')).ok).toBe(false)
  })

  it('fails on a different word, a missing word and an extra spoken word', () => {
    expect(alignCaption('PRICE CUT', words('price drop')).ok).toBe(false)
    expect(alignCaption('PRICE', words('price cut')).detail).toContain('cut')
    expect(alignCaption('PRICE CUT NOW', words('price cut')).ok).toBe(false)
  })
})

describe('extractNumberTokens', () => {
  it('finds figures with symbols, commas and decimals', () => {
    expect(extractNumberTokens('63% cut their price to $475K from $1,250,000, now 3.5 months')).toEqual(['63%', '$475K', '$1,250,000', '3.5 mo'])
  })

  it('skips the locked phone number in every spelling', () => {
    expect(extractNumberTokens('Call now 541.703.3095')).toEqual([])
    expect(extractNumberTokens('(541) 703-3095')).toEqual([])
    expect(extractNumberTokens('+1 541 703 3095 and 12 homes')).toEqual(['12 homes'])
  })

  it('treats other phone numbers as figures', () => {
    expect(extractNumberTokens('Call 541.555.1212')).toContain('541.555')
  })

  it('ignores digits glued to a letter on the left (Q3, H2)', () => {
    expect(extractNumberTokens('Q3 and H2')).toEqual([])
  })

  it('keeps digits glued to a letter on the right, with that unit', () => {
    expect(extractNumberTokens('3BR homes')).toEqual(['3 beds'])
    expect(extractNumberTokens('2x faster')).toEqual(['2 times'])
  })

  it('strips a trailing comma and returns nothing for plain words', () => {
    expect(extractNumberTokens('Sold 12, then')).toEqual(['12'])
    expect(extractNumberTokens('no figures here')).toEqual([])
  })

  it('keeps each figure with its unit or prefix, so "4 mo" is never "4"', () => {
    expect(extractNumberTokens('4 mo, 6 mo, 10 mo')).toEqual(['4 mo', '6 mo', '10 mo'])
    expect(extractNumberTokens('4 MO')).toEqual(['4 mo'])
    expect(extractNumberTokens('4 the end')).toEqual(['4'])
  })

  it('carries the unit word into the token, one form per unit (F3)', () => {
    // review finding: "3.5 days to pending" and "4 days on market" were "3.5" and "4"
    expect(extractNumberTokens('3.5 days to pending')).toEqual(['3.5 days'])
    expect(extractNumberTokens('4 days on market')).toEqual(['4 days'])
    expect(extractNumberTokens('under 4 months')).toEqual(['4 mo'])
    expect(extractNumberTokens('1 month, 2 mos, 3mo')).toEqual(['1 mo', '2 mo', '3 mo'])
    expect(extractNumberTokens('4 more homes and 714 active listings')).toEqual(['4 homes', '714 listings'])
    expect(extractNumberTokens('1,212 closed sales in 26 weeks')).toEqual(['1,212 sales', '26 weeks'])
    expect(extractNumberTokens('12 percent, 12 per cent')).toEqual(['12%', '12%'])
    expect(extractNumberTokens('1,800 sq ft on 2 acres')).toEqual(['1,800 sqft', '2 acres'])
    expect(extractNumberTokens('38 price cuts, 9 offers, 3 beds')).toEqual(['38 cuts', '9 offers', '3 beds'])
    expect(extractNumberTokens('in 2026 prices rose')).toEqual(['2026'])
  })

  it('reads fullwidth digits as digits (F3)', () => {
    expect(extractNumberTokens('１２％ of homes')).toEqual(['12%'])
    expect(extractNumberTokens('３.５ months')).toEqual(['3.5 mo'])
  })

  it('finds the first unit word in a definition, and splits a token back', () => {
    expect(firstUnitIn('Months of supply: active listings divided by closings')).toBe('mo')
    expect(firstUnitIn('The months-of-supply threshold')).toBe('mo')
    expect(firstUnitIn('Median closed price')).toBeNull()
    expect(splitFigure('3.5 mo')).toEqual({ num: '3.5', unit: 'mo' })
    expect(splitFigure('12%')).toEqual({ num: '12', unit: '%' })
    expect(splitFigure('$475K')).toEqual({ num: '$475K', unit: '' })
  })

  it('reads a rank (#1) and a figure glued to punctuation (fell,12%)', () => {
    // review finding: extractNumberTokens missed "#1" and "fell,12%"
    expect(extractNumberTokens('#1 in Bend')).toEqual(['#1'])
    expect(extractNumberTokens('prices fell,12% this year')).toEqual(['12%'])
    expect(extractNumberTokens('up;7% and (9) and "15"')).toEqual(['7%', '9', '15'])
  })

  it('does not split one figure into two', () => {
    expect(extractNumberTokens('3.5 and 1,250')).toEqual(['3.5', '1,250'])
  })
})

describe('spokenFigures (a number said in words is a figure)', () => {
  const w = (s: string) => s.split(' ')

  it('finds counts, percents, dollars, decimals, halves, years and ordinals with their word indices', () => {
    expect(spokenFigures(w('prices fell twelve percent'))).toEqual([{ first: 2, last: 3, said: 'twelve percent', values: [12], unit: 'percent' }])
    expect(spokenFigures(w('Bend has three and a half months')).map((f) => [f.said, f.values])).toEqual([['three and a half', [3.5]]])
    expect(spokenFigures(w('a hundred homes sold')).map((f) => [f.said, f.values])).toEqual([['a hundred', [100]]])
    expect(spokenFigures(w('four hundred seventy five thousand dollars')).map((f) => [f.values, f.unit])).toEqual([[[475000], 'dollar']])
    expect(spokenFigures(w('since twenty twenty six,')).map((f) => f.values)).toEqual([[2026]])
    expect(spokenFigures(w('the third month in a row')).map((f) => f.values)).toEqual([[3]])
  })

  it('reads a hyphenated number as one figure of one word', () => {
    expect(spokenFigures(w('sixty-three homes'))).toEqual([{ first: 0, last: 0, said: 'sixty-three', values: [63], unit: null }])
  })

  it('does not read "a" or "and" alone as a number', () => {
    expect(spokenFigures(w('go in with a plan and a budget'))).toEqual([])
  })

  it('skips the locked phone read digit by digit, and still reads the words around it', () => {
    expect(spokenFigures(w('call five four one seven oh three three oh nine five today'))).toEqual([])
    expect(spokenFigures(w('call five four one seven oh three three oh nine five twelve times')).map((f) => f.values)).toEqual([[12]])
  })

  it('allows "one of" and "one more" (a member of a set)', () => {
    expect(NON_STATISTICAL_SPOKEN.some((r) => r.word === 'one' && r.after?.includes('of'))).toBe(true)
    expect(spokenFigures(w('one of the best'))).toEqual([])
    expect(spokenFigures(w('one more thing'))).toEqual([])
  })

  it('allows "this one", "the one", "no one" and "that one" (a pronoun)', () => {
    for (const before of ['this', 'the', 'no', 'that']) expect(spokenFigures(w(`${before} one`))).toEqual([])
  })

  it('never reads "first" or "second" as a figure ("give it a second")', () => {
    expect(spokenFigures(w('your first home'))).toEqual([])
    expect(spokenFigures(w('give it a second'))).toEqual([])
  })

  it('still flags "one" anywhere else, and "twenty one of them"', () => {
    expect(spokenFigures(w('one home sold')).map((f) => f.values)).toEqual([[1]])
    expect(spokenFigures(w('twenty one of them')).map((f) => f.values)).toEqual([[21]])
  })
})

describe('tokenShowsSpoken', () => {
  it('needs the same value and the same unit', () => {
    expect(tokenShowsSpoken('12%', { values: [12], unit: 'percent' })).toBe(true)
    expect(tokenShowsSpoken('12', { values: [12], unit: 'percent' })).toBe(false)
    expect(tokenShowsSpoken('$475K', { values: [475000], unit: 'dollar' })).toBe(true)
    expect(tokenShowsSpoken('3.5', { values: [3.5], unit: null })).toBe(true)
    // A unit word shows the same spoken count ("four months" as "4 mo"); a magnitude does not.
    expect(tokenShowsSpoken('4 mo', { values: [4], unit: null })).toBe(true)
    expect(tokenShowsSpoken('4K', { values: [4], unit: null })).toBe(false)
    expect(tokenShowsSpoken('12 days', { values: [12], unit: 'percent' })).toBe(false)
  })
})

describe('squash', () => {
  it('lowercases and drops spaces', () => {
    expect(squash(' $475 K ')).toBe('$475k')
  })
})

describe('quantity words are figures (F4)', () => {
  const w = (x: string) => x.split(' ')
  const seen = (x: string) => spokenFigures(w(x)).map((f) => ({ said: f.said, values: f.values, unit: f.unit, vague: f.vague ?? false }))

  it("reads the review's sentence as four figures", () => {
    // review finding: this sentence gave no spoken figure, so it passed preflight b and check 9
    expect(seen('Prices doubled in a dozen neighborhoods and half the listings cut their price by a quarter')).toEqual([
      { said: 'doubled', values: [2], unit: 'ratio', vague: false },
      { said: 'a dozen', values: [12], unit: null, vague: false },
      { said: 'half', values: [0.5], unit: 'ratio', vague: false },
      { said: 'a quarter', values: [0.25], unit: 'ratio', vague: false },
    ])
  })

  it('maps ratios, fractions and dozens to values', () => {
    expect(seen('twice as many')).toEqual([{ said: 'twice', values: [2], unit: 'ratio', vague: false }])
    expect(seen('sales tripled')).toEqual([{ said: 'tripled', values: [3], unit: 'ratio', vague: false }])
    expect(seen('a third of listings')[0]).toMatchObject({ said: 'a third', unit: 'ratio' })
    expect(seen('two thirds of sales')[0].values[0]).toBeCloseTo(2 / 3, 5)
    expect(seen('three quarters of homes')[0]).toMatchObject({ values: [0.75], unit: 'ratio' })
    expect(seen('two dozen homes')).toEqual([{ said: 'two dozen', values: [24], unit: null, vague: false }])
    // "and a half" still closes a number; "the third month" is still an ordinal.
    expect(seen('three and a half months')).toEqual([{ said: 'three and a half', values: [3.5], unit: null, vague: false }])
    expect(seen('the third month')).toEqual([{ said: 'third', values: [3], unit: null, vague: false }])
  })

  it('marks a quantity with no single figure as vague', () => {
    for (const x of ['Most buyers want a plan', 'hundreds of homes', 'dozens of offers', 'the majority of sellers', 'a majority of sellers']) {
      const f = seen(x)
      expect(f, x).toHaveLength(1)
      expect(f[0].vague, x).toBe(true)
    }
  })

  it('leaves a superlative and a stretch of the year alone', () => {
    expect(seen('the most popular street')).toEqual([])
    expect(seen("Bend's most popular street")).toEqual([])
    expect(seen('at most')).toEqual([])
    expect(seen('last quarter sales')).toEqual([])
  })

  it('lets a display rule show a ratio as its figure, and checks it', () => {
    expect(alignCaption('Prices 2x', ['Prices', 'doubled']).ok).toBe(true)
    expect(alignCaption('Prices 3x', ['Prices', 'doubled']).ok).toBe(false)
    expect(alignCaption('25% of homes', ['a', 'quarter', 'of', 'homes']).ok).toBe(true)
    expect(alignCaption('33% of sales', ['a', 'third', 'of', 'sales']).ok).toBe(true)
    expect(alignCaption('34% of sales', ['a', 'third', 'of', 'sales']).ok).toBe(false)
    expect(alignCaption('12 homes', ['a', 'dozen', 'homes']).ok).toBe(true)
    expect(alignCaption('lots of homes', ['hundreds', 'of', 'homes']).ok).toBe(false)
    expect(tokenShowsSpoken('2 times', { values: [2], unit: 'ratio' })).toBe(true)
    expect(tokenShowsSpoken('100%', { values: [2], unit: 'ratio' })).toBe(true)
    expect(tokenShowsSpoken('50%', { values: [0.5], unit: 'ratio' })).toBe(true)
    expect(tokenShowsSpoken('2 times', { values: [], unit: null, vague: true })).toBe(false)
  })
})
