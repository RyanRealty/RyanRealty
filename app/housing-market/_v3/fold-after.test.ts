import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * A SOURCE ASSERTION MUST NOT MATCH A COMMENT (SITE-41).
 *
 * This suite used to read the raw file and match `foldAfter={0}`. When the market
 * openings moved off a full fold, the comment explaining WHY they moved contained the
 * string `foldAfter={0}` — and every assertion here went on passing against code that
 * no longer did any of it. A gate green for the wrong reason is worse than no gate.
 *
 * So every read strips block and line comments first, and what is left is the code.
 */
function code(path: string): string {
  return readFileSync(resolve(path), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:])\/\/.*$/gm, '$1')
}

const hub = code('app/housing-market/page.tsx')
const city = code('app/housing-market/[...slug]/_v3/city-view.tsx')
const community = code('app/housing-market/[...slug]/_v3/community-view.tsx')
const region = code('app/housing-market/central-oregon/page.tsx')
const annual = code('app/housing-market/annual-review/page.tsx')
const geoMeta = code('app/housing-market/[...slug]/page.tsx')
const geoTitleSrc = code('app/housing-market/[...slug]/_v3/geo-title.ts')

describe('market instruments open on a claim and a drawing', () => {
  it('leads with the capped figure row and folds the long tail, on city community region and the annual review', () => {
    expect(city).toMatch(/chartFirst/)
    // SITE-102: fold every KPI tile when MOS, the year overlay, or InsightCards
    // is carrying the answer. MARKET_LEAD_FIGURES stays the degraded opening.
    expect(city).toMatch(
      /foldAfter=\{placeMos \|\| chart \|\| hasInsight \? 0 : MARKET_LEAD_FIGURES\}/,
    )
    expect(city).not.toMatch(/foldAfter=\{0\}/)
    for (const [name, src] of [
      ['community', community],
      ['region', region],
      ['annual review', annual],
    ] as const) {
      expect(src, name).toMatch(/chartFirst/)
      expect(src, name).toMatch(
        /foldAfter=\{(MARKET_LEAD_FIGURES|CLOSED_LEAD_FIGURES|REGION_LEAD_FIGURES)\}/,
      )
      expect(src, name).not.toMatch(/foldAfter=\{0\}/)
    }
  })

  it('names what every fold reveals, and never names a count', () => {
    for (const [name, src] of [
      ['hub', hub],
      ['city', city],
      ['community', community],
      ['region', region],
      ['annual review', annual],
    ] as const) {
      // Every instrument that folds says what is behind the fold. The default summary
      // is "All {n} figures", which reads as a database row count and tells a reader
      // nothing about whether they want it.
      expect(src, name).toMatch(/foldLabel=/)
      // The LABEL TEXT only. Matching the whole expression would test `v3Text`,
      // whose own name carries a 3 — the second time in this file that a source
      // assertion nearly graded something other than the thing it names.
      for (const [, label] of src.matchAll(/foldLabel=\{v3Text\('([^']+)'\)\}/g)) {
        expect(label, name).not.toMatch(/\d/)
      }
    }
  })

  it('SITE-88/101/103/100 year isolate: annual keeps the year pager, hub and region hand it to InsightCards', () => {
    // SITE-103 / SITE-100. The opening mounts the beautifului InsightCards
    // pager in the same fold as the long-view chart. Two pagers a hand's width
    // apart — one stepping years, one stepping claims — read as one broken
    // control, and the 2026-09-13 judge named the year chips as exactly that.
    // So the chart's own year pager is OFF on these routes, explicitly rather
    // than by omission. Nothing is lost: all three years still draw, each with
    // its marks, its hover and its legend toggle.
    expect(region).toMatch(/yearPages:\s*false/)
    expect(region).toMatch(/RegionInsight/)
    expect(hub).toMatch(/yearPages:\s*false/)
    expect(hub).toMatch(/HubInsight/)
    expect(annual).toMatch(/yearPages:\s*true/)
    expect(city).toMatch(/CityInsight/)
    expect(city).not.toMatch(/yearPages/)
  })

  it('SITE-178: city fold mounts MOS bars before InsightCards so a phone can read the two bars', () => {
    const drawing = city.slice(city.indexOf('drawing='))
    expect(drawing.indexOf('<V3MosBars')).toBeGreaterThan(-1)
    expect(drawing.indexOf('<V3MosBars')).toBeLessThan(drawing.indexOf('<CityInsight'))
  })

  it('draws MOS as V3MosBars on the hub opening, not two leftover tiles above the chart', () => {
    expect(hub).toMatch(/buildRegionPlaceMos/)
    expect(hub).toMatch(/V3MosBars/)
    expect(hub).toMatch(/HubInsight/)
    expect(hub).toMatch(/chartFirst/)
    expect(hub).toMatch(/foldAfter=\{HUB_LEAD_FIGURES\}/)
    expect(hub).not.toMatch(/foldAfter=\{0\}/)
    expect(hub).not.toMatch(/buildMosSupplyChart/)
  })

  it('does not retarget {city} homes for sale in market metadata keywords', () => {
    const start = geoMeta.indexOf('keywords:')
    expect(start).toBeGreaterThan(-1)
    const block = geoMeta.slice(start, start + 500)
    expect(block).not.toMatch(/homes for sale/)
    expect(geoMeta).not.toMatch(/\$\{geoName\} homes for sale/)
  })

  it('SITE-173: geo document title is the helper, not an inventory phrase', () => {
    expect(geoMeta).toMatch(/from '\.\/_v3\/geo-title'/)
    expect(geoMeta).not.toMatch(/function geoTitle/)
    const titleCall = geoMeta.slice(geoMeta.indexOf('title: geoTitle'), geoMeta.indexOf('title: geoTitle') + 220)
    expect(titleCall).toMatch(/title: geoTitle\(\{ geoName, datasetVariables: data\.datasetVariables \}\)/)
    expect(titleCall).not.toMatch(/homes for sale/)
    expect(geoTitleSrc).toMatch(/housing market/)
    expect(geoTitleSrc).toMatch(/months of supply/)
    expect(geoTitleSrc).not.toMatch(/homes for sale/)
    expect(geoTitleSrc).not.toMatch(/active listings/)
  })
})
