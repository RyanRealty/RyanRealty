export type CityDHeroData = {
  activeCount: number | null
  medianListPrice: number | null
  medianDaysToPending: number | null
}

export type CityDNearbyPlace = {
  name: string
  href: string
  img: string
  town: string
}

export type CityDSchool = {
  name: string
  href: string
  level: 'elementary' | 'middle' | 'high'
  grades: string | null
  district: string
}

export type CityDReview = {
  quote: string
  author: string
  source: string
}

export type CityDFooterLink = {
  href: string
  label: string
}

export type CityDMarketKpi = {
  label: string
  value: string
}
