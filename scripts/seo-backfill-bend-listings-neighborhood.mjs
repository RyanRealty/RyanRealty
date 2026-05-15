#!/usr/bin/env node
/**
 * Re-runs point-in-polygon tagging on listings.boundary_neighborhood for every
 * Bend listing using the 13 authoritative City of Bend GIS polygons that were
 * just imported via seo-import-bend-neighborhood-boundaries.mjs.
 *
 * Calls server-side RPC backfill_bend_listings_neighborhood(slug) once per
 * neighborhood. The RPC scopes the UPDATE to one polygon at a time so each
 * call is short and bounded — avoids the long-running connection issue that
 * was timing out the MCP tool path.
 *
 * Step 1 (clear) is run inline against ALL 13 names so listings that moved
 * out of an old fabricated polygon end up NULL instead of stuck on the prior tag.
 *
 * Usage: node --env-file=.env.local scripts/seo-backfill-bend-listings-neighborhood.mjs
 */

import { createClient } from '@supabase/supabase-js'

const NEIGHBORHOODS = [
  'awbrey-butte',
  'boyd-acres',
  'century-west',
  'larkspur',
  'mountain-view',
  'old-bend',
  'old-farm-district',
  'orchard-district',
  'river-west',
  'southeast-bend',
  'southern-crossing',
  'southwest-bend',
  'summit-west',
]

const NAMES = [
  'Awbrey Butte', 'Boyd Acres', 'Century West', 'Larkspur', 'Mountain View',
  'Old Bend', 'Old Farm District', 'Orchard District', 'River West',
  'Southeast Bend', 'Southern Crossing', 'Southwest Bend', 'Summit West',
]

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    console.error('NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY required')
    process.exit(1)
  }
  const supabase = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  // Step 1: clear stale tags on any listing currently tagged with one of the 13 names.
  // Done one name at a time via server-side RPC to stay under the listings-table statement timeout.
  console.log('Step 1: clearing existing tags on the 13 neighborhoods (one at a time)...')
  let cleared = 0
  for (const name of NAMES) {
    const t0 = Date.now()
    const { data, error } = await supabase.rpc('clear_listings_neighborhood_tag', { p_name: name })
    const ms = Date.now() - t0
    if (error) {
      console.error(`  FAIL ${name} (${ms}ms) — ${error.message}`)
      continue
    }
    console.log(`  OK   ${name.padEnd(20)} cleared=${String(data.rows_cleared).padStart(4)} (${ms}ms)`)
    cleared += data.rows_cleared ?? 0
  }
  console.log(`  total cleared: ${cleared} listings`)

  // Step 2: re-tag each neighborhood via the server-side RPC (one call per polygon).
  console.log('\nStep 2: re-tagging via server-side RPC (one polygon at a time)...')
  let total = 0
  for (const slug of NEIGHBORHOODS) {
    const t0 = Date.now()
    const { data, error } = await supabase.rpc('backfill_bend_listings_neighborhood', { p_slug: slug })
    const ms = Date.now() - t0
    if (error) {
      console.error(`  FAIL ${slug}  (${ms}ms) — ${error.message}`)
      continue
    }
    if (data?.error) {
      console.error(`  FAIL ${slug}  (${ms}ms) — RPC: ${data.error}`)
      continue
    }
    console.log(`  OK   ${slug.padEnd(20)} -> ${String(data.name).padEnd(20)} rows_tagged=${String(data.rows_tagged).padStart(4)}  (${ms}ms)`)
    total += data.rows_tagged ?? 0
  }
  console.log(`\nTotal listings tagged across 13 neighborhoods: ${total}`)
}

main().catch((e) => {
  console.error('Fatal:', e?.message || e)
  process.exit(1)
})
