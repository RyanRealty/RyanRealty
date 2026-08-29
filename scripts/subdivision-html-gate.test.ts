import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { subdivisionHtmlGate } from './subdivision-html-gate.mjs'

const FACE_TELLS = [
  /Market Truth leftover/i,
  /leftover\s*:\s*true/i,
  /leftover membership/i,
  /\bplat\b/i,
  /Is [^\n<]{0,120}buyer(?:'|’|&rsquo;|&#39;|&#x27;|&apos;)s or seller(?:'|’|&rsquo;|&#39;|&#x27;|&apos;)s market\?/,
]

describe('subdivisionHtmlGate', () => {
  it('passes a subdivision face without leftover labels, plat, or the banned H2', () => {
    const html = `
      <h1>Homes for sale in Ridge At Eagle Crest</h1>
      <p>15 homes for sale now in Ridge At Eagle Crest</p>
      <h2>Around Ridge At Eagle Crest</h2>
      <h2>Ridge At Eagle Crest on record</h2>
      <h2>Closed single-family sales, Ridge At Eagle Crest.</h2>
      <p>Closed single-family sales, Ridge At Eagle Crest.</p>
      <p>historical listings here since 2021</p>
      <p>regional MLS through Oregon Data Share, the last 12 months</p>
    `
    expect(subdivisionHtmlGate(html)).toEqual({ ok: true, fails: [] })
  })

  it('fails leftover, Market Truth leftover, leftover:true, leftover membership, plat, and buyer-seller H2s', () => {
    const html = `
      Market Truth leftover
      leftover:true
      leftover membership
      The outline is the recorded Ridge At Eagle Crest plat boundary.
      Is Ridge At Eagle Crest a buyer&#x27;s or seller&#x27;s market?
    `
    const result = subdivisionHtmlGate(html)
    expect(result.ok).toBe(false)
    expect(result.fails).toEqual([
      'leftover',
      'market-truth-leftover',
      'leftover-true',
      'leftover-membership',
      'plat',
      'buyer-seller-market-h2',
    ])
  })

  it('keeps leftover labels and plat off the subdivision face strings', () => {
    const page = readFileSync(resolve('app/subdivisions/[slug]/page.tsx'), 'utf8')
    const field = readFileSync(resolve('app/subdivisions/[slug]/_v3/SubdivisionHomesField.tsx'), 'utf8')
    const face = readFileSync(resolve('app/subdivisions/[slug]/_v3/subdivision-face.ts'), 'utf8')
    const opening = readFileSync(resolve('app/subdivisions/[slug]/_v3/subdivision-opening.ts'), 'utf8')
    for (const src of [field, face]) {
      for (const tell of FACE_TELLS) {
        expect(src).not.toMatch(tell)
      }
    }
    expect(subdivisionHtmlGate(field)).toEqual({ ok: true, fails: [] })
    expect(subdivisionHtmlGate(face)).toEqual({ ok: true, fails: [] })
    expect(page).toContain('Homes for sale in ${displayName}')
    expect(page).toContain('<V3Stage')
    expect(page).toContain('<SubdivisionHomesField')
    expect(page).not.toContain('SubdivisionMarketCharts')
    expect(page).not.toContain('chart={salesChart}')
    expect(page).not.toMatch(/Is \$\{displayName\} a buyer/)
    expect(field).toContain('listFirst')
    expect(field).toContain('mapToggle')
    expect(field).toContain('subdivisionFaceFieldCount')
    expect(field).toContain('count={fieldCount')
    expect(opening).toContain('isListingStagePlatStill')
    expect(opening).toContain('unsplash')
  })
})
