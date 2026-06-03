/**
 * lib/popular-searches.ts — per-city "most popular searches" used by the Homes
 * mega-menu and (optionally) a /homes-for-sale hub.
 *
 * Single source of truth so the menu and any hub stay in sync. Each entry pairs
 * a city (matching CITY_LINKS in site-nav.ts and app/cities/[slug]) with the
 * preset slugs that genuinely fit that city's inventory.
 *
 * Data-grounded (NOT invented): the preset list per city was chosen from a live
 * query of active SFR inventory in Supabase project dwvlophlbvvygjfxcrhm
 * (PropertyType='A', StandardStatus='Active') on 2026-06-03 — median price,
 * price-tier counts, acreage share, new-construction (year built in the last
 * ~2 years), condos/townhomes subtype counts, mountain/river/golf View counts,
 * and shop/RV PublicRemarks matches. The price tier shown per city tracks that
 * city's median (e.g. Bend median ~$819K leads with under-1m/under-750k; La Pine
 * and Madras lead with under-400k/under-500k). Every preset slug here is one the
 * search_listings_advanced RPC can actually honor — no empty-result presets.
 *
 * IMPORTANT: every slug below must exist in SEARCH_PRESETS (lib/search-presets.ts).
 * The 'on-golf-course' preset is intentionally NOT used — it reads the
 * amenities.golf_view flag which is unpopulated across the service area (0 rows
 * everywhere). The golf intent is served by 'golf-course-view' (details.View),
 * which returns real inventory.
 */

import type { SearchPreset } from '@/lib/search-presets'
import { getPresetBySlug } from '@/lib/search-presets'
import { cityEntityKey, homesForSalePath } from '@/lib/slug'

export type CityPopularSearches = {
  /** Display name, matches CITY_LINKS label. */
  city: string
  /** URL slug, matches cityEntityKey(city). */
  citySlug: string
  /** Ordered preset slugs (most relevant first). All must exist in SEARCH_PRESETS. */
  presetSlugs: string[]
}

/**
 * Ten highest-intent searches per city, ordered most-relevant first.
 * Grounded in each city's active inventory (see file header for the data trace).
 */
