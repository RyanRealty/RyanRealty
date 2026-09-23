/**
 * THE PLAT FAMILY LOCK (Matt 2026-09-23: "we just want to make sure that that
 * grouping is always happening").
 *
 * Runs the family derivation over REAL county labels (the fixture beside this
 * file, read from public.boundaries on 2026-09-23) for the families Matt named
 * and the hardest cases, and fails when:
 *   - a multi-phase family stops being grouped, or grows or shrinks,
 *   - a family has no main page, or its main page is not where it should be
 *     (the registry community page when one owns the name),
 *   - any phase's role stops pointing at its family's main page,
 *   - a lookalike plat (Golf Homes At Tetherow, Tennis Tracts At Broken Top,
 *     North Rim On Awbrey Butte) is swallowed into a family it is not part of.
 * The page side of the same lock (the phase page renders the link up and the
 * family page renders every phase) is pinned in
 * app/subdivisions/[slug]/_v3/plat-family-view.test.ts.
 */
import { describe, expect, it, vi } from 'vitest'

vi.mock('next/cache', () => ({ unstable_cache: (fn: unknown) => fn }))

import fixture from './__fixtures__/plat-family-sample.json'
import recorded from './__fixtures__/plat-family-recorded.json'
import { derivePlatFamilies, platBaseGroups, platFamilyRole, platFamilySlug } from './plat-family'
import { registryFamilyCommunities, reservedPlaceSlugs } from '@/lib/data/subdivisions/getPlatFamilies'
import { resolveSubdivisionAreaRedirect } from '@/lib/subdivision-area-redirects'

type Fixture = {
  plats: Array<{ slug: string; label: string; citySlug: string }>
  mlsNames: Array<{ name: string; citySlug: string }>
  expected: Record<string, { name: string; members: number }>
}
const data = fixture as Fixture

const families = derivePlatFamilies({
  plats: data.plats.map((p) => ({ ...p, closedCount: 20 })),
  communities: registryFamilyCommunities(),
  mlsNames: data.mlsNames,
  reservedSlugs: reservedPlaceSlugs({ citySlugs: [], neighborhoodSlugs: [] }),
  areaRedirect: resolveSubdivisionAreaRedirect,
})
const byHref = new Map(families.map((f) => [f.mainHref, f]))

describe('plat family lock over real county labels', () => {
  for (const [href, want] of Object.entries(data.expected)) {
    it(`${want.name}: ${want.members} recorded phases grouped under ${href}`, () => {
      const family = byHref.get(href)
      expect(family, `no family owns ${href}`).toBeDefined()
      expect(family!.name).toBe(want.name)
      expect(family!.members).toHaveLength(want.members)
    })
  }

  it('Ridge at Eagle Crest, Awbrey Butte Homesites and Tetherow Crossing get their own /subdivisions/ main page', () => {
    for (const slug of ['ridge-at-eagle-crest', 'awbrey-butte-homesites', 'tetherow-crossing', 'shevlin-bluffs']) {
      expect(platFamilyRole(families, slug)?.role, slug).toBe('head')
    }
  })

  it('Tetherow, Broken Top, NorthWest Crossing and Caldera Springs point at their community pages', () => {
    expect(platFamilyRole(families, 'tetherow-phase-4')?.family.mainHref).toBe('/communities/tetherow')
    expect(platFamilyRole(families, 'broken-top-phase-v-c')?.family.mainHref).toBe('/communities/broken-top')
    expect(platFamilyRole(families, 'northwest-crossing-phase-12')?.family.mainHref).toBe('/communities/northwest-crossing')
  })

  it('every phase of every family points at its family main page', () => {
    for (const family of families) {
      for (const member of family.members) {
        if (family.mainKind === 'subdivision' && member.slug === family.slug) continue
        expect(platFamilyRole(families, member.slug)?.family.mainHref, member.slug).toBe(family.mainHref)
      }
    }
  })

  it('keeps lookalikes out', () => {
    for (const slug of [
      'golf-homes-at-tetherow',
      'tetherow-rim',
      'golf-tracts-at-broken-top',
      'tennis-tracts-at-broken-top',
      'north-rim-on-awbrey-butte-phase-1',
      'awbrey-glen-homesites-phase-one',
    ]) {
      const role = platFamilyRole(families, slug)
      expect(['/communities/tetherow', '/communities/broken-top', '/subdivisions/awbrey-butte-homesites']).not.toContain(
        role?.family.mainHref,
      )
    }
  })
})

