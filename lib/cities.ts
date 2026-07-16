/** City row for the index page. */
export type CityForIndex = {
  slug: string
  name: string
  activeCount: number
  medianPrice: number | null
  communityCount: number
  heroImageUrl: string | null
  description?: string | null
}

/** City record for detail page (from DB or derived). */
export type CityDetail = {
  slug: string
  name: string
  description: string | null
  heroImageUrl: string | null
  activeCount: number
  medianPrice: number | null
  avgDom: number | null
  closedLast12Months: number
  communityCount: number
}

/** Primary Central Oregon cities to feature at top of /cities (exact display order).
 * Spellings are the canonical MLS `listings.City` values ("La Pine", "Sunriver" —
 * verified against the live table 2026-07-16). The sales-report cards match these
 * against per-city report data with a raw .get() AND render them as labels, so a
 * non-canonical spelling here means permanently-empty cards ("No sales this
 * period") plus "LAPINE"/"SUN RIVER" typos in the UI. */
export const PRIMARY_CITIES = [
  'Bend',
  'Redmond',
  'La Pine',
  'Sisters',
  'Sunriver',
  'Tumalo',
  'Crooked River Ranch',
  'Prineville',
  'Madras',
]

/** Map primary display name → possible DB/listings name for matching (legacy
 * feed rows occasionally carry "Lapine" / "Sun River"). */
export const PRIMARY_CITY_NAME_ALIASES: Record<string, string[]> = {
  'La Pine': ['La Pine', 'Lapine'],
  'Sunriver': ['Sunriver', 'Sun River'],
}

/** Returns true if city name matches a primary city (by name or alias). */
export function isPrimaryCityName(name: string): boolean {
  const lower = name.trim().toLowerCase()
  for (const p of PRIMARY_CITIES) {
    if (p.toLowerCase() === lower) return true
    const aliases = PRIMARY_CITY_NAME_ALIASES[p]
    if (aliases?.some((a) => a.toLowerCase() === lower)) return true
  }
  return false
}

/** Primary sort order rank (0 = first). -1 if not primary. */
export function getPrimaryCityRank(name: string): number {
  const lower = name.trim().toLowerCase()
  for (let i = 0; i < PRIMARY_CITIES.length; i++) {
    const p = PRIMARY_CITIES[i]!
    if (p.toLowerCase() === lower) return i
    const aliases = PRIMARY_CITY_NAME_ALIASES[p]
    if (aliases?.some((a) => a.toLowerCase() === lower)) return i
  }
  return -1
}

/** Sort cities: primary first (PRIMARY_CITIES order), then others by activeCount desc, then name. */
export function sortCitiesWithPrimaryFirst(cities: CityForIndex[]): CityForIndex[] {
  const primary: CityForIndex[] = []
  const byRank = new Map<string, CityForIndex>()
  for (const c of cities) {
    const r = getPrimaryCityRank(c.name)
    if (r >= 0) byRank.set(String(r), c)
  }
  for (let i = 0; i < PRIMARY_CITIES.length; i++) {
    const c = byRank.get(String(i))
    if (c) primary.push(c)
  }
  const others = cities.filter((c) => getPrimaryCityRank(c.name) < 0)
  others.sort((a, b) => b.activeCount - a.activeCount || a.name.localeCompare(b.name))
  return [...primary, ...others]
}

/**
 * For home page only: show only primary Central Oregon cities (Bend, Redmond, Sisters, etc.).
 * Use this for "Explore by city" and "Browse by city" so we don't show every city from the feed.
 */
export function filterToPrimaryCitiesOnly(cities: CityForIndex[]): CityForIndex[] {
  return sortCitiesWithPrimaryFirst(cities).filter((c) => isPrimaryCityName(c.name))
}

/** Order for Explore by City slider: these appear first, then the rest by count. */
export const SLIDER_CITY_ORDER = ['Bend', 'Redmond', 'Sisters', 'La Pine', 'Sunriver', 'Tumalo']

