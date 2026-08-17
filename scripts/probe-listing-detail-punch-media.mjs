#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'

config({ path: '.env.local' })

const MLS = ['220225742', '220226183', '220226708']

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url?.trim() || !key?.trim()) process.exit(2)
  const sb = createClient(url, key)
  const { data, error } = await sb
    .from('listings')
    .select('ListNumber, ListingKey, has_virtual_tour, details')
    .in('ListNumber', MLS)
  if (error) {
    console.error(error.message)
    process.exit(1)
  }
  const out = (data ?? []).map((row) => {
    const d = row.details && typeof row.details === 'object' ? row.details : {}
    return {
      mls: row.ListNumber,
      key: row.ListingKey,
      has_virtual_tour: row.has_virtual_tour,
      Videos: d.Videos ?? null,
      VirtualTours: d.VirtualTours ?? null,
      VirtualTourURLUnbranded: d.VirtualTourURLUnbranded ?? null,
      VirtualTourURLBranded: d.VirtualTourURLBranded ?? null,
      VirtualTourURL: d.VirtualTourURL ?? null,
    }
  })
  console.log(JSON.stringify(out, null, 2))
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
