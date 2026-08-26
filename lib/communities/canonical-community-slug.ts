/**
 * /communities/<slug> canonicalization — resolved BEFORE render, at the edge.
 *
 * WHY THIS IS NOT IN THE PAGE
 * ---------------------------
 * app/communities/[slug]/page.tsx used to `redirect()` in its own body, after
 * `await getCommunityBySlug(slug)`. Under Next 16 the segment's loading.tsx (and
 * app/loading.tsx above it) opens a Suspense boundary, React flushes the shell
 * — and with it HTTP 200 and the response headers — before the page resolves, so
 * the throw could no longer write a `Location` header. Measured on
 * ryan-realty.com 2026-08-19, browser UA, redirect:manual:
 *
 *   /communities/bend-broken-top         200, Location: null, 0 <h1>, "index, follow"
 *   /communities/bend-tetherow           200, Location: null, 0 <h1>, "index, follow"
 *   /communities/sunriver-river-village  200, Location: null, 0 <h1>, "index, follow"
 *
 * Sweeping the 104 compound slugs this registry can produce under each
 * community's own city: 91 served that shell while publishing a
 * "<Community> Homes for Sale | <City>, OR" <title> over an empty body, ALL 91
 * carried robots "index, follow", and 0 emitted a 3xx. (The 13 that rendered are
 * the two is_resort:false entries under their verified city — three-rivers with
 * its 11 aliases, and crooked-river-ranch — which is exactly what this resolver
 * leaves alone.) A wider sweep that also crosses in wrong-city
 * variants counted 120. The hop only ever completed in a browser that runs JS; a
 * crawler saw an indexable empty page. Same class as the
 * /subdivisions and /neighborhoods marketing-slug hops already living in
 * middleware.ts.
 *
 * WHAT IT REPRODUCES
 * ------------------
 * Exactly the two hops the page body used to make, collapsed to a single 308:
 *
 *   1. A resort has ONE canonical URL — its bare registry slug. A compound slug
 *      naming that resort (by label or by any `subdivision_aliases` entry)
 *      consolidates onto it. GSC 2026-07 showed "broken top homes for sale"
 *      split across bend-parks-at-broken-top and bend-the-highlands-at-broken-top
 *      while the one real page sat unranked.
 *   2. A community's registry city is authoritative over the MLS City field
 *      (hundreds of Crosswater listings say "Bend"; Crosswater is a Sunriver
 *      resort). A slug built from the wrong city consolidates onto the right one.
 *
 * The page derived `subdivision` from the slug itself (parseCommunitySlug ->
 * slugToTitle), and both hop decisions read only `data/resort-communities.json`,
 * so every input this resolver needs is in the URL plus committed JSON. No DB,
 * no async, Edge-safe.
 *
 * SOUNDNESS
 * ---------
 * A redirect is emitted ONLY when the trailing segment slugifies to a registry
 * label or subdivision alias. An unknown name returns null and the slug is
 * served as before, so this can never invent a destination for an ordinary plat.
 */

import registry from '@/data/resort-communities.json' assert { type: 'json' }
import { CENTRAL_OREGON_CITY_SLUGS } from '@/lib/central-oregon'

type RegistryEntry = {
  slug: string
  label: string
  city: string
  city_slug: string
  is_resort?: boolean
  subdivision_aliases?: string[]
}

/**
 * Byte-identical to `slugify` in lib/slug.ts, inlined so the Edge middleware
 * bundle does not pull in that module's listing-publishing imports. Parity is
 * asserted in canonical-community-slug.test.ts.
 */
function slugifyName(name: string): string {
  return (
    name
      .trim()
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, '')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '') || 'unknown'
  )
}

const ENTRIES = (registry as unknown as { communities: RegistryEntry[] }).communities

/** Every registry slug — these URLs are already canonical. */
const CANONICAL_SLUGS: ReadonlySet<string> = new Set(ENTRIES.map((e) => e.slug))

