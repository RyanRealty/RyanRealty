import { describe, it, expect } from 'vitest'
import {
  addDays,
  buildAliasIndex,
  cellWindow,
  priorYearWindow,
  printedPercent,
  buildSparkChecks,
  daysBetween,
  deltaPct,
  deltaStatus,
  earliestCloseDayNeeded,
  isPriceTypo,
  listToPendingDays,
  marketTruthPublishableCloses,
  minusMonths,
  monthLastDay,
  percentileCont,
  pointInPolygonal,
  polygonalAcres,
  polygonalBbox,
  primaryNeighborhood,
  realParcel,
  uniqueListings,
  utcDay,
  type NeighborhoodShape,
  type Polygonal,
  type SparkCheckData,
  type SparkListing,
} from './market-report-spark-check'
import { renderMarketReportEmail } from './market-report-email'
import type { MarketReportAreaBlock } from '@/lib/data/crm/getMarketReportData'
import type { MarketTrendPoint } from '@/lib/data/market/getMarketTrend'
import type { ReportFigure } from './market-report-figures'

function square(minLng: number, minLat: number, maxLng: number, maxLat: number): GeoJSON.Polygon {
  return {
    type: 'Polygon',
    coordinates: [[[minLng, minLat], [maxLng, minLat], [maxLng, maxLat], [minLng, maxLat], [minLng, minLat]]],
  }
}

describe('dates', () => {
  it('reads a UTC day from a date or a timestamp', () => {
    expect(utcDay('2026-08-14')).toBe('2026-08-14')
    expect(utcDay('2026-08-14T23:00:28Z')).toBe('2026-08-14')
    expect(utcDay('2026-08-14T23:30:00-07:00')).toBe('2026-08-15')
    expect(utcDay('')).toBeNull()
    expect(utcDay('not a date')).toBeNull()
  })

  it('subtracts months the way Postgres date - interval does (clamped to month end)', () => {
    expect(minusMonths('2026-09-29', 12)).toBe('2025-09-29')
    expect(minusMonths('2026-03-31', 1)).toBe('2026-02-28')
    expect(minusMonths('2024-03-31', 1)).toBe('2024-02-29')
    expect(minusMonths('2026-01-15', 13)).toBe('2024-12-15')
  })

  it('rebuilds a cell window and its year-over-year window the way compute_market_metrics does', () => {
    expect(cellWindow({ periodEnd: '2026-09-29', windowMonths: 12 })).toEqual({ after: '2025-09-29', through: '2026-09-29' })
    expect(priorYearWindow({ periodEnd: '2026-09-29', windowMonths: 12 })).toEqual({ after: '2024-09-29', through: '2025-09-29' })
    // The prior window always ends 12 months back, whatever its length.
    expect(priorYearWindow({ periodEnd: '2026-09-29', windowMonths: 24 })).toEqual({ after: '2023-09-29', through: '2025-09-29' })
    expect(cellWindow({ windowMonths: 12 })).toBeNull()
  })

  it('adds days and counts days between', () => {
    expect(addDays('2026-09-29', -180)).toBe('2026-04-02')
    expect(daysBetween('2026-01-01', '2026-01-11')).toBe(10)
    expect(monthLastDay('2026-02-01')).toBe('2026-02-28')
    expect(monthLastDay('2026-08-15')).toBe('2026-08-31')
  })
})

describe('statistics', () => {
  it('percentileCont matches PostgreSQL (interpolates an even count)', () => {
    expect(percentileCont([3, 1, 2])).toBe(2)
    expect(percentileCont([1, 2, 3, 4])).toBe(2.5)
    expect(percentileCont([699_900, 780_000])).toBe(739_950)
    expect(percentileCont([])).toBeNull()
  })

  it('deltaPct is (supabase - spark) / spark, and 1% is the STOP line', () => {
    expect(deltaPct(731, 730)).toBe(0.14)
    expect(deltaPct(29, 29)).toBe(0)
    expect(deltaPct(29, 30)).toBe(-3.33)
    expect(deltaPct(null, 30)).toBeNull()
    expect(deltaPct(5, 0)).toBeNull()
    expect(deltaStatus(1)).toBe('ok')
    expect(deltaStatus(-1)).toBe('ok')
    expect(deltaStatus(1.01)).toBe('STOP')
    expect(deltaStatus(null)).toBe('STOP')
  })

  it('prints a percent at one decimal, with no negative zero', () => {
    expect(printedPercent(-1.94)).toBe(-1.9)
    expect(printedPercent(3.06)).toBe(3.1)
    expect(Object.is(printedPercent(-0.04), 0)).toBe(true)
  })
})

