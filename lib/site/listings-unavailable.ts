/**
 * A community / resort listings read that did not answer.
 *
 * Throw this from the page so Next keeps the last good ISR copy
 * (stale-while-revalidate) and never persists a "listings did not load"
 * body as a cacheable 200. A cold miss with no last good copy is HTTP 500
 * (the route error boundary), which crawlers do not treat as the page.
 *
 * Same contract as the bare-city search throw in app/search/[...slug]/page.tsx.
 * Do not call unstable_noStore() here: on an ISR route Next 16 answers that
 * with DYNAMIC_SERVER_USAGE, and ci:degraded-isr refuses it.
 */

export const LISTINGS_UNAVAILABLE = 'LISTINGS_UNAVAILABLE' as const

export class ListingsUnavailableError extends Error {
  readonly code = LISTINGS_UNAVAILABLE
  constructor(label: string) {
    super(`[listings-unavailable] ${label}`)
    this.name = 'ListingsUnavailableError'
  }
}

/** Throw when a raced listings / community read did not answer. */
export function refuseUnavailableListings(ok: boolean, label: string): asserts ok {
  if (!ok) throw new ListingsUnavailableError(label)
}

/**
 * A population that timed out and came back with no homes is a failed
 * listings read, not a genuine empty market. Throw so the failure is not
 * cached as "0 for sale".
 */
export function refuseEmptyFailedListings(
  population: { complete: boolean; tiles: readonly unknown[] },
  label: string,
): void {
  if (!population.complete && population.tiles.length === 0) {
    throw new ListingsUnavailableError(label)
  }
}

/**
 * One retry of a raced read, then refuse. The first miss is usually a
 * blip; the second miss is the outage we must not cache.
 */
export async function readOrRefuseListings<T>(
  start: () => Promise<{ ok: boolean; value: T }>,
  label: string,
): Promise<T> {
  const first = await start()
  if (first.ok) return first.value
  const retry = await start()
  if (retry.ok) return retry.value
  throw new ListingsUnavailableError(label)
}
