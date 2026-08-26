/**
 * The edge resolver must decide EXACTLY what app/communities/[slug]/page.tsx
 * decided before the redirect moved out of the page body — same destination for
 * every slug that redirected, and silence for every slug that rendered.
 *
 * The page's decision is reconstructed here from the same three sources it read
 * (parseCommunitySlug, cityResorts, getCanonicalCityForSubdivision) and iterated
 * to its fixed point, because the page took up to two hops
 * (/communities/bend-crosswater -> /communities/sunriver-crosswater ->
 * /communities/crosswater) where the resolver collapses to one.
 *
 * Grounding: the reconstructed chain was checked against what production
 * actually served on 2026-08-19. The streamed 200 shells carry the page's
 * decision in a `NEXT_REDIRECT;replace;<target>;307;` template, and every
 * sampled slug agreed with this function:
 *
 *   bend-broken-top           -> /communities/broken-top
 *   sunriver-river-village    -> /communities/sunriver
 *   bend-crosswater           -> /communities/sunriver-crosswater
 *   madras-tetherow           -> /communities/bend-tetherow
 *   prineville-sunriver       -> /communities/sunriver-sunriver
 *   la-pine-three-rivers      -> /communities/bend-three-rivers
 *   bend-three-rivers         -> (no redirect; the page rendered, 1 <h1>)
 */

import { describe, it, expect } from 'vitest'
import registry from '@/data/resort-communities.json'
import { CENTRAL_OREGON_CITY_SLUGS } from '@/lib/central-oregon'
import { parseCommunitySlug } from '@/lib/community-slug'
import { cityResorts } from '@/lib/kb/resort-active-counts'
import { getCanonicalCityForSubdivision } from '@/lib/data/communities/registry'
import { slugify } from '@/lib/slug'
import {
  enumerateCanonicalCommunityRedirects,
  resolveCanonicalCommunityPath,
  resolveCanonicalCommunitySlug,
  resolveCityNeighborhoodCommunityPath,
} from './canonical-community-slug'

type Entry = {
  slug: string
  label: string
  city: string
  city_slug: string
  is_resort?: boolean
  subdivision_aliases?: string[]
}
const ENTRIES = (registry as unknown as { communities: Entry[] }).communities

const CITY_SLUGS = new Set<string>(CENTRAL_OREGON_CITY_SLUGS)

/** One hop of the redirect logic app/communities/[slug]/page.tsx used to run. */
function pageHop(slug: string): string | null {
  const parsed = parseCommunitySlug(slug, CITY_SLUGS)
  if (!parsed) return null
  const cityName = parsed.city
  const citySlug = slugify(cityName)
  const subdivisionLc = parsed.subdivision.toLowerCase().trim()

  const resortMatch = cityResorts(citySlug).find(
    (r) =>
      r.slug === slug ||
      r.label.toLowerCase().trim() === subdivisionLc ||
      (r.subdivision_aliases ?? []).some((a) => a.toLowerCase().trim() === subdivisionLc),
  )
  if (resortMatch && slug !== resortMatch.slug) return resortMatch.slug

  const canonicalCity = getCanonicalCityForSubdivision(parsed.subdivision)
  if (canonicalCity && canonicalCity.toLowerCase() !== cityName.toLowerCase()) {
    return `${slugify(canonicalCity)}-${slugify(parsed.subdivision)}`
  }
  return null
}

/** Where the page's chain of hops came to rest, or null if it never hopped. */
function pageFixedPoint(slug: string): string | null {
  let current = slug
  let last: string | null = null
  for (let i = 0; i < 8; i++) {
    const next = pageHop(current)
    if (!next || next === current) break
    last = next
    current = next
  }
  return last
}

/**
 * Every slug the page could ever have redirected: a community name (label or
 * subdivision alias) under any service-area city prefix, plus every bare
 * registry slug, plus controls that must NOT move.
 */
