import { describe, it, expect } from 'vitest'
import { buildDscrDealListEmail, type DscrEmailProperty } from './dscr-deal-list'

/**
 * This email carries investment figures to someone who may act on them, so the
 * assertions here are about honesty, not layout: the assumptions behind the
 * maths are present, every rent figure names its source, the DSCR-vs-cash-flow
 * distinction is spelled out, and nothing a listing could contain can inject
 * markup into a recipient's inbox.
 */

const base: DscrEmailProperty = {
  address: '455 NE Dekalb Ave',
  city: 'Bend',
  beds: 3,
  sqft: 1386,
  propertySubType: 'Single Family Residence',
  price: 369_900,
  rent: 2373,
  rentSource: 'zillow-rentzestimate',
  pitia: 2294,
  dscr: 1.03,
  cashFlowMonthly: -467,
  cashOnCashPct: -5.6,
  maxPriceForDscr: 381_000,
  priceDelta: 11_100,
  dealScore: 62.5,
  listingUrl: '/listing/abc123',
}

const args = {
  properties: [base],
  assumptions: { ratePct: 6.875, downPct: 25, termYears: 30, opexPct: 23 },
  rentAsOf: 'August 3, 2026',
}

/**
 * Prose in the template wraps across source lines, and an email client collapses
 * that whitespace before a reader ever sees it. Assert on the sentence, not on
 * where the template literal happened to break.
 */
const flat = (s: string) => s.replace(/\s+/g, ' ')

describe('DSCR deal-list email', () => {
  it('states the financing assumptions behind every figure', () => {
    const { html, text } = buildDscrDealListEmail(args)
    for (const out of [html, text]) {
      expect(out).toContain('25%')
      expect(out).toContain('6.875%')
      expect(out).toContain('30-year')
      expect(out).toContain('23%')
    }
  })

  it('names the rent source and the date it was pulled', () => {
    const { html, text } = buildDscrDealListEmail(args)
    expect(html).toContain('Zillow Rent Zestimate')
    expect(html).toContain('August 3, 2026')
    expect(text).toContain('Zillow Rent Zestimate')
  })

  it('labels a HUD-sourced rent differently from a property-level one', () => {
    const { html } = buildDscrDealListEmail({
      ...args,
      properties: [{ ...base, rentSource: 'hud-fmr' }],
    })
    expect(html).toContain('HUD Fair Market Rent')
    expect(html).not.toContain('Zillow Rent Zestimate')
  })

  it('explains that DSCR excludes operating costs, so 1.03 is not profit', () => {
    // The recipient must not read DSCR 1.03 with a negative cash flow as a win.
    const { html } = buildDscrDealListEmail(args)
    expect(flat(html)).toMatch(/does not subtract operating costs/i)
    expect(flat(html)).toMatch(/can clear 1\.00 and still lose money/i)
    expect(html).toContain('1.30')
    expect(html).toContain('-$467')
  })

  it('discloses the manufactured-home rent weakness on that row', () => {
    const { html } = buildDscrDealListEmail({
      ...args,
      properties: [{ ...base, propertySubType: 'Manufactured On Land' }],
    })
    expect(flat(html)).toMatch(/thinner set of rental comparables/i)
  })

  it('does not carry the caveat on a property it does not apply to', () => {
    const { html } = buildDscrDealListEmail(args)
    expect(flat(html)).not.toMatch(/thinner set of rental comparables/i)
  })

  it('escapes listing-supplied text so MLS content cannot inject markup', () => {
    const { html } = buildDscrDealListEmail({
      ...args,
      properties: [{ ...base, address: '<script>alert(1)</script>', city: '"><b>x' }],
    })
    expect(html).not.toContain('<script>alert(1)</script>')
    expect(html).toContain('&lt;script&gt;')
  })

  it('carries the MLS attribution and does not present estimates as leases', () => {
    const { html } = buildDscrDealListEmail(args)
    expect(flat(html)).toMatch(/Oregon Datashare/i)
    expect(flat(html)).toMatch(/not signed leases/i)
  })

  it('carries no explaining-the-obvious audience line', () => {
    // Matt 2026-08-03: this class of filler "just persists". Someone who gets a
    // list of houses from their broker knows why they got it; saying so is
    // pandering (§2). The shell's newsletter default is also simply false here.
    const { html } = buildDscrDealListEmail(args)
    expect(flat(html)).not.toMatch(/you.{0,3}re receiving this/i)
    expect(flat(html)).not.toMatch(/you asked for updates/i)
    expect(flat(html)).not.toMatch(/because you subscribed/i)
    expect(flat(html)).not.toMatch(/it is not a subscription/i)
  })

  it('renders absolute listing URLs a recipient can click from an inbox', () => {
    const { html, text } = buildDscrDealListEmail(args)
    expect(html).toContain('https://ryan-realty.com/listing/abc123')
    expect(text).toContain('https://ryan-realty.com/listing/abc123')
  })
})
