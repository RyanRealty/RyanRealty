import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { valuationHtmlGate } from './valuation-html-gate.mjs'

const FACE_TELLS = [
  /Market Truth leftover/i,
  /leftover\s*:\s*true/i,
  /leftover membership/i,
  /methodology v3/i,
  /city_quarter_sale_to_ask/,
  /Is [^\n<]{0,120}buyer(?:'|’|&rsquo;|&#39;|&#x27;|&apos;)s or seller(?:'|’|&rsquo;|&#39;|&#x27;|&apos;)s market\?/,
  /Next we ask for your email/,
]

describe('valuationHtmlGate', () => {
  it('passes a valuation face without leftover labels or the banned H2', () => {
    const html = `
      <h1>Home valuation in Central Oregon</h1>
      <h2>Get your home's value</h2>
      <label>Property address</label>
      <label>Email</label>
      <input type="email" />
      <p data-address-match="pending">Pick an address from the list to confirm it.</p>
      <button>Get my home’s value</button>
      <h2>What goes into the number</h2>
      <p>Recent closed sales in your neighborhood</p>
    `
    expect(valuationHtmlGate(html)).toEqual({ ok: true, fails: [] })
  })

  it('fails leftover, Market Truth leftover, leftover:true, and buyer-seller H2s', () => {
    const html = `
      Market Truth leftover
      leftover:true
      leftover membership
      methodology v3
      city_quarter_sale_to_ask
      Is Bend a buyer&#x27;s or seller&#x27;s market?
      Next we ask for your email.
    `
    const result = valuationHtmlGate(html)
    expect(result.ok).toBe(false)
    expect(result.fails).toEqual([
      'leftover',
      'market-truth-leftover',
      'leftover-true',
      'leftover-membership',
      'methodology-v3',
      'city-quarter-sale-to-ask',
      'buyer-seller-market-h2',
      'deferred-email-helper',
    ])
  })

  it('keeps leftover labels off the /sell/valuation face strings', () => {
    const page = readFileSync(resolve('app/sell/valuation/page.tsx'), 'utf8')
    const form = readFileSync(resolve('app/sell/_v3/ValuationValueForm.tsx'), 'utf8')
    const constants = readFileSync(resolve('app/sell/_v3/sell-constants.ts'), 'utf8')
    for (const src of [page, form, constants]) {
      for (const tell of FACE_TELLS) {
        expect(src).not.toMatch(tell)
      }
      expect(valuationHtmlGate(src)).toEqual({ ok: true, fails: [] })
    }
    expect(page).toContain('Home valuation in Central Oregon')
    expect(page).toContain("Get your home's value")
    expect(page).toContain('What goes into the number')
    expect(form).toContain('AddressAutocomplete')
    expect(form).toContain('data-address-match')
    expect(form).toContain('htmlFor="val-email"')
    expect(form).toContain('type="email"')
    expect(form).toContain('>Email<')
    expect(form).not.toContain('Next we ask for your email.')
    expect(form).not.toContain("setStep('contact')")
  })
})
