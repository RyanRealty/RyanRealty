/**
 * Builds intelligent Unsplash search queries for hero images based on what
 * we actually know about a place — not the subdivision name (which is often
 * meaningless for image search, e.g. "Parkside Place Phase 1").
 *
 * The query uses the city, region, and property characteristics to find
 * a photo that actually represents what the area looks like.
 */

export type CommunityHeroTraits = {
  city: string
  subdivision: string
  isResort?: boolean
  hasWaterfront?: boolean
  propertyTypes?: string[]
  avgLotAcres?: number | null
  medianPrice?: number | null
  hasHoa?: boolean
}

const KNOWN_GOLF_RESORTS = new Set([
  'pronghorn',
  'tetherow',
  'eagle crest',
  'brasada ranch',
  'black butte ranch',
  'sunriver',
  'sunriver resort',
  'aspen lakes',
  'caldera springs',
  'awbrey glen',
  'broken top',
  'crosswater',
  'lost tracks',
  'widgi creek',
  'juniper preserve',
  '7th mtn golf village',
  'mt bachelor village',
  'inn of the 7th mountain',
])

const KNOWN_RIVER_COMMUNITIES = new Set([
  'river rim',
  'deschutes river recreation homesites',
  'riverwild',
  'river canyon estates',
  'river meadow',
  'riverhouse',
  'riverbend',
  'river rock',
])

const CITY_LANDSCAPE: Record<string, string> = {
  bend: 'Bend Oregon Cascade mountains Deschutes River',
  redmond: 'Redmond Oregon high desert Cascade mountains',
  sisters: 'Sisters Oregon Three Sisters mountains ponderosa pine',
  sunriver: 'Sunriver Oregon Deschutes River ponderosa forest',
  'sun river': 'Sunriver Oregon Deschutes River ponderosa forest',
  'la pine': 'La Pine Oregon Deschutes forest high desert',
  lapine: 'La Pine Oregon Deschutes forest high desert',
  prineville: 'Prineville Oregon Ochoco Mountains ranch land',
  madras: 'Madras Oregon Mount Jefferson wheat fields',
  tumalo: 'Tumalo Oregon high desert ranch land Cascades',
  terrebonne: 'Smith Rock Oregon rock climbing desert canyon',
  'powell butte': 'Powell Butte Oregon ranch high desert Cascades',
  'crooked river ranch': 'Crooked River canyon Oregon desert ranch',
  ashland: 'Ashland Oregon Rogue Valley mountains theater',
  albany: 'Albany Oregon Willamette Valley farmland',
  eugene: 'Eugene Oregon Willamette River university town',
  salem: 'Salem Oregon Willamette Valley state capital',
  portland: 'Portland Oregon Mount Hood Willamette River bridges',
  medford: 'Medford Oregon Rogue Valley orchards mountains',
  klamath: 'Klamath Falls Oregon Crater Lake high desert',
  'klamath falls': 'Klamath Falls Oregon Crater Lake high desert',
}

function getCityLandscape(city: string): string {
  const key = city.trim().toLowerCase()
  return CITY_LANDSCAPE[key] ?? `${city} Oregon scenic landscape`
}

function isNameMeaningful(name: string): boolean {
  const lower = name.toLowerCase()
  const meaningless = [
    'phase', 'unit', 'addition', 'plat', 'lot', 'block',
    'filing', 'replat', 'amended', 'mobile', 'estates',
    'subdivision', 'sub div', 'park', 'place', 'terrace',
    'unknown', 'unplatted', 'see remarks', 'out of area',
    'none', 'n/a', 'other', 'misc',
  ]
  if (meaningless.some((m) => lower.includes(m))) return false
  if (/^\d/.test(lower)) return false
  if (lower.length < 4) return false
  return true
}

function isKnownGolfResort(subdivision: string): boolean {
  return KNOWN_GOLF_RESORTS.has(subdivision.trim().toLowerCase())
}

function isRiverCommunity(subdivision: string): boolean {
  const lower = subdivision.trim().toLowerCase()
  if (KNOWN_RIVER_COMMUNITIES.has(lower)) return true
  return lower.includes('river') || lower.includes('creek') || lower.includes('falls')
}

function isRanchCommunity(subdivision: string): boolean {
  const lower = subdivision.trim().toLowerCase()
  return lower.includes('ranch') || lower.includes('acre') || lower.includes('farm')
}

function isMountainCommunity(subdivision: string): boolean {
  const lower = subdivision.trim().toLowerCase()
  return lower.includes('mountain') || lower.includes('mt ') || lower.includes('ridge')
    || lower.includes('summit') || lower.includes('butte') || lower.includes('peak')
    || lower.includes('heights') || lower.includes('highland')
}

function isForestCommunity(subdivision: string): boolean {
  const lower = subdivision.trim().toLowerCase()
  return lower.includes('pine') || lower.includes('cedar') || lower.includes('forest')
    || lower.includes('timber') || lower.includes('wood') || lower.includes('aspen')
    || lower.includes('juniper') || lower.includes('fir')
}

export function buildCommunityHeroQuery(traits: CommunityHeroTraits): string {
  const { city, subdivision, isResort, hasWaterfront, propertyTypes, avgLotAcres, medianPrice } = traits

  if (isKnownGolfResort(subdivision)) {
    return `${city} Oregon golf course mountain view resort`
  }

  if (isResort) {
    return `${city} Oregon resort community lodge mountain`
  }

  if (isRanchCommunity(subdivision)) {
    return `${city} Oregon ranch property fence rural landscape`
  }

  if (hasWaterfront || isRiverCommunity(subdivision)) {
    return `${city} Oregon river waterfront homes scenic`
  }

  if (isMountainCommunity(subdivision)) {
    return `${city} Oregon mountain homes Cascade view`
  }

  if (isForestCommunity(subdivision)) {
    return `${city} Oregon forest ponderosa pine homes`
  }

  const isLand = propertyTypes?.some((t) => t.toLowerCase().includes('land'))
  const isRural = avgLotAcres != null && avgLotAcres > 2
  if (isLand || isRural) {
    return `${city} Oregon rural property land high desert`
  }

  const isLuxury = medianPrice != null && medianPrice > 800000
  if (isLuxury) {
    return `${city} Oregon luxury neighborhood mountain view`
  }

  return getCityLandscape(city)
}

export function buildCityHeroQuery(city: string): string {
  return getCityLandscape(city)
}

export function buildNeighborhoodHeroQuery(neighborhood: string, city: string): string {
  if (isNameMeaningful(neighborhood)) {
    return `${neighborhood} ${city} Oregon neighborhood`
  }
  return getCityLandscape(city)
}
