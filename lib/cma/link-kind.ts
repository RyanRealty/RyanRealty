/**
 * Classify a URL a CMA email or document sent someone to, so the admin
 * outcome cell can name the tap ("report", "Diamond Bar Ranch", "reviews")
 * instead of dumping a path.
 */

export type CmaLinkKind =
  | 'letter'
  | 'area'
  | 'listing'
  | 'book'
  | 'reviews'
  | 'about'
  | 'site'
  | 'other'

export type ClassifiedCmaLink = {
  kind: CmaLinkKind
  label: string
}

const ORIGIN = 'https://ryan-realty.com'

function titleFromSlug(segment: string): string {
  const cleaned = segment.replace(/-(\d{6,})$/, '').replace(/-/g, ' ').trim()
  if (!cleaned) return segment
  return cleaned.replace(/\b[a-z]/g, (c) => c.toUpperCase())
}

function pathOf(url: string): string {
  try {
    return new URL(url, ORIGIN).pathname || '/'
  } catch {
    return url.startsWith('/') ? url.split('?')[0] ?? url : '/'
  }
}

/**
 * What kind of page this CMA-stamped URL opened, plus a broker-readable label.
 * `slug` is the document's own slug so `/cma/<slug>` is the letter, not "site".
 */
export function classifyCmaLink(url: string, slug?: string | null): ClassifiedCmaLink {
  const path = pathOf(url)
  const segments = path.split('/').filter(Boolean)
  const last = segments[segments.length - 1] ?? ''
  const doc = (slug ?? '').trim().toLowerCase()

  if (path === '/reviews' || path.startsWith('/reviews/')) {
    return { kind: 'reviews', label: 'reviews' }
  }
  if (path === '/about' || path.startsWith('/about/')) {
    return { kind: 'about', label: 'about' }
  }
  if (path === '/book' || path.startsWith('/book/')) {
    return { kind: 'book', label: 'book' }
  }

  if (segments[0] === 'cma') {
    const pageSlug = (segments[1] ?? '').toLowerCase()
    if (!doc || pageSlug === doc || pageSlug.startsWith(`${doc}-`)) {
      return { kind: 'letter', label: 'report' }
    }
    return { kind: 'letter', label: 'report' }
  }

  if (segments[0] === 'subdivisions' || segments[0] === 'cities' || segments[0] === 'communities') {
    return { kind: 'area', label: titleFromSlug(last) || segments[0] }
  }

  if (segments[0] === 'homes-for-sale') {
    // Canonical listing: last segment ends in an MLS number (6+ digits).
    if (/-\d{6,}$/.test(last) || segments[1] === 'listing') {
      return { kind: 'listing', label: titleFromSlug(last) || 'listing' }
    }
    return { kind: 'site', label: titleFromSlug(last) || 'homes for sale' }
  }

  if (segments[0] === 'housing-market') {
    return { kind: 'site', label: last ? titleFromSlug(last) : 'housing market' }
  }

  try {
    const host = new URL(url, ORIGIN).hostname.replace(/^www\./, '')
    if (host === 'ryan-realty.com' || url.startsWith('/')) {
      return { kind: 'site', label: last ? titleFromSlug(last) : 'site' }
    }
  } catch {
    // fall through
  }
  return { kind: 'other', label: last ? titleFromSlug(last) : 'link' }
}
