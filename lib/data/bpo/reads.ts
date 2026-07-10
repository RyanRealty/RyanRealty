/**
 * Broker Price Opinion reads + writes — the ONLY database door for the BPO
 * engine (lib/bpo/**). Service-role client: the builder runs from admin actions
 * and the CRM contact card, never from a consumer page.
 *
 * DAL boundary (G1): every raw .from() the BPO feature needs lives here.
 *
 * The subject, comp pool, market context, and broker signature are shared with
 * the CMA engine and read through lib/data/cma/builderReads.ts — this file adds
 * only what the BPO needs on top: the property's full MLS listing history (all
 * prior list attempts + the per-event history rows) and the broker_price_opinions
 * document CRUD.
 */

import 'server-only'
import { createServiceClient } from '@/lib/supabase/service'

function client() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url?.trim() || !key?.trim()) return null
  return createServiceClient()
}

export type BpoListingRow = Record<string, unknown>

/** Listings columns the listing-history analyzer needs (superset of the CMA
 *  projection — adds the price-trajectory + status-lifecycle fields). */
const BPO_CYCLE_COLUMNS = [
  'ListingKey',
  'ListNumber',
  'StreetNumber',
  'StreetName',
  'City',
  'State',
  'PostalCode',
  'SubdivisionName',
  'StandardStatus',
  'PropertyType',
  'property_sub_type',
  'ListPrice',
  'OriginalListPrice',
  'ClosePrice',
  'CloseDate',
  'ListDate',
  'OnMarketDate',
  'off_market_date',
  'DaysOnMarket',
  'CumulativeDaysOnMarket',
  'days_to_pending',
  'price_drop_count',
  'price_increase_count',
  'total_price_changes',
  'total_price_change_amt',
  'total_price_change_pct',
  'largest_price_drop_pct',
  'last_price_change_date',
  'last_price_change_amount',
  'was_relisted',
  'back_on_market_count',
  'BedroomsTotal',
  'BathroomsTotal',
  'TotalLivingAreaSqFt',
  'year_built',
  'lot_size_acres',
  'ListAgentName',
  'ListOfficeName',
  'ModificationTimestamp',
  'status_change_timestamp',
].join(', ')

/**
 * Every MLS listing cycle recorded at one street address — one row per listing
 * attempt across the property's life (each attempt is a distinct ListingKey).
 * Ordered newest first. This is how the BPO reconstructs "listed 3 times,
 * canceled twice, cut $225K" without trusting any single row.
 */
export async function getBpoListingCyclesByAddress(opts: {
  streetNumber: string
  streetNameIlike: string
  cityIlike?: string | null
  postalCode?: string | null
}): Promise<BpoListingRow[]> {
  const sb = client()
  if (!sb) return []
  let q = sb
    .from('listings')
    .select(BPO_CYCLE_COLUMNS)
    .eq('StreetNumber', opts.streetNumber)
    .ilike('StreetName', opts.streetNameIlike)
  if (opts.cityIlike?.trim()) q = q.ilike('City', opts.cityIlike.trim())
  if (opts.postalCode?.trim()) q = q.eq('PostalCode', opts.postalCode.trim())
  const { data, error } = await q
    .order('ListDate', { ascending: false, nullsFirst: false })
    .limit(30)
  if (error) {
    console.error('[getBpoListingCyclesByAddress]', error.message)
    return []
  }
  return (data ?? []) as unknown as BpoListingRow[]
}

// ─── broker_price_opinions document CRUD ─────────────────────────────────────

export type BpoAdminRow = Record<string, unknown>

/** Full BPO row (including html_content + citations) by slug. */
export async function getBpoAdminRowBySlug(slug: string): Promise<BpoAdminRow | null> {
  const sb = client()
  if (!sb) return null
  const { data } = await sb
    .from('broker_price_opinions')
    .select('*')
    .eq('slug', slug.trim().toLowerCase())
    .maybeSingle()
  return (data ?? null) as BpoAdminRow | null
}

