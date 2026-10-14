import { describe, expect, it } from 'vitest'
import { NON_STATISTICAL_SPOKEN, alignCaption, extractNumberTokens, parseCaptionNumber, parseSpokenNumber, spokenFigures, squash, tokenShowsSpoken, tokenizeWords } from './spoken'

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
    expect(value('a half')).toBeNull()
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
    expect(parseCaptionNumber('63%')).toEqual({ value: 63, unit: 'percent' })
    expect(parseCaptionNumber('$475k')).toEqual({ value: 475000, unit: 'dollar' })
    expect(parseCaptionNumber('$1.2m')).toEqual({ value: 1200000, unit: 'dollar' })
    expect(parseCaptionNumber('1,250,000')).toEqual({ value: 1250000, unit: null })
    expect(parseCaptionNumber('3.5')).toEqual({ value: 3.5, unit: null })
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
    expect(extractNumberTokens('63% cut their price to $475K from $1,250,000, now 3.5 months')).toEqual(['63%', '$475K', '$1,250,000', '3.5'])
  })

  it('skips the locked phone number in every spelling', () => {
    expect(extractNumberTokens('Call now 541.703.3095')).toEqual([])
    expect(extractNumberTokens('(541) 703-3095')).toEqual([])
    expect(extractNumberTokens('+1 541 703 3095 and 12 homes')).toEqual(['12'])
  })

  it('treats other phone numbers as figures', () => {
    expect(extractNumberTokens('Call 541.555.1212')).toContain('541.555')
  })

  it('ignores digits glued to a letter on the left (Q3, H2)', () => {
    expect(extractNumberTokens('Q3 and H2')).toEqual([])
  })

  it('keeps digits glued to a letter on the right', () => {
    expect(extractNumberTokens('3BR homes')).toEqual(['3'])
  })

  it('strips a trailing comma and returns nothing for plain words', () => {
    expect(extractNumberTokens('Sold 12, then')).toEqual(['12'])
    expect(extractNumberTokens('no figures here')).toEqual([])
  })

  it('keeps each figure with its unit or prefix, so "4 mo" is never "4"', () => {
    expect(extractNumberTokens('4 mo, 6 mo, 10 mo')).toEqual(['4 mo', '6 mo', '10 mo'])
    expect(extractNumberTokens('under 4 months')).toEqual(['4'])
    expect(extractNumberTokens('4 MO')).toEqual(['4 MO'])
    expect(extractNumberTokens('4 more homes')).toEqual(['4'])
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
    expect(tokenShowsSpoken('4 mo', { values: [4], unit: null })).toBe(false)
  })
})

describe('squash', () => {
  it('lowercases and drops spaces', () => {
    expect(squash(' $475 K ')).toBe('$475k')
  })
})
