import { describe, expect, it } from 'vitest'
import { homepageHtmlGate } from './homepage-html-gate.mjs'

describe('homepageHtmlGate', () => {
  it('passes a homepage face without leftover labels or the banned H2', () => {
    const html = `
      <h1>Homes for Sale in Central Oregon</h1>
      <h2>Where the homes are, and what they cost</h2>
      <h2>How tight the market is</h2>
      <p>Central Oregon has 5.4 months of supply, which is a balanced market.</p>
      <h2>Resorts and planned communities</h2>
      <h2>Get new Central Oregon listings by email</h2>
      <h2>What clients say</h2>
      <h2>The brokers</h2>
    `
    expect(homepageHtmlGate(html)).toEqual({ ok: true, fails: [] })
  })

  it('fails leftover labels and the banned market question', () => {
    const html = `
      Market Truth leftover
      leftover:true
      leftover membership
      methodology v3
      city_quarter_sale_to_ask
      Is Central Oregon a buyer&#x27;s or seller&#x27;s market?
    `
    const result = homepageHtmlGate(html)
    expect(result.ok).toBe(false)
    expect(result.fails).toEqual([
      'market-truth-leftover',
      'leftover-true',
      'leftover-membership',
      'methodology-v3',
      'city-quarter-sale-to-ask',
      'buyer-seller-market-h2',
    ])
  })
})
