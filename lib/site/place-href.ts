/**
 * The one way to build a place door — a link that lands on its page in ONE
 * request.
 *
 * Three mechanisms sit above the render and move a place URL, none of them
 * visible from the component writing the link:
 *
 *  1. `middleware.ts` (resolveGeoCityRedirect) routes a city slug by the Central
 *     Oregon service-area set — inside it the page is `/cities/<slug>`, outside
 *     it the page is `/oregon/<slug>` — and 308s either shape used for the other
 *     kind of city.
 *  2. `middleware.ts` also runs `resolvePreRenderHop`, which consolidates a
 *     registry-community neighborhood slug onto `/communities/<slug>` and a
 *     marketing-area subdivision slug onto its real page.
 *  3. `next.config.ts` hops individual city slugs on top of both.
 *
 * So `/cities/${slug}` written inline is right for Bend and costs a round trip
 * for Medford. Measured on the dev server 2026-09-02, redirect:'manual':
 * `/cities/medford`, `/cities/klamath-falls` and `/cities/chiloquin` each
 * answered 308 before their page, and `/cities/bend/northwest-crossing` and
 * `/cities/redmond/eagle-crest` each answered 308 to `/communities/<slug>`.
 * Every one of those was a door the site had already rendered into its HTML.
 *
 * Build place doors here and they resolve on the first request.
 *
 * Pure and edge-safe: static sets and committed JSON, no DB, no request.
 */
import { CENTRAL_OREGON_CITY_SLUGS } from '@/lib/central-oregon'
import { resolvePreRenderHop } from '@/lib/routing/pre-render-hops'
import { cityNeighborhoodPath } from '@/lib/slug'

/**
 * City slugs whose `/cities/<slug>` page is redirected by a per-slug rule in
 * `next.config.ts`, mapped to what that rule actually serves. next.config's
 * rules run outside `resolvePreRenderHop`, so they are answered here.
 *
 * `lib/site/place-href.test.ts` reads `next.config.ts` and fails on any
 * single-segment `/cities/<slug>` redirect this map does not answer, so a new
 * rule there cannot silently reintroduce a redirecting door.
 */
const CITY_HREF_OVERRIDES: Readonly<Record<string, string>> = {
  // Crooked River Ranch is inside the service area but is not a distinct MLS
  // city (its listings file under Terrebonne), so it has no geo_snapshot_mv row
  // and the city page 404'd. next.config.ts sends it to the community surface
  // that is live.
  'crooked-river-ranch': '/communities/crooked-river-ranch',
}

/** Lowercase + trim — the normalization middleware applies before it routes. */
function normalize(raw: string | null | undefined): string {
  return typeof raw === 'string' ? raw.trim().toLowerCase() : ''
}

/** Follow the pre-render hops until the path stops moving. */
function settle(path: string): string {
  let current = path
  for (let i = 0; i < 4; i++) {
    const next = resolvePreRenderHop(current)
    if (!next || next === current) return current
    current = next
  }
  return current
}

/**
 * Where a city slug's page actually lives.
 *
 * @param citySlug a slugified MLS city (`bend`, `medford`). Null for an absent
 *   slug, so a caller with no city renders no door rather than a dead one.
 */
export function cityHref(citySlug: string | null | undefined): string | null {
  const slug = normalize(citySlug)
  if (!slug) return null
  const override = CITY_HREF_OVERRIDES[slug]
  if (override) return override
  // No pre-render hop covers a single-segment city path, so this is the end of
  // the chain. The test asserts that with resolvePreRenderHop.
  const encoded = encodeURIComponent(slug)
  return CENTRAL_OREGON_CITY_SLUGS.has(slug) ? `/cities/${encoded}` : `/oregon/${encoded}`
}

/**
 * True when a city slug's own page is `/cities/<slug>` — the only shape that
 * carries neighborhood children. An out-of-area city's page is `/oregon/<slug>`
 * and has none, so a neighborhood door under one would be a dead link rather
 * than a redirect.
 */
export function hasCityNeighborhoodPages(citySlug: string | null | undefined): boolean {
  const slug = normalize(citySlug)
  if (!slug) return false
  if (CITY_HREF_OVERRIDES[slug]) return false
  return CENTRAL_OREGON_CITY_SLUGS.has(slug)
}

/**
 * Where a city > neighborhood door lands. A registry community used as a
 * neighborhood slug (Northwest Crossing, Eagle Crest) has its own
 * `/communities/<slug>` page and the two-segment path 308s there.
 */
export function cityNeighborhoodHref(
  citySlug: string | null | undefined,
  neighborhoodSlug: string | null | undefined,
): string | null {
  const city = normalize(citySlug)
  const neighborhood = normalize(neighborhoodSlug)
  if (!city || !neighborhood) return null
  if (!hasCityNeighborhoodPages(city)) return cityHref(city)
  return settle(cityNeighborhoodPath(city, neighborhood))
}

/**
 * Where a subdivision door lands. A marketing-area name carries no plat
 * boundary, so `/subdivisions/<slug>` hops to the page that does hold it.
 */
export function subdivisionHref(slug: string | null | undefined): string | null {
  const s = normalize(slug)
  if (!s) return null
  return settle(`/subdivisions/${encodeURIComponent(s)}`)
}
