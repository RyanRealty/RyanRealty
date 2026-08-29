import { describe, expect, it } from 'vitest'
import { searchHtmlGate } from './search-html-gate.mjs'

describe('searchHtmlGate', () => {
  it('passes a Field face without leftover, stock, or empty-map copy', () => {
    const html = `
      <h1>Homes for Sale</h1>
      <p>1,098 homes in this map view</p>
      <section class="v3-field" aria-label="Homes for sale in this map view"></section>
    `
    expect(searchHtmlGate(html)).toEqual({ ok: true, fails: [] })
  })

  it('fails leftover labels, Unsplash, and Loading map', () => {
    const html = `
      Market Truth leftover
      leftover:true
      leftover membership
      Redmond leftover and other types
      Market Truth
      https://images.unsplash.com/photo-x
      Loading map…
    `
    const result = searchHtmlGate(html)
    expect(result.ok).toBe(false)
    expect(result.fails).toEqual([
      'market-truth-leftover',
      'leftover-true',
      'leftover-membership',
      'leftover-and-other-types',
      'market-truth-eyebrow',
      'unsplash',
      'loading-map',
    ])
  })
})
