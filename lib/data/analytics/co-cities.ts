/**
 * Central Oregon city proper names for analytics closed-sales filters.
 * Must stay aligned with lib/central-oregon.ts + analytics_service_area_cities migration.
 */
import { CENTRAL_OREGON_CITY_SLUGS } from '@/lib/central-oregon'

function slugToProper(slug: string): string {
  return slug
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

export const ANALYTICS_CO_CITIES_PROPER: readonly string[] = [
  ...CENTRAL_OREGON_CITY_SLUGS,
].map(slugToProper)

export const ANALYTICS_METHODOLOGY_V1 =
  'closed_cte+service_area_v1: StandardStatus ILIKE %Closed%, ClosePrice>=1000, CloseDate set, City in CENTRAL_OREGON_CITY_SLUGS'
