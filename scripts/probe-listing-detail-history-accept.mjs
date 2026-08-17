#!/usr/bin/env node
/**
 * Local accept: published history for the three founding listings.
 *   node scripts/probe-listing-detail-history-accept.mjs
 */
import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { publishListingHistory } from '../lib/listing/publish-listing-history.ts'

config({ path: '.env.local' })

const CASES = [
  { mls: '220225742', expectEvents: ['listed'] },
  { mls: '220226183', expectEvents: ['listed', 'pending'] },
  { mls: '220226708', expectEvents: ['listed'] },
]

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url?.trim() || !key?.trim()) process.exit(2)
  const sb = createClient(url, key)
  const { data: listings, error } = await sb
    .from('listings')
    .select('ListNumber, ListingKey, ListPrice, OnMarketDate')
    .in('ListNumber', CASES.map((c) => c.mls))
  if (error) throw new Error(error.message)
  const keys = (listings ?? []).map((r) => r.ListingKey)
  const [{ data: history }, { data: status }, { data: prices }] = await Promise.all([
    sb.from('listing_history').select('listing_key, event, event_date, price, price_change, description').in('listing_key', keys),
    sb.from('status_history').select('listing_key, old_status, new_status, changed_at').in('listing_key', keys),
    sb.from('price_history').select('listing_key, old_price, new_price, changed_at').in('listing_key', keys),
  ])
  const out = []
  let failed = 0
  for (const c of CASES) {
    const listing = (listings ?? []).find((r) => r.ListNumber === c.mls)
    const published = publishListingHistory({
      listingHistory: (history ?? []).filter((h) => h.listing_key === listing.ListingKey || !h.listing_key),
      statusHistory: (status ?? []).filter((h) => h.listing_key === listing.ListingKey),
      priceHistory: (prices ?? []).filter((h) => h.listing_key === listing.ListingKey),
      onMarketDate: listing.OnMarketDate,
      listPrice: listing.ListPrice,
    })
    const events = published.map((r) => r.event)
    const ok = c.expectEvents.every((e) => events.includes(e)) && events.length > 0
    if (!ok) failed += 1
    out.push({ mls: c.mls, ok, events, published })
  }
  console.log(JSON.stringify({ failed, out }, null, 2))
  if (failed) process.exit(1)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
