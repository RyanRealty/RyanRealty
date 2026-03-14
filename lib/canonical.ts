/**
 * Canonical URL helper. Strip non-essential query params for SEO.
 * Base URL comes from getCanonicalSiteUrl (single source of truth).
 */

import { getCanonicalSiteUrl } from './share-metadata'

const STRIP_PARAMS = new Set([
  'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
  'fbclid', 'gclid', 'page', 'sort', 'view', 'ref',
])

/**
 * Returns full canonical URL for a path. Strips pagination, sort, and tracking params.
 */
export function getCanonicalUrl(path: string): string {
  const base = getCanonicalSiteUrl()
  const [pathname, search] = path.split('?')
  const cleanPath = pathname?.replace(/\/+/g, '/').replace(/^\//, '') ?? ''
  if (!search) return `${base}/${cleanPath}`
  const params = new URLSearchParams(search)
  for (const key of STRIP_PARAMS) {
    params.delete(key)
  }
  const q = params.toString()
  return q ? `${base}/${cleanPath}?${q}` : `${base}/${cleanPath}`
}
