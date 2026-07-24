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
 * depend on this order. Spellings are the MLS `listings."City"` values, verified
 * live 2026-07-24, EXCEPT `Tumalo`: it is NOT a distinct MLS city (0 `City` rows;
 * its inventory files under City="Bend" by SubdivisionName). Tumalo is kept here
 * for report/URL identity and is documented in `NON_MLS_CITY_EXEMPTIONS` below;
 * `ci:market-city-mls-canon` (G57) proves every other name matches a real `City`.
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
 *
 * NOT every entry is a distinct MLS `listings."City"` value: `Tumalo` (0 rows;
 * files under Bend) and `Crooked River Ranch` (0 rows; live inventory files under
 * Terrebonne, historical under the now-dead "Crooked River" string) each match
 * nothing, so their city cache + /cities page are permanently empty. They are
 * kept for coverage/identity and recorded in `NON_MLS_CITY_EXEMPTIONS` below. The
 * stat crons that consume this list lower()-key on the name, so those two write
 * empty stubs rather than a wrong number (§0-latent). See `ci:market-city-mls-canon`
 * (G57), which fails CI if any entry here matches no `City` and is not exempted.
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
 * core and the stat tier; order is load-bearing (map pins + card order).
 *
 * Spellings are the MLS `listings."City"` values EXCEPT `Tumalo` and `Crooked
 * River Ranch`, which match 0 rows — exactly the "non-canonical spelling →
 * permanently-empty card" case, but INTRINSIC here, not a typo: neither is a
 * distinct MLS city (Tumalo → Bend, CRR → Terrebonne, by SubdivisionName). Today
 * `/cities/tumalo` 307-redirects to /cities/bend and `/cities/crooked-river-ranch`
 * 404s (no `geo_snapshot_mv` row). Both are documented in `NON_MLS_CITY_EXEMPTIONS`
 * below; `ci:market-city-mls-canon` (G57) enforces the rest.
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

/**
 * City-tier registry NAMES that are deliberately NOT distinct MLS
 * `listings."City"` values. Every OTHER name across REPORT_CITIES /
 * MARKET_REPORT_DEFAULT_CITIES / PRIMARY_CITIES lower()-matches a real `City`
 * with live inventory (Bend, Redmond, Sisters, Sunriver, La Pine, Terrebonne,
 * Madras, Prineville, Powell Butte — all verified live 2026-07-24). These two do
 * not, and by the MLS's own filing convention never will: each community's
 * listings file under a PARENT city plus a `SubdivisionName`.
 *
 * Why EXEMPTED, not ALIASED to the parent city: `compute_and_cache_period_stats`
 * keys a city on `lower("City") = lower(p_geo_slug)`, so aliasing "Crooked River
 * Ranch" to "Terrebonne" for the cache would publish ALL of Terrebonne's stats
 * under the CRR label (and all of Bend's under Tumalo) — a §0 MISATTRIBUTION, far
 * worse than an honest empty. A community's correct market surface is
 * subdivision/community-scoped, not city-scoped.
 *
 * `ci:market-city-mls-canon` (G57, nightly — reads live Supabase) enforces:
 *   • a city-tier name matching 0 `City` rows AND not exempted here → FAIL
 *   • an exempted name that starts matching > 0 `City` rows → FAIL (un-exempt it)
 *   • an exemption whose documented `mlsCity` + `subdivisionMatch` home has 0
 *     rows → FAIL (the "the real listings live here" claim must stay true)
 *
 * Verified live 2026-07-24 (§0, PostgREST exact count):
 *   Crooked River Ranch — `City` rows = 0. Historical rows filed as City="Crooked
 *     River" (3,256 rows, all Closed/Expired/Canceled ≤ 2019). LIVE inventory
 *     files under City="Terrebonne", `SubdivisionName` ~ 'Crooked River Ranch' /
 *     'Crr%' (51 active SFR; closes through Jul 2026; ZIP 97760). Its `/cities`
 *     page 404s; its live surface is `/communities/crooked-river-ranch` (which
 *     today matches only the LITERAL "Crooked River Ranch" subdivision, not every
 *     'Crr%' variant — a separate undercount to close).
 *   Tumalo — `City` rows = 0. LIVE inventory files under City="Bend",
 *     `SubdivisionName` ~ 'Tumalo Heights' / 'Tumalo Rim'. `/cities/tumalo`
 *     307-redirects to `/cities/bend` (next.config.ts). No aggregated Tumalo
 *     subdivision page exists yet.
 */
export const NON_MLS_CITY_EXEMPTIONS: Readonly<
  Record<
    string,
    {
      readonly reason: string
      /** The MLS `listings."City"` value the community's listings actually file under. */
      readonly mlsCity: string
      /** ILIKE pattern(s) that isolate the community within `mlsCity`. */
      readonly subdivisionMatch: readonly string[]
      /** Canonical surface that renders this community correctly today. */
      readonly servedAt: string
    }
  >
> = {
  'Crooked River Ranch': {
    reason: 'Rural planned community in Terrebonne; its own-City string ("Crooked River") went dead in 2019.',
    mlsCity: 'Terrebonne',
    subdivisionMatch: ['Crooked River Ranch', 'Crr%'],
    servedAt: '/communities/crooked-river-ranch',
  },
  Tumalo: {
    reason: 'Bend-area community; the MLS files it under Bend by SubdivisionName, never as its own City.',
    mlsCity: 'Bend',
    subdivisionMatch: ['Tumalo%'],
    servedAt: '/cities/bend',
  },
}
