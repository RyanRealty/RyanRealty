import { describe, expect, it } from 'vitest'
import { isResilientMarketFaq } from './kb-market-faq-resilience.mjs'

const strip = (s) => s.replace(/(^|[^:])\/\/.*$/gm, '$1').replace(/\/\*[\s\S]*?\*\//g, '')
const check = (src) => isResilientMarketFaq(src, strip(src))

describe('G52 market JSON-LD resilience', () => {
  it('FAILS the regression it exists to catch: JSON-LD vanishes on a miss', () => {
    expect(check(`const faq = pulse ? buildMarketFaq(city, pulse) : null`)).toBe(false)
  })

  it('comment prose cannot satisfy the branch arm', () => {
    expect(
      check(`// falls back: pulse ? buildMarketFaq(c, pulse) : buildSnapshotFaq(c)\nconst faq = pulse ? buildMarketFaq(c, pulse) : null`),
    ).toBe(false)
  })

  it('comment prose cannot satisfy the market-truth arm', () => {
    expect(
      check(`// input carries source: 'market-truth'\nconst faq = hud ? buildMarketFaq(c, input) : null`),
    ).toBe(false)
  })

  // KNOWN AND DELIBERATE: the two legacy pulse arms read the RAW source, so
  // `pulse ?? { ... }` inside a comment satisfies them. Widening 2026-08-12 kept
  // them text-based on purpose — "no page that passes today starts failing" —
  // and tightening them now would fail pages unrelated to this change. Pinned
  // here so the looseness is a recorded decision rather than a silent hole.
  it('legacy pulse arms are text-based on purpose', () => {
    expect(
      check(`// falls back to the snapshot: pulse ?? { activeCount }\nconst faq = pulse ? buildMarketFaq(c, pulse) : null`),
    ).toBe(true)
  })

  it('FAILS market-truth prose without an unconditional call', () => {
    expect(check(`const src = "market-truth"\nconst faq = row ? buildMarketFaq(c, row) : undefined`)).toBe(false)
  })

  it('passes the KB nullish shape', () => {
    expect(check(`const faq = buildMarketFaq(city, pulse ?? { activeCount: snap.active })`)).toBe(true)
  })

  it('passes the branch-to-builder shape', () => {
    expect(check(`const faq = pulse ? buildMarketFaq(city, pulse) : buildSnapshotFaq(city, snap)`)).toBe(true)
  })

  it('passes the market-truth unconditional shape (D26)', () => {
    const src = `
      const marketFaqInput = { grain: 'city', source: 'market-truth', activeCount: hud.active, refreshedAt: leftoverStamp }
      const { faqs, datasetVariables } = buildMarketFaq(cityName, marketFaqInput)
    `
    expect(check(src)).toBe(true)
  })

  it('does not let market-truth prose rescue a vanishing call', () => {
    const src = `
      const marketFaqInput = { grain: 'city', source: 'market-truth', activeCount: hud.active }
      const faqs = hud.active ? buildMarketFaq(cityName, marketFaqInput) : null
    `
    expect(check(src)).toBe(false)
  })
})
