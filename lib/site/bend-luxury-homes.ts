/**
 * "Bend luxury homes for sale" has ONE winner: /homes-for-sale/bend/luxury
 * (the city x `luxury` preset search, PAGE_OUTLINE one-winner, SITE-185).
 *
 * GSC 2026-08-24..09-20, queries containing "bend luxury": 224 impressions,
 * 0 clicks, split /luxury-homes-bend 64% (pos 27.5), /housing-market/bend 31%
 * (the appreciation queries, which that page keeps), a Caldera Springs post
 * 2%, a Moonshadow listing 1%. The winner held 0% because nothing linked it:
 * every "Luxury homes in Bend" door in the chrome, the footer, the city and
 * communities pages went to /luxury-homes-bend, which 308'd onto the Bend
 * search with a ?minPrice query string, and the legacy /luxury-homes-bend-oregon
 * chain folded that query string into a path and died on "City not found".
 *
 * This module is the one place the winner's path, its door label, and its
 * title / h1 phrase are typed. Nothing hand-lists the path elsewhere; the
 * redirect sources (next.config.ts, data/legacy-redirects.json) carry the same
 * literal because neither can import from lib/.
 */
import type { SearchPreset } from '@/lib/search-presets'

export const BEND_LUXURY_HOMES_PATH = '/homes-for-sale/bend/luxury'

/** The phrase people search, as anchor text. */
export const BEND_LUXURY_HOMES_LABEL = 'Bend luxury homes for sale'

/** Retired URLs that 301 onto the winner in one hop. */
export const BEND_LUXURY_LEGACY_PATHS = ['/luxury-homes-bend', '/luxury-homes-bend-oregon'] as const

export const LUXURY_PRESET_SLUG = 'luxury'

/** The sitewide door: chrome, footer, city and community edges all use it. */
export function bendLuxuryHomesDoor(): { href: string; label: string } {
  return { href: BEND_LUXURY_HOMES_PATH, label: BEND_LUXURY_HOMES_LABEL }
}

export function isLuxuryPreset(preset: Pick<SearchPreset, 'slug'> | null | undefined): boolean {
  return preset?.slug === LUXURY_PRESET_SLUG
}

/**
 * The win query in human form for a `luxury` preset page: "{Place} luxury
 * homes for sale". Title and h1 share it (PAGE_OUTLINE Title / H1 rules:
 * place name first, never two pages with the same h1 - the place makes each
 * one distinct). Null for every other preset, so callers keep their own
 * composition.
 */
export function luxuryPresetHeading(
  preset: Pick<SearchPreset, 'slug'> | null | undefined,
  placeName: string,
): string | null {
  if (!isLuxuryPreset(preset)) return null
  const place = placeName.trim()
  if (!place) return 'Luxury homes for sale'
  return `${place} luxury homes for sale`
}

/**
 * Meta description for a `luxury` preset page. Opens on the query. The floor
 * is the preset's own `minPrice` filter parameter (lib/search-presets.ts), a
 * filter definition rather than a market figure, so it needs no data trace.
 */
export function luxuryPresetDescription(
  preset: Pick<SearchPreset, 'slug' | 'params'> | null | undefined,
  placeName: string,
): string | null {
  const heading = luxuryPresetHeading(preset, placeName)
  if (!heading || !preset) return null
  const minPrice = preset.params.minPrice
  const floor =
    typeof minPrice === 'number' && Number.isFinite(minPrice) && minPrice > 0
      ? ` priced ${formatFloor(minPrice)} and up`
      : ''
  return `${heading}: live luxury real estate listings in ${placeName.trim()}${floor}, from the regional MLS, with price, size, and the map.`
}

function formatFloor(value: number): string {
  if (value >= 1_000_000 && value % 100_000 === 0) {
    const millions = value / 1_000_000
    return `$${Number.isInteger(millions) ? millions : millions.toFixed(1)} million`
  }
  return `$${value.toLocaleString('en-US')}`
}
