/**
 * Route-local constants for /cities/[slug] (app/cities/[slug]/page.tsx).
 *
 * They live beside the route rather than inside it for the reason the market hub
 * split its own: ci:file-size-budget's instruction when a route file approaches
 * the floor is to split, not to re-baseline. Nothing here fetches, formats, or
 * derives.
 *
 * NOT A GEO REGISTRY. lib/data/geo/report-cities.ts owns the canonical city sets
 * and ci:report-geo-registry bans re-typing one of them. Nothing below is a set
 * of city slugs.
 */

/**
 * One inventory pull for the city Field. The caption, the list, and the map
 * pins are this set. The ask is 1500. A PostgREST page may still return 1000.
 * The caption counts the listed set, never a larger pulse figure.
 */
export const CITY_FIELD_POOL = 1500

/** The one alert filter the city capture adds: single family (§0, PropertyType A). */
export const CITY_ALERT_PROPERTY_TYPE = 'A'
