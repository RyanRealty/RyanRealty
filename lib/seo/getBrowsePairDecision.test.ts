import { beforeEach, describe, expect, it, vi } from 'vitest'

const inventory = vi.fn()
const indexable = vi.fn()
const platCounts = vi.fn()

vi.mock('@/lib/data/subdivisions/getSubdivisionCityInventory', () => ({
  getSubdivisionCityInventory: () => inventory(),
}))
vi.mock('@/lib/data/subdivisions/getIndexableSubdivisions', () => ({
  getIndexableSubdivisions: () => indexable(),
}))
vi.mock('@/lib/data/subdivisions/getPlatClosedCounts', () => ({
  getPlatClosedCounts: () => platCounts(),
}))

import {
  buildBrowsePairIndex,
  buildCityPlatIndex,
  cityPlatFor,
  communityForPair,
  getBrowsePairDecision,
  getBrowsePairSitemapPaths,
} from './getBrowsePairDecision'

const row = (standard_status: string, n: number) => ({ subdivision_name: 'x', standard_status, n })

const MV = [
  // bend/cambria: 22 closed, nothing for sale -> sold-history, emitted
  { cityLower: 'bend', subdivisionName: 'Cambria', rows: [row('Closed', 22), row('Expired', 3), row('Canceled', 4)] },
  // bend/boulevard: indexable plat twin
  { cityLower: 'bend', subdivisionName: 'Boulevard', rows: [row('Closed', 40), row('Active', 1)] },
  // bend/amundson: 7 closed, none for sale -> thin
  { cityLower: 'bend', subdivisionName: 'Amundson', rows: [row('Closed', 7)] },
  // bend/aspenb: an MLS code -> withheld
  { cityLower: 'bend', subdivisionName: 'AspenB', rows: [row('Closed', 40)] },
  // two spellings of one slug in one city are one URL
  { cityLower: 'la pine', subdivisionName: 'Forest View Est', rows: [row('Closed', 2), row('Active', 1)] },
  { cityLower: 'la pine', subdivisionName: 'FOREST VIEW EST', rows: [row('Closed', 9), row('Active Under Contract', 2), row('Pending', 5)] },
  // bend/tetherow: registry community
  { cityLower: 'bend', subdivisionName: 'Tetherow', rows: [row('Closed', 300), row('Active', 12)] },
  // an out-of-list city never reaches the sitemap leg
  { cityLower: 'medford', subdivisionName: 'Somewhere', rows: [row('Closed', 99)] },
]

beforeEach(() => {
  inventory.mockReset().mockResolvedValue(MV)
  indexable.mockReset().mockResolvedValue([{ slug: 'boulevard', name: 'Boulevard', citySlug: 'bend', closedCount: 40 }])
  platCounts.mockReset().mockResolvedValue([
    { slug: 'boulevard', label: 'Boulevard', topCityLower: 'bend' },
    { slug: 'amundson', label: 'Amundson Addition', topCityLower: 'bend' },
    { slug: 'cambria', label: 'Cambria', topCityLower: null },
  ])
})

describe('buildBrowsePairIndex', () => {
  it('counts closed and active per (city slug, area slug), merging spellings of one slug', () => {
    const index = buildBrowsePairIndex(MV)
    expect(index.get('bend/cambria')).toEqual({ mlsName: 'Cambria', closedLifetime: 22, activeNow: 0 })
    // Active + Active Under Contract only (PUBLIC_ACTIVE_STATUSES); Pending is not "for sale now".
    expect(index.get('la-pine/forest-view-est')).toEqual({ mlsName: 'FOREST VIEW EST', closedLifetime: 11, activeNow: 3 })
  })
})

