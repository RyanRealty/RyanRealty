/**
 * report-geo — city-qualified geo resolution for exported market documents. PURE.
 *
 * WHY (§0). `market_stats_cache` keys a community by a BARE slug: geo_type
 * 'subdivision' and 'neighborhood' rows are `tetherow`, `sunriver`,
 * `deer-park` — no city anywhere in the key (verified live 2026-07-24: 101
 * subdivision rows and 4,987 neighborhood rows, zero city-qualified). So a
 * lookup that takes a city and a community name and then queries by the
 * community name alone silently ignores the city. `/api/reports/export?city=
 * Madras&subdivision=Tetherow` produced a Ryan Realty-branded workbook titled
 * "Tetherow, Madras" carrying Bend's Tetherow numbers.
 *
 * The bound therefore has to be a registry that KNOWS which city a community
 * belongs to, not "whatever slug happens to exist in the cache".
 * `data/resort-communities.json` is that registry (CLAUDE.md names it the
 * source of truth), and every entry carries `city` + `city_slug`.
 *
 * A community outside the registry is REFUSED rather than served: there is no
 * city-qualified source that could confirm it, and this endpoint is public,
 * unauthenticated, and stamps the brokerage's name on what it returns.
 *
 * ONE GENERATION PATH (W8.1). A registry hit resolves to geo_type
 * 'neighborhood' — the SAME row `getMarketStatsForSubdivision` and the
 * community page read. The export used to read the community's geo_type
 * 'subdivision' row instead, which is literal-SubdivisionName-equality while
 * 'neighborhood' is the alias-aware aggregate, so the two disagreed about the
 * same community over the same window (verified live 2026-07-24, YTD
 * 2026-01-01..2026-07-24: Tetherow 9 sold / $2,600,000 as a subdivision vs 18
 * sold / $1,414,000 as a neighborhood; Black Butte Ranch 0 vs 17; Sunriver 0
 * vs 43). An exported PDF may not contradict the page it was exported from.
 */
import resortRegistry from '@/data/resort-communities.json' assert { type: 'json' }
import { slugify } from '@/lib/slug'

type RegistryCommunity = {
  slug: string
  label: string
  city: string
  city_slug: string
}

/** A community the registry can place in a specific city. */
export type ReportCommunity = {
  /** Bare cache slug — the `neighborhood` geo_slug, e.g. 'tetherow'. */
  slug: string
  /** Display name, e.g. 'Tetherow'. */
  label: string
  /** The registry's city for this community, NOT the caller's. */
  city: string
}

const REGISTRY = resortRegistry.communities as RegistryCommunity[]

/** Every registry community in `city`, alphabetical. Also the 400-response menu. */
export function reportCommunitiesInCity(city: string): ReportCommunity[] {
  const target = slugify(city)
  return REGISTRY.filter((c) => c.city_slug === target)
    .map((c) => ({ slug: c.slug, label: c.label, city: c.city }))
    .sort((a, b) => a.label.localeCompare(b.label, 'en', { sensitivity: 'base' }))
}

/**
 * Resolve a caller-supplied community name WITHIN a city. Accepts the display
 * label or the slug, case- and punctuation-insensitively (`Black Butte Ranch`,
 * `black-butte-ranch`, `BLACK  BUTTE  RANCH` all resolve).
 *
 * Returns null when the registry has no such community IN THAT CITY — including
 * the case where the community exists under a DIFFERENT city, which is exactly
 * the mismatch that produced the "Tetherow, Madras" document. A near-miss is
 * still a miss: this never falls back to a name-only match.
 */
export function resolveReportCommunity(city: string, community: string): ReportCommunity | null {
  // Guard the RAW input, not the slug. `slugify` returns the literal string
  // 'unknown' for anything that reduces to empty (lib/slug.ts), never '', so a
  // `if (!slugify(x)) return null` guard is dead code AND lets `?subdivision=***`
  // through as the slug 'unknown' — which would resolve if a community were ever
  // slugged that. Refuse blank input here instead.
  if (!community?.trim()) return null
  const wanted = slugify(community)
  return reportCommunitiesInCity(city).find((c) => c.slug === wanted || slugify(c.label) === wanted) ?? null
}
