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

/** Primary cities to feature (Section 18). */
export const PRIMARY_CITIES = [
  'Bend',
  'Redmond',
  'Sisters',
  'Sunriver',
  'La Pine',
  'Prineville',
  'Madras',
  'Crooked River Ranch',
  'Terrebonne',
  'Powell Butte',
  'Tumalo',
]

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
