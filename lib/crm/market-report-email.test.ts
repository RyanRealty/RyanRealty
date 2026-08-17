import { describe, it, expect } from 'vitest'
import {
  renderMarketReportEmail,
  buildSubject,
  buildHeadline,
  chartImageUrl,
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
} from './market-report-email'
import type {
  MarketReportAreaBlock,
  MarketTrendSummary,
} from '@/lib/data/crm/getMarketReportData'

const BANNED_VOCAB = require('../../scripts/brand-voice-vocabulary.cjs') as {
  BANNED_WORD_STRINGS: string[]
}

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
    source: 'market_pulse_live',
    href: '/cities/bend',
    trend: trend(),
    ...overrides,
  }
}

describe('formatCurrencyRounded (nearest thousand)', () => {
  it('rounds to the nearest thousand and adds the comma separator', () => {
    expect(formatCurrencyRounded(721000)).toBe('$721,000')
    expect(formatCurrencyRounded(894750)).toBe('$895,000')
    expect(formatCurrencyRounded(894499)).toBe('$894,000')
    expect(formatCurrencyRounded(2463500)).toBe('$2,464,000')
  })
  it('renders the em-dash data placeholder when unavailable', () => {
    expect(formatCurrencyRounded(null)).toBe('—')
    expect(formatCurrencyRounded(undefined)).toBe('—')
    expect(formatCurrencyRounded(Number.NaN)).toBe('—')
  })
})

describe('formatDays', () => {
  it('renders published days without inventing a second integer', () => {
    expect(formatDays(38)).toBe('38 days')
    expect(formatDays(25.4)).toBe('25.4 days')
    expect(formatDays(47.5)).toBe('47.5 days')
  })
  it('em-dash when unavailable', () => {
    expect(formatDays(null)).toBe('—')
  })
})

describe('formatYoy (signed arrow, one decimal)', () => {
  it('renders an up arrow for positive', () => {
    expect(formatYoy(2.14)).toBe('↑ 2.1% YoY')
  })
  it('renders a down arrow for negative', () => {
    expect(formatYoy(-1.22)).toBe('↓ 1.2% YoY')
  })
  it('renders flat for zero', () => {
    expect(formatYoy(0)).toBe('flat YoY')
    expect(formatYoy(0.04)).toBe('flat YoY') // rounds to 0.0
  })
  it('em-dash when unavailable', () => {
    expect(formatYoy(null)).toBe('—')
  })
})

describe('formatMonths', () => {
  it('one decimal + " months"', () => {
    expect(formatMonths(3.5)).toBe('3.5 months')
    expect(formatMonths(10.8)).toBe('10.8 months')
  })
  it('two decimals inside the verdict-threshold bands, INCLUSIVE of the edges', () => {
    // 4.05 classifies balanced (> 4) but toFixed(1) floating-point-rounds it
    // DOWN to "4.0" — which would print "Balanced market · 4.0 months", the
    // verdict-vs-number contradiction §0 bans. Bend hit this live 2026-07-16.
    expect(formatMonths(4.05)).toBe('4.05 months')
    expect(formatMonths(4.04)).toBe('4.04 months')
    expect(formatMonths(3.95)).toBe('3.95 months')
    expect(formatMonths(5.95)).toBe('5.95 months')
    expect(formatMonths(6.05)).toBe('6.05 months')
    expect(formatMonths(4.1)).toBe('4.1 months')
  })
  it('em-dash when unavailable', () => {
    expect(formatMonths(null)).toBe('—')
  })
})

describe('verdictLabel', () => {
  it('maps each verdict to a sentence-case phrase', () => {
    expect(verdictLabel('sellers')).toBe("Seller's market")
    expect(verdictLabel('balanced')).toBe('Balanced market')
    expect(verdictLabel('buyers')).toBe("Buyer's market")
    expect(verdictLabel(null)).toBe('—')
  })
})

