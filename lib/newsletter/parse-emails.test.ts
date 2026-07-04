import { describe, it, expect } from 'vitest'
import { parseEmailList } from './parse-emails'

describe('parseEmailList', () => {
  it('splits on newlines, commas, semicolons, and whitespace (mixed)', () => {
    const raw = 'a@x.com, b@x.com\nc@x.com;d@x.com  e@x.com'
    expect(parseEmailList(raw)).toEqual(['a@x.com', 'b@x.com', 'c@x.com', 'd@x.com', 'e@x.com'])
  })

  it('drops syntactically invalid tokens', () => {
    const raw = 'good@x.com, not-an-email, missing@tld, @no-local.com, two@@at.com, ok@sub.x.co'
    expect(parseEmailList(raw)).toEqual(['good@x.com', 'ok@sub.x.co'])
  })

  it('lowercases and de-dupes case-insensitively, first-seen order preserved', () => {
    const raw = 'Matt@Ryan-Realty.com\nmatt@ryan-realty.com, B@X.com, b@x.com'
    expect(parseEmailList(raw)).toEqual(['matt@ryan-realty.com', 'b@x.com'])
  })

  it('trims surrounding whitespace on each token', () => {
    expect(parseEmailList('   a@x.com   \n\t  b@x.com ')).toEqual(['a@x.com', 'b@x.com'])
  })

  it('returns [] for empty / whitespace-only / non-string input', () => {
    expect(parseEmailList('')).toEqual([])
    expect(parseEmailList('   \n\t  ')).toEqual([])
    // @ts-expect-error — guard against non-string at runtime
    expect(parseEmailList(null)).toEqual([])
    // @ts-expect-error — guard against non-string at runtime
    expect(parseEmailList(undefined)).toEqual([])
  })

  it('accepts plus-addressing and dotted local parts', () => {
    expect(parseEmailList('a.b+tag@x.com')).toEqual(['a.b+tag@x.com'])
  })
})