/**
 * nameSlug -> registry entry, over labels + `subdivision_aliases` ONLY.
 *
 * That is deliberately the same match set the page used: `cityResorts(...)`
 * compared the parsed subdivision against `r.label` and `r.subdivision_aliases`,
 * and `getCanonicalCityForSubdivision` reads `canonicalCityByAlias`, built from
 * label + subdivision_aliases. `sub_neighborhoods` are NOT in either, so they
 * are not here — adding them would redirect URLs the page rendered.
 */
const ENTRY_BY_NAME_SLUG: ReadonlyMap<string, RegistryEntry> = (() => {
  const map = new Map<string, RegistryEntry>()
  for (const entry of ENTRIES) {
    const names = [entry.label, ...(entry.subdivision_aliases ?? [])]
    for (const name of names) {
      const key = slugifyName(name)
      // ROUND-TRIP GUARD. The page compared the registry name against the
      // subdivision it had rebuilt FROM the slug (slugToTitle), so a name that
      // does not survive slugify -> title -> lowercase never matched there
      // (an apostrophe or a period is dropped by slugify and cannot come back).
      // Registering it here would redirect a URL the page rendered, so it is
      // skipped. Parity over the whole slug space is asserted in the test.
      if (key.replace(/-/g, ' ') !== name.trim().toLowerCase()) continue
      if (!map.has(key)) map.set(key, entry)
    }
  }
  return map
})()

/**
 * LABEL ONLY — a community's own public name. Deliberately NOT the alias set.
 *
 * `subdivision_aliases` holds MLS subdivision names that sit INSIDE a community
 * (Sunriver's "River Village", Tetherow's "Triple"), and those are their own
 * places with their own /subdivisions/ pages. Hopping them at /communities/
 * would assert an identity that is not true: `ridge-at-eagle-crest` is a
 * separate HOA with its own 57 plats and its own governing documents, and
 * `aspen-meadows` names a recorded plat elsewhere in the county. Both 404
 * honestly today, and a confident redirect to the wrong community is worse than
 * an honest 404 — the compound form still consolidates them, which is the case
 * that hop was built for.
 *
 * A LABEL is different: it is what the community calls itself. When a community
 * is renamed and the slug stays as a durable data key, the label is the only
 * name the public now uses.
 */
const ENTRY_BY_LABEL_SLUG: ReadonlyMap<string, RegistryEntry> = (() => {
  const map = new Map<string, RegistryEntry>()
  for (const entry of ENTRIES) {
    const key = slugifyName(entry.label)
    // Same round-trip guard as above.
    if (key.replace(/-/g, ' ') !== entry.label.trim().toLowerCase()) continue
    if (!map.has(key)) map.set(key, entry)
  }
  return map
})()

/**
 * The canonical `/communities` slug for `slug`, or null when `slug` is already
 * canonical (or names no registered community).
 *
 * Returns a SLUG, not a path.
 */
