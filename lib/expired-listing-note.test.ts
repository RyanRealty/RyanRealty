import { afterEach, describe, expect, it } from 'vitest'
import {
  buildListingNote,
  formatPriceDropLine,
  priceDropsFromHistory,
  resolveDaysOnMarket,
  resolveOnMarketDate,
  type ExpiredNoteHistoryRow,
  type ExpiredNoteListing,
} from './expired-listing-note'

const listing = (overrides: Partial<ExpiredNoteListing> = {}): ExpiredNoteListing => ({
  ListingKey: 'KEY-1',
  ListNumber: '220199001',
  StandardStatus: 'Expired',
  status_change_timestamp: '2026-08-15T18:00:00.000Z',
  StreetNumber: '123',
  StreetName: 'Deschutes',
  City: 'Bend',
  PostalCode: '97702',
  ListPrice: 575_000,
  OriginalListPrice: 625_000,
  CumulativeDaysOnMarket: 45,
  OnMarketDate: '2026-07-01',
  ListDate: '2026-06-30',
  ListAgentName: 'Jane Broker',
  list_agent_email: 'jane@example.com',
  PropertyType: 'A',
  BedroomsTotal: 3,
  BathroomsTotal: 2,
  TotalLivingAreaSqFt: 1800,
  SubdivisionName: 'Old Farm District',
  ...overrides,
})

const owner = {
  ownerName: 'Pat Owner',
  ownerEmail: 'pat@example.com',
  ownerPhone: '5415550100',
}

const history: ExpiredNoteHistoryRow[] = [
  {
    event: 'PriceChange',
    event_date: '2026-07-20T12:00:00.000Z',
    price: 599_000,
    price_change: -26_000,
    raw: { Field: 'ListPrice', PreviousValue: 625_000, NewValue: 599_000 },
  },
  {
    event: 'PriceChange',
    event_date: '2026-08-01T12:00:00.000Z',
    price: 575_000,
    price_change: -24_000,
    raw: { Field: 'ListPrice', PreviousValue: 599_000, NewValue: 575_000 },
  },
  {
    event: 'StatusChange',
    event_date: '2026-08-15T18:00:00.000Z',
    raw: { Field: 'MlsStatus', PreviousValue: 'Active', NewValue: 'Expired' },
  },
]

describe('resolveOnMarketDate', () => {
  it('prefers OnMarketDate over ListDate', () => {
    expect(resolveOnMarketDate(listing())).toBe('2026-07-01')
  })

  it('falls back to ListDate when OnMarketDate is missing', () => {
    expect(resolveOnMarketDate(listing({ OnMarketDate: null }))).toBe('2026-06-30')
  })
})

describe('resolveDaysOnMarket', () => {
  it('keeps CumulativeDaysOnMarket when present', () => {
    expect(resolveDaysOnMarket(listing({ CumulativeDaysOnMarket: 12 }))).toBe(12)
  })

  it('computes list date → status change when DOM is null', () => {
    expect(
      resolveDaysOnMarket(
        listing({
          CumulativeDaysOnMarket: null,
          OnMarketDate: '2026-07-01',
          status_change_timestamp: '2026-08-15T18:00:00.000Z',
        }),
      ),
    ).toBe(45)
  })
})

describe('priceDropsFromHistory', () => {
  it('emits documented from → to drops only', () => {
    expect(priceDropsFromHistory(history)).toEqual([
      { date: '2026-07-20', from: 625_000, to: 599_000 },
      { date: '2026-08-01', from: 599_000, to: 575_000 },
    ])
  })

  it('returns no drops when history is empty', () => {
    expect(priceDropsFromHistory([])).toEqual([])
  })

  it('does not invent a cut from original vs last list alone', () => {
    expect(
      priceDropsFromHistory([
        { event: 'NewListing', event_date: '2026-07-01', price: 625_000, raw: { Field: 'MlsStatus', NewValue: 'Active' } },
      ]),
    ).toEqual([])
  })
})

describe('buildListingNote', () => {
  const prev = process.env.NEXT_PUBLIC_SITE_URL
  afterEach(() => {
    if (prev === undefined) delete process.env.NEXT_PUBLIC_SITE_URL
    else process.env.NEXT_PUBLIC_SITE_URL = prev
  })

  it('writes on-market date and per-drop lines when history exists', () => {
    const note = buildListingNote(listing(), owner, history)
    expect(note).toContain('On market: 2026-07-01')
    expect(note).toContain('Days on market: 45 days')
    expect(note).toContain(formatPriceDropLine({ date: '2026-07-20', from: 625_000, to: 599_000 }))
    expect(note).toContain(formatPriceDropLine({ date: '2026-08-01', from: 599_000, to: 575_000 }))
    expect(note).toContain('Prior list agent: Jane Broker (jane@example.com)')
    expect(note).not.toMatch(/failed you|should have|prior agent (did|failed)/i)
  })

  it('omits drop lines when history is empty (no invented cuts)', () => {
    const note = buildListingNote(listing(), owner, [])
    expect(note).toContain('On market: 2026-07-01')
    expect(note).toContain('Original list: $625,000 (dropped $50,000, 8.0%)')
    expect(note).not.toContain('$625,000 → $599,000')
    expect(note).not.toContain('$599,000 → $575,000')
    expect(note).not.toMatch(/\d{4}-\d{2}-\d{2}: \$[\d,]+ → \$[\d,]+/)
  })
})
