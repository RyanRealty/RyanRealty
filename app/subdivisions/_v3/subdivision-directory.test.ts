import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { derivePlatFamilies, type FamilyPlatInput } from '@/lib/market/plat-family'
import { buildIndexableSubdivisions, type PlatClosedCount } from '@/lib/data/subdivisions/subdivision-index'
import { buildSubdivisionDirectory, directoryHrefs } from './subdivision-directory'

const plats: FamilyPlatInput[] = [
  { slug: 'ridge-at-eagle-crest-5', label: 'Ridge At Eagle Crest 5', citySlug: 'redmond', closedCount: 31 },
  { slug: 'ridge-at-eagle-crest-36', label: 'Ridge At Eagle Crest 36', citySlug: 'redmond', closedCount: 207 },
  { slug: 'ridge-at-eagle-crest-40', label: 'Ridge At Eagle Crest 40', citySlug: 'redmond', closedCount: 4 },
  { slug: 'tetherow-crossing', label: 'Tetherow Crossing', citySlug: 'redmond', closedCount: 440 },
  { slug: 'tetherow-crossing-phase-ii', label: 'Tetherow Crossing Phase II', citySlug: 'redmond', closedCount: 104 },
  { slug: 'tetherow-phase-1', label: 'Tetherow Phase 1', citySlug: 'bend', closedCount: 983 },
  { slug: 'tetherow-phase-3', label: 'Tetherow Phase 3', citySlug: 'bend', closedCount: 133 },
  { slug: 'park-addition', label: 'Park Addition', citySlug: 'bend', closedCount: 40 },
  { slug: 'bartel-addition', label: 'Bartel Addition', citySlug: 'redmond', closedCount: 10 },
]
const counts: PlatClosedCount[] = plats.map((p) => ({
  slug: p.slug,
  label: p.label,
  closedCount: p.closedCount,
  closedInPolygon: p.closedCount,
  closedByName: 0,
  closedCountSfr: p.closedCount,
  topCityLower: p.citySlug,
  lastCloseDate: null,
  closedByYear: {},
}))
const families = derivePlatFamilies({
  plats,
  communities: [
    { slug: 'tetherow', label: 'Tetherow', citySlug: 'bend', aliases: ['Tetherow'] },
    { slug: 'eagle-crest', label: 'Eagle Crest', citySlug: 'redmond', aliases: ['Ridge At Eagle Crest'] },
  ],
})
const indexable = buildIndexableSubdivisions(new Set(plats.map((p) => p.slug)), counts, undefined, { families })
const groups = buildSubdivisionDirectory({ indexable, families })

describe('buildSubdivisionDirectory (SEO-4 / EXP-3)', () => {
  it('anchors every page the sitemap submits: no indexable subdivision is an orphan', () => {
    const hrefs = directoryHrefs(groups)
    for (const row of indexable) expect(hrefs.has(`/subdivisions/${row.slug}`)).toBe(true)
  })

  it('nests every phase under its family, including the ones below the index floor', () => {
    const redmond = groups.find((g) => g.key === 'redmond')!
    const ridge = redmond.entries.find((e) => e.href === '/subdivisions/ridge-at-eagle-crest')!
    expect(ridge.name).toBe('Ridge at Eagle Crest')
    expect(ridge.children?.map((c) => c.href)).toEqual([
      '/subdivisions/ridge-at-eagle-crest-5',
      '/subdivisions/ridge-at-eagle-crest-36',
      '/subdivisions/ridge-at-eagle-crest-40',
    ])
    // A phase is never also a standalone row.
    expect(redmond.entries.some((e) => e.href === '/subdivisions/ridge-at-eagle-crest-36')).toBe(false)
  })

  it('makes a recorded head plat the family row, never its own child', () => {
    const redmond = groups.find((g) => g.key === 'redmond')!
    const crossing = redmond.entries.find((e) => e.href === '/subdivisions/tetherow-crossing')!
    expect(crossing.children?.map((c) => c.href)).toEqual(['/subdivisions/tetherow-crossing-phase-ii'])
  })

  it('sends a community-owned family to its community page', () => {
    const bend = groups.find((g) => g.key === 'bend')!
    const tetherow = bend.entries.find((e) => e.name === 'Tetherow')!
    expect(tetherow.href).toBe('/communities/tetherow')
    expect(tetherow.children).toHaveLength(2)
  })

  it('lists a plain subdivision by name', () => {
    const bend = groups.find((g) => g.key === 'bend')!
    expect(bend.entries.some((e) => e.href === '/subdivisions/park-addition' && !e.children)).toBe(true)
  })
})

describe('the /subdivisions page renders the whole directory', () => {
  it('builds the directory from the indexable set and the families', () => {
    const page = readFileSync(join(process.cwd(), 'app/subdivisions/page.tsx'), 'utf8')
    expect(page).toMatch(/buildSubdivisionDirectory\(\{ indexable: indexablePlats, families: platFamilies \}\)/)
    expect(page).toMatch(/<V3PlaceDirectory[\s\S]{0,800}groups=\{directoryGroups\}/)
  })
})