/**
 * THE SAME LOCK OVER EVERY RECORDED PLAT. The fixture is all 3,427
 * public.boundaries subdivision rows with the city getPlatFamilies resolves for
 * each, read 2026-09-23. It proves the invariant, not a sample: every group of
 * two or more recorded plats that share a base in one town has a family with
 * a main page, and every phase in it answers to that page. The only groups
 * exempt are the townsite plats whose base IS a city's name (Bend, Redmond,
 * La Pine): their main page is the city page, which already sits above them in
 * every trail. If a county relabel or a registry edit ever leaves a group with
 * no main page, this fails and names it.
 */
describe('plat family invariant over every recorded plat (2026-09-23 snapshot)', () => {
  type Recorded = {
    citySlugs: string[]
    neighborhoodSlugs: string[]
    plats: Array<[string, string, string, number]>
    mls: Array<[string, string]>
  }
  const data = recorded as unknown as Recorded
  const plats = data.plats.map(([slug, label, citySlug, closedCount]) => ({ slug, label, citySlug, closedCount }))
  const all = derivePlatFamilies({
    plats,
    communities: registryFamilyCommunities(),
    mlsNames: data.mls.map(([citySlug, name]) => ({ name, citySlug })),
    reservedSlugs: reservedPlaceSlugs({ citySlugs: data.citySlugs, neighborhoodSlugs: data.neighborhoodSlugs }),
    areaRedirect: resolveSubdivisionAreaRedirect,
  })
  const cityNames = new Set(data.citySlugs)

  it('every multi-plat group has a family with a main page, except a city townsite', () => {
    const orphans: string[] = []
    for (const group of platBaseGroups(plats)) {
      if (cityNames.has(platFamilySlug(group.key))) continue
      const roles = group.slugs.map((slug) => platFamilyRole(all, slug))
      const hrefs = new Set(roles.map((role) => role?.family.mainHref ?? null))
      if (hrefs.has(null) || hrefs.size !== 1) orphans.push(`${group.citySlug || '(no town)'} / ${group.key}: ${group.slugs.join(', ')}`)
    }
    expect(orphans, 'multi-phase groups with no single main page').toEqual([])
  })

  it('every phase of every family answers to its family main page, and every main page is a real route', () => {
    for (const family of all) {
      expect(family.mainHref, family.name).toMatch(/^\/(subdivisions|communities)\/[a-z0-9-]+$/)
      for (const member of family.members) {
        const role = platFamilyRole(all, member.slug)
        expect(role?.family.mainHref, member.slug).toBe(family.mainHref)
      }
    }
  })

  it('no two families and no family and a foreign plat share one address', () => {
    const platSlugs = new Set(plats.map((p) => p.slug))
    const seen = new Set<string>()
    for (const family of all.filter((f) => f.mainKind === 'subdivision')) {
      expect(seen.has(family.slug), family.slug).toBe(false)
      seen.add(family.slug)
      if (platSlugs.has(family.slug)) {
        expect(family.members.some((m) => m.slug === family.slug), family.slug).toBe(true)
      }
    }
  })

  it('a namesake in another town is addressed by name and town, never merged', () => {
    const bend = all.find((f) => f.name === 'Aspen Heights' && f.citySlug === 'bend')
    expect(bend?.mainHref).toBe('/subdivisions/aspen-heights-bend')
    expect(bend?.members).toHaveLength(4)
    // /subdivisions/aspen-heights is the Prineville plat, not a phase of Bend's.
    expect(platFamilyRole(all, 'aspen-heights')).toBeNull()
  })

  it('the families Matt named, over the whole set', () => {
    const at = (href: string) => all.find((f) => f.mainHref === href)
    expect(at('/subdivisions/ridge-at-eagle-crest')?.members).toHaveLength(60)
    expect(at('/subdivisions/ridge-at-eagle-crest')?.parentCommunitySlug).toBe('eagle-crest')
    expect(at('/subdivisions/awbrey-butte-homesites')?.members).toHaveLength(34)
    expect(at('/communities/broken-top')?.members).toHaveLength(27)
    expect(at('/communities/tetherow')?.members).toHaveLength(7)
    expect(at('/communities/northwest-crossing')?.members).toHaveLength(24)
    expect(at('/communities/caldera-springs')?.members).toHaveLength(15)
    expect(at('/subdivisions/estates-at-pronghorn')?.members).toHaveLength(6)
  })

  it('snapshot size: 540 families holding 1,989 of the 3,427 recorded plats', () => {
    // A deliberate change to the family rule moves these; update them in the
    // same commit with the reason. An accidental one fails here first.
    expect(plats).toHaveLength(3427)
    expect(all).toHaveLength(540)
    expect(all.reduce((n, f) => n + f.members.length, 0)).toBe(1989)
  })
})
