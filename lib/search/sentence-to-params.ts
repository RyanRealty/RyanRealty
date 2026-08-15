/**
 * Sentence → the same /search URL params the filter chrome already understands.
 *
 * Grammar lives in `parseSearchQuery` (registry `voice` / `voiceValues` plus
 * range slots like `under n`, `n bed`). This module is the URL-shaped public
 * API so a typed sentence and a chip click write the same query string.
 */

import { parseSearchQuery } from '@/lib/parse-search-query'
import { ALL_SEARCH_URL_PARAMS } from '@/lib/search/field-registry'

/** Page-owned search params that are not registry field keys. */
const PAGE_OWNED_PARAMS = new Set([
  'city',
  'subdivision',
  'status',
  'propertyType',
  'propertySubType',
  'postalCode',
])

const ALLOWED_PARAMS = new Set<string>([...ALL_SEARCH_URL_PARAMS, ...PAGE_OWNED_PARAMS])

export function sentenceToParams(sentence: string): URLSearchParams {
  const out = new URLSearchParams()
  const parsed = parseSearchQuery(sentence)
  const { statusFilter, ...rest } = parsed
  if (statusFilter === 'closed') rest.status = 'Sold'
  else if (statusFilter === 'pending') rest.status = 'Pending'

  for (const [key, value] of Object.entries(rest)) {
    if (!value || !ALLOWED_PARAMS.has(key)) continue
    out.set(key, value)
  }
  return out
}

/** Overlay parsed sentence params onto the current query. Leaves other params. */
export function mergeSentenceParams(
  current: URLSearchParams,
  sentence: string,
): URLSearchParams {
  const next = new URLSearchParams(current.toString())
  for (const [key, value] of sentenceToParams(sentence).entries()) {
    next.set(key, value)
  }
  next.delete('page')
  return next
}
