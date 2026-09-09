import { describe, expect, it } from 'vitest'
import {
  SUBDIVISION_INDEX_MIN_LIFETIME_SALES,
  buildIndexableSubdivisions,
  subdivisionDetailPath,
  subdivisionLlmsLines,
  subdivisionSitemapUrls,
  type PlatClosedCount,
} from './subdivision-index'

const BOUNDARY_SLUGS = new Set([
  'tetherow-phase-5',
  'awbrey-glen',
  'obsidian-meadows',
  'river-canyon-estates',
  'golf-homes-at-tetherow',
])

/**
 * Build plat rows the way getPlatClosedCounts hands them over. The tuple is
 * [platSlug, platLabel, closedCount, topCityLower]; the polygon/name split
 * defaults to "all from the polygon" and is overridden where a test is about
 * the split itself.
 */
function plats(
  rows: Array<[string, string, number, string | null]>,
  overrides: Partial<Record<string, Partial<PlatClosedCount>>> = {},
): PlatClosedCount[] {
  return rows.map(([slug, label, closedCount, topCityLower]) => ({
    slug,
    label,
    closedCount,
    closedInPolygon: closedCount,
    closedByName: 0,
    closedCountSfr: closedCount,
    topCityLower,
    lastCloseDate: null,
    closedByYear: {},
    ...(overrides[slug] ?? {}),
  }))
}

describe('SUBDIVISION_INDEX_MIN_LIFETIME_SALES', () => {
  it('is pinned at 10 lifetime closed sales', () => {
    expect(SUBDIVISION_INDEX_MIN_LIFETIME_SALES).toBe(10)
  })
})

describe('buildIndexableSubdivisions', () => {
  it('requires BOTH a GIS polygon and the closed-sales threshold', () => {
    const out = buildIndexableSubdivisions(
      BOUNDARY_SLUGS,
      plats([
        ['tetherow-phase-5', 'Tetherow Phase 5', 25, 'bend'], // polygon + above threshold -> in
        ['awbrey-glen', 'Awbrey Glen', 9, 'bend'], // polygon but below threshold -> out
        ['no-polygon-estates', 'No Polygon Estates', 500, 'bend'], // above threshold, polygon withdrawn -> out
      ]),
    )
    expect(out.map((s) => s.slug)).toEqual(['tetherow-phase-5'])
  })

  it('includes a plat exactly at the threshold (>=, not >)', () => {
    const out = buildIndexableSubdivisions(
      BOUNDARY_SLUGS,
      plats([['awbrey-glen', 'Awbrey Glen', SUBDIVISION_INDEX_MIN_LIFETIME_SALES, 'bend']]),
    )
    expect(out.map((s) => s.slug)).toEqual(['awbrey-glen'])
  })

  /**
   * THE SITE-24 CASE. A sub-plat of a resort carries ZERO sales under its own
   * MLS name — every home inside it is listed as "Broken Top" or "Tetherow" —
   * so the name join scored it zero against any nonzero floor forever. The
   * polygon attribution is what clears the floor, and the floor did not move.
   */
  it('indexes a sub-plat whose sales are ALL attributed by polygon and none by name', () => {
    const out = buildIndexableSubdivisions(
      BOUNDARY_SLUGS,
      plats([['golf-homes-at-tetherow', 'Golf Homes At Tetherow', 107, 'bend']], {
        'golf-homes-at-tetherow': { closedInPolygon: 107, closedByName: 0 },
      }),
    )
    expect(out).toHaveLength(1)
    expect(out[0]).toMatchObject({
      slug: 'golf-homes-at-tetherow',
      name: 'Golf Homes At Tetherow',
      citySlug: 'bend',
      closedCount: 107,
    })
  })

  /**
   * The other half of the same rule. Outcrop's plat is real but six of its
   * closed sales share one builder geocode outside the polygon, so the polygon
   * alone scores it 8. The union keeps it indexed. A pure polygon join would
   * have taken an already-indexed page's index slot away.
   */
  it('keeps a plat indexed on the union when the polygon alone would fall under the floor', () => {
    const out = buildIndexableSubdivisions(
      BOUNDARY_SLUGS,
      plats([['obsidian-meadows', 'Obsidian Meadows', 20, 'la-pine']], {
        'obsidian-meadows': { closedInPolygon: 8, closedByName: 20 },
      }),
    )
    expect(out.map((s) => s.slug)).toEqual(['obsidian-meadows'])
  })

  it('uses the recorded plat label as the display name, not the MLS name', () => {
    const out = buildIndexableSubdivisions(
      BOUNDARY_SLUGS,
      plats([['river-canyon-estates', 'River Canyon Estates', 11, 'redmond']]),
    )
    expect(out[0]).toMatchObject({ name: 'River Canyon Estates', citySlug: 'redmond' })
  })

  /**
   * §0: an unknown city is absent, never a place called Unknown. slugify()
   * returns the literal 'unknown' for an empty string, and the page titles read
   * "… | <City>, Oregon" straight off this field.
   */
  it('leaves citySlug empty rather than naming a city the data did not give', () => {
    const out = buildIndexableSubdivisions(
      BOUNDARY_SLUGS,
      plats([
        ['awbrey-glen', 'Awbrey Glen', 12, null],
        ['tetherow-phase-5', 'Tetherow Phase 5', 12, '   '],
      ]),
    )
    expect(out.map((s) => s.citySlug)).toEqual(['', ''])
  })

  it('slugifies a multi-word MLS city into the page-title slug', () => {
    const out = buildIndexableSubdivisions(
      BOUNDARY_SLUGS,
      plats([['awbrey-glen', 'Awbrey Glen', 32, 'black butte ranch']]),
    )
    expect(out[0].citySlug).toBe('black-butte-ranch')
  })

  it('drops the n-a and unknown sentinel slugs', () => {
    const out = buildIndexableSubdivisions(
      new Set(['n-a', 'unknown', ...BOUNDARY_SLUGS]),
      plats([
        ['n-a', 'N/A', 100, 'bend'],
        ['unknown', 'Unknown', 100, 'bend'],
      ]),
    )
    expect(out).toEqual([])
  })

  it('counts a duplicated plat row once, never summed into a doubled count', () => {
    const out = buildIndexableSubdivisions(
      BOUNDARY_SLUGS,
      plats([
        ['tetherow-phase-5', 'Tetherow Phase 5', 12, 'bend'],
        ['tetherow-phase-5', 'Tetherow Phase 5', 12, 'bend'],
      ]),
    )
    expect(out).toHaveLength(1)
    expect(out[0].closedCount).toBe(12)
  })

  it('returns a stable slug-sorted list', () => {
    const out = buildIndexableSubdivisions(
      BOUNDARY_SLUGS,
      plats([
        ['tetherow-phase-5', 'Tetherow Phase 5', 20, 'bend'],
        ['awbrey-glen', 'Awbrey Glen', 20, 'bend'],
        ['obsidian-meadows', 'Obsidian Meadows', 20, 'redmond'],
      ]),
    )
    expect(out.map((s) => s.slug)).toEqual([
      'awbrey-glen',
      'obsidian-meadows',
      'tetherow-phase-5',
    ])
  })
})