function candidateUniverse(): string[] {
  const names = new Set<string>()
  for (const e of ENTRIES) {
    names.add(slugify(e.label))
    for (const a of e.subdivision_aliases ?? []) names.add(slugify(a))
    for (const sub of (e as { sub_neighborhoods?: Array<{ name: string; slug: string }> }).sub_neighborhoods ?? []) {
      // sub_neighborhoods are in NEITHER match set — included as controls.
      names.add(slugify(sub.name))
      names.add(sub.slug)
    }
  }
  const out = new Set<string>()
  for (const city of CITY_SLUGS) {
    out.add(city)
    for (const n of names) out.add(`${city}-${n}`)
  }
  for (const e of ENTRIES) out.add(e.slug)
  for (const control of [
    'bend-awbrey-butte',
    'bend-nowhere-at-all',
    'not-a-city-tetherow',
    'tetherow',
    '',
    'x',
  ]) {
    out.add(control)
  }
  return [...out]
}

describe('resolveCanonicalCommunitySlug', () => {
  const universe = candidateUniverse()

  it('covers a non-trivial slug space', () => {
    // 24 service-area cities x 78 distinct community/alias/sub-neighbourhood
    // names, plus the bare registry slugs and controls. Was >2000 until the
    // 2026-08-26 membership audit removed 21 falsely-claimed aliases (~500
    // city-prefixed candidates); the space is smaller because the registry is
    // now true, not because coverage was cut.
    expect(universe.length).toBeGreaterThan(1800)
  })

  it('lands on the same destination the page body chose, for every slug', () => {
    const mismatches: string[] = []
    for (const slug of universe) {
      const mine = resolveCanonicalCommunitySlug(slug)
      const theirs = pageFixedPoint(slug)
      if (mine !== theirs) mismatches.push(`${slug}: edge=${mine} page=${theirs}`)
    }
    expect(mismatches).toEqual([])
  })

  it('never redirects a canonical registry slug', () => {
    for (const e of ENTRIES) expect(resolveCanonicalCommunitySlug(e.slug)).toBeNull()
  })

  it('collapses the page\'s two-hop chains into one', () => {
    // The page sent bend-crosswater to sunriver-crosswater, which then sent it
    // to crosswater. One 308 now.
    expect(pageHop('bend-crosswater')).toBe('sunriver-crosswater')
    expect(resolveCanonicalCommunitySlug('bend-crosswater')).toBe('crosswater')
    expect(resolveCanonicalCommunitySlug('madras-tetherow')).toBe('tetherow')
    expect(resolveCanonicalCommunitySlug('prineville-sunriver')).toBe('sunriver')
  })

  it('consolidates the GSC self-cannibalization case onto one URL', () => {
    // bend-broken-top is the real case, and the one production was sampled on
    // (see the header). It still consolidates.
    expect(resolveCanonicalCommunitySlug('bend-broken-top')).toBe('broken-top')
    // sunriver-river-village, also production-sampled, is the alias form of the
    // same rule and River Village is a VERIFIED Sunriver child (100% inside).
    expect(resolveCanonicalCommunitySlug('sunriver-river-village')).toBe('sunriver')
  })

  it('stops claiming a neighbouring plat for the resort next door', () => {
    // Until 2026-08-26 this resolver sent bend-parks-at-broken-top and
    // bend-the-highlands-at-broken-top to /communities/broken-top, because the
    // registry listed both as Broken Top aliases. Neither is: each is its own
    // recorded Deschutes County plat with its own HOA (Parks at Broken Top
    // CSNUM 13729/14822/15794/16329/16789, Highlands 15548/15983/16540/16708),
    // and the Broken Top boundary polygon already excluded them by name. The
    // 308 was a canonical claim that these places BELONG to Broken Top, so
    // dropping it is the same correction as dropping the alias (CLAUDE.md §0).
    expect(resolveCanonicalCommunitySlug('bend-parks-at-broken-top')).toBeNull()
    expect(resolveCanonicalCommunitySlug('bend-the-highlands-at-broken-top')).toBeNull()
    // NOTE the side effect, which is PRE-EXISTING and much wider than these two:
    // /communities/<city>-<anything> renders an index,follow page for ANY name,
    // verified 2026-08-26 with the never-registered control
    // /communities/bend-some-ordinary-plat. These names now land in that bucket
    // instead of redirecting. The fix is the junk-slug guard on the
    // /communities route, not a fake alias — tracked for Matt.
  })

  it('leaves a non-resort registry entry alone under its verified city', () => {
    // three-rivers is is_resort:false, city Bend — the page rendered this one.
    expect(resolveCanonicalCommunitySlug('bend-three-rivers')).toBeNull()
    // ...but a wrong-city variant still consolidates.
    expect(resolveCanonicalCommunitySlug('la-pine-three-rivers')).toBe('bend-three-rivers')
  })

  it('leaves an ordinary Bend neighbourhood slug alone', () => {
    expect(resolveCanonicalCommunitySlug('bend-awbrey-butte')).toBeNull()
    expect(resolveCanonicalCommunitySlug('bend-nowhere-at-all')).toBeNull()
  })

  it('returns a path from the path helper, and null when there is no hop', () => {
    expect(resolveCanonicalCommunityPath('bend-tetherow')).toBe('/communities/tetherow')
    expect(resolveCanonicalCommunityPath('tetherow')).toBeNull()
  })

  it('every enumerated pair is a real, terminating hop', () => {
    const pairs = enumerateCanonicalCommunityRedirects()
    expect(pairs.length).toBeGreaterThan(100)
    for (const { from, to } of pairs) {
      expect(from).not.toBe(to)
      // The destination is canonical: resolving it again must be a no-op.
      expect(resolveCanonicalCommunitySlug(to)).toBeNull()
    }
  })

  it("a renamed community's own label resolves to its durable slug", () => {
    // Pronghorn rebranded to Juniper Preserve in 2022. The slug deliberately
    // stays `pronghorn` — geo_snapshot_mv keys on bend:pronghorn and a cron
    // sentinels on it — so the label is the only name the public now uses, and
    // it used to 404 while the compound form already worked.
    expect(resolveCanonicalCommunitySlug('juniper-preserve')).toBe('pronghorn')
    expect(resolveCanonicalCommunitySlug('bend-juniper-preserve')).toBe('pronghorn')
    // The canonical URL stays canonical.
    expect(resolveCanonicalCommunitySlug('pronghorn')).toBeNull()
  })

  it('a BARE subdivision alias does NOT hop — only a label does', () => {
    // subdivision_aliases hold MLS subdivision names that sit INSIDE a
    // community, and those are their own places. Hopping them here would
    // assert an identity that is not true: Ridge at Eagle Crest is a separate
    // HOA with its own plats and governing documents, and Aspen Meadows names a
    // recorded plat elsewhere in the county. Both must stay null so the route
    // 404s honestly rather than redirecting confidently to the wrong community.
    expect(resolveCanonicalCommunitySlug('ridge-at-eagle-crest')).toBeNull()
    expect(resolveCanonicalCommunitySlug('aspen-meadows')).toBeNull()
    expect(resolveCanonicalCommunitySlug('river-village')).toBeNull()
    expect(resolveCanonicalCommunitySlug('triple')).toBeNull()
    // The COMPOUND form still consolidates them — that is what it is for.
    expect(resolveCanonicalCommunitySlug('sunriver-river-village')).toBe('sunriver')
  })

  it('nested city URLs for a registry community hop to /communities/{slug}', () => {
    expect(resolveCityNeighborhoodCommunityPath('/cities/sunriver/sunriver')).toBe(
      '/communities/sunriver',
    )
    expect(resolveCityNeighborhoodCommunityPath('/cities/bend/northwest-crossing')).toBe(
      '/communities/northwest-crossing',
    )
    expect(resolveCityNeighborhoodCommunityPath('/cities/la-pine/three-rivers')).toBe(
      '/communities/three-rivers',
    )
    expect(resolveCityNeighborhoodCommunityPath('/cities/bend/larkspur')).toBeNull()
    expect(resolveCityNeighborhoodCommunityPath('/cities/bend/awbrey-butte')).toBeNull()
  })
})
