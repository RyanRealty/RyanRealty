import type { KbFeaturedItem, KbHeroData } from '@/components/site/kb/types'

export type HomeDHeroData = KbHeroData

export type HomeDTown = {
  name: string
  slug: string
  activeCount: number | null
  medianPrice: number | null
  href: string
  img: string | null
}

export type HomeDPolygonFeature = {
  slug: string
  name: string
  href: string
  geometry: GeoJSON.Polygon | GeoJSON.MultiPolygon
}

export type HomeDCommunity = {
  name: string
  town: string
  href: string
  img: string | null
  activeCount: number
}

export type HomeDPost = {
  title: string
  href: string
  excerpt: string | null
  dateLabel: string | null
}

export type HomeDPark = {
  name: string
  slug: string
  href: string
  city: string
  detail: string | null
  img: string | null
}

export type HomeDLuxuryItem = KbFeaturedItem & {
  propertySubType: string | null
  listNumber: string | null
}