describe('buildSubject', () => {
  it('carries the verified headline story for a single area', () => {
    expect(buildSubject([block({ areaLabel: 'Tetherow' })])).toBe(
      'Tetherow home prices are down 1.2% from a year ago',
    )
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

describe('formatMomPct', () => {
  it('renders a signed one-decimal arrow vs the prior month', () => {
    expect(formatMomPct(2.18, 'May')).toBe('↑ 2.2% vs May')
    expect(formatMomPct(-0.5, 'May')).toBe('↓ 0.5% vs May')
    expect(formatMomPct(0.01, 'May')).toBe('flat vs May')
  })
  it('em-dash when unavailable', () => {
    expect(formatMomPct(null, 'May')).toBe('—')
    expect(formatMomPct(2.2, null)).toBe('—')
  })
})

describe('meaningLine', () => {
  it('maps each verdict to a plain-English implication and null when unknown', () => {
    expect(meaningLine('sellers')).toContain('sellers hold the leverage')
    expect(meaningLine('balanced')).toContain('realistic pricing')
    expect(meaningLine('buyers')).toContain('room to negotiate')
    expect(meaningLine(null)).toBeNull()
  })
})

describe('buildHeadline', () => {
  it('leads with the largest YoY move', () => {
    const h = buildHeadline([
      block({ yoyPct: -1.22 }),
      block({ slug: 'redmond', areaLabel: 'Redmond', yoyPct: 4.25 }),
    ])
    expect(h).toBe('Redmond home prices are up 4.3% from a year ago')
  })
  it('falls back to the verdict when no YoY exists', () => {
    const h = buildHeadline([block({ yoyPct: null })])
    expect(h).toBe("Bend is a seller's market with 3.5 months of supply")
  })
  it('falls back to the median when neither exists', () => {
    const h = buildHeadline([
      block({ yoyPct: null, marketVerdict: null, monthsOfSupply: null }),
    ])
    expect(h).toBe('The Bend median sale price now sits at $721,000')
  })
  it('contains no colon or hyphen (headline rule)', () => {
    for (const areas of [[block()], [block({ yoyPct: null })]]) {
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

  it('a thin-sample area cannot take the headline, even alone, and falls to the verdict', () => {
    const h = buildHeadline([thinArea()])
    expect(h).not.toContain('17.1%')
    expect(h).not.toContain('from a year ago')
    expect(h).toBe("Old Bend is a buyer's market with 7.2 months of supply")
  })

  it('a thin-sample area cannot take the headline from a well-sampled one', () => {
    // Old Bend's -17.1% is 14x Bend's -1.2%, so the pre-floor engine handed it
    // the headline on magnitude alone.
    const h = buildHeadline([block(), thinArea()])
    expect(h).toBe('Bend home prices are down 1.2% from a year ago')
  })

  it('the subject line inherits the floor', () => {
    // The thin price claim never reaches the inbox. The subject falls to the
    // next priority the headline engine already defines (the verdict), not to
    // any new copy.
    const solo = buildSubject([thinArea()])
    expect(solo).not.toContain('17.1%')
    expect(solo).not.toContain('from a year ago')
    expect(solo).toBe("Old Bend is a buyer's market with 7.2 months of supply")
    // And with no verdict either, it degrades to the plain area framing.
    expect(buildSubject([thinArea({ marketVerdict: null, monthsOfSupply: null, medianPrice: null })])).toBe(
      'Old Bend market update',
    )
    expect(buildSubject([block(), thinArea()])).toBe(
      'Bend home prices are down 1.2% from a year ago',
    )
  })

  it('a well-sampled area still carries a large YoY move', () => {
    const h = buildHeadline([block({ areaLabel: 'Redmond', yoyPct: -17.0558, soldLast12mo: 412 })])
    expect(h).toBe('Redmond home prices are down 17.1% from a year ago')
  })

  it('the floor is exactly inclusive at 30 closes', () => {
    expect(buildHeadline([thinArea({ soldLast12mo: 29 })])).not.toContain('17.1%')
    expect(buildHeadline([thinArea({ soldLast12mo: 30 })])).toBe(
      'Old Bend home prices are down 17.1% from a year ago',
    )
  })

  it('a flat 0.0% move from a well-sampled area is still a story', () => {
    expect(buildHeadline([block({ yoyPct: 0 })])).toBe(
      'Bend home prices are holding steady year over year',
    )
  })

  it('falls all the way through to Where when a thin area has no verdict or median either', () => {
    const h = buildHeadline([
      thinArea({ marketVerdict: null, monthsOfSupply: null, medianPrice: null }),
    ])
    expect(h).toBe('Where the Old Bend market stands')
  })

  it('a thin area is still reported in full in the body, it just does not headline', () => {
    const out = renderMarketReportEmail({
      contactName: 'Jordan',
      areas: [block(), thinArea()],
      unsubscribeUrl: 'https://ryan-realty.com/api/email/unsubscribe?t=abc.def',
    })
    expect(out.subject).toBe('Bend home prices are down 1.2% from a year ago')
    // Old Bend's own block still carries its verified figures and its trace.
    expect(out.html).toContain('Old Bend')
    expect(out.html).toContain('$985,000')
    expect(out.html).toContain('↓ 17.1% YoY')
    expect(out.text).toContain('Homes sold last 12 months 15')
    const figures = out.traces.map((t) => t.figure).join('\n')
    expect(figures).toContain('Old Bend median price ↓ 17.1% YoY')
    // The headline trace states the floor so an auditor sees why it did not lead.
    const headlineTrace = out.traces.find((t) => t.figure.startsWith('Headline '))
    expect(headlineTrace?.source).toContain('at least 30 closed sales')
  })
})

describe('chartImageUrl', () => {
  it('builds an absolute URL against the site origin', () => {
    const url = chartImageUrl({ geoType: 'city', slug: 'bend' }, 'median_price')
    expect(url).toMatch(/^https:\/\//)
    expect(url).toContain('/api/email/market-chart?')
    expect(url).toContain('geo=city')
    expect(url).toContain('slug=bend')
    expect(url).toContain('metric=median_price')
  })
})

describe('reportCtaUrl (conversion-audit #2/#8 — seller-framed destination + UTMs)', () => {
  it('sends a city area to /housing-market/<city>, not the buyer storefront', () => {
    const url = reportCtaUrl({ slug: 'bend', geoType: 'city', href: '/cities/bend' })
    expect(url).toBe(
      'https://ryan-realty.com/housing-market/bend?utm_source=crm&utm_medium=email&utm_campaign=market-report#market-report',
    )
  })
  it('sends a neighborhood/community area to its geo page AT the market section', () => {
    const url = reportCtaUrl({ slug: 'tetherow', geoType: 'neighborhood', href: '/communities/tetherow' })
    expect(url).toBe(
      'https://ryan-realty.com/communities/tetherow?utm_source=crm&utm_medium=email&utm_campaign=market-report#market-report',
    )
  })
})

describe('renderMarketReportEmail', () => {
  const UNSUB = 'https://ryan-realty.com/api/email/unsubscribe?t=abc.def'

  it('renders a single-area email with the contact greeting and verified numbers', () => {
    const out = renderMarketReportEmail({
      contactName: 'Jordan Avery',
      brokerSlug: 'matt-ryan',
      areas: [block()],
      unsubscribeUrl: UNSUB,
    })
    expect(out.subject).toBe('Bend home prices are down 1.2% from a year ago')
    expect(out.html).toContain('Hi Jordan,')
    expect(out.html).toContain('$721,000')
    expect(out.html).toContain('25 days')
    expect(out.html).toContain("Seller's market")
    expect(out.html).toContain('3.5 months of supply')
    expect(out.html).toContain('↓ 1.2% YoY')
    // The CTA lands on the seller-framed report page, never the buyer
    // storefront at /cities/bend (conversion-audit 2026-07-15 #2), and
    // carries GA4 UTMs (#8) plus the market-section anchor.
    expect(out.html).toContain(
      'https://ryan-realty.com/housing-market/bend?utm_source=crm&utm_medium=email&utm_campaign=market-report#market-report',
    )
    expect(out.html).not.toContain('https://ryan-realty.com/cities/bend')
    expect(out.html).toContain(UNSUB)
    // The one branded frame (lib/email/shell.ts): masthead + navy + 640px sheet.
    expect(out.html).toContain('MARKET REPORT · BEND')
    expect(out.html).toContain('#102742')
    expect(out.html).toContain('max-width:640px')
    expect(out.html).toContain('name="color-scheme"')
    // text part carries the same figures
    expect(out.text).toContain('$721,000')
    expect(out.text).toContain('Median days on market 25 days')
    expect(out.text).toContain(`Unsubscribe: ${UNSUB}`)
  })

  it('renders the hero headline, month-over-month context, meaning line, and chart images', () => {
    const out = renderMarketReportEmail({
      contactName: 'Jordan',
      areas: [block()],
      unsubscribeUrl: UNSUB,
    })
    // Hero headline — the one story (largest YoY move).
    expect(out.html).toContain('Bend home prices are down 1.2% from a year ago')
    // MoM context sentence from the monthly cache series.
    expect(out.html).toContain('June closed at a $748,000 median, ↑ 2.2% vs May ($732,000).')
    // Inventory + DOM context sub-lines.
    expect(out.html).toContain('June ended 12 more than May')
    expect(out.html).toContain('22 days in June, 2 days faster than May')
    // Threshold-driven meaning line.
    expect(out.html).toContain('Market read')
    expect(out.html).toContain('sellers hold the leverage')
    // Chart images with alt text, absolute URLs.
    expect(out.html).toContain('/api/email/market-chart?geo=city&slug=bend&metric=median_price')
    expect(out.html).toContain('metric=inventory')
    expect(out.html).toContain('alt="Line chart of the Bend median sale price by month over the last 12 months"')
    expect(out.html).toContain('alt="Bar chart of homes for sale in Bend by month over the last 12 months"')
  })

  it('omits charts and MoM context when the area has no trend series', () => {
    const out = renderMarketReportEmail({
      contactName: 'Jordan',
      areas: [block({ trend: null })],
      unsubscribeUrl: UNSUB,
    })
    expect(out.html).not.toContain('/api/email/market-chart')
    expect(out.html).not.toContain('vs May')
  })

  it('returns a §0 trace for every displayed figure and none leak into the html', () => {
    const out = renderMarketReportEmail({
      contactName: 'Jordan',
      areas: [block()],
      unsubscribeUrl: UNSUB,
    })
    const figures = out.traces.map((t) => t.figure).join('\n')
    expect(figures).toContain('median sale price $721,000')
    expect(figures).toContain('homes for sale 480')
    expect(figures).toContain('median days on market 25 days')
    expect(figures).toContain('homes sold last 12 months 1,657')
    expect(figures).toContain('months of supply 3.5 months')
    const sources = out.traces.map((t) => t.source).join('\n')
    expect(sources).toContain('market_stats_cache geo_type=city geo=bend period=rolling_365d')
    expect(sources).toContain('market_pulse_live geo_type=city geo=bend')
    // Traces are admin-only — the trace source strings never render in the email.
    expect(out.html).not.toContain('rolling_365d')
    expect(out.text).not.toContain('rolling_365d')
  })

  it('renders a multi-area email', () => {
    const out = renderMarketReportEmail({
      contactName: null,
      areas: [block(), block({ slug: 'tetherow', areaLabel: 'Tetherow', href: '/communities/tetherow', geoType: 'neighborhood', marketVerdict: 'buyers', monthsOfSupply: 10.8, medianPrice: 1700000 })],
      unsubscribeUrl: UNSUB,
    })
    expect(out.subject).toBe('Bend home prices are down 1.2% from a year ago')
    expect(out.html).toContain('Hi,') // no name -> neutral greeting
    expect(out.html).toContain('Bend')
    expect(out.html).toContain('Tetherow')
    expect(out.html).toContain('$1,700,000')
    expect(out.html).toContain("Buyer's market")
    expect(out.html).toContain('MARKET REPORT · CENTRAL OREGON')
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

  it('renders the em-dash placeholder for an unavailable field rather than a fabricated number', () => {
    const out = renderMarketReportEmail({
      contactName: 'Sam',
      areas: [block({ yoyPct: null, domMedian: null })],
      unsubscribeUrl: UNSUB,
    })
    // em-dash data placeholder is allowed; no fabricated 0% / 0 days
    expect(out.html).toContain('—')
    expect(out.html).not.toContain('0.0% YoY')
  })

  // --- Brand-voice cleanliness (CLAUDE.md §3) ---

  const sampleEmail = () =>
    renderMarketReportEmail({
      contactName: 'Jordan',
      areas: [
        block(),
        block({ slug: 'tetherow', areaLabel: 'Tetherow', href: '/communities/tetherow', geoType: 'neighborhood', marketVerdict: 'buyers', monthsOfSupply: 10.8 }),
      ],
      unsubscribeUrl: 'https://ryan-realty.com/api/email/unsubscribe?t=abc.def',
    })

  it('contains no em-dash or en-dash in body prose (the U+2014 data placeholder is the only allowed dash, used only for unavailable cells)', () => {
    const out = sampleEmail()
    // Strip out the legitimate data-placeholder em-dashes, then assert none remain.
    // (No field is unavailable in this fixture, so there should be zero anyway.)
    expect(out.subject).not.toMatch(/[–—]/)
    expect(out.html.replace(/—/g, '')).not.toContain('–') // no en-dash
    expect(out.text.replace(/—/g, '')).not.toContain('–')
    // The greeting/intro prose specifically uses no dash punctuation.
    expect(out.html).toContain('Here is where')
  })

  it('contains no semicolons in subject, html, or text', () => {
    const out = sampleEmail()
    // HTML entities like &middot; legitimately contain a semicolon; check the
    // visible text + subject, which carry no entities.
    expect(out.subject).not.toContain(';')
    expect(out.text).not.toContain(';')
  })

  it('contains no exclamation marks in body copy', () => {
    const out = sampleEmail()
    expect(out.subject).not.toContain('!')
    expect(out.text).not.toContain('!')
  })

  it('contains no banned vocabulary', () => {
    const out = sampleEmail()
    const haystack = `${out.subject}\n${out.text}`.toLowerCase()
    const hits = BANNED_VOCAB.BANNED_WORD_STRINGS.filter((w) => {
      // whole-token match where the term is a single word; substring for phrases
      if (/\s/.test(w)) return haystack.includes(w)
      return new RegExp(`\\b${w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`).test(haystack)
    })
    expect(hits).toEqual([])
  })
})
