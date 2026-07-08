import { describe, it, expect } from 'vitest'
import {
  renderMarketReportEmail,
  buildSubject,
  buildHeadline,
  chartImageUrl,
  formatCurrencyRounded,
  formatDays,
  formatYoy,
  formatMomPct,
  formatMonths,
  meaningLine,
  verdictLabel,
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
  it('renders integer + " days"', () => {
    expect(formatDays(38)).toBe('38 days')
    expect(formatDays(25.4)).toBe('25 days')
    expect(formatDays(47.5)).toBe('48 days')
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
  it('names the single area', () => {
    expect(buildSubject([block({ areaLabel: 'Tetherow' })])).toBe('Tetherow market update')
  })
  it('uses a regional framing for several areas', () => {
    expect(buildSubject([block(), block({ slug: 'redmond', areaLabel: 'Redmond' })])).toBe(
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

describe('renderMarketReportEmail', () => {
  const UNSUB = 'https://ryan-realty.com/api/email/unsubscribe?t=abc.def'

  it('renders a single-area email with the contact greeting and verified numbers', () => {
    const out = renderMarketReportEmail({
      contactName: 'Jordan Avery',
      brokerSlug: 'matt-ryan',
      areas: [block()],
      unsubscribeUrl: UNSUB,
    })
    expect(out.subject).toBe('Bend market update')
    expect(out.html).toContain('Hi Jordan,')
    expect(out.html).toContain('$721,000')
    expect(out.html).toContain('25 days')
    expect(out.html).toContain("Seller's market")
    expect(out.html).toContain('3.5 months of supply')
    expect(out.html).toContain('↓ 1.2% YoY')
    expect(out.html).toContain('https://ryan-realty.com/cities/bend')
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
    expect(out.html).toContain('What this means for you')
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
    expect(out.subject).toBe('Your Central Oregon market update')
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