describe('geometry', () => {
  const outer = square(-121.4, 44.0, -121.2, 44.12)
  it('contains points inside a polygon and not in its hole', () => {
    const withHole: Polygonal = {
      type: 'Polygon',
      coordinates: [outer.coordinates[0]!, square(-121.31, 44.05, -121.29, 44.07).coordinates[0]!],
    }
    expect(pointInPolygonal(-121.3, 44.02, withHole)).toBe(true)
    expect(pointInPolygonal(-121.3, 44.06, withHole)).toBe(false)
    expect(pointInPolygonal(-121.5, 44.06, withHole)).toBe(false)
  })

  it('handles a MultiPolygon', () => {
    const multi: Polygonal = {
      type: 'MultiPolygon',
      coordinates: [square(0, 0, 1, 1).coordinates, square(2, 2, 3, 3).coordinates],
    }
    expect(pointInPolygonal(2.5, 2.5, multi)).toBe(true)
    expect(pointInPolygonal(1.5, 1.5, multi)).toBe(false)
  })

  it('measures acres so a smaller polygon orders first, and gives a bbox', () => {
    // 0.01 degree square at 44N: about 1,113 m by 800 m, about 220 acres.
    const acres = polygonalAcres(square(-121.3, 44.0, -121.29, 44.01))
    expect(acres).toBeGreaterThan(200)
    expect(acres).toBeLessThan(240)
    expect(polygonalAcres(outer)).toBeGreaterThan(acres)
    expect(polygonalBbox(outer)).toEqual([-121.4, 44.0, -121.2, 44.12])
  })
})

describe('Market Truth publishable closes', () => {
  const base = (p: Partial<SparkListing>): SparkListing => ({
    ListingKey: 'k',
    ClosePrice: 500_000,
    ListPrice: 510_000,
    CloseDate: '2026-08-15',
    ParcelNumber: '12345',
    ModificationTimestamp: '2026-08-20T00:00:00Z',
    ...p,
  })

  it('treats junk parcel keys as no parcel', () => {
    expect(realParcel('TBD')).toBeNull()
    expect(realParcel(' n/a ')).toBeNull()
    expect(realParcel('000')).toBeNull()
    expect(realParcel('291703')).toBe('291703')
  })

  it('flags a close near 10x the list, or a list over 500x the close', () => {
    expect(isPriceTypo(5_000_000, 500_000)).toBe(true)
    expect(isPriceTypo(1_000, 600_000)).toBe(true)
    expect(isPriceTypo(520_000, 500_000)).toBe(false)
    expect(isPriceTypo(null, 500_000)).toBe(false)
  })

  it('keeps one row per parcel, close day and price (latest modified), and drops floor and typo rows', () => {
    const rows = [
      base({ ListingKey: 'a', ModificationTimestamp: '2026-08-20T00:00:00Z' }),
      base({ ListingKey: 'b', ModificationTimestamp: '2026-08-25T00:00:00Z' }),
      base({ ListingKey: 'c', ParcelNumber: 'TBD' }),
      base({ ListingKey: 'd', ParcelNumber: 'TBD' }),
      base({ ListingKey: 'e', ParcelNumber: '9', ClosePrice: 900 }),
      base({ ListingKey: 'f', ParcelNumber: '10', ClosePrice: 5_000_000, ListPrice: 500_000 }),
    ]
    expect(marketTruthPublishableCloses(rows).map((r) => r.ListingKey).sort()).toEqual(['b', 'c', 'd'])
  })

  it('ranks duplicates across property types, so a detached close with a later-modified land twin is not a sale', () => {
    const rows = [
      base({ ListingKey: 'house', ParcelNumber: '777', ModificationTimestamp: '2026-08-20T00:00:00Z' }),
      { ...base({ ListingKey: 'land', ParcelNumber: '777', ModificationTimestamp: '2026-08-21T00:00:00Z' }), PropertyType: 'D' },
    ]
    expect(marketTruthPublishableCloses(rows).map((r) => r.ListingKey)).toEqual(['land'])
  })

  it('dedupes by ListingKey across pulls', () => {
    expect(uniqueListings([{ ListingKey: 'a' }, { ListingKey: 'a' }, { ListingKey: 'b' }]).map((r) => r.ListingKey)).toEqual(['a', 'b'])
  })
})

