import { describe, it, expect } from 'vitest'
import { verifyMarketChart } from '@/lib/email/market-chart-token'
import {
  renderMarketReportEmail,
  buildSubject,
  buildHeadline,
  chartableMonths,
  momMedianPair,
  orderAreasBySpecificity,
  reportCtaUrl,
  formatCurrencyRounded,
  formatDays,
  formatYoy,
  formatMomPct,
  formatMonths,
  meaningLine,
  verdictLabel,
  yoyCanCarryHeadline,
  HEADLINE_MIN_SOLD_COUNT,
  MOM_MIN_MONTH_SALES,
  CHART_MIN_MONTHS,
} from './market-report-email'
import type {
  MarketReportAreaBlock,
  MarketTrendSummary,
} from '@/lib/data/crm/getMarketReportData'
import type { MarketTrendPoint } from '@/lib/data/market/getMarketTrend'

/** A realistic monthly trend fixture (chronological completed months). */
function trend(overrides: Partial<MarketTrendSummary> = {}): MarketTrendSummary {
  const points = [
    { periodStart: '2026-03-01', medianSalePrice: 705000, soldCount: 98, medianDom: 31, endOfPeriodInventory: 402 },
    { periodStart: '2026-04-01', medianSalePrice: 718000, soldCount: 121, medianDom: 27, endOfPeriodInventory: 441 },
    { periodStart: '2026-05-01', medianSalePrice: 732000, soldCount: 143, medianDom: 24, endOfPeriodInventory: 468 },
    { periodStart: '2026-06-01', medianSalePrice: 748000, soldCount: 151, medianDom: 22, endOfPeriodInventory: 480 },
  ]
  return {
    points,
    latestMonthLabel: 'June',
    prevMonthLabel: 'May',
    latestMedianPrice: 748000,
    prevMedianPrice: 732000,
    momPricePct: 2.2,
    latestInventory: 480,
    momInventoryDelta: 12,
    latestDom: 22,
    momDomDelta: -2,
    ...overrides,
  }
}

/** A consecutive run of months ending with `last` (YYYY-MM), each with `sold` closes. */
function months(count: number, last: string, sold = 40): MarketTrendPoint[] {
  const [y, m] = last.split('-').map(Number)
  const out: MarketTrendPoint[] = []
  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(y, m - 1 - i, 1))
    out.push({
      periodStart: d.toISOString().slice(0, 10),
      medianSalePrice: 700000 + i * 1000,
      soldCount: sold,
      medianDom: 20,
      endOfPeriodInventory: 400,
    } as MarketTrendPoint)
  }
  return out
}

function block(overrides: Partial<MarketReportAreaBlock> = {}): MarketReportAreaBlock {
  return {
    slug: 'bend',
    areaLabel: 'Bend',
    geoType: 'city',
    medianPrice: 721000,
    activeListings: 480,
    soldLast12mo: 1657,
    monthsOfSupply: 3.5,
    marketVerdict: 'sellers',
    domMedian: 25,
    yoyPct: -1.22,
    marketHealthLabel: 'Warm',
    refreshedAt: '2026-06-25T12:00:00Z',
    source: 'market_metric',
    twelveMonthSource: 'market-truth',
    href: '/cities/bend',
    trend: trend(),
    monthsOfSupplySource: 'live',
    ...overrides,
  }
}

/** A neighborhood block (Larkspur-shaped): no months of supply ever prints at this grain. */
function hood(overrides: Partial<MarketReportAreaBlock> = {}): MarketReportAreaBlock {
  return block({
    slug: 'bend-larkspur',
    areaLabel: 'Larkspur',
    geoType: 'neighborhood',
    href: '/cities/bend/bend-larkspur',
    medianPrice: 612000,
    activeListings: 32,
    soldLast12mo: 61,
    monthsOfSupply: 5.1,
    marketVerdict: 'balanced',
    domMedian: 30,
    yoyPct: 2.4,
    twelveMonthSource: 'market_stats_cache',
    source: 'market_metric',
    monthsOfSupplySource: 'live',
    trend: null,
    ...overrides,
  })
}

