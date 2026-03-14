/**
 * Standardized prompts for city and subdivision banner images.
 *
 * Design goals:
 * - Aerial/satellite-style so the image reflects real terrain and geography, not invented street-level details.
 * - Factual Central Oregon geography (high desert, Cascades, rivers) to keep output accurate and consistent.
 * - No text, no people, no logos; one image reused everywhere (hero, cards, mobile).
 *
 * We generate once per city/subdivision and reuse the stored URL; no extra API calls.
 */

/** Geographic hints per city so the model uses real regional features instead of inventing landmarks. */
const CITY_GEO: Record<string, string> = {
  bend: 'high desert, Deschutes River, Cascade Mountains in the distance, mix of forest and arid terrain',
  redmond: 'high desert plains, Cascade Mountains to the west, agricultural and residential areas',
  sisters: 'base of Cascade Mountains, Three Sisters peaks, ponderosa pine and juniper',
  sunriver: 'ponderosa pine forest, Deschutes River, resort area south of Bend',
  'la pine': 'Deschutes National Forest, mixed forest and open land, rural Central Oregon',
  prineville: 'Crook County high desert, Ochoco Mountains, rural and small-town terrain',
  madras: 'Jefferson County, Mount Jefferson and Cascade range, agricultural land and desert',
}

const DEFAULT_GEO = 'Central Oregon high desert, sagebrush and juniper, Cascade Mountains in the distance'

function getGeoHint(cityName: string): string {
  const key = cityName.trim().toLowerCase()
  return CITY_GEO[key] ?? DEFAULT_GEO
}

/** Style and constraints to reduce hallucination: aerial view, real terrain only, no invented details. */
const AERIAL_STYLE =
  'Aerial or satellite-style photograph, realistic, high resolution. Show only natural terrain, vegetation, and landscape as it actually appears in the region. Clear daylight. No text, no people, no logos, no made-up buildings or landmarks.'

/**
 * Build the exact prompt for a city banner (e.g. Bend, Redmond, Prineville).
 * Uses factual geography and asks for an aerial/satellite view so the image is accurate.
 */
export function cityBannerPrompt(placeName: string): string {
  const geo = getGeoHint(placeName)
  return `Aerial view of ${placeName}, Oregon. Real geography: ${geo}. ${AERIAL_STYLE}`
}

/**
 * Build the exact prompt for a subdivision/neighborhood banner.
 * Same aerial style; subject is the area in context of its city and regional geography.
 */
export function subdivisionBannerPrompt(placeName: string, cityName: string): string {
  const geo = getGeoHint(cityName)
  return `Aerial view of ${placeName} area, ${cityName}, Oregon. Real geography: ${geo}. ${AERIAL_STYLE}`
}

/**
 * Build the Unsplash search query for a banner (pretty landscapes).
 * - Cities: scenic landscape of that city.
 * - Resort/planned communities: imagery of that specific community.
 * - Other communities: scenic landscape of the city they belong to.
 */
export function getBannerSearchQuery(
  entityType: 'city' | 'subdivision',
  displayName: string,
  city?: string,
  isResort?: boolean
): string {
  if (entityType === 'city') {
    return `${displayName} Oregon scenic`
  }
  if (isResort) {
    return `${displayName} ${city ?? ''} Oregon scenic`.replace(/\s+/g, ' ').trim()
  }
  return city ? `${city} Oregon scenic` : `${displayName} Oregon scenic`
}
