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
 * Wider stat tier (9, display names) — the home-page snapshot, market-pulse
 * carousel, listing-video geos, the /reports page, and the refresh-market-stats
 * crons. Adds the outer-county cities (Madras, Prineville, Powell Butte) to most
 * of the report core.
 *
 * Every entry is a real MLS `listings."City"` value (verified live 2026-07-24).
 * `Tumalo` and `Crooked River Ranch` were REMOVED here 2026-07-24 (Matt's call):
 * neither is a distinct MLS city — Tumalo files under Bend, CRR under Terrebonne,
 * by SubdivisionName — so each produced a permanently-empty city cache stub. CRR
 * now redirects to /communities/crooked-river-ranch; Tumalo already redirects to
 * /cities/bend (both in next.config.ts). `ci:market-city-mls-canon` (G57) fails
 * CI if any entry here matches no `City` and is not exempted. (Tumalo still
 * appears in REPORT_CITIES + NEWSLETTER_MARKET_CITY_SLUGS — separate literals,
 * left as-is here; its exemption below still covers those.)
 */
export const MARKET_REPORT_DEFAULT_CITIES = [
  'Bend',
  'Redmond',
  'Sisters',
  'La Pine',
  'Sunriver',
  'Terrebonne',
  'Madras',
  'Prineville',
  'Powell Butte',
] as const

/**
 * The /cities feature tier (7, display names, EXACT display order) — the
 * top-of-/cities cards, sales-report card routing, and the map pins
 * (`lib/map-constants.ts` order matches this). A distinct set from the report
 * core and the stat tier; order is load-bearing (map pins + card order).
 *
 * Every entry is a real MLS `listings."City"` value. `Tumalo` and `Crooked River
 * Ranch` were REMOVED 2026-07-24 (Matt's call) — neither is a distinct MLS city,
 * so their /cities pages were permanently empty. `/cities/crooked-river-ranch`
 * now redirects to /communities/crooked-river-ranch and `/cities/tumalo` to
 * /cities/bend (next.config.ts). (The /cities index `FEATURED_CITY_SLUGS` cards
 * and the `lib/map-constants.ts` pins are separate literals and still list both,
 * now leading to those redirects.) `ci:market-city-mls-canon` (G57) enforces
 * that every remaining name matches a real `City`.
 */
export const PRIMARY_CITIES = [
  'Bend',
  'Redmond',
  'La Pine',
  'Sisters',
  'Sunriver',
  'Prineville',
  'Madras',
] as const

/**
 * City-tier registry NAMES that are deliberately NOT distinct MLS
 * `listings."City"` values but still appear in a gate-checked registry. Every
 * OTHER name across REPORT_CITIES / MARKET_REPORT_DEFAULT_CITIES / PRIMARY_CITIES
 * lower()-matches a real `City` with live inventory (Bend, Redmond, Sisters,
 * Sunriver, La Pine, Terrebonne, Madras, Prineville, Powell Butte — all verified
 * live 2026-07-24).
 *
 * `Crooked River Ranch` used to live here too, but on 2026-07-24 (Matt's call) it
 * was REMOVED from MARKET_REPORT_DEFAULT_CITIES + PRIMARY_CITIES and its `/cities`
 * URL now redirects to `/communities/crooked-river-ranch` — its real, live surface
 * (Terrebonne + `SubdivisionName` ~ 'Crooked River Ranch' / 'Crr%'). It no longer
 * appears in any gate-checked registry, so it needs no exemption. `Tumalo` was
 * removed from those two tiers as well, but STILL appears in REPORT_CITIES (the
 * report core) + NEWSLETTER_MARKET_CITY_SLUGS, so it stays exempted here.
 *
 * Why EXEMPTED, not ALIASED to the parent city: `compute_and_cache_period_stats`
 * keys a city on `lower("City") = lower(p_geo_slug)`, so aliasing "Tumalo" to
 * "Bend" for the cache would publish ALL of Bend's stats under the Tumalo label —
 * a §0 MISATTRIBUTION, far worse than an honest empty. A community's correct
 * market surface is subdivision/community-scoped, not city-scoped.
 *
 * `ci:market-city-mls-canon` (G57, nightly — reads live Supabase) enforces:
 *   • a city-tier name matching 0 `City` rows AND not exempted here → FAIL
 *   • an exempted name that starts matching > 0 `City` rows → FAIL (un-exempt it)
 *   • an exemption whose documented `mlsCity` + `subdivisionMatch` home has 0
 *     rows → FAIL (the "the real listings live here" claim must stay true)
 *
 * Verified live 2026-07-24 (§0, PostgREST exact count):
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
  Tumalo: {
    reason: 'Bend-area community; the MLS files it under Bend by SubdivisionName, never as its own City.',
    mlsCity: 'Bend',
    subdivisionMatch: ['Tumalo%'],
    servedAt: '/cities/bend',
  },
}
