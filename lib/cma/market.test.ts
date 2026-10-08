import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  assembleCmaMarketContext,
  cmaMarketSources,
  cmaTrendFromMonthly,
  CMA_MARKET_POPULATION,
  resolveCmaMarketTargets,
  type CmaMarketAssembleInput,
} from '@/lib/cma/market'
import type { PublicMonthlyPoint } from '@/lib/data/market-truth/public-monthly'
import type { CmaMarketPulseRow, CmaMarketStatsRow } from '@/lib/data/cma/builderReads'
import type { SellBendMarket } from '@/lib/data/market-truth/getSellBendMarket'
import { EMPTY_PUBLIC_PACE, type PublicPaceRow } from '@/lib/data/market-truth/public-pace'
import { formatMonthsOfSupply, monthsOfSupplyVerdict } from '@/lib/format/months-of-supply'
import { renderInventoryBoardHtml } from '@/lib/cma/market-area-chapters'

const CACHE_STATS: CmaMarketStatsRow = {
  geo_type: 'city',
  geo_slug: 'bend',
  geo_label: 'Bend',
  period_start: '2025-08-22',
  period_end: '2026-08-21',
  sold_count: 1800,
  median_sale_price: 800000,
  median_dom: 72,
  median_ppsf: 350,
  median_price_per_sqft_closed: 351,
  avg_sale_to_list_ratio: 0.98,
  yoy_median_price_delta_pct: 5,
  end_of_period_inventory: 500,
  methodology_version: 'cache-v1',
  computed_at: '2026-08-21T00:00:00.000Z',
}

const PULSE: CmaMarketPulseRow = {
  geo_slug: 'bend',
  active_count: 488,
  pending_count: 80,
  median_list_price: 775000,
  months_of_supply: 3.54,
  updated_at: '2026-08-23T12:00:00.000Z',
}

const CITY_DETACHED: SellBendMarket = {
  activeCount: 774,
  monthsOfSupply: 4.47,
  mosLabel: '4.5 months',
  verdictKind: 'balanced',
  verdictLabel: 'Balanced market',
  medianListPrice: 749000,
  computedAt: '2026-08-23T00:00:00.000Z',
  completeThrough: '2026-08-21',
}

const SUNRIVER_DETACHED: SellBendMarket = {
  activeCount: 56,
  monthsOfSupply: 7.47,
  mosLabel: '7.5 months',
  verdictKind: 'buyers',
  verdictLabel: "Buyer's market",
  medianListPrice: 989000,
  computedAt: '2026-08-23T00:00:00.000Z',
  completeThrough: '2026-08-21',
}

const CITY_LEFTOVER: PublicPaceRow = {
  ...EMPTY_PUBLIC_PACE,
  saleToOriginal: 0.969,
  yoyMedian: -0.019,
  pendingCount: 311,
  medianClose: 760000,
  medianPpsf: 399,
  closedCount: 2095,
  daysToContract: 28,
}

function assemble(over: Partial<CmaMarketAssembleInput> = {}) {
  return assembleCmaMarketContext({
    city: 'Bend',
    geoType: 'city',
    geoSlug: 'bend',
    stats: CACHE_STATS,
    pulse: PULSE,
    detached: CITY_DETACHED,
    leftover: CITY_LEFTOVER,
    monthly: [],
    yearMart: null,
    ...over,
  })
}

describe('resolveCmaMarketTargets', () => {
  it('uses the resort community cache, not the city, for Caldera Springs', () => {
    const { targets } = resolveCmaMarketTargets({
      city: 'Bend',
      subdivision: 'Caldera Springs',
    })
    expect(targets[0]).toEqual({ geoType: 'neighborhood', slugs: ['caldera-springs'] })
    expect(targets[1]?.geoType).toBe('city')
    expect(targets[1]?.slugs).toContain('bend')
  })

  it('still uses the city when the subdivision is not a resort', () => {
    const { targets } = resolveCmaMarketTargets({
      city: 'Redmond',
      subdivision: 'Obsidian',
    })
    expect(targets).toEqual([{ geoType: 'city', slugs: ['redmond'] }])
  })
})