/** Home page Popular Cities section: exact display order (Bend, Redmond, Sunriver, Sisters, La Pine, Tumalo, Prineville, Madras). */
export const HOME_POPULAR_CITY_NAMES = [
  'Bend',
  'Redmond',
  'Sunriver',
  'Sisters',
  'La Pine',
  'Tumalo',
  'Prineville',
  'Madras',
] as const

/** Match city name to home popular list (handles "Sun River" vs "Sunriver", "Lapine" vs "La Pine"). */
function homePopularCityRank(name: string): number {
  const lower = name.trim().toLowerCase()
  for (let i = 0; i < HOME_POPULAR_CITY_NAMES.length; i++) {
    const n = HOME_POPULAR_CITY_NAMES[i]!
    if (n.toLowerCase() === lower) return i
    if (lower === 'sun river' && n === 'Sunriver') return i
    if (lower === 'lapine' && n === 'La Pine') return i
  }
  return -1
}

/** Return only the home popular cities in the specified order; excludes cities not in the list. */
export function getHomePopularCitiesOrdered(cities: CityForIndex[]): CityForIndex[] {
  const byRank = new Map<number, CityForIndex>()
  for (const c of cities) {
    const r = homePopularCityRank(c.name)
    if (r >= 0 && !byRank.has(r)) byRank.set(r, c)
  }
  const out: CityForIndex[] = []
  for (let i = 0; i < HOME_POPULAR_CITY_NAMES.length; i++) {
    const c = byRank.get(i)
    if (c) out.push(c)
  }
  return out
}

/** Quick facts for known cities (population, elevation, county, etc.). */
export type CityQuickFacts = {
  population?: string
  elevation?: string
  county?: string
  schoolDistrict?: string
  nearestAirport?: string
}

export const CITY_QUICK_FACTS: Record<string, CityQuickFacts> = {
  Bend: {
    population: '~102,000',
    elevation: '3,623 ft',
    county: 'Deschutes',
    schoolDistrict: 'Bend-La Pine',
    nearestAirport: 'Redmond (RDM)',
  },
  Redmond: {
    population: '~36,000',
    elevation: '3,077 ft',
    county: 'Deschutes',
    schoolDistrict: 'Redmond',
    nearestAirport: 'Redmond (RDM)',
  },
  Sisters: {
    population: '~3,100',
    elevation: '3,182 ft',
    county: 'Deschutes',
    schoolDistrict: 'Sisters',
    nearestAirport: 'Redmond (RDM)',
  },
  Sunriver: {
    population: '~1,400',
    elevation: '4,160 ft',
    county: 'Deschutes',
    schoolDistrict: 'Bend-La Pine',
    nearestAirport: 'Redmond (RDM)',
  },
  'La Pine': {
    population: '~2,500',
    elevation: '4,260 ft',
    county: 'Deschutes',
    schoolDistrict: 'La Pine',
    nearestAirport: 'Redmond (RDM)',
  },
  Prineville: {
    population: '~10,500',
    elevation: '2,848 ft',
    county: 'Crook',
    schoolDistrict: 'Crook County',
    nearestAirport: 'Redmond (RDM)',
  },
  Madras: {
    population: '~7,500',
    elevation: '2,244 ft',
    county: 'Jefferson',
    schoolDistrict: 'Jefferson County',
    nearestAirport: 'Redmond (RDM)',
  },
  'Crooked River Ranch': {
    population: '~5,000',
    elevation: '2,100 ft',
    county: 'Jefferson',
    schoolDistrict: 'Culver',
    nearestAirport: 'Redmond (RDM)',
  },
  Terrebonne: {
    population: '~1,500',
    elevation: '2,800 ft',
    county: 'Deschutes',
    schoolDistrict: 'Redmond',
    nearestAirport: 'Redmond (RDM)',
  },
  'Powell Butte': {
    population: '~2,000',
    elevation: '3,100 ft',
    county: 'Crook',
    schoolDistrict: 'Crook County',
    nearestAirport: 'Redmond (RDM)',
  },
  Tumalo: {
    population: '~500',
    elevation: '3,200 ft',
    county: 'Deschutes',
    schoolDistrict: 'Bend-La Pine',
    nearestAirport: 'Redmond (RDM)',
  },
}
