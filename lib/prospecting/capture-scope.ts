/**
 * capture-scope — the ONE definition of which listings the prospecting pipelines
 * capture. PURE.
 *
 * THE DECISION (Matt, 2026-08-17):
 * capture scope is six cities, single-family, any list price. The $500K floor
 * is retired. Asked whether to keep excluding under-$500K expireds, the answer
 * was CAPTURE ALL PRICES. That decision is recorded here rather than in a
 * document, because a scope that lives in prose drifts and a scope that lives
 * in one constant does not.
 *
 * WHY ONE MODULE. The scope was written out four times — the city list in
 * `expired-listing-processor.ts` and again in `fsbo-detector.ts`, the price
 * threshold in both of those AND a third time inline in the Zillow query builder
 * — held together by comments reading "must match … exactly" and "Keep in sync
 * with FSBO_MIN_LIST_PRICE below". Comments are not a mechanism. Two of those
 * copies feed an EXTERNAL query (the Zillow searchQueryState) and two feed the
 * local filter, so a drift between them would silently capture a population the
 * filter then rejected, or worse, the reverse.
 *
 * The ledger row promises that widening scope is "the promised one-constant
 * change". It now is: edit the constants below and every pipeline follows.
 * `ci:capture-scope` (scripts/check-capture-scope.mjs) fails the build if any
 * other file in the prospecting path spells the threshold or the city set out
 * again.
 *
 * NOT frozen by the gate — deliberately. The gate enforces SINGLE SOURCE, not a
 * particular value, so a future widen stays a one-line edit rather than a
 * two-place edit that includes the gate.
 */

/**
 * Minimum list price, in dollars. 0 = every list price is in. `.gte` against
 * this still drops null and non-positive prices, which is intended.
 */
export const CAPTURE_MIN_LIST_PRICE = 0

/**
 * The six service-area cities, as the display spellings both pipelines match on.
 *
 * `Tumalo` is intentionally present even though it is not a distinct MLS `City`
 * value (see NON_MLS_CITY_EXEMPTIONS in lib/data/geo/report-cities.ts): these
 * pipelines match a city NAME on an expired-listing row and on a Zillow FSBO
 * page, not the market-cache city registry, and Tumalo appears in both of those.
 */
export const CAPTURE_SERVICE_AREA_CITIES = [
  'Bend',
  'Redmond',
  'Sisters',
  'Sunriver',
  'Tumalo',
  'La Pine',
] as const

export type CaptureServiceAreaCity = (typeof CAPTURE_SERVICE_AREA_CITIES)[number]

/** True when a city name is inside the captured service area. */
export function isCaptureServiceAreaCity(city: string | null | undefined): boolean {
  if (!city) return false
  const c = city.trim().toLowerCase()
  return CAPTURE_SERVICE_AREA_CITIES.some((x) => x.toLowerCase() === c)
}
