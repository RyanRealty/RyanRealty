import { describe, expect, it } from 'vitest'
import { listingLandHtmlGate } from './listing-land-html-gate.mjs'

describe('listingLandHtmlGate', () => {
  it('passes a land face without house leftovers', () => {
    const html = `
      <h1>1327 Constellation Drive</h1>
      <p>$379,900</p>
      <p>0.48 acres · Awbrey Butte · Bend</p>
      <p>Residential lot</p>
      <h2>The lot</h2>
      <h2>Where this lot sits</h2>
      <p>This lot sits in Bend.</p>
      <h2>The market</h2>
      <h2>Get alerts for land like this</h2>
      <h3>Questions about this lot?</h3>
      <nav>Land for sale</nav>
    `
    expect(listingLandHtmlGate(html)).toEqual({ ok: true, fails: [] })
  })

  it('fails leftover labels, compact price, and house copy', () => {
    const html = `
      leftover:true
      Market Truth leftover
      $380K
      Imagine this room
      This house
      This home sits inside
      rental analysis
      Homes for sale
      Get alerts for homes like this
      About this home
      0 beds
    `
    const result = listingLandHtmlGate(html)
    expect(result.ok).toBe(false)
    expect(result.fails).toEqual([
      'leftover-true',
      'market-truth-leftover',
      'compact-price',
      'imagine-this-room',
      'this-house',
      'this-home-sits',
      'rental-analysis',
      'homes-for-sale-crumb',
      'homes-like-this',
      'about-this-home',
      'zero-bed',
    ])
  })
})
