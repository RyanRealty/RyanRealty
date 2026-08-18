/**
 * Report extras — pure computation rules. Every block must refuse to render
 * on thin data (§0: cut, don't guess) and compute honest aggregates on
 * real-shaped rows.
 */
import { describe, expect, it } from 'vitest'
import {
  computeSeasonality,
  computeFinancing,
  computeBandPosition,
  computeSubdivisionPulse,
  computePhotoBench,
} from './extras'
import type { CmaAdjustedComp } from './types'

function closedRow(closeDate: string, dtp: number | null, fin: string | null = '{"Conventional": true}') {
  return { CloseDate: closeDate, days_to_pending: dtp, buyer_financing: fin }
}

describe('computeSeasonality', () => {
  it('groups by close month and claims medians only at n ≥ 12', () => {
    const rows = []
    // 20 May sales at 10 days, 20 November sales at 40 days, spread over 2 years.
    for (let i = 0; i < 20; i++) {
      rows.push(closedRow(`202${4 + (i % 2)}-05-1${i % 9}`, 10))
      rows.push(closedRow(`202${4 + (i % 2)}-11-1${i % 9}`, 40))
    }
    // 5 February sales — too thin for a days claim.
    for (let i = 0; i < 5; i++) rows.push(closedRow(`2025-02-0${i + 1}`, 7))
    // Pad other months to clear the 120-row corpus floor and 6-month claim floor.
    for (const mm of ['01', '03', '04', '06', '07', '08', '09', '10']) {
      for (let i = 0; i < 13; i++) rows.push(closedRow(`2025-${mm}-1${i % 9}`, 20 + i))
    }
    const x = computeSeasonality(rows, 'Bend', '2023-08-06')
    expect(x).not.toBeNull()
    const may = x!.byMonth.find((m) => m.month === 5)!
    const nov = x!.byMonth.find((m) => m.month === 11)!
    const feb = x!.byMonth.find((m) => m.month === 2)!
    expect(may.closedCount).toBe(20)
    expect(may.medianDaysToPending).toBe(10)
    expect(nov.medianDaysToPending).toBe(40)
    expect(feb.medianDaysToPending).toBeNull()
    expect(x!.fastestMonths).toContain('May')
    expect(x!.slowestMonths).toContain('November')
    expect(x!.source).toContain("City='Bend'")
  })

  it('refuses a thin corpus outright', () => {
    const rows = Array.from({ length: 50 }, (_, i) => closedRow(`2025-0${(i % 9) + 1}-10`, 12))
    expect(computeSeasonality(rows, 'Bend', '2023-08-06')).toBeNull()
  })
})

describe('computeFinancing', () => {
  it('parses the JSON-keyed buyer_financing vocabulary', () => {
    const rows = []
    for (let i = 0; i < 30; i++) rows.push(closedRow('2026-05-01', 10, '{"Cash": true}'))
    for (let i = 0; i < 50; i++) rows.push(closedRow('2026-05-01', 10, '{"Conventional": true}'))
    for (let i = 0; i < 15; i++) rows.push(closedRow('2026-05-01', 10, '{"FHA": true}'))
    for (let i = 0; i < 5; i++) rows.push(closedRow('2026-05-01', 10, '{"Seller Financing": true}'))
    const f = computeFinancing(rows, 'Bend', '2025-08-05')
    expect(f).not.toBeNull()
    expect(f!.sampleCount).toBe(100)
    expect(f!.cashPct).toBe(30)
    expect(f!.conventionalPct).toBe(50)
    expect(f!.fhaVaPct).toBe(15)
    expect(f!.otherPct).toBe(5)
  })

  it('a mixed Cash+Conventional tag counts as cash, and old rows fall outside the window', () => {
    const rows = []
    for (let i = 0; i < 45; i++) rows.push(closedRow('2026-05-01', 10, '{"Cash": true, "Conventional": true}'))
    for (let i = 0; i < 40; i++) rows.push(closedRow('2024-01-01', 10, '{"Conventional": true}'))
    const f = computeFinancing(rows, 'Bend', '2025-08-05')
    expect(f!.sampleCount).toBe(45)
    expect(f!.cashPct).toBe(100)
  })

  it('classifies the bare-word legacy format identically to the JSON format', () => {
    const rows = []
    for (let i = 0; i < 20; i++) rows.push(closedRow('2026-05-01', 10, 'Cash'))
    for (let i = 0; i < 20; i++) rows.push(closedRow('2026-05-01', 10, '{"Cash": true}'))
    for (let i = 0; i < 30; i++) rows.push(closedRow('2026-05-01', 10, 'Conventional'))
    for (let i = 0; i < 20; i++) rows.push(closedRow('2026-05-01', 10, 'VA'))
    for (let i = 0; i < 10; i++) rows.push(closedRow('2026-05-01', 10, 'Other'))
    const f = computeFinancing(rows, 'Bend', '2025-08-05')
    expect(f!.cashPct).toBe(40)
    expect(f!.conventionalPct).toBe(30)
    expect(f!.fhaVaPct).toBe(20)
    expect(f!.otherPct).toBe(10)
  })

  it('under 40 in-window sales ships nothing', () => {
    const rows = Array.from({ length: 39 }, () => closedRow('2026-05-01', 10, '{"Cash": true}'))
    expect(computeFinancing(rows, 'Bend', '2025-08-05')).toBeNull()
  })
})

