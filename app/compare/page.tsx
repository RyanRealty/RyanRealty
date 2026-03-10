import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'
import CompareClient from '@/components/compare/CompareClient'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

function getSupabase() {
  if (!url?.trim() || !anonKey?.trim()) throw new Error('Supabase not configured')
  return createClient(url, anonKey)
}

export const metadata: Metadata = {
  title: 'Compare Homes | Ryan Realty',
  robots: 'noindex, follow',
}

export type CompareListingRow = {
  listing_key: string
  list_price: number | null
  beds_total: number | null
  baths_full: number | null
  living_area: number | null
  lot_size_sqft: number | null
  year_built: number | null
  association_fee: number | null
  tax_amount: number | null
  days_on_market: number | null
  subdivision_name: string | null
  garage_spaces: number | null
  standard_status: string | null
  unparsed_address: string | null
  photo_url: string | null
  latitude: number | null
  longitude: number | null
}

export default async function ComparePage({ searchParams }: { searchParams: Promise<{ ids?: string }> }) {
  const { ids } = await searchParams
  const idList = (ids ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 4)
  if (idList.length < 2) redirect('/search')

  const supabase = getSupabase()
  const { data: listRows } = await supabase
    .from('listings')
    .select('listing_key, list_price, beds_total, baths_full, living_area, lot_size_sqft, year_built, association_fee, tax_amount, days_on_market, subdivision_name, garage_spaces, standard_status, property_id')
    .in('listing_key', idList)

  const listingKeys = (listRows ?? []).map((r) => (r as { listing_key: string }).listing_key)
  const validIds = idList.filter((k) => listingKeys.includes(k))
  if (validIds.length < 2) redirect('/search')

  const propIds = [...new Set((listRows ?? []).map((r) => (r as { property_id?: string }).property_id).filter(Boolean))]
  const { data: propRows } = await supabase.from('properties').select('id, unparsed_address, latitude, longitude').in('id', propIds)
  const { data: photoRows } = await supabase.from('listing_photos').select('listing_key, photo_url').eq('is_hero', true).in('listing_key', validIds)

  const propById = new Map((propRows ?? []).map((p) => [(p as { id: string }).id, p]))
  const photoByKey = new Map((photoRows ?? []).map((r) => [(r as { listing_key: string }).listing_key, (r as { photo_url: string }).photo_url]))

  const listings: CompareListingRow[] = (listRows ?? []).map((row) => {
    const r = row as Record<string, unknown>
    const prop = propById.get(r.property_id as string) as { unparsed_address?: string; latitude?: number; longitude?: number } | undefined
    return {
      listing_key: r.listing_key as string,
      list_price: r.list_price != null ? Number(r.list_price) : null,
      beds_total: r.beds_total != null ? Number(r.beds_total) : null,
      baths_full: r.baths_full != null ? Number(r.baths_full) : null,
      living_area: r.living_area != null ? Number(r.living_area) : null,
      lot_size_sqft: r.lot_size_sqft != null ? Number(r.lot_size_sqft) : null,
      year_built: r.year_built != null ? Number(r.year_built) : null,
      association_fee: r.association_fee != null ? Number(r.association_fee) : null,
      tax_amount: r.tax_amount != null ? Number(r.tax_amount) : null,
      days_on_market: r.days_on_market != null ? Number(r.days_on_market) : null,
      subdivision_name: (r.subdivision_name as string) ?? null,
      garage_spaces: r.garage_spaces != null ? Number(r.garage_spaces) : null,
      standard_status: (r.standard_status as string) ?? null,
      unparsed_address: prop?.unparsed_address ?? null,
      photo_url: photoByKey.get(r.listing_key as string) ?? null,
      latitude: prop?.latitude ?? null,
      longitude: prop?.longitude ?? null,
    }
  })

  return <CompareClient listings={listings} />
}
