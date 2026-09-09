/**
 * The source traces this route publishes, in one file.
 *
 * CLAUDE.md section 0: one trace per query, one stamp per trace, never borrowed
 * across populations. The plat node reads FIVE populations and they are not
 * interchangeable, so each gets its own sentence here and the page hands that
 * sentence to the one section that prints that population's figures.
 *
 *   1. THE PLAT'S ACTIVE COUNT. Three resolution paths reach it, and they count
 *      different things. The GIS path counts the pins the `listings_in_boundary`
 *      RPC returned, filtered on StandardStatus='Active' only, so it holds every
 *      property type inside the plat. The registry path counts the set
 *      getCommunityListings returned for the MLS subdivision name, and that call
 *      stops at 14 rows, so the sentence says so rather than implying the count
 *      is the whole plat.
 *   2. THE PLAT'S ACTIVE SINGLE-FAMILY LISTINGS. The Field's rows and pins come
 *      from getListingTiles with propertyType 'A', a strict subset of (1). A
 *      single sentence covering both would be false at one end or the other.
 *   3. THE PLAT'S OWN CLOSED STATS. market_stats_cache, geo_type='subdivision',
 *      periodType 'ytd' (ci:subdivision-stats-integrity pins the period).
 *   4. THE PARENT MARKET. market_pulse_live for the resort community or the
 *      city. It is not plat-level and the sentence says which place it covers.
 *   5. THE PLAT'S LIFETIME CLOSED COUNT (SITE-24). subdivision_plat_closed_mv:
 *      every closed sale attributed to the recorded plat by its own coordinates
 *      falling inside the plat polygon, unioned with the MLS-name match. It is
 *      the ONLY population on this page a sub-plat of a resort can answer —
 *      populations 3 and 4 are name-joined and a sub-plat's sales all carry the
 *      resort's name — so it must never be conflated with the yearly table's
 *      name-joined counts sitting a section away from it.
 *
 * No sentence here contains a number. Numbers live at the call site with the
 * query that produced them.
 */

/**
 * Which parent-market figures rendered, built beside them in ./subdivision-figures
 * so the trace and the figure set cannot disagree. Type-only: nothing here runs.
 */

/**
 * Every figure on this page traces to the same feed. This is how it is named.
 *
 * EXPORTED SINCE SITE-47 because the Atlas's claim sentence attributes itself
 * in the fold, and a second spelling of the feed on one page is exactly the
 * kind of drift this file exists to prevent. One constant, every trace, and
 * the map's own clause.
 */
export const PLAT_FEED = 'live MLS through Oregon Data Share'
const FEED = PLAT_FEED

/** The population an active count covers, by which resolution path found it. */
export type PlatScope =
  | { kind: 'boundary'; displayName: string }
  | { kind: 'registry'; subdivisionName: string; city: string }
  | { kind: 'pins'; displayName: string }

/**
 * Trace for the plat's active count (population 1). "Every property type" is not
 * decoration. `listings_in_boundary` filters status and nothing else, so calling
 * this figure single-family would be the false half of one sentence covering two
 * populations.
 */
export function activeCountTrace(scope: PlatScope): string {
  if (scope.kind === 'registry') {
    return (
      `${FEED}, active single-family listings recorded under the ${scope.subdivisionName} ` +
      `subdivision name in ${scope.city}. No plat boundary is recorded for this page, so the ` +
      `count is the recorded-plat inventory set, not a boundary query.`
    )
  }
  const where =
    scope.kind === 'boundary'
      ? `inside the recorded ${scope.displayName} plat boundary`
      : `the boundary query returned for ${scope.displayName}`
  return `${FEED}, active listings ${where}, every property type the plat holds.`
}

/** One line on the homes Ledger. The fourteen-row essay stays off the fold. */
export function homesLedgerTrace(scope: PlatScope): string {
  if (scope.kind === 'registry') {
    return `${FEED}, active single-family listings under the ${scope.subdivisionName} name in ${scope.city}.`
  }
  const where =
    scope.kind === 'boundary'
      ? `inside the recorded ${scope.displayName} plat`
      : `returned for ${scope.displayName}`
  return `${FEED}, active single-family listings ${where}.`
}

/** Trace for the Field's rows and pins (population 2). */
export function fieldTrace(scope: PlatScope): string {
  const where =
    scope.kind === 'registry'
      ? `recorded under the ${scope.subdivisionName} subdivision name in ${scope.city}`
      : `inside the recorded ${scope.displayName} plat boundary`
  return `${FEED}, active single-family listings ${where}. Map and list are the same set.`
}

