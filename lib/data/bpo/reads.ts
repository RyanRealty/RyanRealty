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

// ─── Admin worklist (/admin/bpo) ─────────────────────────────────────────────

/**
 * The BPO worklist reader — powers the /admin/bpo board (spec: mirrors the
 * prospecting hub's "small, bounded table; filter + paginate in memory"
 * pattern rather than a DB-side WHERE per filter). broker_price_opinions is a
 * low-hundreds table, so one bounded read (capped, newest first) is read once
 * per request, classified in JS, then sliced to the requested page — same
 * shape as lib/data/prospecting/list.ts's listProspects.
 *
 * `posture` is a hard binary toggle (buyer/seller, defaults to buyer) — never
 * an "all posture" state — mirroring ProspectFilters' expired/fsbo `kind`
 * toggle. A BPO whose offer_strategy.mode is missing (pre-offer-strategy
 * legacy rows) matches neither toggle position; it is still reachable from
 * the CRM contact card / the canonical /admin/bpo/[slug] route.
 */

export type BpoStatusFilter = 'all' | 'draft' | 'final' | 'archived'
export type BpoPosture = 'buyer' | 'seller'

export interface BpoWorklistFilters {
  q?: string | null
  status?: BpoStatusFilter
  /** Defaults to 'buyer' when omitted — this dashboard is buyer-facing by default. */
  posture?: BpoPosture
  city?: string | null
  page?: number
  pageSize?: number
}

export interface BpoWorklistRow {
  id: string
  slug: string
  subjectAddress: string | null
  subjectSubdivision: string | null
  subjectCity: string | null
  subjectStatus: string | null
  opinionValue: number | null
  valueLow: number | null
  valueHigh: number | null
  confidence: string | null
  compsCount: number | null
  brokerSlug: string | null
  purpose: string | null
  /** 'draft' | 'final' (the raw DB status column). */
  status: string
  /** Derived from offer_strategy.mode — null on legacy rows built before the offer-strategy feature. */
  posture: BpoPosture | null
  personId: number | null
  lastSentAt: string | null
  sentCount: number
  createdAt: string | null
  builtAt: string | null
  finalizedAt: string | null
  archivedAt: string | null
  buildError: string | null
}

export interface BpoWorklistSummary {
  total: number
  drafts: number
  final: number
  sent: number
}

export interface BpoWorklistResult {
  rows: BpoWorklistRow[]
  total: number
  summary: BpoWorklistSummary
  page: number
  pageSize: number
  /** Distinct subject cities in the current posture's non-archived set, for the city filter Select. */
  cities: string[]
}

/** Never selects the html/citations blobs — those are multi-hundred-KB and
 *  must not ride a list read. */
const BPO_WORKLIST_SELECT =
  'id, slug, subject_address, subject_subdivision, subject_city, subject_status, opinion_value, value_low, value_high, confidence, comps_count, broker_slug, purpose, status, offer_strategy, person_id, last_sent_at, sent_count, generation_reason, created_at, built_at, finalized_at, archived_at, build_error'

function mapWorklistRow(r: Record<string, unknown>): BpoWorklistRow {
  const offer = (r.offer_strategy as Record<string, unknown> | null) ?? null
  const mode = offer?.mode
  return {
    id: String(r.id),
    slug: String(r.slug),
    subjectAddress: (r.subject_address as string | null) ?? null,
    subjectSubdivision: (r.subject_subdivision as string | null) ?? null,
    subjectCity: (r.subject_city as string | null) ?? null,
    subjectStatus: (r.subject_status as string | null) ?? null,
    opinionValue: (r.opinion_value as number | null) ?? null,
    valueLow: (r.value_low as number | null) ?? null,
    valueHigh: (r.value_high as number | null) ?? null,
    confidence: (r.confidence as string | null) ?? null,
    compsCount: (r.comps_count as number | null) ?? null,
    brokerSlug: (r.broker_slug as string | null) ?? null,
    purpose: (r.purpose as string | null) ?? null,
    status: String(r.status ?? 'draft'),
    posture: mode === 'buyer' || mode === 'seller' ? mode : null,
    personId: (r.person_id as number | null) ?? null,
    lastSentAt: (r.last_sent_at as string | null) ?? null,
    sentCount: (r.sent_count as number | null) ?? 0,
    createdAt: (r.created_at as string | null) ?? null,
    builtAt: (r.built_at as string | null) ?? null,
    finalizedAt: (r.finalized_at as string | null) ?? null,
    archivedAt: (r.archived_at as string | null) ?? null,
    buildError: (r.build_error as string | null) ?? null,
  }
}

