/**
 * Search-funnel instrumentation (Phase 0.5, SEARCH_OPTIMIZATION_PLAN_2026-07-29)
 * — PURE payload builders + the one-action-one-event guard.
 *
 * This module is deliberately DOM-free and import-light so every payload shape
 * is unit-testable. The client-side fire path (session id, server action call)
 * lives in components/search/search-events.client.ts and is the only thing
 * allowed to touch window / the network.
 */

export type SearchEventType =
  | 'search_filter_apply'
  | 'search_map_draw'
  | 'search_save'
  | 'alert_create'
  | 'search_zero_results'

export type SearchEventPayload = Record<string, unknown>

/**
 * URL params that are presentation/order state, not search filters — they never
 * count toward active_count and a change touching only them is not a filter
 * apply.
 */
const NON_FILTER_PARAMS: ReadonlySet<string> = new Set(['view', 'page', 'sort'])

/** Distinct non-empty filter params in the URL (poly counts — it IS a spatial filter). */
export function countActiveSearchParams(params: URLSearchParams): number {
  const keys = new Set<string>()
  for (const [key, value] of params.entries()) {
    if (NON_FILTER_PARAMS.has(key)) continue
    if (value.trim() === '') continue
    keys.add(key)
  }
  return keys.size
}

/**
 * `search_filter_apply` — one URL mutation from the chip bar / All-filters
 * sheet / location picker. `updates` is the exact key->value map the UI applied
 * (undefined/'' means the filter was cleared, recorded as null). Returns null
 * when nothing filter-shaped changed (e.g. a view/sort-only update) so the
 * caller can skip the fire entirely.
 */
export function buildFilterApplyPayload(
  updates: Record<string, string | undefined>,
  paramsAfter: URLSearchParams
): { changed: Record<string, string | null>; active_count: number } | null {
  const changed: Record<string, string | null> = {}
  for (const [key, value] of Object.entries(updates)) {
    if (NON_FILTER_PARAMS.has(key)) continue
    changed[key] = value == null || value === '' ? null : value
  }
  if (Object.keys(changed).length === 0) return null
  return { changed, active_count: countActiveSearchParams(paramsAfter) }
}

/** `search_map_draw` — a completed shape draw on the map. Polygons and
 *  rectangles carry a vertex count; circles carry their radius in meters. */
export function buildMapDrawPayload(
  points: number,
  shape: 'polygon' | 'rectangle' | 'circle' = 'polygon',
  radiusM?: number,
): { shape: 'polygon' | 'rectangle' | 'circle'; points: number; radius_m?: number } {
  return shape === 'circle' && radiusM != null
    ? { shape, points, radius_m: Math.round(radiusM) }
    : { shape, points }
}

/** `search_save` — a saved search (signed-in or guest email capture). */
export function buildSearchSavePayload(
  hasShape: boolean,
  filterCount: number
): { has_shape: boolean; filter_count: number } {
  return { has_shape: hasShape, filter_count: filterCount }
}

/** `alert_create` — a listing-alert signup. Frequency is the cadence the row is written with. */
export function buildAlertCreatePayload(frequency: string): { frequency: string } {
  return { frequency }
}

/**
 * `search_zero_results` — a search round-trip that returned 0 homes. Captures
 * the full live query string as a param map so the funnel can answer "which
 * filter combinations dead-end".
 */
export function buildZeroResultsPayload(
  search: string | URLSearchParams
): { params: Record<string, string> } {
  const sp = typeof search === 'string' ? new URLSearchParams(search) : search
  const params: Record<string, string> = {}
  for (const [key, value] of sp.entries()) {
    if (value.trim() === '') continue
    params[key] = value
  }
  return { params }
}

/**
 * One user action fires ONE event: returns a predicate that refuses an
 * identical (type + payload) fire inside `windowMs`. Covers double-invoked
 * handlers (React strict mode, re-entrant callbacks) without suppressing a
 * genuine repeat action later.
 */
export function createSearchEventGuard(
  windowMs = 1500
): (eventType: SearchEventType, payload: SearchEventPayload, nowMs: number) => boolean {
  let lastKey: string | null = null
  let lastAt = 0
  return (eventType, payload, nowMs) => {
    const key = `${eventType}:${JSON.stringify(payload ?? {})}`
    if (key === lastKey && nowMs - lastAt < windowMs) return false
    lastKey = key
    lastAt = nowMs
    return true
  }
}
