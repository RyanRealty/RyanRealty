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

describe('market instruments open on a claim and a drawing', () => {
  it('leads with the capped figure row and folds the long tail, on city community region and the annual review', () => {
    for (const [name, src] of [
      ['city', city],
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

  it('draws MOS on the hub opening instrument, not two leftover tiles above the chart', () => {
    expect(hub).toMatch(/buildMosSupplyChart/)
    expect(hub).toMatch(/chart=\{mosChart \?\? regionChart\}/)
    expect(hub).toMatch(/label: v3Text\('a month of sales'\)/)
    expect(hub).toMatch(/chartFirst/)
  })

  it('does not retarget {city} homes for sale in market metadata keywords', () => {
    const start = geoMeta.indexOf('keywords:')
    expect(start).toBeGreaterThan(-1)
    const block = geoMeta.slice(start, start + 500)
    expect(block).not.toMatch(/homes for sale/)
    expect(geoMeta).not.toMatch(/\$\{geoName\} homes for sale/)
  })
})
