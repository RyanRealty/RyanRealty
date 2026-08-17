#!/usr/bin/env node
/**
 * Source-side check for the listing-detail punch slice.
 *   node scripts/probe-listing-detail-punch-db.mjs
 */
import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'

config({ path: '.env.local' })

const MLS = ['220225742', '220226183', '220226708']

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url?.trim() || !key?.trim()) {
    console.error('UNREADABLE: Supabase env missing')
    process.exit(2)
  }
  const sb = createClient(url, key)
  const { data: listings, error } = await sb
    .from('listings')
    .select(
      'ListingKey, ListNumber, ListPrice, StandardStatus, StreetNumber, StreetName, City, OpenHouses, has_virtual_tour, OnMarketDate, CumulativeDaysOnMarket',
    )
    .in('ListNumber', MLS)
  if (error) {
    console.error('listings', error.message)
    process.exit(1)
  }
  const keys = (listings ?? []).map((r) => r.ListingKey)
  const { data: history } = await sb
    .from('listing_history')
    .select('listing_key, event, event_date, price, price_change')
    .in('listing_key', keys)
    .order('event_date', { ascending: true })
    .limit(200)
  const { data: videos } = await sb
    .from('listing_videos')
    .select('listing_key, video_url, sort_order')
    .in('listing_key', keys)
  const { data: priceHist } = await sb
    .from('price_history')
    .select('listing_key, old_price, new_price, changed_at, change_pct')
    .in('listing_key', keys)
    .order('changed_at', { ascending: true })
    .limit(100)
  const { data: statusHist } = await sb
    .from('status_history')
    .select('listing_key, old_status, new_status, changed_at')
    .in('listing_key', keys)
    .order('changed_at', { ascending: true })
    .limit(100)

  const out = {
    fetchedAt: new Date().toISOString(),
    utcToday: new Date().toISOString().slice(0, 10),
    pacificToday: new Date().toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' }),
    listings: listings ?? [],
    historyByKey: Object.fromEntries(
      keys.map((k) => [k, (history ?? []).filter((h) => h.listing_key === k)]),
    ),
    videosByKey: Object.fromEntries(
      keys.map((k) => [k, (videos ?? []).filter((h) => h.listing_key === k)]),
    ),
    priceHistoryByKey: Object.fromEntries(
      keys.map((k) => [k, (priceHist ?? []).filter((h) => h.listing_key === k)]),
    ),
    statusHistoryByKey: Object.fromEntries(
      keys.map((k) => [k, (statusHist ?? []).filter((h) => h.listing_key === k)]),
    ),
  }
  console.log(JSON.stringify(out, null, 2))
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