const UNSUB = 'https://ryan-realty.com/email-preferences?t=abc.def&stop=1'
const MANAGE = 'https://ryan-realty.com/email-preferences?t=abc.def'
const VIEW = 'https://ryan-realty.com/email-preferences/report?t=view.tok'

describe('months of supply at a verdict threshold (the printed number never contradicts the verdict)', () => {
  it('a raw 4.003 prints 4.1 beside "Balanced market" in the kicker, the headline and the subject, and traces 4.003', () => {
    const b = block({ monthsOfSupply: 4.003, marketVerdict: 'balanced', yoyPct: null })
    const out = renderMarketReportEmail({ contactName: 'Cheryl', areas: [b], unsubscribeUrl: UNSUB })
    expect(out.html).toContain('Balanced market &middot; 4.1 months of supply')
    expect(out.html).not.toContain('4.00 months')
    expect(out.subject).toBe('Bend is a balanced market with 4.1 months of supply')
    expect(out.text).toContain('Balanced market with 4.1 months of supply')
    const mos = out.figures.find((f) => f.label === 'months of supply')!
    expect(mos.value).toBe(4.003)
    expect(mos.display).toBe('4.1 months')
    expect(out.figures.find((f) => f.label === 'market verdict')?.filter).toBe('months_of_supply=4.003')
  })
})

describe('formatters return null for a missing value (never a dash)', () => {
  it('formatCurrencyRounded rounds to the nearest thousand', () => {
    expect(formatCurrencyRounded(721000)).toBe('$721,000')
    expect(formatCurrencyRounded(894750)).toBe('$895,000')
    expect(formatCurrencyRounded(894499)).toBe('$894,000')
    expect(formatCurrencyRounded(2463500)).toBe('$2,464,000')
    expect(formatCurrencyRounded(null)).toBeNull()
    expect(formatCurrencyRounded(undefined)).toBeNull()
    expect(formatCurrencyRounded(Number.NaN)).toBeNull()
  })
  it('formatDays renders whole days', () => {
    expect(formatDays(38)).toBe('38 days')
    expect(formatDays(25.4)).toBe('25 days')
    expect(formatDays(47.5)).toBe('48 days')
    expect(formatDays(null)).toBeNull()
  })
  it('formatYoy renders a signed arrow', () => {
    expect(formatYoy(2.14)).toBe('↑ 2.1% YoY')
    expect(formatYoy(-1.22)).toBe('↓ 1.2% YoY')
    expect(formatYoy(0)).toBe('flat YoY')
    expect(formatYoy(0.04)).toBe('flat YoY')
    expect(formatYoy(null)).toBeNull()
  })
  it('formatMonths prints the canonical one decimal (formatMonthsOfSupply), never crossing a verdict threshold', () => {
    expect(formatMonths(3.5)).toBe('3.5 months')
    expect(formatMonths(10.8)).toBe('10.8 months')
    // Balanced values (> 4, < 6) never print as 4.0 or 6.0, which read as the
    // seller's and buyer's thresholds (Bend, 2026-07-16; review 2026-09-30).
    expect(formatMonths(4.003)).toBe('4.1 months')
    expect(formatMonths(4.05)).toBe('4.1 months')
    expect(formatMonths(4.04)).toBe('4.1 months')
    expect(formatMonths(5.95)).toBe('5.9 months')
    expect(formatMonths(5.999)).toBe('5.9 months')
    // A seller's 3.95 and a buyer's 6.04 print their own side of the line.
    expect(formatMonths(3.95)).toBe('4.0 months')
    expect(formatMonths(6.04)).toBe('6.0 months')
    expect(formatMonths(4.1)).toBe('4.1 months')
    expect(formatMonths(null)).toBeNull()
  })
  it('verdictLabel maps each verdict and null when unknown', () => {
    expect(verdictLabel('sellers')).toBe("Seller's market")
    expect(verdictLabel('balanced')).toBe('Balanced market')
    expect(verdictLabel('buyers')).toBe("Buyer's market")
    expect(verdictLabel(null)).toBeNull()
  })
  it('formatMomPct renders a signed one-decimal arrow vs the prior month', () => {
    expect(formatMomPct(2.18, 'May')).toBe('↑ 2.2% vs May')
    expect(formatMomPct(-0.5, 'May')).toBe('↓ 0.5% vs May')
    expect(formatMomPct(0.01, 'May')).toBe('flat vs May')
    expect(formatMomPct(null, 'May')).toBeNull()
    expect(formatMomPct(2.2, null)).toBeNull()
  })
  it('meaningLine maps each verdict to an implication and null when unknown', () => {
    expect(meaningLine('sellers')).toContain('sellers hold the leverage')
    expect(meaningLine('balanced')).toContain('realistic pricing')
    expect(meaningLine('buyers')).toContain('room to negotiate')
    expect(meaningLine(null)).toBeNull()
  })
})

