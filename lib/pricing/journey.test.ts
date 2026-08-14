import { describe, expect, it } from 'vitest'
import { buildSaleJourney, type HistoryEvent } from '@/lib/pricing/journey'

const ev = (over: Partial<HistoryEvent>): HistoryEvent => ({
  eventDate: '2026-06-01',
  event: 'FieldChange',
  field: 'ListPrice',
  previousValue: '155000',
  newValue: '145000',
  price: 145000,
  ...over,
})

describe('buildSaleJourney', () => {
  it('dedupes the same ListPrice change and counts real drops', () => {
    const events = [
      ev({ eventDate: '2009-11-05' }),
      ev({ eventDate: '2009-11-05' }),
      ev({
        eventDate: '2009-11-18',
        field: 'MlsStatus',
        previousValue: 'Active',
        newValue: 'Pending',
        price: 145000,
      }),
    ]
    const j = buildSaleJourney({
      events,
      originalListPrice: 155000,
      lastListPrice: 145000,
      closePrice: 130000,
      onMarketDate: '2009-10-08',
      pendingTimestamp: null,
    })
    expect(j.dropCount).toBe(1)
    expect(j.steps).toHaveLength(1)
    expect(j.saleToOriginal).toBe(0.8387)
    expect(j.pendingDate).toBe('2009-11-18')
    expect(j.firstDropDay).toBe(28)
  })

  it('ignores non-price field noise', () => {
    const j = buildSaleJourney({
      events: [ev({ field: 'PostalCode', previousValue: '97703', newValue: '97701' })],
      originalListPrice: 500000,
      lastListPrice: 500000,
      closePrice: 490000,
      onMarketDate: '2026-01-01',
      pendingTimestamp: '2026-02-01',
    })
    expect(j.dropCount).toBe(0)
    expect(j.steps).toHaveLength(0)
    expect(j.pendingDate).toBe('2026-02-01')
  })
})
