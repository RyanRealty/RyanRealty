/**
 * Visitor-facing source / methodology lines. Internal stamps
 * (`closed_cte+service_area_v1`, table names, SQL) stay in DAL / admin.
 * Public copy is English a buyer can read.
 */

const INTERNAL_LEAK =
  /closed_cte|service_area_v1|ILIKE|analytics_mart|CENTRAL_OREGON_CITY_SLUGS|StandardStatus|listings_analytics/i

export const PUBLIC_CLOSED_SALES_METHODOLOGY =
  'Oregon Data Share closed sales in the Central Oregon service-area cities. Close price $1,000 or more. Close date set.'

export function publicClosedSalesMethodology(internalStamp?: string | null): string {
  if (internalStamp && INTERNAL_LEAK.test(internalStamp)) {
    return PUBLIC_CLOSED_SALES_METHODOLOGY
  }
  const trimmed = typeof internalStamp === 'string' ? internalStamp.trim() : ''
  if (!trimmed) return PUBLIC_CLOSED_SALES_METHODOLOGY
  if (INTERNAL_LEAK.test(trimmed)) return PUBLIC_CLOSED_SALES_METHODOLOGY
  return trimmed
}

export function assertPublicMethodology(text: string): void {
  if (INTERNAL_LEAK.test(text)) {
    throw new Error(`Visitor methodology leaked an internal stamp: ${text}`)
  }
}
