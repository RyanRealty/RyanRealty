/**
 * subdivision-area-redirects — the MARKETING-slug → canonical-path map for the
 * /subdivisions/[slug] route.
 *
 * WHY THIS EXISTS (the class of bug it fixes):
 * /subdivisions/[slug] serves PLAT-level boundary slugs ONLY (geo_type=
 * 'subdivision' in `boundaries`, e.g. 'tetherow-phase-1', ~3,213 county plats).
 * A MARKETING-level area name ('awbrey-butte', 'tetherow') has no plat boundary,
 * so the page calls notFound() — which, under Next 16 streaming, surfaces as a
 * hollow HTTP 200 (a soft-404): bad UX, and an SEO sink if anything links there.
 * Those names have a canonical home: resort/area communities at
 * /communities/<slug>, City-of-Bend neighborhoods at /cities/bend/<slug>.
 *
 * WHY A PURE MAP (not a live DB lookup in the page):
 * An App Router page-level redirect()/permanentRedirect() CANNOT emit a real
 * 3xx under Next 16 streaming — the root layout flushes a 200 before the page's
 * async work resolves, so the "redirect" degrades to a client-side hop inside a
 * 200 (verified empirically 2026-06-09: /subdivisions/awbrey-butte and
 * /subdivisions/tetherow both returned 200, no Location). A real HTTP 308 has to
 * come from MIDDLEWARE, before render — the same place this app already serves
 * its legacy-URL 301s and canonical-host 308s. Middleware runs on the Edge for
 * every page request, so the resolver MUST be synchronous and DB-free. This
 * module is that resolver: pure data + string ops, zero Supabase / server-only
 * imports, safe to import into middleware AND the page.
 *
 * SOURCES (both committed + authoritative — the map is rebuilt from them at
 * module load, so it can never drift from a separately-generated artifact):
 *   - data/resort-communities.json  → /communities/<slug>
 *     The /communities route serves every registry slug (its isResort signal
 *     satisfies the junk-slug guard in getCommunityBySlug), so these never
 *     301→404.
 *   - data/bend/bend-neighborhood-polygons.json, tier:'city' rows only
 *     → /cities/bend/<route_slug>
 *     The 13 City-of-Bend GIS neighborhoods, served by the city-neighborhood
 *     route. The 10 tier:'community' polygons that are NOT in the resort
 *     registry (deschutes-river-woods, tree-farm, westgate, river-bend-estates,
 *     sunset-view-estates, woodside-ranch, seventh-mountain) are EXCLUDED: they
 *     have no confirmed /communities or /cities page, and a redirect to a 404 is
 *     worse than the current soft-404. Add them here once a home is confirmed.
 *
 * Both the bare marketing name ('tetherow', 'awbrey-butte') and the
 * city-prefixed boundary form ('bend-tetherow', 'bend-awbrey-butte') resolve to
 * the same canonical path.
 */

import resortRegistry from '@/data/resort-communities.json'
import bendPolygons from '@/data/bend/bend-neighborhood-polygons.json'

type RegistryEntry = { slug: string; city_slug: string }
type PolygonEntry = { tier: string; slug: string; route_slug: string }

function buildRedirectMap(): Map<string, string> {
  const map = new Map<string, string>()

  // City-of-Bend GIS neighborhoods → /cities/bend/<route_slug>. Added first so
  // a resort-registry slug (added below) always wins on any overlap — a resort
  // community is canonically a /communities page.
  for (const e of bendPolygons.communities as PolygonEntry[]) {
    if (e.tier !== 'city') continue
    const dest = `/cities/bend/${e.route_slug}`
    map.set(e.route_slug, dest) // bare:     'awbrey-butte'
    map.set(e.slug, dest) //        prefixed: 'bend-awbrey-butte'
  }

  // Resort / area communities → /communities/<slug>.
  for (const c of resortRegistry.communities as RegistryEntry[]) {
    const dest = `/communities/${c.slug}`
    map.set(c.slug, dest) // bare:                'tetherow'
    if (c.city_slug) map.set(`${c.city_slug}-${c.slug}`, dest) // 'bend-tetherow'
  }

  return map
}

// Built once; the Edge runtime caches the module across invocations.
const REDIRECT_MAP = buildRedirectMap()

/** Normalize a slug to the map key form: lowercase, trimmed, no trailing slash. */
function normalize(slug: string): string {
  return slug.trim().toLowerCase().replace(/\/+$/, '')
}

/**
 * Canonical destination path for a /subdivisions/<slug> request that is actually
 * a marketing-level area name, or null when the slug is not a known area (a real
 * plat, or a genuine unknown — both pass through to the page untouched).
 */
export function resolveSubdivisionAreaRedirect(slug: string): string | null {
  if (!slug) return null
  return REDIRECT_MAP.get(normalize(slug)) ?? null
}

/** Full map as sorted [slug, path] pairs — for the contract test + any gate. */
export function subdivisionAreaRedirectEntries(): Array<[string, string]> {
  return Array.from(REDIRECT_MAP.entries()).sort((a, b) => a[0].localeCompare(b[0]))
}
