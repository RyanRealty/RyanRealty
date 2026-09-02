import { describe, expect, it } from 'vitest'
import { buildBrokerRecord, brokerRecordSource } from './broker-record'
import type { BrokerSaleTile } from '@/lib/data/brokers/getBrokerSales'

const NOW = Date.parse('2026-09-02T12:00:00Z')

function sale(over: Partial<BrokerSaleTile>): BrokerSaleTile {
  return {
    ListingKey: over.ListingKey ?? 'k',
    ListNumber: null,
    ListPrice: null,
    OriginalListPrice: null,
    BedroomsTotal: null,
    BathroomsTotal: null,
    TotalLivingAreaSqFt: null,
    StreetNumber: null,
    StreetName: null,
    City: 'Bend',
    State: 'OR',
    PostalCode: null,
    SubdivisionName: null,
    PhotoURL: null,
    StandardStatus: 'Closed',
    OnMarketDate: null,
    CloseDate: '2025-06-01',
    ClosePrice: 700_000,
    ListAgentName: null,
    ListOfficeName: null,
    has_virtual_tour: null,
    virtual_tour_url: null,
    year_built: null,
    price_per_sqft: null,
    lot_size_acres: null,
    garage_spaces: null,
    pool_yn: null,
    estimated_monthly_piti: null,
    price_drop_count: null,
    DaysOnMarket: null,
    total_price_change_pct: null,
    saleSide: 'listed',
    ...over,
  } as BrokerSaleTile
}

describe('buildBrokerRecord', () => {
  const sales = [
    sale({ ListingKey: 'a', CloseDate: '2024-03-10', ClosePrice: 600_000, Latitude: 44.06, Longitude: -121.31, PropertyType: 'A', property_sub_type: 'Single Family Residence' }),
    sale({ ListingKey: 'b', CloseDate: '2025-06-01', ClosePrice: 700_000, Latitude: 44.07, Longitude: -121.32, PropertyType: 'A', property_sub_type: 'Condominium', saleSide: 'represented-buyer' }),
    sale({ ListingKey: 'c', CloseDate: '2025-11-20', ClosePrice: 900_000, Latitude: null, Longitude: null }),
    sale({ ListingKey: 'd', CloseDate: '2026-02-14', ClosePrice: 1_250_000, Latitude: 44.05, Longitude: -121.3, PropertyType: 'A', property_sub_type: 'Single Family Residence' }),
    sale({ ListingKey: 'e', CloseDate: null, ClosePrice: 500_000 }),
    sale({ ListingKey: 'f', CloseDate: '2025-01-01', ClosePrice: null }),
  ]
  const record = buildBrokerRecord(sales, NOW)

  it('keeps only closings with a date and a price, newest first', () => {
    expect(record.closings.map((c) => c.ListingKey)).toEqual(['d', 'c', 'b', 'a'])
  })

  it('states every figure from the rows', () => {
    const labels = Object.fromEntries(record.figures.map((f) => [f.label, f.value]))
    expect(labels['closed sales']).toBe('4')
    expect(labels['on the MLS']).toBe('2024 to 2026')
    expect(labels['median close']).toBe('$800K')
    expect(labels['listed · represented the buyer']).toBe('3 · 1')
    expect(labels['so far in 2026']).toBe('1')
  })

  it('maps only the closings with a coordinate, typed and priced by the close', () => {
    expect(record.dots.map((d) => d.k)).toEqual(['d', 'b', 'a'])
    expect(record.dots.every((d) => d.s === 'closed')).toBe(true)
    expect(record.dots[0]?.p).toBe(1_250_000)
    expect(new Set(record.dots.map((d) => d.t))).toEqual(new Set(['house', 'condo']))
    expect(record.types.map((t) => t.key)).toEqual(['house', 'condo'])
  })

  it('charts closings by year with the partial year standing alone', () => {
    expect(record.chart?.kind).toBe('bars')
    const ticks = record.chart?.series?.[0]?.points.map((p) => p.tick)
    expect(ticks).toEqual(['2024', '2025', '2026'])
    expect(record.chart?.series?.[0]?.points.map((p) => p.label)).toEqual(['1', '2', '1 to date'])
    expect(record.chart?.claim).toBe('Closed sales 1 in 2026 so far.')
  })

  it('writes the source line from the record, naming the coordinate coverage', () => {
    expect(brokerRecordSource('Matt', record)).toBe(
      "Matt's closed sales on the regional MLS through Oregon Data Share, listed or with the buyer represented, 2024 to 2026. 3 of 4 closings carry a coordinate.",
    )
  })

  it('is empty, not wrong, with no closings', () => {
    const empty = buildBrokerRecord([], NOW)
    expect(empty.figures).toEqual([])
    expect(empty.dots).toEqual([])
    expect(empty.chart).toBeUndefined()
  })
})
