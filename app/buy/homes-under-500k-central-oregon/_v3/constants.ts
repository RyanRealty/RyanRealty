import type { LeadFormId, LeadType } from '@/lib/analytics/lead-event'
import { UNDER_500K_FOOTNOTE_TOWNS, UNDER_500K_HEADLINE_TOWNS } from '@/lib/data/listings/under-500k-classify'

export const ROUTE_PATH = '/buy/homes-under-500k-central-oregon'

/** Page title only. Layout appends " | Ryan Realty" (56 chars document title). */
export const TITLE = 'Homes Under $500K in Central Oregon by City'

export const H1 = 'Homes under $500,000 in Central Oregon, town by town'

export const EYEBROW = 'Central Oregon · live MLS counts'

export const MLS_SOURCE = 'Oregon Data Share MLS via Ryan Realty'

export const CELL_UNPUBLISHED = 'not published'

export const SHARED_OWNERSHIP_TIP = 'you may not own the land outright'

export const FORM_ID: LeadFormId = 'search_alert'
export const LEAD_TYPE: LeadType = 'buyer_alerts'
export const LP_VARIANT = 'buy-under-500k'
export const TRAP = { name: 'company', label: 'Company' } as const

export const LINKS = {
  homes: '/homes-for-sale',
  method: '/how-we-get-our-numbers',
  priceDrops: '/price-drops',
  mortgage: '/tools/mortgage-calculator',
  closingCosts: '/blog/closing-costs-buyers-bend-oregon',
  firstTimeGuide: '/blog/first-time-home-buyer-guide-central-oregon',
  firstTimeBuyer: '/buy/first-time-home-buyer',
  book: '/book',
  fairHousing: '/fair-housing',
  privacy: '/privacy',
  housingWorks: 'https://housing-works.org/',
  ohcs: 'https://www.oregon.gov/ohcs',
} as const

export const BANNED_BUY_PATHS = ['/buy/alerts', '/buy/leverage', '/buy/first-time'] as const

export const ALERT_TOWNS = [
  ...UNDER_500K_HEADLINE_TOWNS.map((t) => ({ id: t.name, label: t.name })),
  ...UNDER_500K_FOOTNOTE_TOWNS.map((t) => ({ id: t.name, label: t.name })),
] as const

export const DEFAULT_ALERT_TOWNS = UNDER_500K_HEADLINE_TOWNS.map((t) => t.name)

export function under500kListingsHref(slug: string): string {
  return `/homes-for-sale/${slug}/under-500k`
}

export function under400kListingsHref(slug: string): string {
  return `/homes-for-sale/${slug}/under-400k`
}

export function under300kListingsHref(slug: string): string {
  return `/homes-for-sale/${slug}/under-300k`
}

export function lotsAndLandHref(slug: string): string {
  return `/homes-for-sale/${slug}/lots-and-land`
}

export function housingMarketHref(slug: string): string {
  return `/housing-market/${slug}`
}