describe('neighborhood membership', () => {
  const shapes: NeighborhoodShape[] = [
    { slug: 'bend-big', geometry: square(-121.35, 44.02, -121.25, 44.1), acres: 0 },
    { slug: 'bend-larkspur', geometry: square(-121.3, 44.04, -121.27, 44.06), acres: 0 },
  ].map((s) => ({ ...s, acres: polygonalAcres(s.geometry) }))
  const aliases = buildAliasIndex([
    { neighborhoodSlug: 'bend-larkspur', subdivisionLabel: 'Larkspur Village' },
    { neighborhoodSlug: 'bend-big', subdivisionLabel: 'Shared Name' },
    { neighborhoodSlug: 'bend-aaa', subdivisionLabel: 'Shared Name' },
  ])

  it('files a point under the smallest containing polygon', () => {
    expect(primaryNeighborhood({ ListingKey: 'x', Latitude: 44.05, Longitude: -121.285 }, shapes, aliases)).toBe('bend-larkspur')
    expect(primaryNeighborhood({ ListingKey: 'x', Latitude: 44.08, Longitude: -121.3 }, shapes, aliases)).toBe('bend-big')
  })

  it('uses the alias label only outside every polygon, first slug wins', () => {
    expect(primaryNeighborhood({ ListingKey: 'x', Latitude: 44.08, Longitude: -121.3, SubdivisionName: 'Larkspur Village' }, shapes, aliases)).toBe('bend-big')
    expect(primaryNeighborhood({ ListingKey: 'x', Latitude: 45, Longitude: -121.3, SubdivisionName: ' larkspur village ' }, shapes, aliases)).toBe('bend-larkspur')
    expect(primaryNeighborhood({ ListingKey: 'x', SubdivisionName: 'Shared Name' }, shapes, aliases)).toBe('bend-aaa')
    expect(primaryNeighborhood({ ListingKey: 'x', Latitude: 45, Longitude: -121.3 }, shapes, aliases)).toBeNull()
  })

  it('counts list-to-pending days as whole 24-hour periods, never below 0 (the stored days_to_pending)', () => {
    expect(listToPendingDays({ ListingKey: 'x', OnMarketDate: '2025-09-13T20:47:20Z', PendingTimestamp: '2026-08-14T23:00:28Z' })).toBe(335)
    // Listing 20260716141842524699000000: stored 24, a calendar-day count says 25.
    expect(listToPendingDays({ ListingKey: 'x', OnMarketDate: '2026-07-23T15:28:08Z', PendingTimestamp: '2026-08-17T01:32:49Z' })).toBe(24)
    // Listing 20241024160548678570000000: pending before on-market is stored as 0.
    expect(listToPendingDays({ ListingKey: 'x', OnMarketDate: '2025-11-26T17:03:03Z', PendingTimestamp: '2025-07-12T02:40:07Z' })).toBe(0)
    expect(listToPendingDays({ ListingKey: 'x', OnMarketDate: '2025-09-13T20:47:20Z' })).toBeNull()
  })
})

// ── End to end: render a real email, then reconcile every figure it printed ──

