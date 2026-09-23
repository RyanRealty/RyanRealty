/**
 * registry-area-twins.mjs — the area-search twins of every registry community,
 * and where each one 301s. Consumed by scripts/build-legacy-redirects.mjs; the
 * derivation is pinned against the TypeScript helpers by
 * registry-area-twins.test.mjs so this .mjs copy of the two lookups
 * (public slug, self-city membership) cannot drift from lib/.
 *
 * WHY (SITE-183 / SITE-182, GSC 2026-08-24..09-20). "broken top homes for
 * sale" split across /communities/broken-top (48%) and three plat pages;
 * "tetherow homes for sale" across /communities/tetherow (39%), the old blog
 * slug (32%, already 308s) and the golf-homes plat. Live 2026-09-23 every
 * registry community whose twin was not hand-listed here
 * (/homes-for-sale/bend/broken-top, /homes-for-sale/bend/caldera-springs,
 * /homes-for-sale/crooked-river-ranch/crooked-river-ranch, ...) answered 200
 * with the community page's EXACT <title> and <h1> and a self canonical: a
 * second document for the one query PAGE_OUTLINE gives to the community page.
 * Tetherow, Sunriver, Black Butte Ranch and Crooked River Ranch had been
 * fixed one hand entry at a time (fc3649b, 738be2a); this is the rule those
 * entries were instances of.
 *
 * THE RULE, derived from data/resort-communities.json and nothing else:
 *   /homes-for-sale/<city>/<area>  →  /communities/<public slug>
 * where <area> is the community's durable slug or its public slug (Pronghorn
 * files as /bend/pronghorn AND /bend/juniper-preserve), and <city> is each of
 *   - the registry city_slug (Bend for Tetherow, Sisters for Black Butte Ranch)
 *   - every MLS city the registry records the community's homes filed under
 *     (mls_cities: Caldera Springs and Crosswater under Bend, Three Rivers
 *     under La Pine), because the search app builds area URLs from a listing's
 *     City field, so those pages exist and render the same h1
 *   - the community itself when it is its own city (Sunriver, Black Butte
 *     Ranch, Crooked River Ranch: lib/communities/self-city-community.ts).
 * Exactly two path segments after /homes-for-sale. A listing URL has three or
 * more (/homes-for-sale/bend/broken-top/<address>) and is never matched; a
 * preset variant (/homes-for-sale/bend/broken-top/luxury) likewise keeps
 * rendering. The destination is always the LIVE public URL so no twin lands
 * on a second redirect (check-legacy-redirects.mjs: no multi-hop).
 */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'

/** Byte-identical to lib/communities/community-public-pair.ts slugifyCommunityName. */
export function slugifyCommunityName(name) {
  return (
    String(name)
      .trim()
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, '')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '') || 'unknown'
  )
}

/** Same rule as lib/communities/community-public-pair.ts publicCommunitySlug. */
export function publicCommunitySlug(entry) {
  const label = String(entry.label ?? '')
  const fromLabel = slugifyCommunityName(label)
  const roundTrips = fromLabel.replace(/-/g, ' ') === label.trim().toLowerCase()
  if (fromLabel !== 'unknown' && roundTrips) return fromLabel
  return String(entry.slug).trim().toLowerCase()
}

/**
 * CENTRAL_OREGON_CITY_SLUGS, read out of lib/central-oregon.ts. The script
 * runs under plain `node` (CI is Node 20, no TypeScript loader), so the set is
 * lifted from the source text rather than imported; the test asserts it equals
 * the exported constant, so a reshaped literal fails loudly instead of quietly
 * shrinking the self-city set.
 */
export function loadCentralOregonCitySlugs(root = process.cwd()) {
  const src = readFileSync(join(root, 'lib', 'central-oregon.ts'), 'utf8')
  const m = src.match(/CENTRAL_OREGON_CITY_SLUGS[^=]*=\s*new Set<string>\(\[([\s\S]*?)\]\)/)
  if (!m) throw new Error('registry-area-twins: CENTRAL_OREGON_CITY_SLUGS literal not found in lib/central-oregon.ts')
  const slugs = new Set()
  for (const q of m[1].matchAll(/'([a-z0-9-]+)'/g)) slugs.add(q[1])
  if (slugs.size === 0) throw new Error('registry-area-twins: CENTRAL_OREGON_CITY_SLUGS parsed empty')
  return slugs
}

export function loadResortRegistry(root = process.cwd()) {
  const raw = JSON.parse(readFileSync(join(root, 'data', 'resort-communities.json'), 'utf8'))
  const list = Array.isArray(raw) ? raw : (raw.communities ?? [])
  return list.filter((e) => e && typeof e.slug === 'string' && typeof e.city_slug === 'string')
}

/** Same rule as lib/communities/self-city-community.ts isOwnCity. */
export function isSelfCityEntry(entry, citySlugs) {
  const slug = String(entry.slug).trim().toLowerCase()
  return slug === String(entry.city_slug).trim().toLowerCase() || citySlugs.has(slug)
}

/** Every `/homes-for-sale/<city>/<area>` twin of one registry entry, sorted. */
export function areaTwinPathsFor(entry, citySlugs) {
  const durable = String(entry.slug).trim().toLowerCase()
  const cities = new Set([String(entry.city_slug).trim().toLowerCase()])
  for (const c of entry.mls_cities ?? []) cities.add(slugifyCommunityName(c))
  if (isSelfCityEntry(entry, citySlugs)) cities.add(durable)
  const areas = new Set([durable, publicCommunitySlug(entry)])
  const paths = []
  for (const city of cities) for (const area of areas) paths.push(`/homes-for-sale/${city}/${area}`)
  return paths.sort()
}

/** `{ '/homes-for-sale/<city>/<area>': '/communities/<public slug>' }` for the whole registry. */
export function registryAreaTwinRedirects({ registry, citySlugs }) {
  const map = {}
  for (const entry of registry) {
    const dest = `/communities/${publicCommunitySlug(entry)}`
    for (const path of areaTwinPathsFor(entry, citySlugs)) map[path] = dest
  }
  return map
}
