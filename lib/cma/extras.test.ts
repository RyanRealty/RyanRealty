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
  computeSold90SameBedsBaths,
} from './extras'
import type { CmaAdjustedComp } from './types'
import type { CmaMarketAreaRow } from '@/lib/data/cma/marketAreaReads'

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

  it('drops townhouses and condos when the subject is a detached house', () => {
    const b = computeBandPosition(
      {
        activeAsks: [465000, 438995],
        activeDaysOnMarket: [17, 40],
        pendingCount: 1,
        activeRows: [
          {
            ListingKey: 'sfr',
            StreetNumber: '947',
            StreetName: '6th',
            ListPrice: 465000,
            StandardStatus: 'Active',
            DaysOnMarket: 17,
            PhotoURL: null,
            Latitude: 44.05,
            Longitude: -121.29,
            property_sub_type: 'Single Family Residence',
          },
          {
            ListingKey: 'th',
            StreetNumber: '61737',
            StreetName: 'Santorini',
            ListPrice: 438995,
            StandardStatus: 'Active',
            DaysOnMarket: 40,
            PhotoURL: null,
            Latitude: 44.04,
            Longitude: -121.28,
            property_sub_type: 'Townhouse',
          },
        ],
        pendingRows: [],
      },
      'Bend',
      425000,
      510000,
      { latitude: 44.05, longitude: -121.29, propertySubType: 'Single Family Residence' },
    )
    expect(b!.activeCount).toBe(1)
    expect(b!.rivals.map((r) => r.address)).toEqual(['947 6th'])
    expect(b!.rivals.some((r) => /santorini/i.test(r.address))).toBe(false)
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

describe('computeSold90SameBedsBaths', () => {
  function row(over: Partial<CmaMarketAreaRow> = {}): CmaMarketAreaRow {
    return {
      StandardStatus: 'Closed',
      ListPrice: 480000,
      ClosePrice: 475000,
      CloseDate: '2026-07-01',
      ListDate: '2026-05-01',
      OnMarketDate: '2026-05-01',
      TotalLivingAreaSqFt: 1600,
      BedroomsTotal: 3,
      BathroomsTotal: 2,
      DaysOnMarket: 14,
      CumulativeDaysOnMarket: 14,
      status_change_timestamp: '2026-07-01',
      SubdivisionName: 'Heritage Ranch',
      property_sub_type: 'Single Family Residence',
      ...over,
    }
  }
  const subject = {
    beds: 3,
    baths: 2,
    propertySubType: 'Single Family Residence',
    city: 'Redmond',
    subdivision: 'Heritage Ranch',
  }
  const asOf = new Date('2026-08-17T00:00:00Z')

  it('needs three same-bed same-bath closes in 90 days', () => {
    const band = computeSold90SameBedsBaths({
      rows: [row(), row({ ClosePrice: 490000, CloseDate: '2026-06-15' }), row({ ClosePrice: 460000, CloseDate: '2026-07-20' })],
      subject,
      asOf,
    })
    expect(band).not.toBeNull()
    expect(band!.count).toBe(3)
    expect(band!.bedsLabel).toBe('3 bedroom / 2 bath')
    expect(band!.source).toContain('Heritage Ranch')
    expect(band!.source).not.toMatch(/ZIP/i)
  })

  it('drops a different bed count and a different whole-bath count', () => {
    const band = computeSold90SameBedsBaths({
      rows: [
        row(),
        row({ ClosePrice: 490000 }),
        row({ BedroomsTotal: 2, ClosePrice: 400000 }),
        row({ BathroomsTotal: 3, ClosePrice: 510000 }),
      ],
      subject,
      asOf,
    })
    expect(band).toBeNull()
  })
})
