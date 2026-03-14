/**
 * Static and data-driven content for community (subdivision) and resort pages.
 * Resort pages should read like splash pages: overview, amenities, lifestyle, real estate.
 * Regular communities get substantive about copy so search engines and LLMs don't see thin content.
 */

function normalizeKey(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, ' ')
}

export type ResortCommunityContent = {
  overview: string
  /** Lifestyle, amenities, HOA, trails, etc. */
  amenities?: string
  /** Golf, recreation, skiing, etc. */
  golf_recreation?: string
  /** Real estate mix, buyer profile, market note */
  real_estate?: string
  /** Optional short history or development story */
  history?: string
}

/** Key = "city:subdivision" normalized (lowercase, single spaces). */
const resortContent: Record<string, ResortCommunityContent> = {
  'sunriver:sunriver': {
    overview:
      'Sunriver is a premier resort and residential community south of Bend, set among ponderosa pines along the Deschutes River. Developed as a planned resort in the 1960s, it has grown into a mix of vacation homes, full-time residences, and short-term rentals while keeping strict design and natural-space standards. The community is known for its extensive path system, three golf courses, and family-friendly amenities.',
    amenities:
      'Sunriver offers a private path system for walking and biking, multiple pools and tennis facilities, the Sunriver Resort and Lodge, and the Village at Sunriver with shops and dining. Many homes have access to HOA amenities including recreation centers. The community is highly walkable and bike-friendly, with a focus on preserving open space and wildlife habitat.',
    golf_recreation:
      'Golf is central to Sunriver: the community is home to Crosswater (often ranked among the top courses in Oregon), Meadows at Sunriver, and Woodlands. The Deschutes River runs through the area for fishing and floating. In winter, Mt. Bachelor is a short drive for skiing and snowboarding. Trails, parks, and the Sunriver Nature Center round out outdoor recreation.',
    real_estate:
      'Sunriver real estate includes single-family homes, townhomes, and condos, with a wide range of sizes and price points. Many buyers choose Sunriver as a second home or vacation rental investment; full-time residents enjoy a tight-knit community and year-round access to amenities. Listings are updated frequently; browse below for current homes for sale.',
  },
  'sunriver:sunriver resort': {
    overview:
      'Sunriver Resort is the heart of the Sunriver community—a full-service resort with lodging, dining, and recreation. Real estate in the resort area includes condos and homes with proximity to the lodge, golf, and the Village. Buyers often look here for vacation properties or investment rentals with strong demand.',
    real_estate:
      'Properties near Sunriver Resort appeal to buyers who want walkable access to the lodge, golf, and amenities. The mix includes condos and single-family homes. Browse current listings below for availability and pricing.',
  },
  'bend:pronghorn': {
    overview:
      'Pronghorn is a resort community in Bend built around two golf courses—one by Nicklaus Design and one by Tom Fazio—and a commitment to outdoor living. The community blends high-end homes with mountain and high-desert views, trails, and a members-only club. It attracts buyers seeking a resort lifestyle with easy access to Bend and Central Oregon recreation.',
    amenities:
      'Pronghorn residents enjoy the Club at Pronghorn with dining and events, 36 holes of golf, a fitness center, and extensive trails. The design standards and natural landscaping give the community a cohesive, upscale feel. Many properties are second homes; full-time residents enjoy a quiet, active lifestyle.',
    golf_recreation:
      'Golf is the centerpiece: the Nicklaus and Fazio courses offer distinct challenges and views. Hiking and biking trails connect to the broader Bend trail network. Mt. Bachelor, Smith Rock, and the Deschutes River are all within a short drive.',
    real_estate:
      'Pronghorn real estate includes custom and production homes, often on larger lots with views. Price points range from mid-six figures into the millions. Browse active listings below for current availability.',
  },
  'sisters:black butte ranch': {
    overview:
      'Black Butte Ranch is a resort and residential community west of Sisters, set against the Cascade Mountains. Two golf courses, a pool complex, tennis, and miles of trails define the lifestyle. The ranch has been a Central Oregon destination for decades, with a mix of vacation homes and year-round residents who value privacy and recreation.',
    amenities:
      'Black Butte Ranch offers two 18-hole golf courses, multiple pools, tennis and pickleball, dining at the Lodge, and a general store. The trail system is used for walking, biking, and horseback riding. HOA standards preserve the ranch character and natural setting.',
    golf_recreation:
      'Golf at Black Butte Ranch includes the Big Meadow and Glaze Meadow courses, both well-regarded for playability and views. The community is a gateway to the Deschutes National Forest, with easy access to hiking, fishing, and skiing at Hoodoo or Mt. Bachelor.',
    real_estate:
      'Homes at Black Butte Ranch range from cabins and condos to large custom homes. Many buyers use the property as a second home or vacation rental. Full-time residents enjoy a tight community and year-round access to amenities. Browse listings below for current homes for sale.',
  },
  'bend:tetherow': {
    overview:
      'Tetherow is a golf and resort community in Bend built around a David McLay Kidd–designed course and a modern lodge. The community offers a mix of homes and lots with mountain and fairway views, plus access to a pool, fitness, and dining. It appeals to buyers who want a resort feel with close proximity to Bend.',
    amenities:
      'Tetherow residents have access to the Tetherow Lodge, golf, pool, and fitness facilities. The community is designed for both vacation and full-time living, with design standards that maintain a consistent, high-quality look.',
    golf_recreation:
      'The Tetherow Golf Course is a central feature—a links-style course with views of the Cascades. Bend’s trail network, Mt. Bachelor, and the Deschutes River are all nearby for additional recreation.',
    real_estate:
      'Tetherow real estate includes single-family homes and lots. Prices vary by size and location within the community. Browse active listings below for current availability.',
  },
  'redmond:eagle crest resort': {
    overview:
      'Eagle Crest Resort is a large resort community in Redmond with multiple golf courses, a spa, pools, and dining. The community caters to vacationers and full-time residents who want resort amenities and a Central Oregon lifestyle at a slightly lower price point than Bend or Sunriver.',
    amenities:
      'Eagle Crest offers 54 holes of golf, multiple pools and hot tubs, a fitness center, spa, and several dining options. The resort has a mix of condos and single-family homes, many available as vacation rentals.',
    golf_recreation:
      'Three golf courses provide variety for players. The resort is close to Smith Rock, the Deschutes River, and Redmond’s airport, making it convenient for outdoor recreation and travel.',
    real_estate:
      'Eagle Crest real estate includes condos and single-family homes. Buyers often choose the community for a second home or investment property. Browse listings below for current homes for sale.',
  },
  'powell butte:brasada ranch': {
    overview:
      'Brasada Ranch is a resort community east of Bend in Powell Butte, built around a Cupp Design golf course and a ranch-style lodge. The community offers homes and cabins with high-desert and mountain views, plus access to golf, pools, dining, and trails. It appeals to buyers seeking a quieter resort setting with easy access to Bend.',
    amenities:
      'Brasada Ranch features the Brasada Canyons golf course, Sage Canyon Sports Club with pool and fitness, and the Ranch House for dining. The design emphasizes the high-desert landscape and wide views.',
    golf_recreation:
      'Golf at Brasada Canyons is the centerpiece. The area is also suited to hiking, biking, and exploring Central Oregon’s high desert. Bend and Prineville are both within a short drive.',
    real_estate:
      'Brasada Ranch real estate includes cabins and custom homes. Listings range from more affordable cabins to higher-end custom builds. Browse below for current homes for sale.',
  },
  'bend:petrosa': {
    overview:
      'Petrosa is a residential community in Bend, Oregon, offering a mix of single-family homes with access to Central Oregon’s outdoor lifestyle. The neighborhood is known for its family-friendly setting, proximity to schools and services, and easy access to trails, parks, and the Deschutes River.',
    amenities:
      'Residents of Petrosa benefit from Bend’s extensive path system for walking and biking, nearby parks, and the area’s strong schools and services. The community is close to shopping, dining, and healthcare, while remaining a short drive from Mt. Bachelor, the Deschutes River, and the Cascade Lakes. Many homes feature views and lot sizes that appeal to families and outdoor enthusiasts.',
    real_estate:
      'Petrosa real estate includes single-family homes across a range of sizes and price points. The market here reflects Bend’s overall demand: active listings, competitive pricing, and solid interest from buyers. Browse the listings below for current homes for sale, or contact a Ryan Realty agent for a personalized market overview.',
  },
}

