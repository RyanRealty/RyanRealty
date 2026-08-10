/**
 * Static content for city (and subdivision) pages so search engines and users see
 * substantive content, not thin listing-only pages. Edit here or replace with CMS.
 *
 * Layer B only: about body paragraphs (description, history, demographics,
 * attractions, dining). Layer A titles/meta/H1s live on the city route.
 */

export type CityContent = {
  title?: string
  description: string
  history?: string
  /** Short line for meta description */
  metaDescription?: string
  /** Warm, friendly demographics for About tab */
  demographics?: string
  /** Attractions / things to do for tab */
  attractions?: string
  /** Places to eat / dining for tab */
  dining?: string
}

const cityContent: Record<string, CityContent> = {
  bend: {
    title: 'Bend',
    description:
      'Bend is the largest city in Central Oregon. It sits on the Deschutes River with the Cascade Range to the west. You get single-family homes, townhomes, and land, from river corridors to high-desert edges and the west-side golf communities.',
    history:
      'Bend was incorporated in 1905 and grew with lumber. Later it became a base for outdoor sports and tourism. It is one of the faster-growing cities in Oregon, with housing demand that follows that growth.',
    metaDescription: 'Homes for sale in Bend, Oregon. Browse Bend real estate listings, market stats, and neighborhoods.',
    demographics:
      'Bend has roughly 105,000 residents, a median age around 40, and a mix of families, outdoor workers, and people who work remote. Median household income sits in the upper $80s. That mix shows up in the inventory: starter homes, mid-range neighborhoods, and high-end west-side stock.',
    attractions:
      'Daily life here often includes the Deschutes River Trail, Mt. Bachelor, the Old Mill District, and downtown. Hiking, skiing, biking, and floating the river sit next to arts events, farmers markets, and a long list of craft breweries.',
    dining:
      'Bend has craft breweries and brewpubs, farm-to-table restaurants, and casual spots after a day outside. Downtown and the Old Mill hold most of the density; west-side and south-side corridors fill in the rest.',
  },
  redmond: {
    title: 'Redmond',
    description:
      'Redmond sits in the middle of Central Oregon, with short drives to Bend, Sisters, and Smith Rock. List prices run lower than Bend for a similar home size. Inventory covers new construction, older neighborhoods, and acreage.',
    history:
      'Redmond was founded in 1910 as an agricultural and railroad town. The airport, plus growth in tech and healthcare, pulled in more full-time residents and remote workers.',
    metaDescription: 'Homes for sale in Redmond, Oregon. Browse Redmond real estate, market data, and subdivisions.',
  },
  sisters: {
    title: 'Sisters',
    description:
      'Sisters is a small Western-themed city at the base of the Cascades. Buyers come for a quieter street grid, mountain access, and in-town shops. Listings run from in-town homes to larger lots and land.',
    history:
      'Sisters takes its name from the Three Sisters peaks. It started as a logging and ranching town. The Western storefronts and the Sisters Rodeo still define the main street.',
    metaDescription: 'Homes for sale in Sisters, Oregon. Browse Sisters real estate and Central Oregon mountain living.',
    demographics:
      'Sisters has about 3,000 year-round residents. You will find long-time locals, families, and people who moved for mountain access and a smaller downtown. The housing stock is limited compared with Bend or Redmond, so inventory turns over more slowly.',
    attractions:
      'The Cascades and Three Sisters sit above town. Hiking, skiing, and mountain biking start close to the city limits. Downtown has local shops, galleries, and the Sisters Rodeo calendar.',
    dining:
      'Dining is small-town scale: local cafes, family restaurants, and places you hit before or after a trail day. Service is personal because the room is small.',
  },
  sunriver: {
    title: 'Sunriver',
    description:
      'Sunriver is a planned resort and residential community south of Bend, built around Sunriver Resort, golf, and the Deschutes River. Many homes are vacation or second homes. Full-time residents share the same trails, paths, and HOA rules.',
    history:
      'Sunriver was developed in the 1960s as a planned resort. It still mixes vacation rentals and year-round homes under design and open-space standards set by the owners association.',
    metaDescription: 'Homes for sale in Sunriver, Oregon. Browse Sunriver real estate, resort properties, and vacation homes.',
  },
  'la pine': {
    title: 'La Pine',
    description:
      'La Pine sits south of Bend and Sunriver. Lots run larger, list prices run lower, and the feel is more rural. Buyers come for space, privacy, and access to the Deschutes National Forest and nearby lakes.',
    metaDescription: 'Homes for sale in La Pine, Oregon. Browse La Pine real estate, land, and rural Central Oregon properties.',
  },
  prineville: {
    title: 'Prineville',
    description:
      'Prineville is the seat of Crook County and one of the older towns in Central Oregon. Housing costs less than Bend. You will find older homes, new construction, land, and a historic downtown. Fishing, hunting, and reservoir recreation sit nearby.',
    metaDescription: 'Homes for sale in Prineville, Oregon. Browse Prineville and Crook County real estate listings.',
  },
  madras: {
    title: 'Madras',
    description:
      'Madras is in Jefferson County, with views of Mount Jefferson and the Cascades. Inventory mixes agricultural land, newer subdivisions, and homes that cost less than Bend. Highway access ties it to the rest of Central Oregon.',
    metaDescription: 'Homes for sale in Madras, Oregon. Browse Madras and Jefferson County real estate and land.',
  },
}

