/**
 * Report-coverage geo registry (W8.8) — the ONE place the Central Oregon
 * report-city sets are spelled out.
 *
 * Before this, the "report core 7" was duplicated inline in four files
 * (getMarketReportData `CITY_SLUGS`, market-stat-consistency `VERDICT_CITIES`,
 * generate-market-report `VERDICT_CITY_SLUGS`, getContactReportSubscriptions
 * `CENTRAL_OREGON_CITIES`) and the newsletter carried a drifted 6-city subset —
 * so a coverage change had to be made in N places and silently drifted between
 * them. Every report-coverage consumer now imports from here.
 *
 * This is NOT the service-area source. That is `lib/central-oregon.ts`
 * (`SITE_CITY_SLUGS` / `CENTRAL_OREGON_CITY_SLUGS`, the 10/27-slug site geo set).
 * Report coverage is a smaller, verified tier: the cities the CRM report engine
 * serves a §0-traced market verdict for.
 *
 * ENFORCEMENT: the report-core-7 literal may appear ONLY in this file —
 * scripts/check-report-geo-registry.mjs (ci:report-geo-registry) fails the build
 * if any array/Set literal outside `lib/data/geo/` (and *.test.ts) is exactly the
 * report-core set. Add a new report tier as a NAMED export here, never inline.
 */

export type ReportCity = { slug: string; label: string }

/**
 * The report core: the 7 Central Oregon cities the report engine serves as
 * cities (each resolves as `city`, not `neighborhood`). Ordered — consumers that
 * render or seed in order (market-verdict lists, the subscription area floor)
 * depend on this order. Spellings are the canonical MLS `listings.City` values
 * ("La Pine", "Sunriver" — verified against the live table).
 */
export const REPORT_CITIES: readonly ReportCity[] = [
  { slug: 'bend', label: 'Bend' },
  { slug: 'redmond', label: 'Redmond' },
  { slug: 'sisters', label: 'Sisters' },
  { slug: 'sunriver', label: 'Sunriver' },
  { slug: 'tumalo', label: 'Tumalo' },
  { slug: 'la-pine', label: 'La Pine' },
  { slug: 'terrebonne', label: 'Terrebonne' },
]

/** Report-core slugs, canonical order. */
export const REPORT_CITY_SLUGS: readonly string[] = REPORT_CITIES.map((c) => c.slug)

/** Report-core display names (MLS City spellings), canonical order. */
export const REPORT_CITY_LABELS: readonly string[] = REPORT_CITIES.map((c) => c.label)

/** O(1) membership set for the `city` vs `neighborhood` classification. */
export const REPORT_CITY_SLUG_SET: ReadonlySet<string> = new Set(REPORT_CITY_SLUGS)

/**
 * The newsletter Market section's cities — the report core MINUS Terrebonne, in
 * the newsletter's historical RENDER ORDER (la-pine before tumalo, which differs
 * from the report core's tumalo-first order). Spelled out rather than derived via
 * `.filter(REPORT_CITY_SLUGS)` for two reasons: (1) the filter would inherit the
 * core's order and silently swap the La Pine / Tumalo meter rows in the monthly
 * draft; (2) an explicit array makes this a gate-OWNED set, so a re-inline of the
 * newsletter 6 elsewhere is caught too. The newsletter has always covered these
 * 6; if it should cover all 7, add 'terrebonne' (a content change — confirm first).
 */
export const NEWSLETTER_MARKET_CITY_SLUGS: readonly string[] = [
  'bend',
  'redmond',
  'sisters',
  'sunriver',
  'la-pine',
  'tumalo',
]

/**
 * Wider stat tier (11, display names) — the home-page snapshot, market-pulse
 * carousel, listing-video geos, the /reports page, and the refresh-market-stats
 * crons. A SUPERSET of the report core with the outer-county cities (Madras,
 * Prineville, Powell Butte, Crooked River Ranch). Deliberately DISTINCT from the
 * report core — folding it in would drop those 4 cities from the stat crons.
 */
export const MARKET_REPORT_DEFAULT_CITIES = [
  'Bend',
  'Redmond',
  'Sisters',
  'La Pine',
  'Sunriver',
  'Tumalo',
  'Terrebonne',
  'Madras',
  'Prineville',
  'Powell Butte',
  'Crooked River Ranch',
] as const

/**
 * The /cities feature tier (9, display names, EXACT display order) — the
 * top-of-/cities cards, sales-report card routing, and the map pins
 * (`lib/map-constants.ts` order matches this). A distinct set from the report
 * core and the stat tier; order is load-bearing (map pins + card order), and the
 * spellings are the canonical MLS `listings.City` values (a non-canonical
 * spelling produces permanently-empty "No sales this period" cards).
 */
export const PRIMARY_CITIES = [
  'Bend',
  'Redmond',
  'La Pine',
  'Sisters',
  'Sunriver',
  'Tumalo',
  'Crooked River Ranch',
  'Prineville',
  'Madras',
] as const