describe('orderAreasBySpecificity (the specific area first)', () => {
  it('puts neighborhoods ahead of cities and keeps the order within each', () => {
    const out = orderAreasBySpecificity([block(), hood(), block({ slug: 'redmond', areaLabel: 'Redmond' })])
    expect(out.map((a) => a.slug)).toEqual(['bend-larkspur', 'bend', 'redmond'])
  })
})

describe('buildSubject', () => {
  it('carries the verified headline story for a single area', () => {
    expect(buildSubject([block({ areaLabel: 'Tetherow' })])).toBe('Tetherow home prices are down 1.2% from a year ago')
  })
  it('leads with the biggest verified story across several areas', () => {
    expect(buildSubject([block(), block({ slug: 'redmond', areaLabel: 'Redmond' })])).toBe(
      'Bend home prices are down 1.2% from a year ago',
    )
  })
  it('falls back to the plain area framing when the headline has no story', () => {
    const bare = block({ yoyPct: null, marketVerdict: null, monthsOfSupply: null, medianPrice: null })
    expect(buildSubject([bare])).toBe('Bend market update')
    expect(buildSubject([bare, { ...bare, slug: 'redmond', areaLabel: 'Redmond' }])).toBe(
      'Your Central Oregon market update',
    )
  })
})

describe('buildHeadline', () => {
  it('leads with the largest YoY move', () => {
    const h = buildHeadline([block({ yoyPct: -1.22 }), block({ slug: 'redmond', areaLabel: 'Redmond', yoyPct: 4.25 })])
    expect(h).toBe('Redmond home prices are up 4.3% from a year ago')
  })
  it('falls back to a city verdict when no YoY exists', () => {
    expect(buildHeadline([block({ yoyPct: null })])).toBe("Bend is a seller's market with 3.5 months of supply")
  })
  it('never headlines a neighborhood verdict (months of supply is city grain only)', () => {
    const h = buildHeadline([hood({ yoyPct: null })])
    expect(h).not.toContain('months of supply')
    expect(h).toBe('Larkspur homes sold for a median $612,000 over the last 12 months')
  })
  it('falls back to the twelve-month median when neither exists', () => {
    const h = buildHeadline([block({ yoyPct: null, marketVerdict: null, monthsOfSupply: null })])
    expect(h).toBe('Bend homes sold for a median $721,000 over the last 12 months')
  })
  it('contains no colon or hyphen (headline rule)', () => {
    for (const areas of [[block()], [block({ yoyPct: null })], [hood({ yoyPct: null })]]) {
      const h = buildHeadline(areas)
      expect(h).not.toContain(':')
      expect(h).not.toContain(' - ')
    }
  })
})

/**
 * The Old Bend fixture, from the live row that produced the 2026-07-29 subject
 * line "Old Bend home prices are down 17.1% from a year ago":
 * market_stats_cache geo_type=neighborhood geo=bend-old-bend period=rolling_365d,
 * yoy_median_price_delta_pct = -17.0558, sold_count = 15. The figure is exact.
 * The sample behind it is not headline-grade.
 */
function thinArea(overrides: Partial<MarketReportAreaBlock> = {}): MarketReportAreaBlock {
  return block({
    slug: 'bend-old-bend',
    areaLabel: 'Old Bend',
    geoType: 'neighborhood',
    href: '/neighborhoods/bend-old-bend',
    medianPrice: 985000,
    activeListings: 9,
    soldLast12mo: 15,
    monthsOfSupply: 7.2,
    marketVerdict: 'buyers',
    yoyPct: -17.0558,
    source: 'market_stats_cache:rolling_365d',
    twelveMonthSource: 'market_stats_cache',
    trend: null,
    ...overrides,
  })
}

