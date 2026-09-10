/**
 * SITE-60: a listing page must know whether this render is a speculative
 * App Router prefetch. `next/image` `priority` emits `<link rel="preload">`
 * into the RSC payload; hover/viewport prefetch of listing links then
 * downloads every linked listing's 1600×1200 Spark plate.
 *
 * Next strips `rsc` / `next-router-prefetch` / `next-router-segment-prefetch`
 * from the Headers adapter (FLIGHT_HEADERS) before `headers()` sees them.
 * The header that survives is Accept: a document navigation asks for
 * text/html; a Flight fetch asks for text/x-component or star-slash.
 */

/** Header Next sets on speculative Link prefetches. Lowercased by `headers()`. */
export const NEXT_ROUTER_PREFETCH_HEADER = 'next-router-prefetch'

/** Cache-busting search param Next appends to every Flight request. */
export const NEXT_RSC_UNION_QUERY = '_rsc'

/**
 * True when this render must not emit an LCP hero preload.
 *
 * A document GET includes `text/html` in Accept and never has `_rsc`.
 * Everything else (loading-boundary prefetch, Full prefetch, click RSC)
 * is a Flight render: the lead Image loads when it commits, so a `<head>`
 * preload in that payload only taxes the list the visitor is still on.
 */
export function isNextRouterPrefetchFromHeaders(
  getHeader: (name: string) => string | null,
): boolean {
  const prefetch = (getHeader(NEXT_ROUTER_PREFETCH_HEADER) ?? '').trim().toLowerCase()
  if (prefetch === '1' || prefetch === '2' || prefetch === 'true') return true
  if ((getHeader('next-router-segment-prefetch') ?? '').trim()) return true
  if ((getHeader('rsc') ?? '').trim() === '1') return true
  const accept = (getHeader('accept') ?? '').toLowerCase()
  if (accept.includes('text/x-component')) return true
  if (accept.includes('text/html')) return false
  // fetch() Flight requests typically send */* and omit text/html.
  return accept.length > 0
}

export function isFlightSearchParams(
  searchParams: Record<string, unknown> | undefined | null,
): boolean {
  if (!searchParams) return false
  return Object.prototype.hasOwnProperty.call(searchParams, NEXT_RSC_UNION_QUERY)
}

export async function isNextRouterPrefetch(
  searchParams?: Record<string, unknown> | null,
): Promise<boolean> {
  if (isFlightSearchParams(searchParams)) return true
  try {
    const { headers } = await import('next/headers')
    const h = await headers()
    return isNextRouterPrefetchFromHeaders((name) => h.get(name))
  } catch {
    // No request (prerender bailout, unit tests). Treat as a real visit so
    // a missing header store cannot strip the LCP preload.
    return false
  }
}
