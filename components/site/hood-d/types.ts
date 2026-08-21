export type HoodDHeroData = {
  activeCount: number | null
  medianListPrice: number | null
  medianDaysToPending: number | null
}

export type HoodDHome = {
  href: string
  img: string
  priceLabel: string
  address: string
  meta: string | null
}

export type HoodDMapRow = {
  key: string
  href: string
  title: string
  subtitle: string | null
  price: number | null
  photoUrl: string | null
  propertySubType: string | null
  subdivisionName: string | null
  city: string | null
  listNumber: string | null
}

export type HoodDChild = {
  name: string
  href: string
}

export type HoodDPlace = {
  name: string
  href: string | null
  detail: string | null
  img: string | null
}

export type HoodDEvent = {
  name: string
  href: string
  detail: string | null
}

export type HoodDPost = {
  title: string
  href: string
  excerpt: string | null
  dateLabel: string | null
}

export type HoodDCompareRow = {
  label: string
  here: string
  city: string
}

export type HoodDPeer = {
  name: string
  href: string
  img: string | null
  detail: string | null
}

export type HoodDSchool = {
  name: string
  detail: string | null
}

export type HoodDReview = {
  quote: string
  author: string
}