describe('headline sample floor (§0 judgment, not §0 citation)', () => {
  it('exposes a floor of 30 trailing-12-month closed sales', () => {
    expect(HEADLINE_MIN_SOLD_COUNT).toBe(30)
  })
  it('rejects a YoY move drawn from too few closes', () => {
    expect(yoyCanCarryHeadline({ yoyPct: -17.0558, soldLast12mo: 15 })).toBe(false)
    expect(yoyCanCarryHeadline({ yoyPct: -17.0558, soldLast12mo: 29 })).toBe(false)
  })
  it('accepts a YoY move at or above the floor', () => {
    expect(yoyCanCarryHeadline({ yoyPct: -17.0558, soldLast12mo: 30 })).toBe(true)
    expect(yoyCanCarryHeadline({ yoyPct: -1.22, soldLast12mo: 1657 })).toBe(true)
  })
  it('rejects an area with no YoY or no close count at all', () => {
    expect(yoyCanCarryHeadline({ yoyPct: null, soldLast12mo: 1657 })).toBe(false)
    expect(yoyCanCarryHeadline({ yoyPct: Number.NaN, soldLast12mo: 1657 })).toBe(false)
    expect(yoyCanCarryHeadline({ yoyPct: -17.0558, soldLast12mo: null })).toBe(false)
  })
  it('a thin-sample neighborhood cannot take the headline, even alone, and falls to its median', () => {
    const h = buildHeadline([thinArea()])
    expect(h).not.toContain('17.1%')
    expect(h).toBe('Old Bend homes sold for a median $985,000 over the last 12 months')
  })
  it('a thin-sample area cannot take the headline from a well-sampled one', () => {
    expect(buildHeadline([block(), thinArea()])).toBe('Bend home prices are down 1.2% from a year ago')
  })
  it('the subject line inherits the floor', () => {
    const solo = buildSubject([thinArea()])
    expect(solo).not.toContain('17.1%')
    expect(solo).toBe('Old Bend homes sold for a median $985,000 over the last 12 months')
    expect(buildSubject([thinArea({ marketVerdict: null, monthsOfSupply: null, medianPrice: null })])).toBe(
      'Old Bend market update',
    )
    expect(buildSubject([block(), thinArea()])).toBe('Bend home prices are down 1.2% from a year ago')
  })
  it('a well-sampled area still carries a large YoY move', () => {
    const h = buildHeadline([block({ areaLabel: 'Redmond', yoyPct: -17.0558, soldLast12mo: 412 })])
    expect(h).toBe('Redmond home prices are down 17.1% from a year ago')
  })
  it('the floor is exactly inclusive at 30 closes', () => {
    expect(buildHeadline([thinArea({ soldLast12mo: 29 })])).not.toContain('17.1%')
    expect(buildHeadline([thinArea({ soldLast12mo: 30 })])).toBe('Old Bend home prices are down 17.1% from a year ago')
  })
  it('a flat 0.0% move from a well-sampled area is still a story', () => {
    expect(buildHeadline([block({ yoyPct: 0 })])).toBe('Bend home prices are holding steady year over year')
  })
  it('falls all the way through to Where when a thin area has no verdict or median either', () => {
    expect(buildHeadline([thinArea({ marketVerdict: null, monthsOfSupply: null, medianPrice: null })])).toBe(
      'Where the Old Bend market stands',
    )
  })
  it('a thin area is still reported in the body, it just does not headline', () => {
    const out = renderMarketReportEmail({ contactName: 'Jordan', areas: [block(), thinArea()], unsubscribeUrl: UNSUB })
    expect(out.subject).toBe('Bend home prices are down 1.2% from a year ago')
    expect(out.html).toContain('Old Bend')
    expect(out.html).toContain('$985,000')
    expect(out.html).toContain('↓ 17.1% from a year ago')
    expect(out.text).toContain('Homes sold, last 12 months 15')
    const figures = out.traces.map((t) => t.figure).join('\n')
    expect(figures).toContain('Old Bend median sale price change from a year ago ↓ 17.1% from a year ago')
    // The headline trace states the floor so an auditor sees why it did not lead.
    const headlineTrace = out.traces.find((t) => t.figure.startsWith('headline '))
    expect(headlineTrace?.source).toContain('at least 30 closed sales')
  })
})