const BEND = square(-121.4, 44.0, -121.2, 44.12)
const BIG = square(-121.35, 44.02, -121.25, 44.1)
const LARKSPUR = square(-121.3, 44.04, -121.27, 44.06)
const AT_LARKSPUR = { Latitude: 44.05, Longitude: -121.285 }
const AT_BIG = { Latitude: 44.08, Longitude: -121.3 }
const OUTSIDE_BEND = { Latitude: 44.05, Longitude: -121.6 }
const MONTHS = ['2026-03', '2026-04', '2026-05', '2026-06', '2026-07', '2026-08']

function fixture() {
  let seq = 0
  const row = (p: Partial<SparkListing>): SparkListing => {
    seq += 1
    return {
      ListingKey: `k${String(seq).padStart(4, '0')}`,
      City: 'Bend',
      PropertyType: 'A',
      PropertySubType: 'Single Family Residence',
      StandardStatus: 'Closed',
      ListPrice: 500_000,
      ParcelNumber: `P${seq}`,
      ModificationTimestamp: '2026-09-01T00:00:00Z',
      OnMarketDate: '2026-01-01T12:00:00Z',
      PendingTimestamp: '2026-01-11T12:00:00Z',
      ...p,
    }
  }
  const closed: SparkListing[] = []
  MONTHS.forEach((m, mi) => {
    for (let i = 0; i < 10; i++) {
      const inLarkspur = i % 2 === 0
      closed.push(
        row({
          ClosePrice: 400_000 + mi * 20_000 + i * 10_000,
          CloseDate: `${m}-15`,
          PendingTimestamp: `2026-01-${String(2 + i).padStart(2, '0')}T12:00:00Z`,
          SubdivisionName: inLarkspur ? 'Larkspur Village' : 'Big Estates',
          ...(inLarkspur ? AT_LARKSPUR : AT_BIG),
        }),
      )
    }
  })
  const original = closed[0]!
  closed.push(
    // A duplicate of the first close, modified earlier: Market Truth keeps the original only.
    row({ ...original, ListingKey: 'dup', ModificationTimestamp: '2026-04-01T00:00:00Z' }),
    // A price typo: Market Truth drops it, the cache keeps it.
    row({ ClosePrice: 5_000_000, ListPrice: 500_000, CloseDate: '2026-08-20', ...AT_BIG, SubdivisionName: 'Big Estates' }),
    // MLS City Bend outside the city polygon: Market Truth city counts it, the cache does not.
    row({ ClosePrice: 610_000, CloseDate: '2026-08-10', ...OUTSIDE_BEND, SubdivisionName: 'Larkspur Village' }),
    row({ ClosePrice: 620_000, CloseDate: '2026-08-11', ...OUTSIDE_BEND, SubdivisionName: 'Rural Acres' }),
    // Window edges: 2025-09-29 is outside both windows, 2025-09-30 inside both.
    row({ ClosePrice: 450_000, CloseDate: '2025-09-29', ...AT_BIG }),
    row({ ClosePrice: 455_000, CloseDate: '2025-09-30', ...AT_BIG }),
    // Not detached: never counted.
    row({ PropertySubType: 'Condominium', ClosePrice: 300_000, CloseDate: '2026-08-12', ...AT_LARKSPUR }),
    // Outside the service area, under a Larkspur label (the Klamath Falls
    // "Tanglewood" case): Market Truth counts neither.
    row({ City: 'Klamath Falls', ClosePrice: 390_000, CloseDate: '2026-08-13', Latitude: 42.27, Longitude: -121.74, SubdivisionName: 'Larkspur Village' }),
  )
  const active: SparkListing[] = [
    ...Array.from({ length: 5 }, () => row({ StandardStatus: 'Active', ...AT_LARKSPUR, ModificationTimestamp: '2026-09-30T02:00:00Z' })),
    ...Array.from({ length: 7 }, () => row({ StandardStatus: 'Active', ...AT_BIG, ModificationTimestamp: '2026-09-30T02:00:00Z' })),
    row({ StandardStatus: 'Active Under Contract', ...AT_LARKSPUR }),
    row({ StandardStatus: 'Active', PropertySubType: 'Townhouse', ...AT_LARKSPUR }),
    row({ StandardStatus: 'Active', City: 'Klamath Falls', Latitude: 42.27, Longitude: -121.74, SubdivisionName: 'Larkspur Village' }),
  ]
  return { closed, active }
}

