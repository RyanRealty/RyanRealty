/**
 * Expired-listing capture reads. Split out of syncWrites so that file
 * stays under the file-size ratchet. Behavior matches the capture/note fix.
 */
import 'server-only'
import { createServiceClient } from '@/lib/supabase/service'
import { expiredListingSeenKeyFilter } from '@/lib/expired-listing-select'

function client() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url?.trim() || !key?.trim()) return null
  return createServiceClient()
}

async function listAllExpiredListingKeys(): Promise<string[]> {
  const sb = client()
  if (!sb) return []
  const keys: string[] = []
  const page = 1000
  for (let from = 0; from < 50_000; from += page) {
    const { data } = await sb.from('expired_listings').select('listing_key').range(from, from + page - 1)
    const rows = (data ?? []) as Array<{ listing_key: string }>
    for (const row of rows) {
      if (row.listing_key) keys.push(row.listing_key)
    }
    if (rows.length < page) break
  }
  return keys
}

/** listing_history rows for one key (expired CRM note). */
export async function selectListingHistoryForKey(listingKey: string): Promise<
  Array<{
    event: string | null
    event_date: string | null
    price: number | null
    price_change: number | null
    description: string | null
    raw: unknown
  }>
> {
  const sb = client()
  if (!sb || !listingKey) return []
  const { data } = await sb
    .from('listing_history')
    .select('event, event_date, price, price_change, description, raw')
    .eq('listing_key', listingKey)
    .order('event_date', { ascending: true })
    .limit(500)
  return (data ?? []) as Array<{
    event: string | null
    event_date: string | null
    price: number | null
    price_change: number | null
    description: string | null
    raw: unknown
  }>
}

/** Fetch newly expired/canceled/withdrawn listings in our service area for the expired-listing pipeline. */
export async function selectNewExpiredListings(options: {
  sinceIso: string
  serviceAreaCities: readonly string[]
  minListPrice: number
  limit: number
}): Promise<Array<Record<string, unknown>>> {
  const sb = client()
  if (!sb) return []
  const seenKeys = await listAllExpiredListingKeys()
  const exclude = expiredListingSeenKeyFilter(seenKeys)
  let query = sb
    .from('listings')
    .select(
      'ListingKey,ListNumber,StandardStatus,status_change_timestamp,StreetNumber,StreetName,City,PostalCode,ListPrice,OriginalListPrice,CumulativeDaysOnMarket,OnMarketDate,ListDate,ListAgentName,list_agent_email,PropertyType,BedroomsTotal,BathroomsTotal,TotalLivingAreaSqFt,SubdivisionName',
    )
    .in('StandardStatus', ['Expired', 'Canceled', 'Withdrawn'])
    .gt('status_change_timestamp', options.sinceIso)
    .in('City', options.serviceAreaCities as readonly string[])
    .eq('PropertyType', 'A')
    .gte('ListPrice', options.minListPrice)
  if (exclude) query = query.not('ListingKey', 'in', exclude)
  const { data, error } = await query.order('status_change_timestamp', { ascending: false }).limit(options.limit)
  if (error) {
    console.error('[selectNewExpiredListings] error:', error.message)
    return []
  }
  return (data ?? []) as unknown as Array<Record<string, unknown>>
}

/** Get the set of listing_keys already present in expired_listings (dedup check). */
export async function getExistingExpiredListingKeys(keys: string[]): Promise<Set<string>> {
  const sb = client()
  if (!sb || keys.length === 0) return new Set()
  const { data } = await sb
    .from('expired_listings')
    .select('listing_key')
    .in('listing_key', keys.slice(0, 5000))
  return new Set(((data ?? []) as Array<{ listing_key: string }>).map((r) => r.listing_key))
}
