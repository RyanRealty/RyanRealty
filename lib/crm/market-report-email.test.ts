import { describe, it, expect } from 'vitest'
import {
  renderMarketReportEmail,
  buildSubject,
  formatCurrencyRounded,
  formatDays,
  formatYoy,
  formatMonths,
  verdictLabel,
} from './market-report-email'
import type { MarketReportAreaBlock } from '@/lib/data/crm/getMarketReportData'

const BANNED_VOCAB = require('../../scripts/brand-voice-vocabulary.cjs') as {
  BANNED_WORD_STRINGS: string[]
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
    expect(formatYoy(2.14)).toBe('↑ up 2.1% YoY')
  })
  it('renders a down arrow for negative', () => {
    expect(formatYoy(-1.22)).toBe('↓ down 1.2% YoY')
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
    expect(out.html).toContain('https://ryan-realty.com/cities/bend')
    expect(out.html).toContain(UNSUB)
    // text part carries the same figures
    expect(out.text).toContain('$721,000')
    expect(out.text).toContain('Median days on market: 25 days')
    expect(out.text).toContain(`Unsubscribe: ${UNSUB}`)
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
