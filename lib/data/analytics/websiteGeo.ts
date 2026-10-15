/**
 * Where a website visit came from, in plain words: Central Oregon, the rest of
 * Oregon, another US state, or another country (Matt 2026-10-14: "where
 * visitors are, local vs rest of Oregon vs out of state").
 *
 * Pure: no I/O. The input is what visitor_sessions stores from the edge
 * headers (app/api/visitors/track/route.ts readIpGeo):
 *   ip_country  two-letter country code (Vercel / Cloudflare)
 *   ip_region   the state: Vercel sends the code ("OR"), Cloudflare the name
 *               ("Oregon"); both are accepted
 *   ip_city     the city name as the network reports it
 *
 * "Central Oregon" is the service area's one definition
 * (lib/central-oregon.ts isCentralOregonCity), checked only inside Oregon so a
 * Redmond, Washington visit never counts as local.
 *
 * Geo is stored only when the visitor allowed analytics (the track route drops
 * it at the essential tier: a declined banner, or the EU / UK / Switzerland
 * default), so a visit with no country is "Location unknown", never guessed.
 */
import { isCentralOregonCity } from '@/lib/central-oregon'

export type GeoBucket = 'central_oregon' | 'rest_of_oregon' | 'other_states' | 'other_countries' | 'unknown'

export const GEO_BUCKET_ORDER: readonly GeoBucket[] = [
  'central_oregon',
  'rest_of_oregon',
  'other_states',
  'other_countries',
  'unknown',
]

export const GEO_BUCKET_LABEL: Record<GeoBucket, string> = {
  central_oregon: 'Central Oregon',
  rest_of_oregon: 'Rest of Oregon',
  other_states: 'Other US states',
  other_countries: 'Other countries',
  unknown: 'Location unknown',
}

/** USPS codes for the 50 states, DC and Puerto Rico. */
const US_STATE_NAMES: Record<string, string> = {
  AL: 'Alabama', AK: 'Alaska', AZ: 'Arizona', AR: 'Arkansas', CA: 'California',
  CO: 'Colorado', CT: 'Connecticut', DE: 'Delaware', DC: 'District of Columbia',
  FL: 'Florida', GA: 'Georgia', HI: 'Hawaii', ID: 'Idaho', IL: 'Illinois',
  IN: 'Indiana', IA: 'Iowa', KS: 'Kansas', KY: 'Kentucky', LA: 'Louisiana',
  ME: 'Maine', MD: 'Maryland', MA: 'Massachusetts', MI: 'Michigan', MN: 'Minnesota',
  MS: 'Mississippi', MO: 'Missouri', MT: 'Montana', NE: 'Nebraska', NV: 'Nevada',
  NH: 'New Hampshire', NJ: 'New Jersey', NM: 'New Mexico', NY: 'New York',
  NC: 'North Carolina', ND: 'North Dakota', OH: 'Ohio', OK: 'Oklahoma', OR: 'Oregon',
  PA: 'Pennsylvania', PR: 'Puerto Rico', RI: 'Rhode Island', SC: 'South Carolina',
  SD: 'South Dakota', TN: 'Tennessee', TX: 'Texas', UT: 'Utah', VT: 'Vermont',
  VA: 'Virginia', WA: 'Washington', WV: 'West Virginia', WI: 'Wisconsin', WY: 'Wyoming',
}

const US_STATE_CODE_BY_NAME = new Map(
  Object.entries(US_STATE_NAMES).map(([code, name]) => [name.toLowerCase(), code]),
)

export type GeoInput = {
  country: string | null | undefined
  region: string | null | undefined
  city: string | null | undefined
}

function clean(v: string | null | undefined): string {
  return (v ?? '').trim()
}

/** Upper-case two-letter country code, or null when none was stored. */
export function normalizeCountry(country: string | null | undefined): string | null {
  const c = clean(country).toUpperCase()
  // 'XX' / 'T1' are the edge's "unknown" and Tor markers, not countries.
  if (!/^[A-Z]{2}$/.test(c) || c === 'XX' || c === 'T1') return null
  return c
}

/**
 * The US state code for a stored region, accepting either the code ("OR",
 * "US-OR") or the name ("Oregon"). Null for a non-US visit or an unknown state.
 */
export function usStateCode(country: string | null | undefined, region: string | null | undefined): string | null {
  if (normalizeCountry(country) !== 'US') return null
  const r = clean(region)
  if (!r) return null
  const code = r.toUpperCase().replace(/^US-/, '')
  if (US_STATE_NAMES[code]) return code
  return US_STATE_CODE_BY_NAME.get(r.toLowerCase()) ?? null
}

export function usStateName(code: string): string {
  return US_STATE_NAMES[code] ?? code
}

let regionNames: Intl.DisplayNames | null = null
/** "Canada" for "CA". Falls back to the code when the runtime has no data for it. */
export function countryName(code: string): string {
  try {
    regionNames ??= new Intl.DisplayNames(['en'], { type: 'region' })
    return regionNames.of(code) ?? code
  } catch {
    return code
  }
}

export function geoBucketOf(g: GeoInput): GeoBucket {
  const country = normalizeCountry(g.country)
  if (!country) return 'unknown'
  if (country !== 'US') return 'other_countries'
  const state = usStateCode(country, g.region)
  if (!state) return 'unknown'
  if (state !== 'OR') return 'other_states'
  return isCentralOregonCity(clean(g.city)) ? 'central_oregon' : 'rest_of_oregon'
}

/**
 * The row key and label for a city: "Bend, OR" inside the US, "Toronto,
 * Canada" outside it. Null when the visit has no city.
 */
export function cityKeyAndLabel(g: GeoInput): { key: string; label: string } | null {
  const city = clean(g.city)
  const country = normalizeCountry(g.country)
  if (!city || !country) return null
  if (country === 'US') {
    const state = usStateCode(country, g.region)
    const label = state ? `${city}, ${state}` : city
    return { key: `US|${state ?? ''}|${city.toLowerCase()}`, label }
  }
  return { key: `${country}|${city.toLowerCase()}`, label: `${city}, ${countryName(country)}` }
}