/** Bounded base read (q/city only — status/posture/pagination are applied in
 *  memory below). THROWS on a Supabase error rather than returning an empty
 *  set, so a transient blip never masquerades as "no opinions" (no-poison-null). */
async function fetchRawBpoWorklistRows(filters: { q?: string | null; city?: string | null }): Promise<Record<string, unknown>[]> {
  const sb = client()
  if (!sb) return []
  let q = sb.from('broker_price_opinions').select(BPO_WORKLIST_SELECT)
  const term = filters.q?.trim().replace(/[%,()]/g, ' ').trim()
  if (term) {
    q = q.or(`subject_address.ilike.%${term}%,subject_subdivision.ilike.%${term}%`)
  }
  if (filters.city?.trim()) q = q.eq('subject_city', filters.city.trim())
  // The BPO universe is a low-hundreds table — a documented cap, not a
  // reliance on PostgREST's implicit 1,000-row default.
  const { data, error } = await q.order('created_at', { ascending: false }).limit(1000)
  if (error) throw new Error(`listBposForAdmin base read failed: ${error.message}`)
  return (data ?? []) as unknown as Record<string, unknown>[]
}

/** The BPO worklist read for /admin/bpo. */
export async function listBposForAdmin(filters: BpoWorklistFilters): Promise<BpoWorklistResult> {
  const page = Math.max(1, Math.floor(filters.page ?? 1))
  const pageSize = Math.min(Math.max(Math.floor(filters.pageSize ?? 24), 1), 100)
  const posture: BpoPosture = filters.posture === 'seller' ? 'seller' : 'buyer'
  const statusFilter: BpoStatusFilter = filters.status ?? 'all'

  let rawRows: Record<string, unknown>[]
  try {
    rawRows = await fetchRawBpoWorklistRows({ q: filters.q, city: filters.city })
  } catch (e) {
    console.error('[listBposForAdmin] base read threw:', e instanceof Error ? e.message : e)
    rawRows = []
  }

  const mapped = rawRows.map(mapWorklistRow)
  const postureScoped = mapped.filter((r) => r.posture === posture)

  const cities = [
    ...new Set(
      postureScoped
        .filter((r) => !r.archivedAt)
        .map((r) => r.subjectCity)
        .filter((c): c is string => !!c && c.trim().length > 0)
        .map((c) => c.trim()),
    ),
  ].sort((a, b) => a.localeCompare(b))

  const nonArchived = postureScoped.filter((r) => !r.archivedAt)
  const summary: BpoWorklistSummary = {
    total: nonArchived.length,
    drafts: nonArchived.filter((r) => r.status === 'draft').length,
    final: nonArchived.filter((r) => r.status === 'final').length,
    sent: nonArchived.filter((r) => r.sentCount > 0).length,
  }

  const filtered = postureScoped.filter((r) => {
    if (statusFilter === 'archived') return Boolean(r.archivedAt)
    if (r.archivedAt) return false
    if (statusFilter === 'draft') return r.status === 'draft'
    if (statusFilter === 'final') return r.status === 'final'
    return true // 'all' — every non-archived row
  })

  const total = filtered.length
  const from = (page - 1) * pageSize
  const rows = filtered.slice(from, from + pageSize)

  return { rows, total, summary, page, pageSize, cities }
}

/** Single worklist row by id (the `?id=` detail drawer read) — same light
 *  projection as the list, no html/citations blob. */
export async function getBpoWorklistRowById(id: string): Promise<BpoWorklistRow | null> {
  const sb = client()
  if (!sb || !id?.trim()) return null
  const { data, error } = await sb
    .from('broker_price_opinions')
    .select(BPO_WORKLIST_SELECT)
    .eq('id', id.trim())
    .maybeSingle()
  if (error) {
    console.error('[getBpoWorklistRowById]', error.message)
    return null
  }
  return data ? mapWorklistRow(data as unknown as Record<string, unknown>) : null
}
