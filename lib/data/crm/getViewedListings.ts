/**
 * getViewedListingsForLead — the homes a CRM lead is actually shopping.
 *
 * Joins the lead's behavioral trail (visitor_events.listing_mls, captured per
 * identified session) to the LIVE listing row (listing_tile_mv.listing_key) so
 * the broker sees each watched home with its CURRENT price + MLS status — not a
 * stale snapshot from whenever the page was viewed (§0 data-accuracy: prices and
 * statuses shown to a broker must be current). Distinct listings, most-recently
 * viewed first, capped.
 *
 * DAL boundary: the raw .from() lives here, inside lib/data/ (G1).
 */
import { createServiceClient } from '@/lib/data/client'

export type ViewedListing = {
  listingKey: string
  address: string
  city: string | null
  status: string | null
  photoUrl: string | null
  listPrice: number | null
  beds: number | null
  baths: number | null
  sqft: number | null
  addressSlug: string | null
  views: number
  saved: boolean
  lastViewedAt: string
}

export async function getViewedListingsForLead(fubPersonId: number | null | undefined): Promise<ViewedListing[]> {
  if (!fubPersonId) return []
  const sb = createServiceClient()

  // Sessions belonging to this identified lead.
  const { data: sessions } = await sb
    .from('visitor_sessions')
    .select('session_id')
    .eq('fub_person_id', fubPersonId)
    .limit(200)
  const sessionIds = (sessions ?? []).map((s) => s.session_id as string).filter(Boolean)
  if (sessionIds.length === 0) return []

  // Listing-level events across those sessions.
  const { data: events } = await sb
    .from('visitor_events')
    .select('listing_mls,event_type,event_at,listing_street,listing_city,listing_price')
    .in('session_id', sessionIds)
    .not('listing_mls', 'is', null)
    .order('event_at', { ascending: false })
    .limit(400)
  if (!events || events.length === 0) return []

  // Roll up per MLS key: view count, saved flag, last seen, snapshot fallback.
  type Agg = { views: number; saved: boolean; lastViewedAt: string; street: string | null; city: string | null; price: number | null }
  const byKey = new Map<string, Agg>()
  for (const e of events) {
    const key = String(e.listing_mls)
    const a = byKey.get(key) ?? { views: 0, saved: false, lastViewedAt: e.event_at as string, street: (e.listing_street as string | null) ?? null, city: (e.listing_city as string | null) ?? null, price: e.listing_price === null ? null : Number(e.listing_price) }
    a.views += 1
    if (/sav|favorit/i.test(String(e.event_type))) a.saved = true
    if ((e.event_at as string) > a.lastViewedAt) a.lastViewedAt = e.event_at as string
    byKey.set(key, a)
  }
  const keys = [...byKey.keys()]
  if (keys.length === 0) return []

  // Live listing data for the watched keys.
  const { data: live } = await sb
    .from('listing_tile_mv')
    .select('listing_key,street_number,street_name,city,standard_status,photo_url,list_price,beds,baths,sqft,address_slug')
    .in('listing_key', keys)
  const liveByKey = new Map((live ?? []).map((r) => [String(r.listing_key), r]))

  const out: ViewedListing[] = keys.map((key) => {
    const agg = byKey.get(key)!
    const r = liveByKey.get(key)
    const address = r
      ? [r.street_number, r.street_name].filter(Boolean).join(' ')
      : agg.street ?? 'Listing'
    return {
      listingKey: key,
      address,
      city: (r?.city as string | null) ?? agg.city,
      status: (r?.standard_status as string | null) ?? null,
      photoUrl: (r?.photo_url as string | null) ?? null,
      listPrice: r ? (r.list_price === null ? null : Number(r.list_price)) : agg.price,
      beds: r ? (r.beds === null ? null : Number(r.beds)) : null,
      baths: r ? (r.baths === null ? null : Number(r.baths)) : null,
      sqft: r ? (r.sqft === null ? null : Number(r.sqft)) : null,
      addressSlug: (r?.address_slug as string | null) ?? null,
      views: agg.views,
      saved: agg.saved,
      lastViewedAt: agg.lastViewedAt,
    }
  })

  // Most-recently viewed first; cap.
  out.sort((a, b) => (a.lastViewedAt < b.lastViewedAt ? 1 : -1))
  return out.slice(0, 8)
}
