/**
 * The source traces this route publishes, in one file.
 *
 * CLAUDE.md section 0: one trace per query, one stamp per trace, never borrowed
 * across populations. The plat node reads FOUR populations and they are not
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
 *
 * No sentence here contains a number. Numbers live at the call site with the
 * query that produced them.
 */

/**
 * Which parent-market figures rendered, built beside them in ./subdivision-figures
 * so the trace and the figure set cannot disagree. Type-only: nothing here runs.
 */
import type { ParentPulseCoverage as ParentMarketCoverage } from './subdivision-figures'

/** Every figure on this page traces to the same feed. This is how it is named. */
const FEED = 'live MLS through Oregon Data Share'

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
      `${FEED}, active listings recorded under the ${scope.subdivisionName} subdivision name in ` +
      `${scope.city}. No plat boundary is recorded for this page, so the count is the set that ` +
      `query returned and it stops at fourteen.`
    )
  }
  const where =
    scope.kind === 'boundary'
      ? `inside the recorded ${scope.displayName} plat boundary`
      : `the boundary query returned for ${scope.displayName}`
  return `${FEED}, active listings ${where}, every property type the plat holds.`
}

/** Trace for the Field's rows and pins (population 2). */
export function fieldTrace(scope: PlatScope, listedCap: number): string {
  const where =
    scope.kind === 'registry'
      ? `recorded under the ${scope.subdivisionName} subdivision name in ${scope.city}`
      : `inside the recorded ${scope.displayName} plat boundary`
  return (
    `${FEED}, active single-family listings ${where}. The list shows at most ${listedCap} of them, ` +
    `and the map plots every one that carries coordinates.`
  )
}

/**
 * Trace for the Field when the tile query returned nothing and the rows come
 * from the registry-name fetch instead. Same fourteen-row ceiling as (1).
 */
export function fieldFallbackTrace(subdivisionName: string, city: string): string {
  return (
    `${FEED}, active listings recorded under the ${subdivisionName} subdivision name in ${city}. ` +
    `The listing-tile query returned nothing on this refresh, so these are the rows that fetch ` +
    `returned and it stops at fourteen.`
  )
}

/** Trace for the plat's own closed statistics (population 3). */
export function platStatsTrace(displayName: string, cityName: string, periodLabel: string): string {
  const where = cityName === 'Central Oregon' ? displayName : `${displayName}, ${cityName}`
  return (
    `${FEED} through the subdivision statistics cache, closed single-family sales in ${where}, ` +
    `${periodLabel.toLowerCase()}. Medians round to the nearest thousand.`
  )
}

/**
 * Trace for the parent market band (population 4).
 *
 * The sentence is composed from the figures that actually rendered, not from the
 * three the pulse row can carry. A guard in _v3/subdivision-figures.ts drops any
 * figure the row did not answer — including a closings count of 0, which the DAL
 * cannot distinguish from a NULL column — and a trace that named a figure the
 * page then suppressed would be a source line describing a number nobody can see.
 */
export function parentMarketTrace(scopeLabel: string, covers: ParentMarketCoverage): string {
  const active =
    covers.listPrice && covers.daysToPending
      ? 'List price and days to pending come from active inventory.'
      : covers.listPrice
        ? 'List price comes from active inventory.'
        : covers.daysToPending
          ? 'Days to pending comes from active inventory.'
          : ''
  const closed = covers.closed ? 'Closings are the last thirty days.' : ''
  const basis = [active, closed].filter(Boolean).join(' ')
  return (
    `${FEED}, single-family homes in ${scopeLabel}. ${basis}${basis ? ' ' : ''}These are ` +
    `${scopeLabel} figures, not plat-level ones.`
  )
}

/** Trace for the yearly closed-sale table. Aggregates only, per ODS rule 5-4 A.4. */
export function salesHistoryTrace(displayName: string): string {
  return (
    `${FEED}, closed single-family sales in ${displayName}, grouped by calendar year. Counts and ` +
    `medians only, never an individual sale. Medians round to the nearest thousand.`
  )
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

/** How many listings the Field lists. The KB dual-pane used the same ceiling. */
export const MAX_LISTED = 24
