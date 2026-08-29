import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { sellHtmlGate } from './sell-html-gate.mjs'

const FACE_TELLS = [
  /Market Truth leftover/i,
  /Market Truth cells/i,
  /leftover\s*:\s*true/i,
  /leftover membership/i,
  /sample-gated/i,
  /methodology v3/i,
  /city_quarter_sale_to_ask/,
  /Browse homes for sale/,
]

describe('sellHtmlGate', () => {
  it('passes a Sell face without leftover labels or the banned H2', () => {
    const html = `
      <h1>Sell your home in Central Oregon</h1>
      <label>Home address</label>
      <button>Value my home</button>
      <h2>How tight Bend is</h2>
      <p>Bend has 4.5 months of supply, which is a balanced market.</p>
      <p>regional MLS through Oregon Data Share, detached single-family homes whose MLS City is Bend</p>
      <h2>The 3% listing plan</h2>
      <h2>Selling questions</h2>
    `
    expect(sellHtmlGate(html)).toEqual({ ok: true, fails: [] })
  })

  it('fails leftover, Market Truth leftover, leftover:true, and sample-gated', () => {
    const html = `
      Market Truth leftover
      Market Truth cells
      leftover:true
      leftover membership
      sample-gated
      methodology v3
      city_quarter_sale_to_ask
      Is Bend a buyer&#x27;s or seller&#x27;s market?
    `
    const result = sellHtmlGate(html)
    expect(result.ok).toBe(false)
    expect(result.fails).toEqual([
      'leftover',
      'market-truth-leftover',
      'market-truth-cells',
      'leftover-true',
      'leftover-membership',
      'sample-gated',
      'methodology-v3',
      'city-quarter-sale-to-ask',
      'buyer-seller-market-h2',
    ])
  })

  it('keeps leftover labels off the /sell face strings', () => {
    const page = readFileSync(resolve('app/sell/page.tsx'), 'utf8')
    const constants = readFileSync(resolve('app/sell/_v3/sell-constants.ts'), 'utf8')
    const market = readFileSync(resolve('app/sell/_v3/sell-market.ts'), 'utf8')
    for (const src of [page, constants, market]) {
      for (const tell of FACE_TELLS) {
        expect(src).not.toMatch(tell)
      }
    }
    expect(sellHtmlGate(constants)).toEqual({ ok: true, fails: [] })
  })
})
