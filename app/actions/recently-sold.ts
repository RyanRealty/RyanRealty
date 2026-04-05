'use server'

import { createClient } from '@supabase/supabase-js'

export type RecentlySoldListing = {
  listingKey: string
  listNumber: string | null
  mlsSource?: string | null
  listPrice: number | null
  closePrice: number | null
  closeDate: string | null
  beds: number | null
  baths: number | null
  sqft: number | null
  streetNumber: string | null
  streetName: string | null
  city: string | null
  state: string | null
  postalCode: string | null
  photoUrl: string | null
}

export async function getRecentlySold(options: {
  city?: string | null
  subdivision?: string | null
  limit?: number
}): Promise<RecentlySoldListing[]> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url?.trim() || !anonKey?.trim()) return []

  const supabase = createClient(url, anonKey)
  const limit = Math.min(24, Math.max(1, options.limit ?? 9))
  const city = options.city?.trim() ?? ''
  const subdivision = options.subdivision?.trim() ?? ''

  let query = supabase
    .from('listings')
    .select('ListingKey, ListNumber, mls_source, ListPrice, ClosePrice, CloseDate, BedroomsTotal, BathroomsTotal, LivingArea, StreetNumber, StreetName, City, State, PostalCode, PhotoURL, SubdivisionName, StandardStatus')
    .or('StandardStatus.ilike.%Closed%,StandardStatus.ilike.%Sold%')
    .order('CloseDate', { ascending: false, nullsFirst: false })
    .order('ModificationTimestamp', { ascending: false })
    .limit(limit)

  if (city) query = query.eq('City', city)
  if (subdivision) query = query.ilike('SubdivisionName', subdivision)

  const { data } = await query
  const rows = (data ?? []) as Array<Record<string, unknown>>

  return rows
    .map((row) => ({
      listingKey: String(row.ListingKey ?? row.ListNumber ?? '').trim(),
      listNumber: row.ListNumber == null ? null : String(row.ListNumber),
      mlsSource: row.mls_source == null ? null : String(row.mls_source),
      listPrice: row.ListPrice == null ? null : Number(row.ListPrice),
      closePrice: row.ClosePrice == null ? null : Number(row.ClosePrice),
      closeDate: row.CloseDate == null ? null : String(row.CloseDate),
      beds: row.BedroomsTotal == null ? null : Number(row.BedroomsTotal),
      baths: row.BathroomsTotal == null ? null : Number(row.BathroomsTotal),
      sqft: row.LivingArea == null ? null : Number(row.LivingArea),
      streetNumber: row.StreetNumber == null ? null : String(row.StreetNumber),
      streetName: row.StreetName == null ? null : String(row.StreetName),
      city: row.City == null ? null : String(row.City),
      state: row.State == null ? null : String(row.State),
      postalCode: row.PostalCode == null ? null : String(row.PostalCode),
      photoUrl: row.PhotoURL == null ? null : String(row.PhotoURL),
    }))
    .filter((row) => row.listingKey.length > 0)
}
