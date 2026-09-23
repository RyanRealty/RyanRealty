/**
 * place-type-twin — ONE URL per (place, property type) (visibility audit
 * 2026-09-22, EXP-6).
 *
 * Two URL families answered the same query. /cities/{city}/types/{type} and
 * /communities/{community}/types/{type} are the richer page (count in the
 * title, the Atlas, a photographed rail; live 2026-09-22: /cities/bend/types/
 * single-family "757 single-family homes for sale in Bend, Oregon", 122
 * listing links) but sat in no sitemap. Their search-preset twins,
 * /homes-for-sale/{city}/{type} and /homes-for-sale/{city}/{community}/{type},
 * were sitemapped, indexable and self-canonical ("Single-Family Homes in Bend",
 * 9 listing links).
 *
 * The rule, read by the sitemap AND the search route's metadata:
 *   - a preset whose slug IS a place-type slug (PLACE_TYPE_PAGE_SLUGS: the ten
 *     type pages use the old preset slugs verbatim), and
 *   - a VERIFIED positive active count for that preset at that scope, from the
 *     search matrix (the same count that already decides whether the preset
 *     twin is emitted or noindexed; its filters are the type page's filters:
 *     single-family = PropertySubType 'Single Family Residence', lots = class
 *     D, and so on — lib/search-presets.ts vs lib/place/place-type-page.ts)
 * => the type page is emitted in the sitemap's types leg, and the preset twin
 *    carries rel=canonical to it and leaves the sitemap. A canonical, not a
 *    301: the preset page is a filterable search a visitor may still want.
 * Unknown or zero count => no twin: the preset page keeps its own canonical
 * and its existing W3.1 / W3.2 zero rule, and the type page is not submitted.
 *
 * No menu change: SITE_PAGES.md's locked menu has no property-type column; the
 * type pages are reached from the place pages and the sitemap.
 */

import { SITE_CITY_SLUGS } from '@/lib/central-oregon'
import { getAllResortCommunities, type ResortCommunityEntry } from '@/lib/data/communities/registry'
import { publicCommunitySlug } from '@/lib/communities/community-public-pair'
import { PLACE_TYPE_PAGE_SLUGS } from '@/lib/place/publish-place-type-cards'
import { slugify } from '@/lib/slug'
import { cityPresetPath, matrixPath } from './search-matrix'

const TYPE_SLUGS: ReadonlySet<string> = new Set<string>(PLACE_TYPE_PAGE_SLUGS)

/**
 * Cities whose /cities/{city}/types/{type} pages RENDER. Measured live
 * 2026-09-23 over every candidate the types leg would submit (a positive
 * matrix count): the ten SITE_CITY_SLUGS cities answered 71 of 71 with 200,
 * "index, follow"; every other service-area city answered 17 of 17 with HTTP
 * 500 (Metolius, Black Butte Ranch, Camp Sherman, Paulina, Ashwood, Brothers,
 * Mitchell, Post). A canonical or a sitemap entry must never point at a 500, so
 * the twin rule is limited to the cities with a real hub until those pages
 * render. The 500 itself is a defect in app/cities/[slug]/types/[type] (re-read
 * 2026-09-23: /cities/metolius/types/single-family and
 * /cities/camp-sherman/types/single-family still 500), outside this rule;
 * widen TYPE_PAGE_CITY_SLUGS once those pages render.
 */
const TYPE_PAGE_CITY_SLUGS: ReadonlySet<string> = new Set<string>(SITE_CITY_SLUGS)

export function isPlaceTypePresetSlug(slug: string | null | undefined): boolean {
  return TYPE_SLUGS.has((slug ?? '').trim().toLowerCase())
}

export function cityTypePagePath(citySlug: string, typeSlug: string): string {
  return `/cities/${citySlug}/types/${typeSlug}`
}

export function communityTypePagePath(communityPublicSlug: string, typeSlug: string): string {
  return `/communities/${communityPublicSlug}/types/${typeSlug}`
}

/**
 * The registry community the search matrix enumerates at (citySlug, areaSlug).
 * The matrix keys a resort geo as (resort.city_slug, slugify(resort.label))
 * (lib/seo/getSearchMatrixEntries.ts), so this matches exactly that key.
 */
export function matrixResortAt(citySlug: string, areaSlug: string): ResortCommunityEntry | null {
  const city = citySlug.trim().toLowerCase()
  const area = areaSlug.trim().toLowerCase()
  return getAllResortCommunities().find((c) => c.city_slug === city && slugify(c.label) === area) ?? null
}

/**
 * /homes-for-sale/{city}/{type} -> /cities/{city}/types/{type}, or null.
 * `positiveCityPresets` is the matrix's verified-positive city x preset set;
 * null (the matrix read failed) is never a twin.
 */
export function cityPresetTypeTwin(
  citySlug: string,
  presetSlug: string,
  positiveCityPresets: ReadonlySet<string> | null,
): string | null {
  const city = citySlug.trim().toLowerCase()
  const preset = presetSlug.trim().toLowerCase()
  if (!city || !isPlaceTypePresetSlug(preset) || !positiveCityPresets) return null
  if (!TYPE_PAGE_CITY_SLUGS.has(city)) return null
  if (!positiveCityPresets.has(cityPresetPath(city, preset))) return null
  return cityTypePagePath(city, preset)
}

/**
 * /homes-for-sale/{city}/{community}/{type} -> /communities/{c}/types/{type},
 * or null. `positivePaths` is the matrix's verified-positive 3-segment set.
 */
export function communityPresetTypeTwin(
  citySlug: string,
  areaSlug: string,
  presetSlug: string,
  positivePaths: ReadonlySet<string> | null,
): string | null {
  const city = citySlug.trim().toLowerCase()
  const area = areaSlug.trim().toLowerCase()
  const preset = presetSlug.trim().toLowerCase()
  if (!city || !area || !isPlaceTypePresetSlug(preset) || !positivePaths) return null
  const resort = matrixResortAt(city, area)
  if (!resort) return null
  if (!positivePaths.has(matrixPath(city, area, preset))) return null
  return communityTypePagePath(publicCommunitySlug(resort), preset)
}

/**
 * Every type page with a verified-positive count, for the sitemap's types leg.
 * Cities come from the caller (the same service-area set the /cities hubs are
 * emitted for); communities from the registry. Sorted and deduped so the leg is
 * stable across regenerations.
 */
export function placeTypeSitemapPaths(
  citySlugs: readonly string[],
  sets: { positiveCityPresets: ReadonlySet<string>; positivePaths: ReadonlySet<string> } | null,
): string[] {
  if (!sets) return []
  const out = new Set<string>()
  for (const citySlug of citySlugs) {
    for (const type of PLACE_TYPE_PAGE_SLUGS) {
      const path = cityPresetTypeTwin(citySlug, type, sets.positiveCityPresets)
      if (path) out.add(path)
    }
  }
  for (const resort of getAllResortCommunities()) {
    for (const type of PLACE_TYPE_PAGE_SLUGS) {
      const path = communityPresetTypeTwin(resort.city_slug, slugify(resort.label), type, sets.positivePaths)
      if (path) out.add(path)
    }
  }
  return [...out].sort()
}