describe('sitemap <-> llms.txt parity', () => {
  const subs = buildIndexableSubdivisions(
    BOUNDARY_SLUGS,
    plats([
      ['tetherow-phase-5', 'Tetherow Phase 5', 25, 'bend'],
      ['awbrey-glen', 'Awbrey Glen', 12, 'bend'],
      ['obsidian-meadows', 'Obsidian Meadows', 10, 'la-pine'],
    ]),
  )

  it('fixture produces a non-trivial indexable set (parity below is not vacuous)', () => {
    expect(subs.length).toBeGreaterThanOrEqual(3)
  })

  it('both surfaces emit exactly the same URL set from the same list', () => {
    const base = 'https://ryan-realty.com'
    const sitemapUrls = subdivisionSitemapUrls(subs, base)
    const llmsUrls = subdivisionLlmsLines(subs, base).map((line) => {
      // "- Name (City): https://..." -> the URL is everything after the last ': http'
      const m = line.match(/(https?:\/\/\S+)$/)
      return m ? m[1] : ''
    })
    expect(new Set(llmsUrls)).toEqual(new Set(sitemapUrls))
    expect(llmsUrls).toHaveLength(sitemapUrls.length)
  })

  it('every URL is a /subdivisions/[slug] detail path', () => {
    for (const url of subdivisionSitemapUrls(subs, 'https://ryan-realty.com')) {
      expect(url).toMatch(/^https:\/\/ryan-realty\.com\/subdivisions\/[a-z0-9-]+$/)
    }
  })

  it('normalizes a trailing-slash base URL identically on both surfaces', () => {
    const a = subdivisionSitemapUrls(subs, 'https://ryan-realty.com/')
    const b = subdivisionSitemapUrls(subs, 'https://ryan-realty.com')
    expect(a).toEqual(b)
    const la = subdivisionLlmsLines(subs, 'https://ryan-realty.com/')
    const lb = subdivisionLlmsLines(subs, 'https://ryan-realty.com')
    expect(la).toEqual(lb)
  })

  it('llms lines label the city in title case', () => {
    const lines = subdivisionLlmsLines(subs, 'https://ryan-realty.com')
    const obsidian = lines.find((l) => l.includes('/subdivisions/obsidian-meadows'))
    expect(obsidian).toContain('(La Pine)')
  })

  it('llms lines omit the parenthetical entirely when the city is unknown', () => {
    const cityless = buildIndexableSubdivisions(
      BOUNDARY_SLUGS,
      plats([['awbrey-glen', 'Awbrey Glen', 12, null]]),
    )
    const [line] = subdivisionLlmsLines(cityless, 'https://ryan-realty.com')
    expect(line).toBe('- Awbrey Glen: https://ryan-realty.com/subdivisions/awbrey-glen')
    expect(line).not.toContain('(')
  })
})

describe('subdivisionDetailPath', () => {
  it('builds the canonical detail path', () => {
    expect(subdivisionDetailPath('awbrey-glen')).toBe('/subdivisions/awbrey-glen')
  })
})
