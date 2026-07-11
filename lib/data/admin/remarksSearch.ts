/**
 * Admin remarks search — keyword match across BOTH PublicRemarks and
 * PrivateRemarks on the on-market listing_search_mv.
 *
 * private_remarks is column-level-granted to service_role ONLY (migration
 * 20260711190000): the anon/authenticated PostgREST roles get a permission
 * error even naming the column, so this module is the single read path and it
 * runs on the service client. Callers MUST sit behind getAdminContext() —
 * app/actions/admin-listings.ts is the only intended consumer.
 *
 * Match semantics mirror the public keyword search (word-AND), except each
 * word may land in either remarks field: for every word,
 * (public_remarks ILIKE %w% OR private_remarks ILIKE %w%).
 */

import { createServiceClient } from '@/lib/supabase/service'

export type AdminRemarksSearchRow = {
  listingKey: string
  listNumber: string | null
  status: string | null
  listPrice: number | null
  beds: number | null
  baths: number | null
  streetNumber: string | null
  streetName: string | null
  streetSuffix: string | null
  city: string | null
  postalCode: string | null
  subdivisionName: string | null
  photoUrl: string | null
  onMarketDate: string | null
  modifiedAt: string | null
  publicRemarks: string | null
  /** Admin-only. Never pass to a public surface. */
  privateRemarks: string | null
  /** Which remarks field(s) matched — lets the UI badge private-only hits. */
  matchedIn: ('public' | 'private')[]
}

function client() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url?.trim() || !key?.trim()) return null
  return createServiceClient()
}

function keywordWords(raw: string): string[] {
  return raw
    .replace(/[%_*\\]/g, ' ')
    .split(/\s+/)
    .map((w) => w.trim())
    .filter((w) => w.length >= 2)
    .slice(0, 6)
}

const SELECT_COLUMNS = [
  'listing_key', 'list_number', 'standard_status', 'list_price', 'beds', 'baths',
  'street_number', 'street_name', 'street_suffix', 'city', 'postal_code',
  'subdivision_name', 'photo_url', 'on_market_date', 'modified_at',
  'public_remarks', 'private_remarks',
].join(',')

type MvRemarksRow = {
  listing_key: string
  list_number: string | null
  standard_status: string | null
  list_price: number | null
  beds: number | null
  baths: number | null
  street_number: string | null
  street_name: string | null
  street_suffix: string | null
  city: string | null
  postal_code: string | null
  subdivision_name: string | null
  photo_url: string | null
  on_market_date: string | null
  modified_at: string | null
  public_remarks: string | null
  private_remarks: string | null
}

export async function searchAdminListingsRemarks(
  rawQuery: string,
  opts?: { limit?: number; offset?: number }
): Promise<{ rows: AdminRemarksSearchRow[]; totalCount: number }> {
  const supabase = client()
  if (!supabase) return { rows: [], totalCount: 0 }

  const words = keywordWords(rawQuery)
  if (words.length === 0) return { rows: [], totalCount: 0 }

  const limit = Math.min(Math.max(opts?.limit ?? 50, 1), 200)
  const offset = Math.max(opts?.offset ?? 0, 0)

  let query = supabase
    .from('listing_search_mv')
    .select(SELECT_COLUMNS, { count: 'exact' })
  for (const word of words) {
    // Values are sanitized by keywordWords (no % _ * \\ or commas survive a
    // word split), so the or() filter string cannot be broken out of.
    query = query.or(`public_remarks.ilike.%${word}%,private_remarks.ilike.%${word}%`)
  }
  query = query
    .order('modified_at', { ascending: false, nullsFirst: false })
    .range(offset, offset + limit - 1)

  const { data, count, error } = await query
  if (error) {
    throw new Error(`[searchAdminListingsRemarks] supabase error: ${error.message}`)
  }

  const lower = words.map((w) => w.toLowerCase())
  const rows = ((data ?? []) as unknown as MvRemarksRow[]).map((r) => {
    const pub = (r.public_remarks ?? '').toLowerCase()
    const priv = (r.private_remarks ?? '').toLowerCase()
    const matchedIn: ('public' | 'private')[] = []
    if (lower.some((w) => pub.includes(w))) matchedIn.push('public')
    if (lower.some((w) => priv.includes(w))) matchedIn.push('private')
    return {
      listingKey: r.listing_key,
      listNumber: r.list_number,
      status: r.standard_status,
      listPrice: r.list_price,
      beds: r.beds,
      baths: r.baths,
      streetNumber: r.street_number,
      streetName: r.street_name,
      streetSuffix: r.street_suffix,
      city: r.city,
      postalCode: r.postal_code,
      subdivisionName: r.subdivision_name,
      photoUrl: r.photo_url,
      onMarketDate: r.on_market_date,
      modifiedAt: r.modified_at,
      publicRemarks: r.public_remarks,
      privateRemarks: r.private_remarks,
      matchedIn,
    }
  })
  return { rows, totalCount: count ?? rows.length }
}
