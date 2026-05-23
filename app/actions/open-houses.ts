'use server'

import { createClient } from '@supabase/supabase-js'
import { unstable_cache } from 'next/cache'
import { getListingTiles } from '@/lib/data'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

function getSupabase() {
  if (!url?.trim() || !anonKey?.trim()) throw new Error('Supabase not configured')
  return createClient(url, anonKey)
}

export type OpenHouseWithListing = {
  id: string
  open_house_key: string
  listing_key: string
  list_number: string | null
  event_date: string
  start_time: string | null
  end_time: string | null
  host_agent_name: string | null
  remarks: string | null
  rsvp_count: number
  list_price: number | null
  beds_total: number | null
  baths_full: number | null
  living_area: number | null
  subdivision_name: string | null
  city: string | null
  state: string | null
  postal_code: string | null
  street_number: string | null
  street_name: string | null
  photo_url: string | null
  latitude: number | null
  longitude: number | null
  unparsed_address: string | null
}

export type OpenHousesFilters = {
  dateFrom?: string
  dateTo?: string
  community?: string[]
  city?: string
  minPrice?: number
  maxPrice?: number
  beds?: number
  baths?: number
}

/**
 * Default range for "this weekend": includes today when it's Sat or Sun, else the upcoming Sat–Sun.
 * Important: on Sunday (day === 0), the Mon–Fri formula (6 - day) would yield next Saturday, so
 * dateFrom would be next week and today's (Sunday) open houses would be excluded. We explicitly
 * handle Sunday (and Saturday) so same-day and same-weekend open houses are always included.
 */
function getThisWeekend(): { dateFrom: string; dateTo: string } {
  const now = new Date()
  const day = now.getDay() // 0 = Sunday, 6 = Saturday
  const today = now.toISOString().slice(0, 10)
  if (day === 0) {
    return { dateFrom: today, dateTo: today }
  }
  if (day === 6) {
    const sun = new Date(now)
    sun.setDate(now.getDate() + 1)
    return { dateFrom: today, dateTo: sun.toISOString().slice(0, 10) }
  }
  const sat = new Date(now)
  sat.setDate(now.getDate() + (6 - day))
  const sun = new Date(sat)
  sun.setDate(sat.getDate() + 1)
  return {
    dateFrom: sat.toISOString().slice(0, 10),
    dateTo: sun.toISOString().slice(0, 10),
  }
}