describe('month over month (same instrument, sampled months only)', () => {
  it(`needs ${MOM_MIN_MONTH_SALES} closed sales in BOTH months`, () => {
    expect(MOM_MIN_MONTH_SALES).toBe(10)
    // Larkspur, 2026-09: August 5 sales vs July 4. A 19.1% "move" on that is noise.
    const thin = [
      { periodStart: '2026-07-01', medianSalePrice: 700000, soldCount: 4 },
      { periodStart: '2026-08-01', medianSalePrice: 566000, soldCount: 5 },
    ] as MarketTrendPoint[]
    expect(momMedianPair(thin)).toBeNull()
    const ok = [
      { periodStart: '2026-07-01', medianSalePrice: 700000, soldCount: 10 },
      { periodStart: '2026-08-01', medianSalePrice: 714000, soldCount: 12 },
    ] as MarketTrendPoint[]
    expect(momMedianPair(ok)).toMatchObject({ pct: 2 })
  })
  it('needs consecutive calendar months', () => {
    const gapped = [
      { periodStart: '2026-06-01', medianSalePrice: 700000, soldCount: 40 },
      { periodStart: '2026-08-01', medianSalePrice: 720000, soldCount: 40 },
    ] as MarketTrendPoint[]
    expect(momMedianPair(gapped)).toBeNull()
  })
})

describe('the price chart (an unbroken, sampled run, pinned to its months)', () => {
  it(`draws only a run of at least ${CHART_MIN_MONTHS} consecutive qualifying months`, () => {
    expect(chartableMonths(months(5, '2026-08'))).toBeNull()
    expect(chartableMonths(months(6, '2026-08'))?.length).toBe(6)
    expect(chartableMonths(months(14, '2026-08'))?.length).toBe(12)
  })
  it('stops the run at a thin month', () => {
    const pts = months(8, '2026-08')
    pts[3] = { ...pts[3], soldCount: 3 }
    expect(chartableMonths(pts)).toBeNull() // only 4 qualifying months after the thin one
  })
  it('renders the price chart from the exact monthly values it prints and checks, signed into the URL (review 2026-09-30)', () => {
    const pts = months(12, '2026-08')
    const out = renderMarketReportEmail({
      contactName: 'Jordan',
      areas: [block({ trend: trend({ points: pts }) })],
      unsubscribeUrl: UNSUB,
    })
    const src = /<img src="([^"]*\/api\/email\/market-chart[^"]*)"/.exec(out.html)?.[1]
    expect(src).toBeTruthy()
    const url = new URL(src!.replace(/&amp;/g, '&'))
    // Nothing the route could re-read market data by: no geo, slug, months or through.
    expect([...url.searchParams.keys()].sort()).toEqual(['d', 's'])
    expect(verifyMarketChart(url.searchParams.get('d'), url.searchParams.get('s'))).toEqual({
      metric: 'median_price',
      label: 'Bend',
      points: pts.map((p) => ({ month: p.periodStart.slice(0, 7), value: p.medianSalePrice })),
    })
    expect(out.html).toContain('alt="Line chart of the Bend median sale price by month over the last 12 months"')
    const chartFig = out.figures.find((f) => f.label.startsWith('median sale price chart'))
    expect(chartFig?.as_of).toBe('2026-08-31')
    // The trace names every drawn value, so an auditor can match the image to the check.
    expect(chartFig?.filter).toContain('2026-08:700000')
    expect(chartFig?.source).toContain('never re-reads')
  })
})

describe('reportCtaUrl (lands on the market section)', () => {
  it('sends a city area to /housing-market/<city> at #market', () => {
    expect(reportCtaUrl({ slug: 'bend', geoType: 'city', href: '/cities/bend' })).toBe(
      'https://ryan-realty.com/housing-market/bend?utm_source=crm&utm_medium=email&utm_campaign=market-report#market',
    )
  })
  it('sends a neighborhood/community area to its geo page at #market', () => {
    expect(reportCtaUrl({ slug: 'tetherow', geoType: 'neighborhood', href: '/communities/tetherow' })).toBe(
      'https://ryan-realty.com/communities/tetherow?utm_source=crm&utm_medium=email&utm_campaign=market-report#market',
    )
  })
})