function median(xs: number[]): number {
  return percentileCont(xs)!
}

function blocksFor(closed: SparkListing[]): MarketReportAreaBlock[] {
  const periodEnd = '2026-09-29'
  const inMt = (r: SparkListing) =>
    r.City === 'Bend' &&
    r.PropertySubType === 'Single Family Residence' &&
    r.CloseDate! > '2025-09-29' &&
    r.CloseDate! <= periodEnd &&
    r.ListingKey !== 'dup' &&
    r.ClosePrice !== 5_000_000
  const mtBend = closed.filter(inMt)
  const mtLarkspur = mtBend.filter((r) => r.SubdivisionName === 'Larkspur Village')
  const inBendPolygon = (r: SparkListing) => r.Longitude! > -121.4 && r.Longitude! < -121.2
  const cacheBend = closed.filter((r) => r.PropertySubType === 'Single Family Residence' && inBendPolygon(r) && r.CloseDate! >= '2025-09-30')
  const cacheLarkspur = closed.filter((r) => r.PropertySubType === 'Single Family Residence' && r.SubdivisionName === 'Larkspur Village' && r.CloseDate! >= '2025-09-30')
  const dom = (rows: SparkListing[]) => median(rows.map((r) => listToPendingDays(r)!))
  const points: MarketTrendPoint[] = MONTHS.map((m) => {
    const rows = cacheBend.filter((r) => r.CloseDate!.startsWith(m))
    return { periodStart: `${m}-01`, medianSalePrice: median(rows.map((r) => r.ClosePrice!)), soldCount: rows.length, medianDom: null, endOfPeriodInventory: null }
  })
  const n180 = mtBend.filter((r) => r.CloseDate! > '2026-04-02').length
  const mos = Math.round((12 / (n180 / 6)) * 100) / 100
  const cell = (n: number) => ({
    sampleN: n,
    method: 'percentile_cont_close',
    excludedN: 0,
    completeThrough: '2026-09-28',
    windowMonths: 12,
    definitionId: 'mt-v1',
    computedAt: '2026-09-30T00:24:12Z',
    isFloor: false,
    withheldReason: null,
    periodEnd,
  })
  const cache = (n: number) => ({ updatedAt: '2026-09-30T07:00:00Z', periodStart: '2025-09-30', periodEnd: '2026-09-30', soldCount: n, methodologyVersion: 'v3-2026-05-07' })
  const bend: MarketReportAreaBlock = {
    slug: 'bend',
    areaLabel: 'Bend',
    geoType: 'city',
    medianPrice: median(mtBend.map((r) => r.ClosePrice!)),
    activeListings: 12,
    soldLast12mo: mtBend.length,
    monthsOfSupply: mos,
    monthsOfSupplySource: 'live',
    marketVerdict: 'sellers',
    domMedian: dom(cacheBend),
    yoyPct: null,
    marketHealthLabel: null,
    refreshedAt: '2026-09-30T00:24:12Z',
    source: 'market_metric',
    twelveMonthSource: 'market-truth',
    href: '/cities/bend',
    trend: { points, latestMonthLabel: 'August', prevMonthLabel: 'July', latestMedianPrice: null, prevMedianPrice: null, momPricePct: null, latestInventory: null, momInventoryDelta: null, latestDom: null, momDomDelta: null },
    provenance: {
      cache: cache(cacheBend.length),
      live: { table: 'market_metric', computedAt: '2026-09-30T00:24:12Z', completeThrough: '2026-09-28', periodEnd },
      twelveMonth: { medianClose: cell(mtBend.length), closedCount: cell(mtBend.length), yoyMedian: null },
    },
  }
  const larkspur: MarketReportAreaBlock = {
    slug: 'bend-larkspur',
    areaLabel: 'Larkspur',
    geoType: 'neighborhood',
    medianPrice: median(mtLarkspur.map((r) => r.ClosePrice!)),
    activeListings: 5,
    soldLast12mo: mtLarkspur.length,
    monthsOfSupply: null,
    monthsOfSupplySource: null,
    marketVerdict: null,
    domMedian: dom(cacheLarkspur),
    yoyPct: null,
    marketHealthLabel: null,
    refreshedAt: '2026-09-30T00:40:03Z',
    source: 'market_metric',
    twelveMonthSource: 'market-truth',
    href: '/cities/bend/larkspur',
    trend: null,
    provenance: {
      cache: cache(cacheLarkspur.length),
      live: { table: 'market_metric', computedAt: '2026-09-30T00:40:03Z', completeThrough: null, periodEnd: null },
      twelveMonth: { medianClose: cell(mtLarkspur.length), closedCount: cell(mtLarkspur.length), yoyMedian: null },
    },
  }
  return [larkspur, bend]
}