/** The serve read: only what the /bpo/<slug> route needs. */
export async function getBpoHtmlBySlug(
  slug: string,
): Promise<{ html_content: string | null; html_path: string | null; status: string } | null> {
  const sb = client()
  if (!sb) return null
  const { data } = await sb
    .from('broker_price_opinions')
    .select('html_content, html_path, status')
    .eq('slug', slug.trim().toLowerCase())
    .maybeSingle()
  return (data ?? null) as { html_content: string | null; html_path: string | null; status: string } | null
}

/** Upsert a BPO row by slug (rebuild updates in place). Returns id + slug. */
export async function upsertBpoRowBySlug(
  row: Record<string, unknown>,
): Promise<{ id: string | null; slug: string | null; error?: string }> {
  const sb = client()
  if (!sb) return { id: null, slug: null, error: 'Supabase not configured' }
  const { data, error } = await sb
    .from('broker_price_opinions')
    .upsert(row, { onConflict: 'slug' })
    .select('id, slug')
    .single()
  if (error) return { id: null, slug: null, error: error.message }
  return {
    id: (data as { id?: string } | null)?.id ?? null,
    slug: (data as { slug?: string } | null)?.slug ?? null,
  }
}

/** Patch a BPO row by slug. */
export async function updateBpoRowFieldsBySlug(
  slug: string,
  updates: Record<string, unknown>,
): Promise<{ ok: boolean; error?: string }> {
  const sb = client()
  if (!sb) return { ok: false, error: 'Supabase not configured' }
  const { error } = await sb
    .from('broker_price_opinions')
    .update(updates)
    .eq('slug', slug.trim().toLowerCase())
  return error ? { ok: false, error: error.message } : { ok: true }
}

/** Delete a BPO row (comps cascade via FK) by id. */
export async function deleteBpoRowById(id: string): Promise<{ ok: boolean; error?: string }> {
  const sb = client()
  if (!sb) return { ok: false, error: 'Supabase not configured' }
  const { error } = await sb.from('broker_price_opinions').delete().eq('id', id)
  return error ? { ok: false, error: error.message } : { ok: true }
}

export type BpoCompInsert = {
  bpo_id: string
  comp_listing_key: string
  comp_order: number
  comp_address: string | null
  sold_price: number | null
  sold_date: string | null
  days_to_offer: number | null
  dom_total: number | null
  price_per_sqft: number | null
  adjusted_price: number | null
}

/** Replace the bpo_comps set for one BPO (idempotent rebuilds). */
export async function replaceBpoComps(
  bpoId: string,
  comps: BpoCompInsert[],
): Promise<{ ok: boolean; error?: string }> {
  const sb = client()
  if (!sb) return { ok: false, error: 'Supabase not configured' }
  const { error: delErr } = await sb.from('bpo_comps').delete().eq('bpo_id', bpoId)
  if (delErr) return { ok: false, error: delErr.message }
  if (comps.length === 0) return { ok: true }
  const { error } = await sb.from('bpo_comps').insert(comps)
  return error ? { ok: false, error: error.message } : { ok: true }
}

/** Paginated BPO list for the admin index. Never selects the html/citations
 *  blobs — those are multi-hundred-KB and must not ride a list read. */
export async function listBposForAdmin(options: {
  limit: number
  offset: number
}): Promise<{ rows: Array<Record<string, unknown>>; total: number }> {
  const sb = client()
  if (!sb) return { rows: [], total: 0 }
  const { data, count } = await sb
    .from('broker_price_opinions')
    .select(
      'id, slug, subject_address, subject_subdivision, subject_city, subject_status, opinion_value, value_low, value_high, confidence, comps_count, broker_slug, purpose, status, generation_reason, created_at, built_at, finalized_at, build_error',
      { count: 'exact' },
    )
    .is('archived_at', null)
    .order('created_at', { ascending: false })
    .range(options.offset, options.offset + options.limit - 1)
  return { rows: (data ?? []) as Array<Record<string, unknown>>, total: count ?? data?.length ?? 0 }
}
