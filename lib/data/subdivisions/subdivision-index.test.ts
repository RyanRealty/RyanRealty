import { describe, expect, it } from 'vitest'
import {
  SUBDIVISION_INDEX_MIN_LIFETIME_SALES,
  buildIndexableSubdivisions,
  subdivisionDetailPath,
  subdivisionLlmsLines,
  subdivisionSitemapUrls,
  type CitySubdivisionCounts,
} from './subdivision-index'

const BOUNDARY_SLUGS = new Set([
  'tetherow-phase-5',
  'awbrey-glen',
  'obsidian-meadows',
  'river-canyon-estates',
])

function counts(rows: Array<[string, string, number]>): CitySubdivisionCounts[] {
  // rows: [citySlug, subdivisionName, closed]
  const byCity = new Map<string, CitySubdivisionCounts>()
  for (const [citySlug, name, closed] of rows) {
    const bucket = byCity.get(citySlug) ?? { citySlug, rows: [] }
    bucket.rows.push({ subdivision_name: name, active: 0, pending: 0, closed })
    byCity.set(citySlug, bucket)
  }
  return [...byCity.values()]
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
      counts([
        ['bend', 'Tetherow Phase 5', 25], // polygon + above threshold -> in
        ['bend', 'Awbrey Glen', 9], // polygon but below threshold -> out
        ['bend', 'No Polygon Estates', 500], // above threshold but no polygon -> out
      ]),
    )
    expect(out.map((s) => s.slug)).toEqual(['tetherow-phase-5'])
  })

  it('includes a plat exactly at the threshold (>=, not >)', () => {
    const out = buildIndexableSubdivisions(
      BOUNDARY_SLUGS,
      counts([['bend', 'Awbrey Glen', SUBDIVISION_INDEX_MIN_LIFETIME_SALES]]),
    )
    expect(out.map((s) => s.slug)).toEqual(['awbrey-glen'])
  })

  it('sums closed sales across cities for the same slug and keeps the best city', () => {
    const out = buildIndexableSubdivisions(
      BOUNDARY_SLUGS,
      counts([
        ['bend', 'River Canyon Estates', 4],
        ['redmond', 'River Canyon Estates', 7],
      ]),
    )
    expect(out).toHaveLength(1)
    expect(out[0]).toMatchObject({
      slug: 'river-canyon-estates',
      closedCount: 11,
      citySlug: 'redmond', // 7 > 4 — the larger contributor names the city
    })
  })

  it('drops N/A, empty, and unknown-slug subdivision names', () => {
    const out = buildIndexableSubdivisions(
      new Set(['n-a', 'unknown', ...BOUNDARY_SLUGS]),
      counts([
        ['bend', 'N/A', 100],
        ['bend', '   ', 100],
        ['bend', '///', 100], // slugifies to 'unknown'
      ]),
    )
    expect(out).toEqual([])
  })

  it('normalizes casing/punctuation variants of one plat into a single slug', () => {
    const out = buildIndexableSubdivisions(
      BOUNDARY_SLUGS,
      counts([
        ['bend', 'Tetherow Phase 5', 6],
        ['bend', 'TETHEROW  PHASE 5', 6],
      ]),
    )
    expect(out).toHaveLength(1)
    expect(out[0]).toMatchObject({ slug: 'tetherow-phase-5', closedCount: 12 })
  })

  it('returns a stable slug-sorted list', () => {
    const out = buildIndexableSubdivisions(
      BOUNDARY_SLUGS,
      counts([
        ['bend', 'Tetherow Phase 5', 20],
        ['bend', 'Awbrey Glen', 20],
        ['redmond', 'Obsidian Meadows', 20],
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
    counts([
      ['bend', 'Tetherow Phase 5', 25],
      ['bend', 'Awbrey Glen', 12],
      ['la-pine', 'Obsidian Meadows', 10],
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
})

describe('subdivisionDetailPath', () => {
  it('builds the canonical detail path', () => {
    expect(subdivisionDetailPath('awbrey-glen')).toBe('/subdivisions/awbrey-glen')
  })
})