function dataFor(active: SparkListing[], closed: SparkListing[]): SparkCheckData {
  const shapes: NeighborhoodShape[] = [
    { slug: 'bend-big', geometry: BIG, acres: polygonalAcres(BIG) },
    { slug: 'bend-larkspur', geometry: LARKSPUR, acres: polygonalAcres(LARKSPUR) },
  ]
  return {
    active,
    closed,
    cityPolygons: new Map([['bend', BEND]]),
    neighborhoods: shapes,
    neighborhoodPolygonGaps: [],
    aliases: [
      { neighborhoodSlug: 'bend-larkspur', subdivisionLabel: 'Larkspur Village' },
      { neighborhoodSlug: 'bend-big', subdivisionLabel: 'Big Estates' },
    ],
    serviceAreaCities: ['Bend', 'Redmond'],
    fetchedAt: '2026-09-30T05:00:00Z',
  }
}

describe('buildSparkChecks, end to end over a rendered email', () => {
  it('rebuilds every printed figure over its own population, and all agree', () => {
    const { active, closed } = fixture()
    const blocks = blocksFor(closed)
    const rendered = renderMarketReportEmail({ contactName: 'Cheryl', areas: blocks, unsubscribeUrl: 'https://ryan-realty.com/x' })
    const checks = buildSparkChecks({ blocks, figures: rendered.figures, data: dataFor(active, closed) })

    expect(checks).toHaveLength(rendered.figures.length)
    expect(checks.filter((c) => c.status === 'not-reconciled')).toEqual([])
    expect(checks.filter((c) => c.status === 'STOP')).toEqual([])
    // The headline repeats Bend's months of supply and verdict, and passes because they did.
    const headline = checks.find((c) => c.figure === 'headline')!
    expect(headline.status).toBe('ok')
    expect(headline.population).toBe('repeats bend: months of supply, market verdict')

    const by = (area: string, figure: string) => checks.find((c) => c.area === area && c.figure === figure)!
    // Market Truth city counts MLS City text, so the two closes outside the polygon are in.
    expect(by('bend', 'homes sold, last 12 months').spark).toBe(63)
    // Market Truth Larkspur: 30 inside the polygon plus 1 alias close outside
    // every polygon; the out-of-area Klamath Falls namesake is not counted.
    expect(by('bend-larkspur', 'homes sold, last 12 months').spark).toBe(31)
    expect(by('bend-larkspur', 'homes for sale').spark).toBe(5)
    expect(by('bend', 'homes for sale').spark).toBe(12)
    expect(by('bend', 'homes for sale').note).toContain('12 of Spark')
    expect(by('bend', 'market verdict').status).toBe('ok')
    expect(checks.find((c) => c.figure.startsWith('median sale price chart'))?.note).toContain('2026-03')
  })

  it('STOPs a figure that differs from Spark by more than 1%', () => {
    const { active, closed } = fixture()
    const blocks = blocksFor(closed)
    blocks[1] = { ...blocks[1]!, activeListings: 13 }
    const rendered = renderMarketReportEmail({ contactName: 'Cheryl', areas: blocks, unsubscribeUrl: 'https://ryan-realty.com/x' })
    const checks = buildSparkChecks({ blocks, figures: rendered.figures, data: dataFor(active, closed) })
    const stop = checks.filter((c) => c.status === 'STOP')
    expect(stop.map((c) => `${c.area} ${c.figure}`)).toEqual(['bend homes for sale'])
    expect(stop[0]!.deltaPct).toBe(8.33)
  })

  it('never passes a figure it cannot rebuild: a cache end-of-period count is not-reconciled', () => {
    const { active, closed } = fixture()
    const blocks = blocksFor(closed)
    blocks[0] = { ...blocks[0]!, provenance: { ...blocks[0]!.provenance!, live: null } }
    const rendered = renderMarketReportEmail({ contactName: 'Cheryl', areas: blocks, unsubscribeUrl: 'https://ryan-realty.com/x' })
    const checks = buildSparkChecks({ blocks, figures: rendered.figures, data: dataFor(active, closed) })
    const row = checks.find((c) => c.area === 'bend-larkspur' && c.figure === 'homes for sale')!
    expect(row.status).toBe('not-reconciled')
    expect(row.note).toContain('end-of-period')
  })

  it('reaches back far enough for every window the email printed, and no further', () => {
    const { closed } = fixture()
    const blocks = blocksFor(closed)
    // A sparse neighborhood series reaching back to 2024 prints no month figure,
    // so it is no reason to pull 2024.
    blocks[0] = {
      ...blocks[0]!,
      trend: { ...blocks[1]!.trend!, points: [{ periodStart: '2024-04-01', medianSalePrice: 500_000, soldCount: 2, medianDom: null, endOfPeriodInventory: null }] },
    }
    const rendered = renderMarketReportEmail({ contactName: 'Cheryl', areas: blocks, unsubscribeUrl: 'https://ryan-realty.com/x' })
    expect(earliestCloseDayNeeded(blocks, rendered.figures)).toBe('2025-09-29')
  })

  it('fails the headline when a figure it repeats fails', () => {
    const { active, closed } = fixture()
    const blocks = blocksFor(closed)
    blocks[1] = { ...blocks[1]!, monthsOfSupply: 2.5 }
    const rendered = renderMarketReportEmail({ contactName: 'Cheryl', areas: blocks, unsubscribeUrl: 'https://ryan-realty.com/x' })
    const checks = buildSparkChecks({ blocks, figures: rendered.figures, data: dataFor(active, closed) })
    expect(checks.find((c) => c.figure === 'months of supply')?.status).toBe('STOP')
    const headline = checks.find((c) => c.figure === 'headline')!
    expect(headline.status).toBe('STOP')
    expect(headline.note).toContain('months of supply (STOP)')
  })

  it('leaves every neighborhood unbuilt while any neighborhood polygon failed to load', () => {
    const { active, closed } = fixture()
    const blocks = blocksFor(closed)
    const rendered = renderMarketReportEmail({ contactName: 'Cheryl', areas: blocks, unsubscribeUrl: 'https://ryan-realty.com/x' })
    const data = { ...dataFor(active, closed), neighborhoodPolygonGaps: ['tetherow'] }
    const checks = buildSparkChecks({ blocks, figures: rendered.figures, data })
    const forSale = checks.find((c) => c.area === 'bend-larkspur' && c.figure === 'homes for sale')!
    expect(forSale.status).toBe('not-reconciled')
    expect(forSale.note).toContain('tetherow')
    // City checks do not depend on neighborhood polygons.
    expect(checks.find((c) => c.area === 'bend' && c.figure === 'homes for sale')?.status).toBe('ok')
  })

  it('gates only alias-filed actives on the service area: a listing inside the polygon counts whatever its City', () => {
    const { active, closed } = fixture()
    const blocks = blocksFor(closed)
    const inPolygonElsewhere: SparkListing = { ...active[0]!, ListingKey: 'odd-city', City: 'Deschutes River Woods' }
    blocks[0] = { ...blocks[0]!, activeListings: 6 }
    const rendered = renderMarketReportEmail({ contactName: 'Cheryl', areas: blocks, unsubscribeUrl: 'https://ryan-realty.com/x' })
    const checks = buildSparkChecks({ blocks, figures: rendered.figures, data: dataFor([...active, inPolygonElsewhere], closed) })
    const forSale = checks.find((c) => c.area === 'bend-larkspur' && c.figure === 'homes for sale')!
    expect(forSale.spark).toBe(6)
    expect(forSale.status).toBe('ok')
  })

  it('marks the headline not reconciled, not STOP, when a figure it repeats could not be rebuilt', () => {
    const { active, closed } = fixture()
    const blocks = blocksFor(closed)
    blocks[1] = { ...blocks[1]!, provenance: { ...blocks[1]!.provenance!, live: { ...blocks[1]!.provenance!.live!, periodEnd: null } } }
    const rendered = renderMarketReportEmail({ contactName: 'Cheryl', areas: blocks, unsubscribeUrl: 'https://ryan-realty.com/x' })
    const checks = buildSparkChecks({ blocks, figures: rendered.figures, data: dataFor(active, closed) })
    expect(checks.find((c) => c.figure === 'months of supply')?.status).toBe('not-reconciled')
    const headline = checks.find((c) => c.figure === 'headline')!
    expect(headline.status).toBe('not-reconciled')
    expect(headline.note).toContain('months of supply (not-reconciled)')
  })

  it('does not rebuild a neighborhood whose polygon did not load', () => {
    const { active, closed } = fixture()
    const blocks = blocksFor(closed)
    const rendered = renderMarketReportEmail({ contactName: 'Cheryl', areas: blocks, unsubscribeUrl: 'https://ryan-realty.com/x' })
    const data = { ...dataFor(active, closed), neighborhoods: [] }
    const checks = buildSparkChecks({ blocks, figures: rendered.figures, data })
    const sold = checks.find((c) => c.area === 'bend-larkspur' && c.figure === 'homes sold, last 12 months')!
    expect(sold.status).toBe('not-reconciled')
    expect(sold.note).toContain('polygon did not load')
  })

  it('compares a year-over-year change at the one decimal it prints', () => {
    const row = (key: string, day: string, price: number): SparkListing => ({
      ListingKey: key,
      City: 'Bend',
      PropertyType: 'A',
      PropertySubType: 'Single Family Residence',
      StandardStatus: 'Closed',
      ClosePrice: price,
      ListPrice: price,
      CloseDate: day,
      ParcelNumber: key,
      ModificationTimestamp: '2026-09-01T00:00:00Z',
    })
    const closed = [row('a', '2026-03-01', 500_000), row('b', '2026-04-01', 510_000), row('c', '2025-03-01', 480_000), row('d', '2025-04-01', 500_000)]
    const cell = { sampleN: 2, method: 'x', excludedN: 0, completeThrough: '2026-09-28', windowMonths: 12, definitionId: 'mt-v1', computedAt: '2026-09-30T00:00:00Z', isFloor: false, withheldReason: null, periodEnd: '2026-09-29' }
    const area = {
      ...blocksFor(fixture().closed)[1]!,
      yoyPct: 3.06,
      provenance: { cache: null, live: null, twelveMonth: { medianClose: cell, closedCount: cell, yoyMedian: cell } },
    } satisfies MarketReportAreaBlock
    const yoyFigure = (value: number): ReportFigure => ({
      area: 'bend',
      areaLabel: 'Bend',
      label: 'median sale price change from a year ago',
      value,
      display: 'x',
      source: 'x',
      filter: 'x',
      as_of: null,
      n: null,
    })
    const data = { ...dataFor([], closed) }
    // Medians 505,000 against 490,000: +3.06%, printed 3.1.
    const same = buildSparkChecks({ blocks: [area], figures: [yoyFigure(3.06)], data })[0]!
    expect(same.status).toBe('ok')
    expect(same.deltaPct).toBeNull()
    expect(same.spark).toBe(3.06)
    // 3.2 prints differently from the rebuilt 3.1, even though the relative gap is small.
    const other = buildSparkChecks({ blocks: [area], figures: [yoyFigure(3.2)], data })[0]!
    expect(other.status).toBe('STOP')
    expect(other.deltaPoints).toBe(0.14)
  })
})