export function getResortCommunityContent(city: string, subdivision: string): ResortCommunityContent | null {
  const key = `${normalizeKey(city)}:${normalizeKey(subdivision)}`
  return resortContent[key] ?? null
}

/** Listing-derived stats for data-driven community copy. */
export type CommunityDataDrivenInput = {
  communityName: string
  city: string
  isResort: boolean
  activeCount: number
  medianPrice: number | null
  minPrice: number | null
  maxPrice: number | null
  propertyTypes: string[]
  avgLotAcres: number | null
  yearBuiltMin: number | null
  yearBuiltMax: number | null
  hasHoa: boolean
  hasWaterfront: boolean
}

/**
 * Build 2–4 paragraphs of substantive "About [community]" copy from data.
 * Used when DB description and static content are missing or thin.
 */
export function buildDataDrivenCommunityAbout(input: CommunityDataDrivenInput): string[] {
  const {
    communityName,
    city,
    isResort,
    activeCount,
    medianPrice,
    minPrice,
    maxPrice,
    propertyTypes,
    avgLotAcres,
    yearBuiltMin,
    yearBuiltMax,
    hasHoa,
    hasWaterfront,
  } = input
  const paras: string[] = []
  const priceStr = (n: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)

  const intro =
    isResort
      ? `${communityName} is a resort community in ${city}, Oregon. It offers a mix of recreation, amenities, and residential living that appeals to second-home buyers and full-time residents alike.`
      : `${communityName} is a community in ${city}, Oregon, with a range of homes and lots. Buyers here benefit from the area’s schools, services, and access to Central Oregon’s outdoor recreation.`
  paras.push(intro)

  const amenitiesLine =
    city.toLowerCase().includes('bend') || city.toLowerCase().includes('sisters') || city.toLowerCase().includes('redmond') || city.toLowerCase().includes('sunriver')
      ? `The area offers trails, parks, and easy access to the Deschutes River, Mt. Bachelor, and the Cascade Lakes. Schools, shopping, and healthcare are nearby, making it a practical choice for families and outdoor enthusiasts alike.`
      : `Residents enjoy access to Central Oregon’s schools, services, and outdoor recreation, including trails, parks, and nearby natural areas.`
  if (paras.length < 3) paras.push(amenitiesLine)

  const marketParts: string[] = []
  if (activeCount > 0) marketParts.push(`${activeCount} active listing${activeCount === 1 ? '' : 's'}`)
  if (medianPrice != null && Number.isFinite(medianPrice)) marketParts.push(`median list price ${priceStr(medianPrice)}`)
  if (minPrice != null && maxPrice != null && minPrice !== maxPrice)
    marketParts.push(`price range ${priceStr(minPrice)} – ${priceStr(maxPrice)}`)
  else if (minPrice != null) marketParts.push(`listings from ${priceStr(minPrice)}`)
  if (marketParts.length > 0) {
    paras.push(
      `The current real estate market in ${communityName} includes ${marketParts.join(', ')}. ${propertyTypes.length > 0 ? `Property types include ${propertyTypes.slice(0, 4).join(', ')}. ` : ''}${avgLotAcres != null && avgLotAcres > 0 ? `Typical lot sizes run around ${avgLotAcres >= 1 ? `${avgLotAcres.toFixed(1)} acres` : `${(avgLotAcres * 43560).toFixed(0)} sq ft`}. ` : ''}${yearBuiltMin != null && yearBuiltMax != null ? `Homes were built from the ${yearBuiltMin}s to the ${yearBuiltMax}s. ` : ''}${hasHoa ? 'The community has an HOA. ' : ''}${hasWaterfront ? 'Some properties offer waterfront access. ' : ''}Browse the listings below for the latest homes for sale.`
    )
  }

  if (isResort && paras.length < 3) {
    paras.push(
      `Resort communities in Central Oregon often feature golf, pools, trails, and club amenities. Contact a Ryan Realty agent for details on what ${communityName} offers and current availability.`
    )
  }
  return paras
}
