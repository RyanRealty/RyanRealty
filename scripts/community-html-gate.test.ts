import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { communityHtmlGate } from './community-html-gate.mjs'

const FACE_TELLS = [
  /Market Truth leftover/i,
  /leftover\s*:\s*true/i,
  /leftover membership/i,
  /metric layer/i,
  /methodology v3/i,
  /Is [^\n<]{0,120}buyer(?:'|’|&rsquo;|&#39;|&#x27;|&apos;)s or seller(?:'|’|&rsquo;|&#39;|&#x27;|&apos;)s market\?/,
]

describe('communityHtmlGate', () => {
  it('passes a community face without leftover labels or the banned H2', () => {
    const html = `
      <h1>Eagle Crest homes for sale</h1>
      <p>Eagle Crest has 6.3 months of supply, which is a buyer's market.</p>
      <h2>How tight the market is</h2>
      <h2>Living in Eagle Crest</h2>
      <h2>Get new Eagle Crest listings by email</h2>
      <p>regional MLS through Oregon Data Share, the last 12 months</p>
    `
    expect(communityHtmlGate(html)).toEqual({ ok: true, fails: [] })
  })

  it('fails leftover, Market Truth leftover, leftover:true, leftover membership, metric layer, and buyer-seller H2s', () => {
    const html = `
      Market Truth leftover
      leftover:true
      leftover membership
      metric layer
      methodology v3
      Is Eagle Crest a buyer&#x27;s or seller&#x27;s market?
    `
    const result = communityHtmlGate(html)
    expect(result.ok).toBe(false)
    expect(result.fails).toEqual([
      'leftover',
      'market-truth-leftover',
      'leftover-true',
      'leftover-membership',
      'metric-layer',
      'methodology-v3',
      'buyer-seller-market-h2',
    ])
  })

  it('keeps leftover labels off the community face strings', () => {
    const page = readFileSync(resolve('app/communities/[slug]/page.tsx'), 'utf8')
    const field = readFileSync(resolve('app/communities/[slug]/_v3/CommunityHomesField.tsx'), 'utf8')
    const face = readFileSync(resolve('app/communities/[slug]/_v3/community-face.ts'), 'utf8')
    const opening = readFileSync(resolve('app/communities/[slug]/_v3/community-opening.ts'), 'utf8')
    for (const src of [field, face, opening]) {
      for (const tell of FACE_TELLS) {
        expect(src).not.toMatch(tell)
      }
    }
    expect(communityHtmlGate(field)).toEqual({ ok: true, fails: [] })
    expect(communityHtmlGate(face)).toEqual({ ok: true, fails: [] })
    expect(communityHtmlGate(opening)).toEqual({ ok: true, fails: [] })
    expect(page).toContain('${publicName} homes for sale')
    expect(page).toContain('How tight the market is')
    expect(page).toContain('<CommunityStage')
    expect(page).toContain('<CommunityHomesField')
    expect(page).toContain('Search ${publicName} homes')
    expect(page).not.toMatch(/Is \$\{publicName\} a buyer/)
    expect(page).not.toContain('V3PlacePropertyTypes')
    expect(field).toContain('listFirst')
    expect(field).toContain('mapToggle')
    expect(field).toContain('Property types')
  })
})
