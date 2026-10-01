/**
 * getListingRawRow — fetch the full row from the `listings` table for a
 * single listing key.
 *
 * Lives inside lib/data/ so the DAL boundary allows it. Used by routes that
 * need the wide raw row (JSONB `details`, broker fields, every column)
 * which is intentionally NOT projected into `listing_tile_mv`.
 *
 * Lookup order:
 *   1. ListNumber
 *   2. ListingKey
 *
 * Returns null if neither matches. (Two more tries by list_number and
 * listing_key were dropped 2026-10-01: listings has neither column, so each
 * was a request that always failed. ci:listings-select-columns.)
 */

import { supabaseAnon } from '@/lib/data/client'

export type ListingRawRow = Record<string, unknown> & {
  ListingKey?: string | null
  ListNumber?: string | null
  details?: unknown
}

/** Try the two keys; return the first match. */
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

  return null
}