describe('computeBandPosition', () => {
  it('medians the live band and passes counts through', () => {
    const b = computeBandPosition(
      { activeAsks: [700000, 725000, 750000], activeDaysOnMarket: [10, 30, 50], pendingCount: 4 },
      'Bend',
      675000,
      825000,
    )
    expect(b!.activeCount).toBe(3)
    expect(b!.activeMedianAsk).toBe(725000)
    expect(b!.activeMedianDom).toBe(30)
    expect(b!.pendingCount).toBe(4)
  })
  it('a failed inventory pull ships nothing', () => {
    expect(computeBandPosition(null, 'Bend', 1, 2)).toBeNull()
  })

  it('keeps actives that pass the priced rungs and drops a house outside that search', () => {
    const row = (
      over: Partial<{
        ListingKey: string
        StreetNumber: string
        StreetName: string
        ListPrice: number
        BedroomsTotal: number
        BathroomsTotal: number
        TotalLivingAreaSqFt: number
        Latitude: number
        Longitude: number
        SubdivisionName: string
      }>,
    ) => ({
      ListingKey: over.ListingKey ?? 'A',
      StreetNumber: over.StreetNumber ?? '10',
      StreetName: over.StreetName ?? 'Pine',
      ListPrice: over.ListPrice ?? 410000,
      StandardStatus: 'Active',
      DaysOnMarket: 10,
      PhotoURL: null,
      Latitude: over.Latitude ?? 44.05,
      Longitude: over.Longitude ?? -121.3,
      BedroomsTotal: over.BedroomsTotal ?? 3,
      BathroomsTotal: over.BathroomsTotal ?? 1,
      TotalLivingAreaSqFt: over.TotalLivingAreaSqFt ?? 1056,
      SubdivisionName: over.SubdivisionName ?? 'Other',
      year_built: 1978,
      lot_size_acres: 0.2,
      property_sub_type: 'Single Family Residence',
    })
    const b = computeBandPosition(
      {
        activeAsks: [410000, 449000, 520000],
        activeDaysOnMarket: [10, 12, 20],
        pendingCount: 0,
        activeRows: [
          row({ ListingKey: 'A', StreetNumber: '10', StreetName: 'Pine', ListPrice: 410000, BathroomsTotal: 2 }),
          row({
            ListingKey: 'FAR',
            StreetNumber: '1',
            StreetName: 'Distant',
            ListPrice: 449000,
            BathroomsTotal: 1,
            Latitude: 44.12,
            Longitude: -121.26,
          }),
        ],
        pendingRows: [],
      },
      'Bend',
      200000,
      800000,
      {
        subject: {
          listingKey: 'SUBJ',
          streetAddress: '648 Douglas',
          city: 'Bend',
          citySlug: 'bend',
          subdivision: 'Clear Sky Estates',
          subdivisionNorm: 'clear sky estates',
          latitude: 44.05,
          longitude: -121.3,
          beds: 3,
          baths: 1,
          sqft: 1056,
          lotAcres: 0.2,
          yearBuilt: 1978,
          storyClass: 'one',
          productClass: 'detached',
          waterClass: 'unknown',
          sewerClass: 'unknown',
          hoaClass: 'unknown',
          lotClass: 'in_town',
          ruralAcreage: false,
          marketArea: null,
        },
        tiersUsed: ['nearby-2mi-3mo'],
        asOf: '2026-08-17',
      },
    )
    expect(b!.activeCount).toBe(1)
    expect(b!.rivals?.map((r) => r.address)).toEqual(['10 Pine'])
    expect(b!.productLabel).toMatch(/2-mile search/)
    expect(b!.source).toMatch(/nearby-2mi-3mo/)
    expect(b!.source).not.toMatch(/3-bedroom, 1-bath/)
  })
})

describe('computeSubdivisionPulse', () => {
  it('needs three sales to speak', () => {
    expect(
      computeSubdivisionPulse(
        [
          { ClosePrice: 500000, CloseDate: '2026-01-01' },
          { ClosePrice: 600000, CloseDate: '2026-02-01' },
        ],
        'Kenwood',
        12,
        '2025-08-05',
      ),
    ).toBeNull()
    const p = computeSubdivisionPulse(
      [
        { ClosePrice: 500000, CloseDate: '2026-01-01' },
        { ClosePrice: 600000, CloseDate: '2026-02-01' },
        { ClosePrice: 700000, CloseDate: '2026-03-01' },
      ],
      'Kenwood',
      12,
      '2025-08-05',
    )
    expect(p!.closedCount).toBe(3)
    expect(p!.medianClose).toBe(600000)
    expect(p!.low).toBe(500000)
    expect(p!.high).toBe(700000)
  })
})

describe('computePhotoBench', () => {
  const comp = (photos: number | null): CmaAdjustedComp =>
    ({ address: 'x', photosCount: photos } as unknown as CmaAdjustedComp)
  it('medians comp photo counts against the subject', () => {
    const b = computePhotoBench(12, [comp(30), comp(40), comp(50), comp(null)])
    expect(b!.subjectPhotos).toBe(12)
    expect(b!.compMedianPhotos).toBe(40)
    expect(b!.compPhotos).toHaveLength(3)
  })
  it('no subject photos or too few comp counts ships nothing', () => {
    expect(computePhotoBench(null, [comp(30), comp(40), comp(50)])).toBeNull()
    expect(computePhotoBench(0, [comp(30), comp(40), comp(50)])).toBeNull()
    expect(computePhotoBench(12, [comp(30), comp(40)])).toBeNull()
  })
})