/** Normalize city name for lookup (lowercase, trim). */
function normalizeKey(name: string): string {
  return name.trim().toLowerCase()
}

/**
 * Get content for a city page. Returns null if none defined (page can still show market snapshot + listings).
 */
export function getCityContent(city: string): CityContent | null {
  if (!city?.trim()) return null
  const key = normalizeKey(city)
  const exact = cityContent[key]
  if (exact) return exact
  const titleCase = city.trim().replace(/\w\S*/g, (t) => t.charAt(0).toUpperCase() + t.slice(1).toLowerCase())
  const byTitle = cityContent[normalizeKey(titleCase)]
  if (byTitle) return { ...byTitle, title: titleCase }
  return null
}

/**
 * Optional short blurb for a subdivision (e.g. "Part of Bend's west side..."). Add entries as needed.
 */
const subdivisionBlurb: Record<string, string> = {}

export function getSubdivisionBlurb(subdivisionName: string): string | null {
  if (!subdivisionName?.trim()) return null
  return subdivisionBlurb[normalizeKey(subdivisionName)] ?? null
}

/** Quick facts + market stats for building data-driven copy when no static content exists. */
export type CityDataDrivenInput = {
  cityName: string
  population?: string | null
  elevation?: string | null
  county?: string | null
  schoolDistrict?: string | null
  nearestAirport?: string | null
  activeCount: number
  medianPrice: number | null
  communityCount: number
}

/**
 * Build 2–3 paragraphs of substantive "About [city]" copy from data only.
 * Used when DB description is missing or very short so pages are never thin.
 * Numbers come only from the input (DAL / city metadata). No invented stats.
 */
export function buildDataDrivenCityAbout(input: CityDataDrivenInput): string[] {
  const {
    cityName,
    population,
    elevation,
    county,
    schoolDistrict,
    nearestAirport,
    activeCount,
    medianPrice,
    communityCount,
  } = input
  const paras: string[] = []
  const priceStr =
    medianPrice != null && Number.isFinite(medianPrice)
      ? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(medianPrice)
      : null

  const placeBits: string[] = []
  if (population) placeBits.push(`about ${population} residents`)
  if (county) placeBits.push(`${county} County`)
  if (elevation) placeBits.push(`elevation around ${elevation}`)
  if (nearestAirport) placeBits.push(`nearest commercial airport ${nearestAirport}`)

  paras.push(
    placeBits.length > 0
      ? `${cityName} is in Central Oregon. ${placeBits.join('. ')}.`
      : `${cityName} is in Central Oregon. Neighborhoods, seasons, and highway access shape what sells here.`,
  )

  const marketParts: string[] = []
  if (activeCount > 0) marketParts.push(`${activeCount} active listing${activeCount === 1 ? '' : 's'}`)
  if (priceStr) marketParts.push(`a median list price of ${priceStr}`)
  if (communityCount > 0) marketParts.push(`${communityCount} communities and subdivisions`)
  if (marketParts.length > 0) {
    paras.push(
      `Right now the ${cityName} market shows ${marketParts.join(', ')}. That mix covers primary homes, vacation property, and land. Listings on this page refresh from the regional MLS.`,
    )
  }

  if (schoolDistrict && paras.length < 3) {
    paras.push(
      `Schools fall under ${schoolDistrict}. Check the district site and tour the streets that match your budget and commute.`,
    )
  }
  return paras
}
