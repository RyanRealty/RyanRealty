/**
 * One market URL per place (2026-09-24).
 *
 * /housing-market/[...slug] reads the URL shape, not a registry:
 *   - one segment   /housing-market/<city>             -> the CITY cache grain
 *   - two segments  /housing-market/<city>/<community> -> the COMMUNITY grain
 * so a registry community was reachable, self-canonical and indexable at up to
 * three URLs. Found live 2026-09-24: /housing-market/black-butte-ranch (city
 * grain, no figure in its description) and /housing-market/sisters/black-butte-
 * ranch (community grain, "27 homes for sale, $1,150,000 median list price")
 * both answered 200 "index, follow" with the same <h1>; GSC 2026-08-24..09-20
 * credited the two-segment URL with 7% of the "black butte ranch" impressions
 * and the one-segment URL with none. /housing-market/sunriver/sunriver twinned
 * /housing-market/sunriver the same way, and wrong-city twins
 * (/housing-market/bend/caldera-springs beside sunriver/caldera-springs) all
 * rendered.
 *
 * THE RULE (the URL scheme the route, place-links and the sitemap already use):
 *   - A registry community's market page is /housing-market/<registry
 *     city_slug>/<durable slug>: the community grain, the one place-links
 *     (`marketUrl`) and every community page link.
 *   - EXCEPT a community that IS its registry city (Sunriver: slug ===
 *     city_slug). There the city grain is the place, the one-segment URL is the
 *     page, and /housing-market/sunriver/sunriver is the twin.
 *   - A destination that data/legacy-redirects.json sends on (SITE-171:
 *     /housing-market/bend/tetherow -> /communities/tetherow) is followed here,
 *     so a hop never lands on another hop.
 *
 * Only a registry durable or public slug matches, never an alias: an alias can
 * be a real plat with its own subdivision-grain market page.
 *
 * Pure and Edge-safe (committed JSON + string work). middleware.ts runs it via
 * lib/routing/pre-render-hops.ts, before anything streams.
 */
import registry from '@/data/resort-communities.json'
import legacyRedirects from '@/data/legacy-redirects.json'
import { publicCommunitySlug } from '@/lib/communities/community-public-pair'

type Entry = { slug: string; label: string; city_slug: string }

const ENTRIES = (registry as unknown as { communities: Entry[] }).communities

const BY_SLUG: ReadonlyMap<string, Entry> = (() => {
  const map = new Map<string, Entry>()
  for (const e of ENTRIES) {
    map.set(e.slug.toLowerCase(), e)
    const pub = publicCommunitySlug(e)
    if (!map.has(pub)) map.set(pub, e)
  }
  return map
})()

const LEGACY = legacyRedirects as Record<string, string>

/** Real /housing-market/<segment> routes that are not a place. */
const RESERVED_FIRST = new Set(['reports', 'history', 'annual-review', 'central-oregon', 'og', 'explore'])

/** The one market path for a registry community, by durable or public slug; null when not a registry community. */
export function communityMarketPath(
  slug: string | null | undefined,
  opts: { followLegacy?: boolean } = {},
): string | null {
  const e = BY_SLUG.get((slug ?? '').trim().toLowerCase())
  if (!e) return null
  const durable = e.slug.toLowerCase()
  const city = e.city_slug.toLowerCase()
  const path = durable === city ? `/housing-market/${durable}` : `/housing-market/${city}/${durable}`
  // followLegacy false: the market DOCUMENT path, for a caller that already
  // drops a door whose target a legacy redirect folds away (community-figures).
  return opts.followLegacy === false ? path : (LEGACY[path] ?? path)
}

/**
 * Destination for a /housing-market/<a>[/<b>] request that names a registry
 * community at a non-canonical URL, or null (pass through).
 */
export function resolveMarketCommunityHop(pathname: string): string | null {
  const m = pathname.match(/^\/housing-market\/([^/]+)(?:\/([^/]+))?\/?$/)
  if (!m) return null
  if (RESERVED_FIRST.has(m[1].toLowerCase())) return null
  const decode = (raw: string) => {
    try {
      return decodeURIComponent(raw).toLowerCase()
    } catch {
      return raw.toLowerCase()
    }
  }
  const community = decode(m[2] ?? m[1])
  const dest = communityMarketPath(community)
  if (!dest) return null
  const here = pathname.replace(/\/+$/, '').toLowerCase()
  return dest === here ? null : dest
}

/**
 * The market page for a one-segment place slug as the site links it: a
 * registry community's canonical market path (black-butte-ranch ->
 * /housing-market/sisters/black-butte-ranch), else the city page
 * /housing-market/<slug>. Build every `/housing-market/<city>` link with this
 * so no internal link lands on the 301.
 */
export function cityMarketPath(slug: string): string {
  const s = slug.trim().toLowerCase()
  return communityMarketPath(s) ?? `/housing-market/${s}`
}