describe('renderMarketReportEmail', () => {
  it('renders a single-area email with the greeting, the verified numbers and the CTA', () => {
    const out = renderMarketReportEmail({
      contactName: 'Jordan Avery',
      brokerSlug: 'matt',
      areas: [block()],
      unsubscribeUrl: UNSUB,
      manageUrl: MANAGE,
      viewUrl: VIEW,
      asOf: new Date('2026-09-29T18:00:00Z'),
    })
    expect(out.subject).toBe('Bend home prices are down 1.2% from a year ago')
    expect(out.html).toContain('Hi Jordan,')
    expect(out.html).toContain('as of September 29, 2026')
    expect(out.html).toContain('$721,000')
    expect(out.html).toContain('25 days')
    expect(out.html).toContain("Seller's market &middot; 3.5 months of supply")
    expect(out.html).toContain('↓ 1.2% from a year ago')
    // The trace keeps the raw figure the verdict was classified from.
    expect(out.figures.find((f) => f.label === 'months of supply')).toMatchObject({ value: 3.5, display: '3.5 months' })
    expect(out.html).toContain(
      'https://ryan-realty.com/housing-market/bend?utm_source=crm&utm_medium=email&utm_campaign=market-report#market',
    )
    expect(out.html).not.toContain('#market-report')
    expect(out.html).not.toContain('https://ryan-realty.com/cities/bend')
    // The one branded frame (lib/email/shell.ts).
    expect(out.html).toContain('MARKET REPORT · BEND')
    expect(out.html).toContain('#102742')
    expect(out.html).toContain('max-width:640px')
    expect(out.html).toContain('name="color-scheme"')
    expect(out.text).toContain('$721,000')
    expect(out.text).toContain('Median days on market, last 12 months 25 days')
  })

  it('carries one footer: the address once, and View online, Manage and Unsubscribe links', () => {
    const out = renderMarketReportEmail({
      contactName: 'Jordan',
      areas: [block()],
      unsubscribeUrl: UNSUB,
      manageUrl: MANAGE,
      viewUrl: VIEW,
    })
    const address = 'Ryan Realty, 115 NW Oregon Ave #2, Bend, OR 97703'
    expect(out.html.split(address).length - 1).toBe(1)
    expect(out.text.split(address).length - 1).toBe(1)
    expect(out.html).toContain(`href="${VIEW}"`)
    expect(out.html).toContain(`href="${MANAGE}"`)
    expect(out.html).toContain(`href="${UNSUB}"`)
    expect(out.html).toContain('View this report online')
    expect(out.html).toContain('Manage your report')
    expect(out.text).toContain(`View this report online: ${VIEW}`)
    expect(out.text).toContain(`Manage your report: ${MANAGE}`)
    expect(out.text).toContain(`Unsubscribe: ${UNSUB}`)
    // No narration of why the reader got it (defect h).
    expect(out.html).not.toContain('You are receiving')
    expect(out.text).not.toContain('You are receiving')
  })

  it('renders the month-over-month line on the same instrument and no inventory or DOM month context', () => {
    const out = renderMarketReportEmail({ contactName: 'Jordan', areas: [block()], unsubscribeUrl: UNSUB })
    expect(out.html).toContain('June closed at a $748,000 median, ↑ 2.2% vs May ($732,000).')
    expect(out.html).not.toContain('June ended 12 more than May')
    expect(out.html).not.toContain('faster than May')
    expect(out.html).toContain('Market read')
    expect(out.html).toContain('sellers hold the leverage')
  })

  it('omits charts and month-over-month when the area has no trend series', () => {
    const out = renderMarketReportEmail({ contactName: 'Jordan', areas: [block({ trend: null })], unsubscribeUrl: UNSUB })
    expect(out.html).not.toContain('/api/email/market-chart')
    expect(out.html).not.toContain('vs May')
  })

  it('prints no months of supply, verdict or market read for a neighborhood', () => {
    const out = renderMarketReportEmail({ contactName: 'Cheryl', areas: [hood()], unsubscribeUrl: UNSUB })
    expect(out.html).toContain('Larkspur')
    expect(out.html).toContain('$612,000')
    expect(out.html).not.toContain('months of supply')
    expect(out.html).not.toContain('Months of supply')
    expect(out.html).not.toContain('Balanced market')
    expect(out.html).not.toContain('Market read')
    expect(out.figures.some((f) => f.label === 'months of supply')).toBe(false)
  })

  it('puts the specific area first: Larkspur before Bend', () => {
    const out = renderMarketReportEmail({ contactName: 'Cheryl', areas: [block(), hood()], unsubscribeUrl: UNSUB })
    expect(out.html.indexOf('>Larkspur<')).toBeGreaterThan(-1)
    expect(out.html.indexOf('>Larkspur<')).toBeLessThan(out.html.indexOf('>Bend<'))
    expect(out.html).toContain('Here is where Larkspur and Bend stand')
    expect(out.html).toContain('MARKET REPORT · CENTRAL OREGON')
  })

  it('drops a row with no value instead of printing a dash or a fabricated zero', () => {
    const out = renderMarketReportEmail({
      contactName: 'Sam',
      areas: [block({ yoyPct: null, domMedian: null, activeListings: null })],
      unsubscribeUrl: UNSUB,
    })
    expect(out.html).not.toContain('—')
    expect(out.text).not.toContain('—')
    expect(out.html).not.toContain('Median days on market')
    expect(out.html).not.toContain('Homes for sale')
    expect(out.html).not.toContain('from a year ago')
    expect(out.html).not.toContain('0.0%')
  })

  it('returns a figure for every printed number, and no trace leaks into the email', () => {
    const out = renderMarketReportEmail({ contactName: 'Jordan', areas: [block()], unsubscribeUrl: UNSUB })
    // Every figure's display string is what the reader saw (the text part is unescaped).
    for (const f of out.figures) {
      if (f.display === 'chart') continue
      expect(out.text).toContain(f.display)
    }
    const labels = out.figures.map((f) => f.label)
    expect(labels).toEqual(
      expect.arrayContaining([
        'median sale price, last 12 months',
        'median sale price change from a year ago',
        'homes for sale',
        'median days on market, last 12 months',
        'homes sold, last 12 months',
        'months of supply',
        'market verdict',
      ]),
    )
    const sources = out.traces.map((t) => t.source).join('\n')
    expect(sources).toContain('market_stats_cache via getCityMarketDetail · geo_type=city geo_slug=bend period_type=rolling_365d column=median_dom')
    // A hand-built block carries no provenance: its trace says so rather than
    // guessing a source.
    expect(sources).toContain('live count, source not recorded on this block')
    expect(sources).not.toContain('market_pulse_live')
    expect(out.html).not.toContain('rolling_365d')
    expect(out.text).not.toContain('rolling_365d')
    expect(out.html).not.toContain('market_metric')
  })

  it('names the read that served a live Market Truth count, by grain, and never the pulse table', () => {
    // A neighborhood's count is Market Truth's active_count read directly (the
    // pulse's own count includes Coming Soon), so its trace names market_metric.
    const provenance = {
      cache: null,
      live: { table: 'market_metric' as const, computedAt: '2026-09-30T00:40:03Z', completeThrough: null, periodEnd: null },
      twelveMonth: null,
    }
    const out = renderMarketReportEmail({
      contactName: 'Jordan',
      areas: [block({ provenance }), hood({ provenance })],
      unsubscribeUrl: UNSUB,
    })
    const active = out.figures.filter((f) => f.label === 'homes for sale')
    expect(active.find((f) => f.area === 'bend')?.source).toBe(
      'market_metric via getDetachedMarkets (Market Truth, segment detached, StandardStatus Active)',
    )
    expect(active.find((f) => f.area === 'bend-larkspur')?.source).toBe(
      'market_metric via getDetachedInventories (Market Truth, segment detached, StandardStatus Active, primary place membership)',
    )
    expect(active.find((f) => f.area === 'bend-larkspur')?.as_of).toBe('2026-09-30T00:40:03Z')
  })

  it('dates each monthly figure at the end of its month', () => {
    const out = renderMarketReportEmail({ contactName: 'Jordan', areas: [block()], unsubscribeUrl: UNSUB })
    const june = out.figures.find((f) => f.label === 'June median sale price')
    expect(june?.as_of).toBe('2026-06-30')
    expect(june?.n).toBe(151)
  })

  it('renders the broker close card when a senderBroker is passed', () => {
    const out = renderMarketReportEmail({
      contactName: 'Sam',
      areas: [block()],
      unsubscribeUrl: UNSUB,
      senderBroker: {
        name: 'Matt Ryan',
        firstName: 'Matt',
        title: 'Owner & Principal Broker',
        phone: '541.703.3095',
        email: 'matt@ryan-realty.com',
        headshotUrl: 'https://ryan-realty.com/images/brokers/ryan-matt.png',
        isOwner: true,
      },
    })
    expect(out.html).toContain('TALK TO MATT')
    expect(out.html).toContain('541.703.3095')
  })

  it('omits the broker close card by default', () => {
    const out = renderMarketReportEmail({ contactName: 'Sam', areas: [block()], unsubscribeUrl: UNSUB })
    expect(out.html).not.toContain('TALK TO')
  })

  // --- Voice (VOICE.md; no em dashes in public copy, ci:no-public-em-dash) ---

  const sampleEmail = () =>
    renderMarketReportEmail({
      contactName: 'Jordan',
      areas: [block(), hood(), thinArea({ yoyPct: null, domMedian: null })],
      unsubscribeUrl: UNSUB,
      manageUrl: MANAGE,
      viewUrl: VIEW,
    })

  it('contains no em dash or en dash anywhere', () => {
    const out = sampleEmail()
    expect(out.subject).not.toMatch(/[–—]/)
    expect(out.html).not.toMatch(/[–—]/)
    expect(out.text).not.toMatch(/[–—]/)
  })

  it('contains no semicolons in the subject or the text part', () => {
    const out = sampleEmail()
    expect(out.subject).not.toContain(';')
    expect(out.text).not.toContain(';')
  })

  it('contains no exclamation marks', () => {
    const out = sampleEmail()
    expect(out.subject).not.toContain('!')
    expect(out.text).not.toContain('!')
  })
})

