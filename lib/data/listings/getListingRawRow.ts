/**
 * getListingRawRow — fetch the full PascalCase + snake_case row from the
 * `listings` table for a single listing key.
 *
 * Lives inside lib/data/ so the DAL boundary allows it. Used by routes that
 * need the wide raw row (JSONB `details`, broker fields, every column)
 * which is intentionally NOT projected into `listing_tile_mv`.
 *
 * Lookup order:
 *   1. PascalCase ListNumber
 *   2. PascalCase ListingKey
 *   3. snake_case list_number
 *   4. snake_case listing_key
 *
 * Returns null if none match.
 */

import { supabaseAnon } from '@/lib/data/client'

export type ListingRawRow = Record<string, unknown> & {
  ListingKey?: string | null
  ListNumber?: string | null
  details?: unknown
}

/** Try four keying paths; return the first non-null. */
export async function getListingRawRowByKey(key: string): Promise<ListingRawRow | null> {
  const sb = supabaseAnon()
  if (!sb) return null
  const k = String(key ?? '').trim()
  if (!k) return null

  const normalize = (row: ListingRawRow | null): ListingRawRow | null => {
    if (!row) return null
    if (row.details && typeof row.details === 'string') {
      try {
        row.details = JSON.parse(row.details as string) as Record<string, unknown>
      } catch { /* keep as string */ }
    }
    return row
  }

  const byNumber = await sb.from('listings').select('*').eq('ListNumber', k).maybeSingle()
  if (byNumber.data) return normalize(byNumber.data as ListingRawRow)

  const byKey = await sb.from('listings').select('*').eq('ListingKey', k).maybeSingle()
  if (byKey.data) return normalize(byKey.data as ListingRawRow)

  const bySnakeNum = await sb.from('listings').select('*').eq('list_number', k).maybeSingle()
  if (bySnakeNum.data) return normalize(bySnakeNum.data as ListingRawRow)

  const bySnakeKey = await sb.from('listings').select('*').eq('listing_key', k).maybeSingle()
  if (bySnakeKey.data) return normalize(bySnakeKey.data as ListingRawRow)

  return null
}
