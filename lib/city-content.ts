/**
 * Static content for city (and subdivision) pages so search engines and users see
 * substantive content, not thin listing-only pages. Edit here or replace with CMS.
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
      'Bend is the largest city in Central Oregon and a gateway to the High Desert. Known for craft breweries, outdoor recreation, and a strong quality of life, Bend offers a mix of mountain views, the Deschutes River, and a walkable downtown. The real estate market here includes single-family homes, townhomes, and land, with neighborhoods ranging from riverfront to high desert.',
    history:
      'Bend was incorporated in 1905 and grew with the lumber industry. In the late 20th century it became a hub for outdoor sports and tourism. Today it is one of the fastest-growing cities in Oregon, with a diverse economy and a highly sought-after housing market.',
    metaDescription: 'Homes for sale in Bend, Oregon. Browse Bend real estate listings, market stats, and neighborhoods.',
    demographics:
      'Bend welcomes roughly 105,000 residents, with a median age around 40 and a mix of families, outdoor enthusiasts, and remote workers. Median household income is in the upper $80s, and the community is known for being active, educated, and friendly. Whether you’re raising a family or enjoying retirement, Bend feels like a place where people look out for each other.',
    attractions:
      'From the Deschutes River Trail and Mt. Bachelor to the Old Mill District and downtown breweries, Bend is built for people who love the outdoors and a relaxed vibe. Hiking, skiing, biking, and floating the river are part of everyday life. The community also supports a strong arts scene, farmers markets, and events that make it easy to feel at home.',
    dining:
      'Bend’s food scene is as varied as its landscape—craft breweries and brewpubs, farm-to-table spots, and casual eateries where you can refuel after a day outside. Whether you’re in the mood for a quick bite downtown or a sit-down meal with mountain views, you’ll find a warm, welcoming atmosphere and a focus on quality and local flavor.',
  },
  redmond: {
    title: 'Redmond',
    description:
      'Redmond sits in the heart of Central Oregon, with easy access to Bend, Sisters, and Smith Rock. The city offers a more affordable entry point to the region while still providing strong schools, parks, and a growing downtown. Redmond real estate includes new construction, established neighborhoods, and acreage.',
    history:
      'Redmond was founded in 1910 and grew as an agricultural and railroad town. The opening of the Redmond Airport and growth in tech and healthcare have made it a popular choice for families and remote workers.',
    metaDescription: 'Homes for sale in Redmond, Oregon. Browse Redmond real estate, market data, and subdivisions.',
  },
  sisters: {
    title: 'Sisters',
    description:
      'Sisters is a small, Western-themed city at the base of the Cascade Mountains. It attracts buyers looking for a quieter, community-focused lifestyle with quick access to hiking, skiing, and outdoor recreation. Listings range from in-town homes to larger properties and land.',
    history:
      'Sisters was named after the Three Sisters peaks and developed as a logging and ranching community. Its preserved Western storefronts and events like the Sisters Rodeo make it a distinctive Central Oregon town.',
    metaDescription: 'Homes for sale in Sisters, Oregon. Browse Sisters real estate and Central Oregon mountain living.',
    demographics:
      'Sisters is a tight-knit town of about 3,000 residents who value community, the outdoors, and a slower pace. You’ll find a mix of long-time locals, families, and newcomers who chose Sisters for its small-town feel and easy access to the mountains. The vibe is welcoming and down-to-earth.',
    attractions:
      'The Cascade Mountains and Three Sisters are right in your backyard—hiking, skiing, and mountain biking are part of life here. Downtown Sisters feels like a Western film set with local shops, galleries, and the famous Sisters Rodeo. Year-round events and a strong arts community make it a place where there’s always something to do without the rush of a big city.',
    dining:
      'Sisters offers a cozy dining scene that matches its small-town character: local cafés, family-friendly restaurants, and spots where you can grab a meal before or after a day on the trails. The focus is on friendly service and a relaxed atmosphere—the kind of place where staff remember your name.',
  },
  sunriver: {
    title: 'Sunriver',
    description:
      'Sunriver is a resort and residential community south of Bend, known for the Sunriver Resort, golf, and the Deschutes River. Many properties are vacation or second homes, but full-time residents enjoy a tight-knit community and extensive trails and amenities.',
    history:
      'Sunriver was developed in the 1960s as a planned resort community. It has grown into a mix of vacation rentals and year-round homes while maintaining strict design and natural-space standards.',
    metaDescription: 'Homes for sale in Sunriver, Oregon. Browse Sunriver real estate, resort properties, and vacation homes.',
  },
  'la pine': {
    title: 'La Pine',
    description:
      'La Pine is a more rural community south of Bend and Sunriver, offering larger lots, lower prices, and a quiet lifestyle. The area appeals to buyers seeking space, privacy, and access to the Deschutes National Forest and nearby lakes.',
    metaDescription: 'Homes for sale in La Pine, Oregon. Browse La Pine real estate, land, and rural Central Oregon properties.',
  },
  prineville: {
    title: 'Prineville',
    description:
      'Prineville is the seat of Crook County and one of Central Oregon’s older towns. It offers affordable housing, a historic downtown, and proximity to fishing, hunting, and outdoor recreation. The real estate market includes older homes, new construction, and land.',
    metaDescription: 'Homes for sale in Prineville, Oregon. Browse Prineville and Crook County real estate listings.',
  },
  madras: {
    title: 'Madras',
    description:
      'Madras is in Jefferson County, with views of Mount Jefferson and the Cascades. The area offers a mix of agricultural land, newer subdivisions, and more affordable housing compared to Bend, with good highway access to the rest of Central Oregon.',
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

  paras.push(
    `${cityName} is part of Central Oregon's diverse real estate landscape. ${population ? `The area is home to approximately ${population} residents. ` : ''}${county ? `It sits in ${county} County. ` : ''}${elevation ? `Elevation is around ${elevation}. ` : ''}${nearestAirport ? `The nearest commercial airport is ${nearestAirport}. ` : ''}Buyers and sellers here benefit from a mix of neighborhoods, clear seasons, and access to outdoor recreation and major highways.`
  )

  const marketParts: string[] = []
  if (activeCount > 0) marketParts.push(`${activeCount} active listing${activeCount === 1 ? '' : 's'}`)
  if (priceStr) marketParts.push(`a median list price of ${priceStr}`)
  if (communityCount > 0) marketParts.push(`${communityCount} communities and subdivisions`)
  if (marketParts.length > 0) {
    paras.push(
      `The current ${cityName} real estate market includes ${marketParts.join(', ')}. Whether you're looking for a primary residence, a vacation property, or land, the area offers a range of options. Listings are updated regularly; browse below for the latest homes for sale.`
    )
  }

  if (schoolDistrict && paras.length < 3) {
    paras.push(
      `Schools in the area fall under ${schoolDistrict}. Many buyers consider school districts when choosing a neighborhood; we recommend visiting the district website and touring areas that fit your priorities.`
    )
  }
  return paras
}

/** Build 1–2 paragraphs for neighborhood about when description is missing or short. */
export function buildDataDrivenNeighborhoodAbout(input: {
  neighborhoodName: string
  cityName: string
  activeCount: number
  medianPrice: number | null
}): string[] {
  const { neighborhoodName, cityName, activeCount, medianPrice } = input
  const paras: string[] = []
  const priceStr =
    medianPrice != null && Number.isFinite(medianPrice)
      ? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(medianPrice)
      : null
  paras.push(
    `${neighborhoodName} is a neighborhood in ${cityName}, Oregon. It offers residents a mix of housing styles and proximity to schools, services, and Central Oregon recreation. Browse the listings below for current homes for sale in the area.`
  )
  if (activeCount > 0 || priceStr) {
    const parts: string[] = []
    if (activeCount > 0) parts.push(`${activeCount} active listing${activeCount === 1 ? '' : 's'}`)
    if (priceStr) parts.push(`median list price ${priceStr}`)
    paras.push(`The current market in ${neighborhoodName} includes ${parts.join(', ')}. For more area overview and city-wide stats, see the ${cityName} city page.`)
  }
  return paras
}
