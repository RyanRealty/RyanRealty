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
 * How many active listings the Field renders as rows and pins.
 *
 * 24 is the number the retired dual-pane list already showed
 * (splitRowsFromTiles caps at 24 in lib/explore/subdivision-page-extras.ts), so
 * the visible set is unchanged by the migration. The honest total renders above
 * the frame as the Field's count, with its own trace, and the browse door under
 * the answer opens the full set.
 */
export const CITY_FIELD_ROWS = 24

/**
 * The pool the 24 rows are chosen from. `sort: 'newest'` orders the query, so
 * the pool only has to be large enough to survive the coordinate filter in
 * cityFieldItems (a listing with no lat/lng is listed, never plotted, but it
 * still occupies a row). 60 covers the worst observed null-coordinate rate on a
 * city page with room to spare, and it is a 25x smaller read than the retired
 * 1500-row map pull.
 */
export const CITY_FIELD_POOL = 60

/** The one alert filter the city capture adds: single family (§0, PropertyType A). */
export const CITY_ALERT_PROPERTY_TYPE = 'A'