describe('the trace names the store that produced the figure', () => {
  const traceFor = (area: MarketReportAreaBlock, label: string) => {
    const out = renderMarketReportEmail({ contactName: 'Jordan', areas: [area], unsubscribeUrl: UNSUB })
    const f = out.figures.find((x) => x.label === label)
    return f ? `${f.source} · ${f.filter}` : ''
  }

  const twelveMonth: Array<[string, string, string]> = [
    ['median sale price, last 12 months', 'stat_id=median_close', 'column=median_sale_price'],
    ['median sale price change from a year ago', 'stat_id=yoy_median_price', 'column=yoy_median_price_delta_pct'],
    ['homes sold, last 12 months', 'stat_id=closed_count', 'column=sold_count'],
  ]
  for (const [label, truth, cache] of twelveMonth) {
    it(`traces "${label}" to Market Truth when the block is a leftover overlay`, () => {
      const t = traceFor(block({ twelveMonthSource: 'market-truth' }), label)
      expect(t).toContain('market_metric via getPublicDetachedPace')
      expect(t).toContain(truth)
      expect(t).not.toContain('market_stats_cache')
    })
    it(`traces "${label}" to the cache when the block is not an overlay`, () => {
      const t = traceFor(block({ twelveMonthSource: 'market_stats_cache' }), label)
      expect(t).toContain('market_stats_cache')
      expect(t).toContain(cache)
      expect(t).not.toContain('getPublicDetachedPace')
    })
  }

  it('keeps median days on market on the cache even for a leftover overlay block (D17)', () => {
    const t = traceFor(block({ twelveMonthSource: 'market-truth' }), 'median days on market, last 12 months')
    expect(t).toContain('market_stats_cache')
    expect(t).toContain('column=median_dom')
  })

  it('names Market Truth for a city active count read from market_metric', () => {
    const area = block({
      provenance: {
        cache: null,
        live: { table: 'market_metric', computedAt: '2026-09-29T06:21:00Z', completeThrough: '2026-09-28' },
        twelveMonth: null,
      },
    })
    const t = traceFor(area, 'homes for sale')
    expect(t).toContain('market_metric via getDetachedMarkets')
    expect(t).toContain('stat_id=active_count')
  })
})
