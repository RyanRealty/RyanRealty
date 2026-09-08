import { describe, it, expect } from 'vitest'
import { buildAnswerFigures } from './answer-figures'

/**
 * The reader's own arithmetic must reproduce our verdict.
 *
 * The two-bar drawing shows homes-for-sale against a month of sales and invites
 * the division; months of supply IS that division. On 2026-09-08 the bars read
 * 48 and 8 while the caption said 5.8 months and "a balanced market" — but
 * 48 / 8 is 6.0, which on the canon's thresholds (<=4 seller, 4-6 balanced,
 * >=6 buyer) is a BUYER'S market. The pace had been rounded from 8.28.
 */
const base = {
  placeLabel: 'Sunriver',
  street: '17936 Red Cedar',
  monthsOfSupply: '5.8',
  verdictLabel: 'balanced market',
  activeCount: 48,
  salesPerMonth: 48 / 5.8,
  daysToPending: 28,
  cityDaysToPending: 30,
  cityLabel: 'Bend',
  compMarks: [],
  compCount: null,
  subjectFound: true,
  subjectSummary: null,
  asOfLabel: 'September 7, 2026',
  sources: { supply: 'market_metric, Sunriver detached, read September 7, 2026' },
  unmatchedSentence: 'We could not match that address.',
}

const supplyOf = (input: Parameters<typeof buildAnswerFigures>[0]) =>
  buildAnswerFigures(input).find((f) => f.key === 'supply')

describe('the supply two-bar · a reader can reproduce the verdict', () => {
  it('keeps a decimal on the monthly pace when a whole number would not divide back', () => {
    const supply = supplyOf(base)!
    const sold = supply.bars!.find((b) => b.name === 'Under contract in a month')!
    expect(sold.label).toBe('8.3')
    // The division a reader actually performs lands on the published figure.
    const recovered = base.activeCount / Number(sold.label)
    expect(recovered).toBeGreaterThanOrEqual(5.75)
    expect(recovered).toBeLessThan(5.85)
    // …and stays inside the balanced band it claims, never crossing to buyer's.
    expect(recovered).toBeLessThan(6)
  })

  it('states the same pace in the claim sentence as on the bar', () => {
    const supply = supplyOf(base)!
    expect(supply.claim).toContain('about 8.3 of them go under contract')
  })

  it('prints a whole number whole, with no decimal noise', () => {
    const supply = supplyOf({ ...base, activeCount: 40, salesPerMonth: 8, monthsOfSupply: '5.0' })!
    const sold = supply.bars!.find((b) => b.name === 'Under contract in a month')!
    expect(sold.label).toBe('8')
    expect(supply.claim).toContain('about 8 of them')
  })
})