describe('assembleCmaMarketContext leftover', () => {
  it('city leftover fields do not fall back to cache or pulse numbers', () => {
    const missed = assemble({ leftover: { ...EMPTY_PUBLIC_PACE } })
    expect(missed.medianSalePrice).toBeNull()
    expect(missed.medianPpsf).toBeNull()
    expect(missed.saleToListRatio).toBeNull()
    expect(missed.yoyMedianPriceDeltaPct).toBeNull()
    expect(missed.pendingCount).toBeNull()
    expect(missed.medianSalePrice).not.toBe(CACHE_STATS.median_sale_price)
    expect(missed.pendingCount).not.toBe(PULSE.pending_count)
    expect(missed.medianDom).toBe(72)
  })

  it('city leftover overlays sale-to-original, YoY, pending, median close, and ppsf', () => {
    const hit = assemble()
    expect(hit.medianSalePrice).toBe(760000)
    expect(hit.medianPpsf).toBe(399)
    expect(hit.saleToListRatio).toBe(0.969)
    expect(hit.yoyMedianPriceDeltaPct).toBeCloseTo(-1.9, 5)
    expect(hit.pendingCount).toBe(311)
    expect(hit.medianSalePrice).not.toBe(CACHE_STATS.median_sale_price)
    expect(hit.pendingCount).not.toBe(PULSE.pending_count)
  })

  it('does not map leftover 12-month days to contract onto medianDom', () => {
    const row = assemble({ leftover: { ...CITY_LEFTOVER, daysToContract: 28 } })
    expect(row.medianDom).toBe(72)
    expect(row.medianDom).not.toBe(28)
  })

  it('still assembles when cache rolling_365d is missing and leftover exists', () => {
    const row = assemble({ stats: null, detached: null })
    expect(row.medianSalePrice).toBe(760000)
    expect(row.pendingCount).toBe(311)
    expect(row.monthsOfSupply).toBeNull()
    expect(row.activeCount).toBeNull()
    expect(row.medianDom).toBeNull()
  })

  it('city leftover closedCount fills soldCount365', () => {
    const row = assemble({ leftover: { ...CITY_LEFTOVER, closedCount: 2096 } })
    expect(row.soldCount365).toBe(2096)
  })

  it('city leftover miss fills from trusted cache sold_count', () => {
    const row = assemble({
      leftover: { ...EMPTY_PUBLIC_PACE },
      stats: { ...CACHE_STATS, sold_count: 1641 },
    })
    expect(row.soldCount365).toBe(1641)
  })

  it('city leftover miss and no cache omits soldCount365', () => {
    const row = assemble({ leftover: { ...EMPTY_PUBLIC_PACE }, stats: null })
    expect(row.soldCount365).toBeNull()
    expect(row.soldCount365).not.toBe(0)
  })
})

describe('assembleCmaMarketContext neighborhood MOS', () => {
  const tetherowPulse: CmaMarketPulseRow = {
    geo_slug: 'tetherow',
    active_count: 35,
    pending_count: 8,
    median_list_price: 1_850_000,
    months_of_supply: 4.6,
    updated_at: '2026-08-23T12:00:00.000Z',
  }
  const tetherowStats: CmaMarketStatsRow = {
    ...CACHE_STATS,
    geo_type: 'neighborhood',
    geo_slug: 'tetherow',
    geo_label: 'Tetherow',
    sold_count: 16,
    median_sale_price: 1_900_000,
  }

  it('withholds neighborhood MOS when Market Truth is not publishable', () => {
    const row = assemble({
      geoType: 'neighborhood',
      geoSlug: 'tetherow',
      stats: tetherowStats,
      pulse: tetherowPulse,
      detached: null,
      leftover: { ...EMPTY_PUBLIC_PACE, pendingCount: 6, daysToContract: 37 },
    })
    expect(row.monthsOfSupply).toBeNull()
    expect(row.marketVerdict).toBeNull()
    expect(row.activeCount).toBeNull()
    expect(row.mosFormula).toMatch(/withheld/)
    expect(row.mosFormula).toMatch(/no pulse fallback/)
    expect(row.monthsOfSupply).not.toBe(4.6)
    expect(row.pendingCount).toBe(6)
    expect(row.medianDom).toBe(72)
    expect(row.soldCount365).toBeNull()
  })

  it('publishes neighborhood MOS only from Market Truth', () => {
    const row = assemble({
      geoType: 'neighborhood',
      geoSlug: 'sunriver',
      stats: { ...tetherowStats, geo_slug: 'sunriver', geo_label: 'Sunriver', sold_count: 45 },
      pulse: { ...tetherowPulse, geo_slug: 'sunriver', months_of_supply: 14.2, active_count: 19 },
      detached: SUNRIVER_DETACHED,
      leftover: { ...EMPTY_PUBLIC_PACE, pendingCount: 16, medianClose: 875000 },
    })
    // The raw Market Truth figure stays in the data; every print site formats it.
    expect(row.monthsOfSupply).toBe(7.47)
    expect(formatMonthsOfSupply(row.monthsOfSupply!)).toBe('7.5')
    expect(row.marketVerdict).toBe('buyer')
    expect(row.activeCount).toBe(56)
    expect(row.mosFormula).toMatch(/market-truth/)
    expect(row.mosFormula).not.toMatch(/pulse/)
    expect(row.monthsOfSupply).not.toBe(14.2)
    expect(row.pendingCount).toBe(16)
    expect(row.medianSalePrice).toBe(875000)
  })
})