async function _getOpenHousesWithListingsUncached(filters: OpenHousesFilters = {}): Promise<OpenHouseWithListing[]> {
  const supabase = getSupabase()
  const today = new Date().toISOString().slice(0, 10)
  const defaultRange = getThisWeekend()
  const dateFrom = filters.dateFrom ?? defaultRange.dateFrom
  const dateTo = filters.dateTo ?? defaultRange.dateTo

  // dateFrom/dateTo define the "weekend" range; .gte('event_date', today) ensures we never show past events
  const { data: rows, error } = await supabase
    .from('open_houses')
    .select('id, open_house_key, listing_key, event_date, start_time, end_time, host_agent_name, remarks, rsvp_count')
    .gte('event_date', dateFrom)
    .lte('event_date', dateTo)
    .gte('event_date', today)
    .order('event_date', { ascending: true })
    .order('start_time', { ascending: true })

  if (error) return []

  const listingKeys = [...new Set((rows ?? []).map((r: { listing_key: string }) => r.listing_key))]
  if (listingKeys.length === 0) return []

  // DAL: read tiles from listing_tile_mv (city/postal/street are in the tile,
  // so we no longer need to join through the legacy properties table). Photos
  // join stays — listing_photos isn't in the MV.
  const tiles = await getListingTiles({
    listingKeys: listingKeys.slice(0, 5000),
    status: 'all',
    limit: 500,
  })
  const listingRows = tiles.map((t) => ({
    listing_key: t.listingKey,
    list_number: t.listNumber,
    list_price: t.listPrice,
    beds_total: t.beds,
    baths_full: t.baths,
    living_area: t.sqft,
    subdivision_name: t.subdivisionName,
    // Inline what was previously joined from properties:
    city: t.city,
    state: null as string | null,
    postal_code: t.postalCode,
    street_number: t.streetNumber,
    street_name: t.streetName,
    latitude: t.lat,
    longitude: t.lng,
    photo_url: t.photoUrl,
  }))

  const { data: photoRows } = await supabase
    .from('listing_photos')
    .select('listing_key, photo_url')
    .in('listing_key', listingKeys)
    .eq('is_hero', true)
    .limit(listingKeys.length * 2)

  const listingsByKey = new Map(
    listingRows.map((l) => [l.listing_key, l as Record<string, unknown>]),
  )
  const heroByKey = new Map(
    (photoRows ?? []).map((p: { listing_key: string; photo_url: string }) => [p.listing_key, p.photo_url])
  )

  const result: OpenHouseWithListing[] = []
  for (const r of rows ?? []) {
    const row = r as {
      id: string
      open_house_key: string
      listing_key: string
      event_date: string
      start_time: string | null
      end_time: string | null
      host_agent_name: string | null
      remarks: string | null
      rsvp_count: number
    }
    const listRec = listingsByKey.get(row.listing_key) as {
      property_id?: string
      list_number?: string | null
      list_price?: number
      beds_total?: number
      baths_full?: number
      living_area?: number
      subdivision_name?: string
      city?: string | null
      state?: string | null
      postal_code?: string | null
      street_number?: string | null
      street_name?: string | null
      latitude?: number | null
      longitude?: number | null
    } | undefined
    // DAL listing_tile_mv inlines the address/geo fields the legacy
    // properties join used to provide. No properties table join needed.
    const address = [listRec?.street_number, listRec?.street_name].filter(Boolean).join(' ')
    const city = listRec?.city ?? null
    const subdivision = listRec?.subdivision_name ?? null

    if (filters.community?.length && subdivision && !filters.community.includes(subdivision)) continue
    if (filters.city && city !== filters.city) continue
    const listPrice = listRec?.list_price ?? null
    if (filters.minPrice != null && (listPrice == null || listPrice < filters.minPrice)) continue
    if (filters.maxPrice != null && (listPrice == null || listPrice > filters.maxPrice)) continue
    const beds = listRec?.beds_total ?? null
    if (filters.beds != null && (beds == null || beds < filters.beds)) continue
    const baths = listRec?.baths_full ?? null
    if (filters.baths != null && (baths == null || baths < filters.baths)) continue

    result.push({
      id: row.id,
      open_house_key: row.open_house_key,
      listing_key: row.listing_key,
      list_number: listRec?.list_number ?? null,
      event_date: row.event_date,
      start_time: row.start_time,
      end_time: row.end_time,
      host_agent_name: row.host_agent_name,
      remarks: row.remarks,
      rsvp_count: row.rsvp_count ?? 0,
      list_price: listPrice ?? null,
      beds_total: beds ?? null,
      baths_full: baths ?? null,
      living_area: listRec?.living_area ?? null,
      subdivision_name: subdivision ?? null,
      city: city ?? null,
      state: listRec?.state ?? null,
      postal_code: listRec?.postal_code ?? null,
      street_number: listRec?.street_number ?? null,
      street_name: listRec?.street_name ?? null,
      unparsed_address: address || null,
      photo_url: heroByKey.get(row.listing_key) ?? null,
      latitude: listRec?.latitude ?? null,
      longitude: listRec?.longitude ?? null,
    })
  }
  return result
}

export const getOpenHousesWithListings = unstable_cache(
  _getOpenHousesWithListingsUncached,
  ['open-houses-with-listings'],
  { revalidate: 900, tags: ['open-houses'] }
)

