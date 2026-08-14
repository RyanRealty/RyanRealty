/**
 * listing_pricing_reads DAL. Service-role only.
 * Per docs/DATABASE_FOR_AI_AGENTS.md §2b. No listings.details on this path.
 */

import 'server-only'
import { createServiceClient } from '@/lib/supabase/service'
import { makeResilientCached } from '@/lib/data/cache/resilient'
import type { PublicListingRead, PublicRefuseReason } from '@/lib/pricing/public-contract'

export const LISTING_PRICING_CONTRACT_VERSION = 'public-v1-2026-08-14'

function client() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url?.trim() || !key?.trim()) return null
  return createServiceClient()
}

export type ListingPricingReadRow = {
  listingKey: string
  kind: PublicListingRead['kind']
  refuseReason: PublicRefuseReason | null
  listPrice: number | null
  compsClose: number | null
  deltaPct: number | null
  rangeLow: number | null
  rangeHigh: number | null
  n: number
  factsReady: boolean
  newConstruction: boolean
  subdivision: string | null
  sameSubdivisionTight: boolean
  computedAt: string
  contractVersion: string
}

type ReadDbRow = {
  listing_key: string
  kind: string
  refuse_reason: string | null
  list_price: number | string | null
  comps_close: number | string | null
  delta_pct: number | string | null
  range_low: number | string | null
  range_high: number | string | null
  n: number
  facts_ready: boolean
  new_construction: boolean
  subdivision: string | null
  same_subdivision_tight: boolean
  computed_at: string
  contract_version: string
}

function num(v: number | string | null | undefined): number | null {
  if (v == null || v === '') return null
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) ? n : null
}

function rowFromDb(r: ReadDbRow): ListingPricingReadRow {
  return {
    listingKey: r.listing_key,
    kind: r.kind as ListingPricingReadRow['kind'],
    refuseReason: (r.refuse_reason as PublicRefuseReason | null) ?? null,
    listPrice: num(r.list_price),
    compsClose: num(r.comps_close),
    deltaPct: num(r.delta_pct),
    rangeLow: num(r.range_low),
    rangeHigh: num(r.range_high),
    n: Number(r.n) || 0,
    factsReady: r.facts_ready === true,
    newConstruction: r.new_construction === true,
    subdivision: r.subdivision,
    sameSubdivisionTight: r.same_subdivision_tight === true,
    computedAt: r.computed_at,
    contractVersion: r.contract_version,
  }
}

export async function listingPricingReadsDue(limit = 24): Promise<string[]> {
  const sb = client()
  if (!sb) return []
  const { data, error } = await sb.rpc('listing_pricing_reads_due', { p_limit: limit })
  if (error) {
    console.error('[listingPricingReadsDue]', error.message)
    return []
  }
  return (data ?? [])
    .map((r: { listing_key?: string }) => (typeof r.listing_key === 'string' ? r.listing_key : null))
    .filter((k: string | null): k is string => Boolean(k))
}

export async function upsertListingPricingRead(row: ListingPricingReadRow): Promise<{ error: string | null }> {
  const sb = client()
  if (!sb) return { error: 'Supabase not configured' }
  const { error } = await sb.from('listing_pricing_reads').upsert(
    {
      listing_key: row.listingKey,
      kind: row.kind,
      refuse_reason: row.kind === 'refuse' ? row.refuseReason : null,
      list_price: row.listPrice,
      comps_close: row.compsClose,
      delta_pct: row.deltaPct,
      range_low: row.rangeLow,
      range_high: row.rangeHigh,
      n: row.n,
      facts_ready: row.factsReady,
      new_construction: row.newConstruction,
      subdivision: row.subdivision,
      same_subdivision_tight: row.sameSubdivisionTight,
      computed_at: row.computedAt,
      contract_version: row.contractVersion,
    },
    { onConflict: 'listing_key' },
  )
  if (error) {
    console.error('[upsertListingPricingRead]', error.message)
    return { error: error.message }
  }
  return { error: null }
}

async function fetchListingPricingRead(listingKey: string): Promise<ListingPricingReadRow | null> {
  const sb = client()
  if (!sb || !listingKey.trim()) return null
  const { data, error } = await sb
    .from('listing_pricing_reads')
    .select(
      'listing_key, kind, refuse_reason, list_price, comps_close, delta_pct, range_low, range_high, n, facts_ready, new_construction, subdivision, same_subdivision_tight, computed_at, contract_version',
    )
    .eq('listing_key', listingKey)
    .maybeSingle()
  if (error) throw new Error(error.message)
  if (!data) return null
  return rowFromDb(data as ReadDbRow)
}

export const getListingPricingRead = makeResilientCached<[string], ListingPricingReadRow | null>(
  fetchListingPricingRead,
  ['listing-pricing-read-v1'],
  { revalidate: 60, tags: ['listing-pricing-reads'] },
  null,
)