describe('CMA market readers', () => {
  it('comp pool SQL still defaults to PropertyType A then keepSameProductType', () => {
    const comps = readFileSync(resolve('lib/cma/comps.ts'), 'utf8')
    const pool = readFileSync(resolve('lib/data/cma/builderReads.ts'), 'utf8')
    // 'A' is now the DEFAULT rather than a literal, so a land subject can pull
    // segment 'D' (REGISTRY §1) instead of silently matching nothing. Every
    // improved caller omits the field and still gets 'A'.
    expect(pool).toMatch(/\.eq\('PropertyType', opts\.propertyType\?\.trim\(\) \|\| 'A'\)/)
    expect(comps).toMatch(/const segment = land \? 'D' : 'A'/)
    expect(comps).toMatch(/keepSameProductType/)
    expect(comps).toMatch(/selectCmaCompsPool/)
  })

  it('getCmaMarketContext overlays leftover and inventory without requiring cache', () => {
    const src = readFileSync(resolve('lib/cma/market.ts'), 'utf8')
    expect(src).toMatch(/assembleCmaMarketContext/)
    expect(src).toMatch(/getPublicDetachedPace/)
    expect(src).toMatch(/getDetachedMarket\('neighborhood'/)
    expect(src).toMatch(/getCityDetachedMarket/)
    expect(src).toMatch(/publicPaceHasRow/)
    expect(src).toMatch(/source: 'market-truth'/)
    expect(src).not.toMatch(/if \(!stats\) return null/)
    expect(src).not.toMatch(/cityPace\?\.medianClose \?\? num\(stats/)
    expect(src).not.toMatch(/cityPace\?\.saleToOriginal \?\? num\(stats/)
    expect(src).not.toMatch(/cityPace\?\.pendingCount \?\? num\(pulse/)
    expect(src).not.toMatch(/getCmaSubdivision/)
  })
})

describe('D27 — a resort CMA omits the verdict it has not earned', () => {
  // Verified on the live layer 2026-08-25: at neighborhood grain, detached, 24 places
  // publish a 12-month median and only 15 publish a 6-month verdict. The nine that
  // publish a median but no verdict are awbrey-glen, bend-old-bend,
  // bend-southern-crossing, black-butte-ranch, brasada-ranch, broken-top,
  // caldera-springs, northwest-crossing and tetherow — precisely the places our
  // highest-value CMAs are written for. lib/cma/market.ts reads neighborhood grain
  // FIRST for resort subdivisions, so this is the shape a Tetherow CMA actually hits.
  //
  // The failure this pins is not a blank pill. It is a Tetherow document rendering
  // Bend's verdict under Tetherow's name — one population labelled as another, on a
  // page a broker signs. §0.
  const RESORT_MEDIAN_NO_VERDICT: SellBendMarket = {
    activeCount: 21,
    monthsOfSupply: 0,
    mosLabel: '',
    verdictKind: null as unknown as SellBendMarket['verdictKind'],
    verdictLabel: '',
    medianListPrice: 2450000,
    computedAt: '2026-08-25T00:00:00.000Z',
    completeThrough: '2026-08-24',
  }

  const resortBoard = () =>
    assemble({
      city: 'Bend',
      geoType: 'neighborhood',
      geoSlug: 'tetherow',
      // No rolling_365d cache row at this grain — that is exactly why the real
      // resolver keeps the resort slug rather than inheriting the city's.
      stats: null,
      pulse: null,
      detached: RESORT_MEDIAN_NO_VERDICT,
      leftover: { ...CITY_LEFTOVER, medianClose: 1875000 },
    })

  it('publishes the resort median and leaves the verdict null', () => {
    const out = resortBoard()
    expect(out.medianSalePrice).toBe(1875000)
    expect(out.marketVerdict).toBeNull()
  })

  it('never carries the city verdict onto a neighborhood board', () => {
    const out = resortBoard()
    // CITY_DETACHED is 'balanced'. If a fallback ever leaks the city board onto a
    // resort slug, this is the assertion that catches it.
    expect(out.marketVerdict).not.toBe('balanced')
    expect(out.geoSlug).toBe('tetherow')
  })
})

describe('D27 — the CMA citation names the store that produced each figure', () => {
  // The defect: market_context carried one fixed string, "market_stats_cache
  // (rolling_365d) + market_pulse_live", long after the board moved onto leftover.
  // A CMA is broker-signed and its citation is what a reviewer audits against, so
  // a wrong store name makes the figure unverifiable. §0.
  it('attributes the leftover figures to market-truth, not the cache', () => {
    const src = cmaMarketSources(assemble())
    for (const key of [
      'median_sale_price',
      'median_ppsf',
      'sale_to_list_ratio',
      'yoy_median_price_delta_pct',
      'pending_count',
      'active_count',
      'months_of_supply',
      'market_verdict',
    ]) {
      expect(src[key]).toContain('market-truth leftover detached membership')
      expect(src[key]).not.toContain('market_stats_cache')
    }
  })

  it("keeps days on market on the cache, per D17's carve-out", () => {
    const src = cmaMarketSources(assemble())
    expect(src.median_dom).toContain('market_stats_cache')
    expect(src.median_dom).not.toContain('leftover')
  })

  it('says none rather than naming a store for a figure it does not have', () => {
    const src = cmaMarketSources(assemble({ leftover: { ...EMPTY_PUBLIC_PACE }, stats: null }))
    expect(src.median_dom).toBe('none')
    expect(src.sold_count_365).toBe('none')
  })
})

describe('months of supply is stored raw, printed through one helper, and graded on the raw value (cma-5391-frank-redmond-97756)', () => {
  // Redmond's raw figure sat just over 4. The CMA rounded it on its own to 4.0
  // and took the verdict from the raw value, so the document printed "4.0
  // months" beside "balanced" while CLAUDE.md §0 says 4 or less is a seller's
  // market. The data keeps the RAW value (the citation and every figure
  // derived from it read it), each print site formats it with
  // formatMonthsOfSupply, and the verdict is monthsOfSupplyVerdict(raw), so
  // the printed digits and the verdict cannot disagree.
  it.each([
    { raw: 4.02, kind: 'balanced' as const, printed: '4.1', verdict: 'balanced' },
    { raw: 3.98, kind: 'sellers' as const, printed: '4.0', verdict: 'seller' },
    { raw: 5.97, kind: 'balanced' as const, printed: '5.9', verdict: 'balanced' },
    { raw: 6.01, kind: 'buyers' as const, printed: '6.0', verdict: 'buyer' },
  ])('raw $raw stays $raw in the data, prints $printed, and reads $verdict', ({ raw, kind, printed, verdict }) => {
    const row = assemble({
      city: 'Redmond',
      geoSlug: 'redmond',
      detached: { ...CITY_DETACHED, monthsOfSupply: raw, verdictKind: kind },
    })
    expect(row.monthsOfSupply).toBe(raw)
    expect(formatMonthsOfSupply(row.monthsOfSupply!)).toBe(printed)
    expect(row.marketVerdict).toBe(verdict)
    // The figure a reader sees grades to the verdict printed beside it.
    expect(monthsOfSupplyVerdict(Number(formatMonthsOfSupply(row.monthsOfSupply!)))?.key).toBe(row.marketVerdict)
  })

  it('prints the pace off the raw figure: 201 for sale at a raw 4.02 is 50 a month, not 49', () => {
    // The review of da8dce6: storing the display value (4.1) made the letter
    // print "about 49 sell in a typical month" where the source pace is
    // 201 / 4.02 = 50.0 (it printed 50 before that change).
    const row = assemble({
      city: 'Redmond',
      geoSlug: 'redmond',
      detached: { ...CITY_DETACHED, monthsOfSupply: 4.02, verdictKind: 'balanced', activeCount: 201 },
    })
    const html = renderInventoryBoardHtml(row)
    expect(html).toContain('an average of 50 sold each month')
    expect(html).toContain('it would take 4.1 months')
    expect(html).toContain('balanced market territory')
  })

  it('no CMA or BPO sentence prints the figure without the helper', () => {
    const files = [
      'lib/cma/pricing.ts',
      'lib/cma/market-area-chapters.ts',
      'lib/cma/client-facing.ts',
      'lib/cma/audit.ts',
      'lib/cma/judge.ts',
      'lib/bpo/opinion.ts',
      'lib/bpo/narrative.ts',
      'lib/bpo/offer.ts',
      'lib/bpo/render.ts',
    ]
    for (const f of files) {
      const src = readFileSync(resolve(f), 'utf8')
      expect(src, f).not.toMatch(/\$\{market\.monthsOfSupply(?: \?\? [^}]+)?\}/)
      expect(src, f).not.toMatch(/String\(market\.monthsOfSupply\)/)
      expect(src, f).not.toMatch(/monthsOfSupply\.toFixed\(/)
    }
    // The admin BPO page prints the stored build_summary.market figure.
    const admin = readFileSync(resolve('app/admin/(protected)/bpo/[slug]/page.tsx'), 'utf8')
    expect(admin).not.toMatch(/String\(market\.months_of_supply\)/)
    expect(admin).toMatch(/formatMonthsOfSupply\(/)
  })
})

describe('one population on the Bend right now page (2026-10-08)', () => {
  // cma-2382-jackson and every Bend letter built that night printed "712 homes
  // are for sale in Bend right now. Over the last six months, an average of
  // 204 sold each month. At that pace it would take 3.5 months". Read the same
  // night: Market Truth city:bend detached held active 712 and
  // months_of_supply 3.49019607843137 over sample_n 1224 closes in 180 days
  // (1224 / 6 = 204), and all residential held 896. The letter's stored month
  // line was market_stats_cache monthly, Bend clipped to its TIGER polygon
  // (Apr to Sep 2026: 140, 157, 198, 188, 147, 148 sold, 978 in all), and
  // market_pulse_live (the same polygon, counting pre-market listings too) held 472 at
  // 2.95. Two reviewers divided 712 by the polygon's 163 a month and got 4.4,
  // a balanced verdict no single population supports. The fix keeps the
  // counts on Market Truth, puts the month line on the same membership, and
  // has the sentence say what it counts.
  const BEND_2026_10_08: SellBendMarket = {
    activeCount: 712,
    monthsOfSupply: 3.49019607843137,
    closedSixMonths: 1224,
    mosLabel: '3.5',
    verdictKind: 'sellers',
    verdictLabel: "seller's market",
    medianListPrice: 884900,
    computedAt: '2026-10-08T00:22:44.125613+00:00',
    completeThrough: '2026-10-06',
  }
  // getPublicDetachedMonthly city:bend, one-month cells computed 2026-10-07.
  const BEND_MONTHLY: PublicMonthlyPoint[] = (
    [
      ['2025-10-01', 773750, 196],
      ['2025-11-01', 737450, 166],
      ['2025-12-01', 732727.5, 162],
      ['2026-01-01', 716500, 121],
      ['2026-02-01', 745000, 143],
      ['2026-03-01', 708047, 183],
      ['2026-04-01', 725000, 179],
      ['2026-05-01', 855000, 197],
      ['2026-06-01', 772500, 250],
      ['2026-07-01', 800000, 230],
      ['2026-08-01', 749500, 196],
      ['2026-09-01', 759000, 199],
    ] as const
  ).map(([start, median, closed]) => ({
    periodStart: start,
    periodEnd: `${start.slice(0, 7)}-28`,
    medianClose: median,
    closedCount: closed,
  }))

  const bend = () => assemble({ detached: BEND_2026_10_08, monthly: BEND_MONTHLY })

  it('prints what it counts, and the pace and verdict are the same numbers', () => {
    const row = bend()
    const html = renderInventoryBoardHtml(row)
    expect(html).toContain(
      '712 single-family homes are for sale in Bend right now. Over the last six months, an average of 204 sold each month. At that pace it would take 3.5 months to sell what is listed, which is seller&#39;s market territory.',
    )
    expect(html).not.toMatch(/712 homes are for sale/)
    expect(html).toContain('Single-family homes for sale in Bend right now')
    expect(html).toContain(
      'aria-label="712 single-family homes for sale in Bend, and an average of 204 sold each month',
    )
    // 712 / (1224 / 6) is the stored figure, and the verdict is graded on it (CLAUDE.md §0: <= 4 seller's).
    expect(row.closedSixMonths).toBe(1224)
    expect(712 / (1224 / 6)).toBeCloseTo(row.monthsOfSupply!, 10)
    expect(row.marketVerdict).toBe('seller')
    expect(monthsOfSupplyVerdict(row.monthsOfSupply!)?.key).toBe('seller')
  })

  it('draws the month line from the same membership, never the polygon cache', () => {
    const row = bend()
    expect(row.trend).toHaveLength(12)
    expect(row.trend?.map((t) => t.soldCount)).toEqual([196, 166, 162, 121, 143, 183, 179, 197, 250, 230, 196, 199])
    // No monthly inventory cell exists in Market Truth; another population's count is not borrowed.
    expect(row.trend?.every((t) => t.endOfPeriodInventory === null)).toBe(true)
    const sixMonths = (row.trend ?? []).slice(-6).reduce((sum, t) => sum + (t.soldCount ?? 0), 0)
    expect(sixMonths).toBe(1251)
    // Calendar Apr to Sep on the same membership grades the same way the 180-day figure does.
    expect(monthsOfSupplyVerdict(712 / (sixMonths / 6))?.key).toBe(row.marketVerdict)
    const html = renderInventoryBoardHtml(row)
    expect(html).toContain('The line below is median sale price, single-family homes in Bend, month by month')
    expect(cmaMarketSources(row).trend).toContain('market-truth leftover detached membership')
    expect(cmaMarketSources(row).trend).not.toContain('market_stats_cache')
  })

  it('keeps a withheld month blank rather than filling it, and draws nothing under six', () => {
    const thin = BEND_MONTHLY.map((p, i) => (i % 3 === 0 ? p : { ...p, medianClose: null }))
    const trend = cmaTrendFromMonthly(thin)
    expect(trend).toHaveLength(12)
    expect(trend.filter((t) => t.medianSalePrice != null)).toHaveLength(4)
    // The closed count is a count (Market Truth publishes it at one sale); only the median is withheld.
    expect(trend[1]).toMatchObject({ periodStart: '2025-11-01', medianSalePrice: null, soldCount: 166 })
    const row = assemble({ detached: BEND_2026_10_08, monthly: thin })
    const html = renderInventoryBoardHtml(row)
    expect(html).not.toContain('month-line')
    expect(html).not.toContain('The line below is')
    const none = assemble({ detached: BEND_2026_10_08, monthly: thin.map((p) => ({ ...p, medianClose: null })) })
    expect(cmaMarketSources(none).trend).toBe('none')
  })

  it('cites the closed count only beside a published figure', () => {
    const withheld = assemble({ detached: null, monthly: BEND_MONTHLY })
    expect(withheld.monthsOfSupply).toBeNull()
    expect(withheld.closedSixMonths).toBeNull()
  })

  it('names the population the citation is reconciled against', () => {
    expect(CMA_MARKET_POPULATION).toContain("property_sub_type 'Single Family Residence'")
    expect(CMA_MARKET_POPULATION).toContain('MLS City text')
    expect(CMA_MARKET_POPULATION).toContain('active / (closed_180d / 6)')
    const build = readFileSync(resolve('lib/cma/build.ts'), 'utf8')
    expect(build).toMatch(/population: CMA_MARKET_POPULATION/)
    expect(build).toMatch(/months_of_supply_closed_6mo: market\.closedSixMonths/)
  })

  it('reads the month line from Market Truth, not market_stats_cache monthly', () => {
    const src = readFileSync(resolve('lib/cma/market.ts'), 'utf8')
    expect(src).toMatch(/getPublicDetachedMonthly\(/)
    expect(src).not.toMatch(/getCmaMarketTrendRows\(/)
    const dal = readFileSync(resolve('lib/data/cma/builderReads.ts'), 'utf8')
    expect(dal).not.toMatch(/export async function getCmaMarketTrendRows/)
  })
})
