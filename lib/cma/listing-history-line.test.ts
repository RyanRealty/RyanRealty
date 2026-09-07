import { describe, expect, it } from 'vitest'
import {
  daysOnMarketFrom,
  daysOnMarketLabel,
  listingHistoryLine,
} from '@/lib/cma/listing-history-line'

describe('listingHistoryLine', () => {
  it('names a price cut on an active listing with DOM', () => {
    expect(
      listingHistoryLine({
        listPrice: 497800,
        originalListPrice: 525000,
        status: 'Active',
        onMarketDate: '2026-05-01',
        daysOnMarket: 64,
      }),
    ).toBe('Listed May 1, 2026 at $525,000, now $497,800 · 64 days on market')
  })

  it('does not invent a cut when original equals list', () => {
    expect(
      listingHistoryLine({
        listPrice: 500000,
        originalListPrice: 500000,
        status: 'Active',
        onMarketDate: '2026-06-15',
        daysOnMarket: 20,
      }),
    ).toMatch(/^Listed at \$500,000 since /)
    expect(
      listingHistoryLine({
        listPrice: 500000,
        originalListPrice: 500000,
        status: 'Active',
        onMarketDate: '2026-06-15',
        daysOnMarket: 20,
      }),
    ).toContain('20 days on market')
  })

  it('shows sold list-to-close timeline without blaming anyone', () => {
    const line = listingHistoryLine({
      listPrice: 510000,
      originalListPrice: 529000,
      closePrice: 497800,
      status: 'Closed',
      onMarketDate: '2026-02-01',
      closeDate: '2026-04-10',
      daysOnMarket: 42,
    })
    expect(line).toContain('Listed')
    expect(line).toContain('$529,000')
    expect(line).toContain('cut to $510,000')
    expect(line).toContain('sold')
    expect(line).toContain('$497,800')
    expect(line).toContain('42 days on market')
    expect(line?.toLowerCase()).not.toContain('overprice')
  })

  it('shows expired peers came off without saying overpriced', () => {
    const line = listingHistoryLine({
      listPrice: 519000,
      originalListPrice: 549000,
      status: 'Expired',
      daysOnMarket: 97,
    })
    expect(line).toBe('Asked $549,000, cut to $519,000, came off expired · 97 days on market')
    expect(line?.toLowerCase()).not.toContain('overprice')
  })
})

describe('daysOnMarketFrom', () => {
  it('prefers the measured count', () => {
    expect(daysOnMarketFrom({ daysOnMarket: 12, onMarketDate: '2020-01-01' })).toBe(12)
  })

  it('derives from on-market date when count is missing', () => {
    const asOf = new Date('2026-09-06T12:00:00.000Z')
    expect(daysOnMarketFrom({ onMarketDate: '2026-08-07', asOf })).toBe(30)
  })
})

describe('daysOnMarketLabel', () => {
  it('labels singular and plural', () => {
    expect(daysOnMarketLabel(1)).toBe('1 day on market')
    expect(daysOnMarketLabel(12)).toBe('12 days on market')
    expect(daysOnMarketLabel(null)).toBeNull()
  })
})
