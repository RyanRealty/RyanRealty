import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { neighborhoodHtmlGate } from './neighborhood-html-gate.mjs'

const FACE_TELLS = [
  /Market Truth/i,
  /Market Truth leftover/i,
  /Market Truth metric layer/i,
  /leftover\s*:\s*true/i,
  /leftover membership/i,
  /methodology v3/i,
  /Is [^\n<]{0,120}buyer(?:'|’|&rsquo;|&#39;|&#x27;|&apos;)s or seller(?:'|’|&rsquo;|&#39;|&#x27;|&apos;)s market\?/,
]

describe('neighborhoodHtmlGate', () => {
  it('passes a neighborhood face without leftover labels or the banned H2', () => {
    const html = `
      <h1>Awbrey Butte homes for sale</h1>
      <p>Awbrey Butte has 5.6 months of supply, which is a balanced market.</p>
      <h2>How tight the market is</h2>
      <h2>Awbrey Butte, in plain words</h2>
      <h2>Get new Bend listings by email</h2>
      <p>regional MLS through Oregon Data Share, the last 12 months</p>
    `
    expect(neighborhoodHtmlGate(html)).toEqual({ ok: true, fails: [] })
  })

  it('fails leftover, Market Truth leftover, leftover:true, leftover membership, and buyer-seller H2s', () => {
    const html = `
      Market Truth leftover
      leftover:true
      leftover membership
      methodology v3
      Is Awbrey Butte a buyer&#x27;s or seller&#x27;s market?
    `
    const result = neighborhoodHtmlGate(html)
    expect(result.ok).toBe(false)
    expect(result.fails).toEqual([
      'leftover',
      'market-truth',
      'market-truth-leftover',
      'leftover-true',
      'leftover-membership',
      'methodology-v3',
      'buyer-seller-market-h2',
    ])
  })

  it('fails Market Truth metric layer even without the leftover word', () => {
    const html =
      'Source: regional MLS through the Market Truth metric layer, Awbrey Butte townhomes. ' +
      'Source: regional MLS through the Market Truth metric layer, Awbrey Butte lots.'
    const result = neighborhoodHtmlGate(html)
    expect(result.ok).toBe(false)
    expect(result.fails).toContain('market-truth')
    expect(result.fails).toContain('market-truth-metric-layer')
  })

  it('keeps leftover labels off the neighborhood face strings', () => {
    const page = readFileSync(resolve('app/cities/[slug]/[neighborhoodSlug]/page.tsx'), 'utf8')
    const field = readFileSync(
      resolve('app/cities/[slug]/[neighborhoodSlug]/_v3/NeighborhoodHomesField.tsx'),
      'utf8',
    )
    const face = readFileSync(
      resolve('app/cities/[slug]/[neighborhoodSlug]/_v3/neighborhood-face.ts'),
      'utf8',
    )
    const opening = readFileSync(
      resolve('app/cities/[slug]/[neighborhoodSlug]/_v3/neighborhood-opening.ts'),
      'utf8',
    )
    const types = readFileSync(resolve('components/site/v3/V3PlacePropertyTypes.tsx'), 'utf8')
    for (const src of [field, face, opening, types]) {
      for (const tell of FACE_TELLS) {
        expect(src).not.toMatch(tell)
      }
    }
    expect(neighborhoodHtmlGate(field)).toEqual({ ok: true, fails: [] })
    expect(neighborhoodHtmlGate(face)).toEqual({ ok: true, fails: [] })
    expect(neighborhoodHtmlGate(opening)).toEqual({ ok: true, fails: [] })
    expect(neighborhoodHtmlGate(types)).toEqual({ ok: true, fails: [] })
    expect(types).toContain('Oregon Data Share')
    expect(page).not.toMatch(/Market Truth/i)
    expect(page).toContain('${neighborhood.name} homes for sale')
    expect(page).toContain('How tight the market is')
    expect(page).toContain('<V3Stage')
    expect(page).toContain('<NeighborhoodHomesField')
    expect(page).not.toMatch(/Is \$\{neighborhood\.name\} a buyer/)
    expect(field).toContain('listFirst')
    expect(field).toContain('mapToggle')
  })
})
