import { describe, expect, it } from 'vitest'
import { alignCaption, extractNumberTokens, parseCaptionNumber, parseSpokenNumber, squash, tokenizeWords } from './spoken'

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
})

describe('squash', () => {
  it('lowercases and drops spaces', () => {
    expect(squash(' $475 K ')).toBe('$475k')
  })
})