export function resolveCanonicalCommunitySlug(rawSlug: string): string | null {
  const slug = rawSlug.trim().toLowerCase()
  if (!slug || CANONICAL_SLUGS.has(slug)) return null

  // HOP 0 — a BARE registry name that is not itself a canonical slug.
  //
  // The city-prefix scan below only ever fired for compound `<city>-<name>`
  // URLs, so a URL naming a community by its own label went to notFound(). That
  // is how /communities/juniper-preserve 404'd while
  // /communities/bend-juniper-preserve correctly 308'd to /communities/pronghorn
  // (verified live and locally 2026-08-26): Pronghorn's registry label IS
  // "Juniper Preserve" since the 2022 rebrand, and the slug deliberately stays
  // `pronghorn` because geo_snapshot_mv keys on bend:pronghorn and a cron
  // sentinels on it. The public name changed; the durable key did not.
  //
  // A brand's CURRENT name 404'ing is the worst possible outcome for the one
  // term people now search. This converts that 404 into the same 308 the
  // compound form already produced — and only ever a 404: an unregistered name
  // still falls through to null, and a canonical slug never reaches here.
  //
  // LABELS ONLY, not the alias set — see ENTRY_BY_LABEL_SLUG for why hopping a
  // subdivision alias here would assert an identity that is not true.
  const bare = ENTRY_BY_LABEL_SLUG.get(slug)
  if (bare && bare.slug !== slug) return bare.slug

  const parts = slug.split('-')
  if (parts.length < 2) return null

  // FIRST city-slug prefix wins, and the scan stops there — byte-identical to
  // parseCommunitySlug in lib/community-slug.ts, which the page used. Trying
  // longer prefixes after a match would diverge: 'crooked-river' is a service-
  // area slug, so the page read /communities/crooked-river-ranch-widgi-creek as
  // city "Crooked River" + subdivision "Ranch Widgi Creek" and rendered nothing
  // — it never saw a Widgi Creek slug there, so neither may this.
  let citySlug: string | null = null
  let nameSlug: string | null = null
  for (let i = 1; i < parts.length; i++) {
    const candidate = parts.slice(0, i).join('-')
    if (CENTRAL_OREGON_CITY_SLUGS.has(candidate)) {
      citySlug = candidate
      nameSlug = parts.slice(i).join('-')
      break
    }
  }
  if (!citySlug || !nameSlug) return null

  const entry = ENTRY_BY_NAME_SLUG.get(nameSlug)
  if (!entry) return null

  // Hop 1 — a resort in its own city consolidates onto its bare slug.
  if (entry.is_resort === true && entry.city_slug === citySlug) {
    return entry.slug === slug ? null : entry.slug
  }

  // Hop 2 — wrong city for this community. A resort collapses straight to its
  // bare slug (the page took two hops to get there); a non-resort registry
  // entry keeps the compound shape under its verified city.
  if (entry.city_slug !== citySlug) {
    return entry.is_resort === true ? entry.slug : `${entry.city_slug}-${nameSlug}`
  }

  // Non-resort entry, already under its verified city: the page renders.
  return null
}

/** `/communities/<canonical>` for `slug`, or null when no hop is needed. */
export function resolveCanonicalCommunityPath(rawSlug: string): string | null {
  const target = resolveCanonicalCommunitySlug(rawSlug)
  return target ? `/communities/${target}` : null
}

/**
 * Nested `/cities/{city}/{slug}` for a registered community is a hollow
 * notFound (the neighborhoods table is Bend districts). Send the visitor to
 * `/communities/{slug}`. Bend district pages (larkspur, awbrey-butte) are
 * not registry slugs and pass through.
 */
export function resolveCityNeighborhoodCommunityPath(pathname: string): string | null {
  const m = pathname.match(/^\/cities\/([^/]+)\/([^/]+)\/?$/)
  if (!m) return null
  const neighborhood = slugifyName(m[2])
  if (!CANONICAL_SLUGS.has(neighborhood)) return null
  const dest = `/communities/${neighborhood}`
  return dest === pathname ? null : dest
}

/**
 * Every compound slug this resolver redirects, with its destination. Used by the
 * unit test and by the verification probe — never at request time.
 */
export function enumerateCanonicalCommunityRedirects(): Array<{ from: string; to: string }> {
  const out: Array<{ from: string; to: string }> = []
  const seen = new Set<string>()
  for (const citySlug of CENTRAL_OREGON_CITY_SLUGS) {
    for (const nameSlug of ENTRY_BY_NAME_SLUG.keys()) {
      const from = `${citySlug}-${nameSlug}`
      if (seen.has(from)) continue
      seen.add(from)
      const to = resolveCanonicalCommunitySlug(from)
      if (to) out.push({ from, to })
    }
  }
  return out.sort((a, b) => a.from.localeCompare(b.from))
}