describe('cityPlatFor — the recorded plat that is this pair\'s place', () => {
  const cityPlats = buildCityPlatIndex([
    { slug: 'north-rim', label: 'North Rim', topCityLower: 'redmond' },
    { slug: 'deschutes-river-woods', label: 'Deschutes River Woods', topCityLower: 'bend' },
    { slug: 'la-pine', label: 'La Pine', topCityLower: 'la pine' },
    { slug: 'west-ridge', label: 'West Ridge', topCityLower: 'bend' },
    { slug: 'westridge', label: 'Westridge', topCityLower: 'bend' },
    { slug: 'no-city', label: 'No City', topCityLower: null },
  ])

  it('never matches a plat in another city', () => {
    expect(cityPlatFor(cityPlats, 'bend', 'north-rim')).toBeNull()
    expect(cityPlatFor(cityPlats, 'redmond', 'north-rim')).toEqual({ slug: 'north-rim', label: 'North Rim' })
  })

  it('matches across a word break, in the MV city spelling', () => {
    expect(cityPlatFor(cityPlats, 'bend', 'deschutes-riverwoods')?.slug).toBe('deschutes-river-woods')
    expect(cityPlatFor(cityPlats, 'la-pine', 'lapine')?.slug).toBe('la-pine')
  })

  it('prefers the exact slug and refuses an ambiguous word-break match', () => {
    expect(cityPlatFor(cityPlats, 'bend', 'westridge')?.slug).toBe('westridge')
    expect(cityPlatFor(cityPlats, 'bend', 'west-ridge')?.slug).toBe('west-ridge')
    expect(cityPlatFor(cityPlats, 'bend', 'w-estridge')).toBeNull()
  })

  it('a plat with no city is nobody\'s place', () => {
    expect(cityPlatFor(cityPlats, 'bend', 'no-city')).toBeNull()
  })
})

describe('communityForPair', () => {
  it('matches a registry community in its own city or an MLS city it files under', () => {
    expect(communityForPair('bend', 'tetherow')?.publicSlug).toBe('tetherow')
    expect(communityForPair('sunriver', 'caldera-springs')?.label).toBe('Caldera Springs')
    // Caldera Springs lists under MLS City Bend (mls_cities).
    expect(communityForPair('bend', 'caldera-springs')?.label).toBe('Caldera Springs')
    expect(communityForPair('redmond', 'tetherow')).toBeNull()
  })
})

describe('getBrowsePairDecision (page)', () => {
  it('refuses two garbage areas under two cities without an active-name hit', async () => {
    for (const [city, area] of [['bend', 'p1-fixagent-garbage-91'], ['prineville', 'p1-no-such-place']] as const) {
      const lookup = vi.fn().mockResolvedValue(null)
      const { decision } = await getBrowsePairDecision(city, area, lookup)
      expect(decision.kind).toBe('unresolved')
      expect(lookup).toHaveBeenCalledTimes(1)
    }
  })

  it('skips the active-name lookup when the MV already knows the pair', async () => {
    const lookup = vi.fn().mockResolvedValue('Cambria')
    const { decision } = await getBrowsePairDecision('bend', 'cambria', lookup)
    expect(decision.kind).toBe('sold-history')
    expect(lookup).not.toHaveBeenCalled()
  })

  it('matches the plat of THIS city only; a plat with no city matches nothing', async () => {
    const boulevard = await getBrowsePairDecision('bend', 'boulevard', async () => null)
    expect(boulevard.facts.cityPlat).toEqual({ slug: 'boulevard', label: 'Boulevard' })
    expect(boulevard.decision.kind).toBe('plat-twin')
    const cambria = await getBrowsePairDecision('bend', 'cambria', async () => null)
    expect(cambria.facts.cityPlat).toBeNull()
    // The exact-slug label still reaches the refusal door, which is city-blind.
    expect(cambria.facts.platLabel).toBe('Cambria')
  })

  it('treats a failed inventory read as unknown, never as a refusal', async () => {
    inventory.mockResolvedValue([])
    const { decision } = await getBrowsePairDecision('bend', 'cambria', async () => null)
    expect(decision.kind).toBe('unknown')
  })
})

describe('getBrowsePairSitemapPaths (sitemap) — the same decision', () => {
  it('emits only sold-history pairs of the listed cities', async () => {
    const paths = await getBrowsePairSitemapPaths(['bend', 'la-pine'])
    expect(paths).toEqual(['/homes-for-sale/bend/cambria', '/homes-for-sale/la-pine/forest-view-est'])
    // Not the plat twin, not the thin pair, not the MLS code, not the community.
    for (const dropped of ['boulevard', 'amundson', 'aspenb', 'tetherow']) {
      expect(paths).not.toContain(`/homes-for-sale/bend/${dropped}`)
    }
  })

  it('emits nothing when the inventory read failed (thinner sitemap, never a fabricated one)', async () => {
    inventory.mockResolvedValue([])
    expect(await getBrowsePairSitemapPaths(['bend'])).toEqual([])
  })
})