/**
 * Trace for the Market Truth recorded-plat counts (population 2). A different
 * membership from the listing set above it: detached homes whose recorded plat
 * IS this one, over the metric layer's own windows.
 */
export function platCountsTrace(displayName: string): string {
  return (
    `regional MLS through the Market Truth metric layer, detached homes on the recorded ` +
    `${displayName} plat. Each figure names its own window; a figure the layer withheld is ` +
    `absent, not estimated.`
  )
}

/** Trace for the plat's own closed statistics (population 3). */
export function platStatsTrace(displayName: string, cityName: string, periodLabel: string): string {
  const where = cityName === 'Central Oregon' ? displayName : `${displayName}, ${cityName}`
  // NO MEDIAN CLAUSE. The cache row carries a closed median and a YoY of it, and
  // publishSubdivisionClosedPrice withholds BOTH at plat grain (REGISTRY §4), so
  // the only figure that reaches the page from this row is days on market. A
  // sentence about rounding medians would describe a number the page suppressed.
  return (
    `${FEED} through the subdivision statistics cache, closed single-family sales in ${where}, ` +
    `${periodLabel.toLowerCase()}. Days on market only: a closed-price statistic at plat grain is ` +
    `withheld.`
  )
}

/**
 * Trace for the plat's own live inventory median (population 1's price side).
 * The counted set is the only plat-grain live inventory there is: a registry
 * plat has no market_pulse_live row, so a parent-city or community pulse under
 * this heading would attribute another geography's figure to this plat.
 */
export function platInventoryTrace(scope: PlatScope): string {
  const where =
    scope.kind === 'registry'
      ? `recorded under the ${scope.subdivisionName} subdivision name in ${scope.city}`
      : `inside the recorded ${scope.displayName} plat`
  return `${FEED}, the list prices of the active single-family listings ${where}.`
}

/**
 * Trace for the plat's LIFETIME closed count (SITE-24, 2026-09-08). A FIFTH
 * population, and it exists because the fourth cannot answer for a sub-plat:
 * salesHistoryTrace names sales "recorded under the MLS subdivision name", and
 * every home inside Ridge At Broken Top or Golf Homes At Tetherow is recorded
 * under "Broken Top" or "Tetherow", so that population is empty for them at any
 * grain finer than the resort. This one is attributed by GEOMETRY first — the
 * sale's own coordinates inside the recorded plat boundary — unioned with the
 * name match so a sale whose historical geocode is coarse is not lost either.
 * Counted once however it was found.
 *
 * The sentence names the join because the reader cannot otherwise tell this
 * figure from the yearly table's counts directly above it, and the two measure
 * different sets.
 */
export function platLifetimeClosedTrace(displayName: string): string {
  // Not "${FEED} through the … index": FEED already ends in "through Oregon
  // Data Share", and the two prepositions collided into "through … through"
  // (evaluator, 2026-09-09). The clause opens with a comma, like every other
  // trace in this file, and names the index inside the sentence instead.
  return (
    `${FEED}, every closed sale on record attributed to the ${displayName} plat by the ` +
    `recorded-plat closed-sale index — the sale's own coordinates falling inside the recorded ` +
    `plat boundary, or the sale carrying this plat's name in the MLS, counted once either ` +
    `way. Lifetime, every property type, and the by-year series above is the same set grouped ` +
    `by the year of the close. Counts only: a closed-price statistic at plat grain is withheld.`
  )
}

/** Trace for the yearly closed-sale table. Aggregates only, per ODS rule 5-4 A.4. */
export function salesHistoryTrace(displayName: string, priceMayPublish = false): string {
  const base =
    `${FEED}, closed single-family sales recorded under the MLS subdivision name ` +
    `${displayName} — matched by that name, not by the recorded plat boundary — grouped by ` +
    `calendar year. Never an individual sale.`
  return priceMayPublish
    ? base
    : `${base} Counts only: a closed-price statistic at this grain is withheld, because most ` +
        `plats never reach ten detached sales in 36 months and a median of that is not a fact.`
}

/** The window label the stats cache row carries, spelled for a reader. */
export const PERIOD_LABEL: Record<
  'rolling_30d' | 'rolling_90d' | 'rolling_365d' | 'monthly' | 'ytd',
  string
> = {
  rolling_30d: 'Last 30 days',
  rolling_90d: 'Last 90 days',
  rolling_365d: 'Last 12 months',
  monthly: 'This month',
  ytd: 'Year to date',
}

/** How many closed years the Ledger prints. The KB table used the same ceiling. */
export const MAX_YEAR_ROWS = 40