export const CITY_POPULAR_SEARCHES: CityPopularSearches[] = [
  {
    // Bend — median ~$819K. Deep mid-to-upper market, strong luxury (393),
    // new construction (248), mountain-view (227), townhomes (88) + condos (67),
    // river-view (55), acreage (155).
    city: 'Bend',
    citySlug: 'bend',
    presetSlugs: [
      'under-750k',
      'under-1m',
      'luxury',
      'new-construction',
      'mountain-view',
      'townhomes',
      'condos',
      'river-view',
      'single-level',
      'new-listings',
    ],
  },
  {
    // Redmond — median ~$550K. Value mid-market: under-500k (130), under-600k
    // (199), townhomes (56), single-level (100), new construction (70),
    // mountain-view (110), shop (95), acreage (37).
    city: 'Redmond',
    citySlug: 'redmond',
    presetSlugs: [
      'under-500k',
      'under-600k',
      'under-750k',
      'single-level',
      'new-construction',
      'townhomes',
      'mountain-view',
      'with-shop',
      'acreage',
      'new-listings',
    ],
  },
  {
    // Sisters — median ~$732K. Upper market, very little under-400k (2);
    // under-750k (71), luxury (34), acreage (44), townhomes (14), mountain-view
    // (37), new construction (20), condos (7).
    city: 'Sisters',
    citySlug: 'sisters',
    presetSlugs: [
      'under-750k',
      'under-1m',
      'luxury',
      'acreage',
      'mountain-view',
      'single-level',
      'new-construction',
      'townhomes',
      'with-shop',
      'new-listings',
    ],
  },
  {
    // Sunriver — resort market, median ~$677K. Condo-heavy (27), golf-view (15),
    // under-500k (44), under-750k (68), luxury (20). No acreage (resort lots).
    city: 'Sunriver',
    citySlug: 'sunriver',
    presetSlugs: [
      'condos',
      'golf-course-view',
      'under-500k',
      'under-750k',
      'under-1m',
      'luxury',
      'with-view',
      'with-fireplace',
      'single-level',
      'new-listings',
    ],
  },
  {
    // La Pine — affordable + land. Median ~$499K, under-400k (57), under-500k
    // (120), acreage (137 of 233 SFR), shop (120), RV (99), single-level (47).
    city: 'La Pine',
    citySlug: 'la-pine',
    presetSlugs: [
      'under-400k',
      'under-500k',
      'acreage',
      'with-shop',
      'rv-parking',
      'single-level',
      'acreage-5',
      'new-construction',
      'river-view',
      'new-listings',
    ],
  },
  {
    // Prineville — affordable + land. Median ~$485K, under-400k (56), under-500k
    // (111), acreage (87), shop (83), RV (91), single-level (38), lake-view (7).
    city: 'Prineville',
    citySlug: 'prineville',
    presetSlugs: [
      'under-400k',
      'under-500k',
      'acreage',
      'with-shop',
      'rv-parking',
      'single-level',
      'acreage-5',
      'mountain-view',
      'new-construction',
      'new-listings',
    ],
  },
  {
    // Madras — most affordable. Median ~$428K, under-400k (46), under-500k (79),
    // mountain-view (46), townhomes (7), shop (36), acreage (27), new constr (20).
    city: 'Madras',
    citySlug: 'madras',
    presetSlugs: [
      'under-300k',
      'under-400k',
      'under-500k',
      'mountain-view',
      'single-level',
      'with-shop',
      'acreage',
      'new-construction',
      'townhomes',
      'new-listings',
    ],
  },
  {
    // Terrebonne — acreage country. Median ~$647K, acreage (64 of 74 SFR),
    // mountain-view (55), under-750k (45), shop (42), RV (32), acreage-5 (20).
    city: 'Terrebonne',
    citySlug: 'terrebonne',
    presetSlugs: [
      'acreage',
      'mountain-view',
      'under-600k',
      'under-750k',
      'acreage-5',
      'with-shop',
      'rv-parking',
      'single-level',
      'luxury',
      'new-listings',
    ],
  },
  {
    // Powell Butte — luxury acreage. Median ~$1.26M, luxury (37 of 54),
    // mountain-view (42), acreage (25), acreage-5 (18), new construction (10).
    city: 'Powell Butte',
    citySlug: 'powell-butte',
    presetSlugs: [
      'luxury',
      'acreage',
      'acreage-5',
      'mountain-view',
      'under-1m',
      'under-1-5m',
      'new-construction',
      'with-shop',
      'single-level',
      'new-listings',
    ],
  },
  {
    // Culver — small + rural. Median ~$599K, acreage (21 of 27 SFR),
    // mountain-view (22), under-600k (14), shop (11), lake-view (3).
    city: 'Culver',
    citySlug: 'culver',
    presetSlugs: [
      'acreage',
      'mountain-view',
      'under-500k',
      'under-600k',
      'acreage-5',
      'with-shop',
      'rv-parking',
      'single-level',
      'lake-view',
      'new-listings',
    ],
  },
]

const POPULAR_BY_SLUG = new Map(CITY_POPULAR_SEARCHES.map((c) => [c.citySlug, c]))

export type PopularSearchLink = {
  href: string
  label: string
  shortLabel: string
}

/** Resolve a city's popular searches to ready-to-render links (label + href). */
export function getPopularSearchesForCity(citySlug: string, limit?: number): PopularSearchLink[] {
  const entry = POPULAR_BY_SLUG.get(citySlug)
  if (!entry) return []
  const slugs = limit != null ? entry.presetSlugs.slice(0, limit) : entry.presetSlugs
  const links: PopularSearchLink[] = []
  for (const slug of slugs) {
    const preset: SearchPreset | null = getPresetBySlug(slug)
    if (!preset) continue
    links.push({
      href: `${homesForSalePath(entry.city)}/${preset.slug}`,
      label: preset.shortLabel,
      shortLabel: preset.shortLabel,
    })
  }
  return links
}

/** "All [City] homes" link for a city. */
export function getAllCityHomesLink(citySlug: string): PopularSearchLink | null {
  const entry = POPULAR_BY_SLUG.get(citySlug)
  if (!entry) return null
  return {
    href: homesForSalePath(entry.city),
    label: `All ${entry.city} homes`,
    shortLabel: entry.city,
  }
}

/** Helper so callers don't re-import cityEntityKey just to slug a city. */
export function citySlugFor(city: string): string {
  return cityEntityKey(city)
}
