/** Subdivision story — deterministic facts + render rules. The AI pass is not
 *  exercised here (fails open by design); everything a reader sees numbers-wise
 *  comes from computeSubdivisionFacts, locked below. */
import { describe, expect, it } from 'vitest'
import { computeSubdivisionFacts } from './subdivision-story'
import type { CmaSubdivisionHistoryRow } from '@/lib/data/cma/builderReads'
import type { CmaSubject } from './types'

function sale(over: Partial<CmaSubdivisionHistoryRow>): CmaSubdivisionHistoryRow {
  return {
    ListingKey: Math.random().toString(36).slice(2),
    ListNumber: '220000000',
    StreetNumber: '123',
    StreetName: 'Test',
    ClosePrice: 600000,
    CloseDate: '2025-06-01',
    ListPrice: 610000,
    OriginalListPrice: 620000,
    TotalLivingAreaSqFt: 2000,
    BedroomsTotal: 3,
    BathroomsTotal: 2,
    year_built: 2020,
    CumulativeDaysOnMarket: 20,
    lot_size_acres: 0.1,
    public_remarks: null,
    PhotoURL: null,
    ...over,
  }
}

const subject = { sqft: 2222, streetAddress: '20513 Byron', beds: 4, baths: 3, yearBuilt: 2023 } as unknown as CmaSubject

describe('computeSubdivisionFacts', () => {
  it('aggregates by close year with medians, records, and the subject percentile', () => {
    const rows = [
      sale({ ClosePrice: 500000, CloseDate: '2023-04-01', TotalLivingAreaSqFt: 1800, year_built: 2019 }),
      sale({ ClosePrice: 550000, CloseDate: '2023-09-01', TotalLivingAreaSqFt: 2000 }),
      sale({ ClosePrice: 560000, CloseDate: '2023-11-01', TotalLivingAreaSqFt: 2100 }),
      sale({ ClosePrice: 600000, CloseDate: '2024-05-01', TotalLivingAreaSqFt: 2200 }),
      sale({ ClosePrice: 640000, CloseDate: '2024-07-01', TotalLivingAreaSqFt: 2400, year_built: 2024 }),
      sale({ ClosePrice: 700000, CloseDate: '2025-03-01', StreetNumber: '999', StreetName: 'Summit', TotalLivingAreaSqFt: 2600 }),
    ]
    const f = computeSubdivisionFacts(rows, 'Stone Creek', subject, '2016-08-05')!
    expect(f.totalSales).toBe(6)
    expect(f.years.map((y) => y.year)).toEqual([2023, 2024, 2025])
    expect(f.years[0]).toMatchObject({ year: 2023, count: 3, medianClose: 550000 })
    expect(f.years[1]).toMatchObject({ year: 2024, count: 2, medianClose: 620000 })
    expect(f.recordHigh).toMatchObject({ price: 700000, address: '999 Summit' })
    expect(f.recordLow!.price).toBe(500000)
    // subject 2222 sqft beats 1800/2000/2100/2200 of 6 → 4/6 ≈ 67%
    expect(f.subjectSqftPercentile).toBe(67)
    expect(f.vintageSpan).toEqual({ min: 2019, max: 2024 })
    expect(f.source).toContain("SubdivisionName='Stone Creek'")
  })

  it('under five sales tells no story', () => {
    const rows = [sale({}), sale({}), sale({}), sale({})]
    expect(computeSubdivisionFacts(rows, 'Tiny', subject, '2016-08-05')).toBeNull()
  })

  it('sale-to-list and DOM come from the recent two years only', () => {
    const now = new Date()
    const recentIso = new Date(now.getTime() - 100 * 24 * 3600e3).toISOString().slice(0, 10)
    const oldIso = '2019-05-01'
    const rows = [
      sale({ ClosePrice: 590000, ListPrice: 600000, CloseDate: recentIso, CumulativeDaysOnMarket: 10 }),
      sale({ ClosePrice: 590000, ListPrice: 600000, CloseDate: recentIso, CumulativeDaysOnMarket: 30 }),
      sale({ ClosePrice: 400000, ListPrice: 800000, CloseDate: oldIso, CumulativeDaysOnMarket: 400 }),
      sale({ ClosePrice: 410000, ListPrice: 820000, CloseDate: oldIso }),
      sale({ ClosePrice: 420000, ListPrice: 840000, CloseDate: oldIso }),
    ]
    const f = computeSubdivisionFacts(rows, 'Stone Creek', subject, '2016-08-05')!
    expect(f.saleToListRecentPct).toBe(98.3)
    expect(f.medianDomRecent).toBe(20)
  })

  it('does not treat a zero CDOM as a median of zero days', () => {
    const now = new Date()
    const recentIso = new Date(now.getTime() - 40 * 24 * 3600e3).toISOString().slice(0, 10)
    const rows = [
      sale({ CloseDate: recentIso, CumulativeDaysOnMarket: 0 }),
      sale({ CloseDate: recentIso, CumulativeDaysOnMarket: 0 }),
      sale({ CloseDate: recentIso, CumulativeDaysOnMarket: 0 }),
      sale({ CloseDate: recentIso, CumulativeDaysOnMarket: 0 }),
      sale({ CloseDate: recentIso, CumulativeDaysOnMarket: 0 }),
    ]
    const f = computeSubdivisionFacts(rows, 'Clear Sky', subject, '2016-08-05')!
    expect(f.medianDomRecent).toBeNull()
  })
})
