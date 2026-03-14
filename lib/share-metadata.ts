/**
 * Helpers for social share metadata (Open Graph, Twitter Cards).
 * Best practices: og:title ≤60 chars, og:description 100–160 chars, og:image 1200×630.
 * Share URLs must always use the production site so pasted links work on social.
 */

const MAX_DESC = 155

/** Production site URL for canonical and share links. Never localhost so shared links work on social. */
const PRODUCTION_SITE = 'https://ryan-realty.com'

/** Base URL to use for all shared links and canonical URLs. Prefers env; never returns localhost. */
export function getCanonicalSiteUrl(): string {
  const raw = typeof process !== 'undefined' && process.env && process.env.NEXT_PUBLIC_SITE_URL
  const fromEnv = typeof raw === 'string' ? raw.trim().replace(/\/$/, '') : ''
  if (fromEnv && !fromEnv.includes('localhost')) return fromEnv
  return PRODUCTION_SITE
}

/** Default hashtags for all Ryan Realty social shares. */
export const DEFAULT_HASHTAGS = '#RyanRealty #BendRealEstate #CentralOregon'

/** Additional hashtags for listing shares (location + real estate). */
export function listingHashtags(city?: string | null): string {
  const parts = ['#RealEstate']
  if (city?.trim()) {
    const c = city.trim().replace(/\s+/g, '')
    parts.push(`#${c.replace(/,/g, '')}OR`)
  }
  return parts.join(' ')
}

/** Trim and clean a string for og:description (100–160 chars recommended). */
export function shareDescription(text: string, max = MAX_DESC): string {
  return text.replace(/\s+/g, ' ').trim().slice(0, max)
}

/** Build a listing share summary: price, beds/baths/sqft, address, CTA. */
export function listingShareSummary(opts: {
  price?: number | null
  beds?: number | null
  baths?: number | null
  sqft?: number | null
  address?: string | null
  city?: string | null
}): string {
  const parts: string[] = []
  if (opts.price != null && opts.price > 0) {
    parts.push(new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(opts.price))
  }
  if (opts.beds != null || opts.baths != null) {
    const b = [opts.beds != null ? `${opts.beds} bed` : null, opts.baths != null ? `${opts.baths} bath` : null].filter(Boolean).join(', ')
    if (b) parts.push(b)
  }
  if (opts.sqft != null && opts.sqft > 0) {
    parts.push(`${Number(opts.sqft).toLocaleString()} sq ft`)
  }
  const location = [opts.address, opts.city].filter(Boolean).join(opts.address && opts.city ? ', ' : '')
  if (location) parts.push(location)
  const raw = parts.join(' · ')
  return shareDescription(raw || 'Property for sale — Ryan Realty')
}

/** Max length for social post text (Twitter allows 280; URL takes ~23, so leave room). */
const MAX_SHARE_TEXT = 250

/**
 * Build rich share text for a listing: exciting line + summary (beds, baths, sqft, price) + hashtags.
 * Used as the pre-filled message when sharing to X/Twitter, email, and native share.
 */
export function listingShareText(opts: {
  price?: number | null
  beds?: number | null
  baths?: number | null
  sqft?: number | null
  address?: string | null
  city?: string | null
  /** First sentence or excerpt from listing description for an exciting hook. */
  publicRemarks?: string | null
}): string {
  const parts: string[] = []
  const remark = (opts.publicRemarks ?? '').trim().replace(/\s+/g, ' ').slice(0, 120)
  if (remark) {
    const oneLiner = remark.includes('.') ? remark.split('.')[0].trim() + '.' : remark
    parts.push(oneLiner)
  } else {
    const stats: string[] = []
    if (opts.beds != null) stats.push(`${opts.beds} bed`)
    if (opts.baths != null) stats.push(`${opts.baths} bath`)
    if (opts.sqft != null && opts.sqft > 0) stats.push(`${Number(opts.sqft).toLocaleString()} sq ft`)
    const loc = [opts.address, opts.city].filter(Boolean).join(', ')
    if (stats.length) parts.push(`${stats.join(' · ')}${loc ? ` in ${loc}` : ''}.`)
    else if (loc) parts.push(`Beautiful property in ${loc}.`)
    else parts.push('Don\'t miss this one!')
  }
  const priceStr =
    opts.price != null && opts.price > 0
      ? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(opts.price)
      : ''
  const summaryBits: string[] = []
  if (opts.beds != null || opts.baths != null) {
    const b = [opts.beds != null ? `${opts.beds} bed` : null, opts.baths != null ? `${opts.baths} bath` : null].filter(Boolean).join(', ')
    if (b) summaryBits.push(b)
  }
  if (opts.sqft != null && opts.sqft > 0) summaryBits.push(`${Number(opts.sqft).toLocaleString()} sq ft`)
  if (priceStr) summaryBits.push(priceStr)
  const location = [opts.address, opts.city].filter(Boolean).join(', ')
  if (location) summaryBits.push(location)
  if (summaryBits.length) parts.push(summaryBits.join(' · '))
  parts.push('Your next home awaits!')
  const hashtags = [DEFAULT_HASHTAGS, listingHashtags(opts.city)].join(' ').replace(/\s+/g, ' ').trim()
  parts.push(hashtags)
  const raw = parts.join(' ')
  return shareDescription(raw, MAX_SHARE_TEXT)
}

/** Standard OG image dimensions (1200×630 recommended for all platforms). */
export const OG_IMAGE_WIDTH = 1200
export const OG_IMAGE_HEIGHT = 630
