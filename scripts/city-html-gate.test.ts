import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { cityHtmlGate } from './city-html-gate.mjs'

const FACE_TELLS = [
  /Market Truth leftover/i,
  /leftover\s*:\s*true/i,
  /leftover membership/i,
  /methodology v3/i,
  /city_quarter_sale_to_ask/,
  /Is [^\n<]{0,120}buyer(?:'|’|&rsquo;|&#39;|&#x27;|&apos;)s or seller(?:'|’|&rsquo;|&#39;|&#x27;|&apos;)s market\?/,
]

describe('cityHtmlGate', () => {
  it('passes a city face without leftover labels or the banned H2', () => {
    const html = `
      <h1>Redmond homes for sale</h1>
      <p>Redmond has 4.6 months of supply, which is a balanced market.</p>
      <h2>How tight the market is</h2>
      <h2>Redmond, in plain words</h2>
      <h2>Get new Redmond listings by email</h2>
      <p>regional MLS through Oregon Data Share, the last 12 months</p>
    `
    expect(cityHtmlGate(html)).toEqual({ ok: true, fails: [] })
  })

  it('fails leftover, Market Truth leftover, leftover:true, and buyer-seller H2s', () => {
    const html = `
      Market Truth leftover
      leftover:true
      leftover membership
      methodology v3
      city_quarter_sale_to_ask
      Is Redmond a buyer&#x27;s or seller&#x27;s market?
    `
    const result = cityHtmlGate(html)
    expect(result.ok).toBe(false)
    expect(result.fails).toEqual([
      'leftover',
      'market-truth-leftover',
      'leftover-true',
      'leftover-membership',
      'methodology-v3',
      'city-quarter-sale-to-ask',
      'buyer-seller-market-h2',
    ])
  })

  it('keeps leftover labels off the /cities/[slug] face strings', () => {
    const page = readFileSync(resolve('app/cities/[slug]/page.tsx'), 'utf8')
    const field = readFileSync(resolve('app/cities/[slug]/_v3/CityHomesField.tsx'), 'utf8')
    const items = readFileSync(resolve('app/cities/[slug]/_v3/city-field-items.ts'), 'utf8')
    const face = readFileSync(resolve('app/cities/[slug]/_v3/city-face.ts'), 'utf8')
    for (const src of [page, field, items, face]) {
      for (const tell of FACE_TELLS) {
        expect(src).not.toMatch(tell)
      }
    }
    expect(cityHtmlGate(field)).toEqual({ ok: true, fails: [] })
    expect(cityHtmlGate(items)).toEqual({ ok: true, fails: [] })
    expect(cityHtmlGate(face)).toEqual({ ok: true, fails: [] })
    expect(page).toContain('${cityName} homes for sale')
    expect(page).toContain('How tight the market is')
    expect(page).not.toContain('V3PlacePropertyTypes')
    expect(field).toContain('listFirst')
    expect(field).toContain('mapToggle')
    expect(field).toContain('Property types')
  })
})
