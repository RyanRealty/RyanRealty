/**
 * Canonical URL helper. Strip non-essential query params for SEO.
 */

const BASE = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://ryanrealty.com').replace(/\/$/, '')

const STRIP_PARAMS = new Set([
  'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
  'fbclid', 'gclid', 'page', 'sort', 'view', 'ref',
])

/**
 * Returns full canonical URL for a path. Strips pagination, sort, and tracking params.
 */
export function getCanonicalUrl(path: string): string {
  const [pathname, search] = path.split('?')
  const cleanPath = pathname?.replace(/\/+/g, '/').replace(/^\//, '') ?? ''
  if (!search) return `${BASE}/${cleanPath}`
  const params = new URLSearchParams(search)
  for (const key of STRIP_PARAMS) {
    params.delete(key)
  }
  const q = params.toString()
  return q ? `${BASE}/${cleanPath}?${q}` : `${BASE}/${cleanPath}`
}
