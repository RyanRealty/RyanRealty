import { describe, expect, it } from 'vitest'
import { yearAgoClause } from './year-ago-clause'

describe('yearAgoClause (VOICE-6)', () => {
  it('names the direction as a verb, with this year as the subject', () => {
    // The live /housing-market/bend lede, 2026-09-22: $750K against $795K.
    expect(
      yearAgoClause({ now: 750_000, then: 795_000, thenMoney: '$795K', thenLabel: 'August 2025', delta: '−5.7%' }),
    ).toBe('down 5.7% from $795K in August 2025')
    expect(
      yearAgoClause({ now: 640_000, then: 612_000, thenMoney: '$612K', thenLabel: 'August 2025', delta: '+4%' }),
    ).toBe('up 4% from $612K in August 2025')
  })

  it('lets the values decide the direction, so a sign and a word cannot disagree', () => {
    expect(
      yearAgoClause({ now: 700_000, then: 650_000, thenMoney: '$650K', thenLabel: 'July 2025', delta: '7.7%' }),
    ).toBe('up 7.7% from $650K in July 2025')
  })

  it('says level when the page itself rounds the change to nothing', () => {
    for (const delta of ['level', '0.0%', '+0.0%', '0%', null]) {
      expect(
        yearAgoClause({ now: 500_100, then: 500_000, thenMoney: '$500K', thenLabel: 'May 2025', delta }),
      ).toBe('level with $500K in May 2025')
    }
  })

  it('never reads like the old template', () => {
    const out = yearAgoClause({ now: 750_000, then: 795_000, thenMoney: '$795K', thenLabel: 'August 2025', delta: '−5.7%' })!
    expect(out).not.toMatch(/than the same month last year|, [+−-]\d/)
  })

  it('refuses unusable values rather than writing a comparison', () => {
    expect(yearAgoClause({ now: 0, then: 1, thenMoney: '$1', thenLabel: 'x', delta: null })).toBeNull()
    expect(yearAgoClause({ now: 1, then: Number.NaN, thenMoney: '$1', thenLabel: 'x', delta: null })).toBeNull()
  })
})
