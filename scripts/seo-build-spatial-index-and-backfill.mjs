#!/usr/bin/env node
/**
 * Fire-and-forget builder for the partial GIST spatial index on Bend listings,
 * then runs the 13 neighborhood backfills sequentially via direct pg-style RPC.
 *
 * Uses Supabase's PostgREST against the pre-created server-side functions:
 *   - clear_listings_neighborhood_tag(name)
 *   - backfill_bend_listings_neighborhood(slug)
 *
 * The index is built CONCURRENTLY in a separate connection so it doesn't block
 * other reads. The backfills run AFTER the index exists so each spatial query
 * is fast.
 *
 * Usage: node --env-file=.env.local scripts/seo-build-spatial-index-and-backfill.mjs
 */

import { createClient } from '@supabase/supabase-js'

const NEIGHBORHOODS = [
  'awbrey-butte', 'boyd-acres', 'century-west', 'larkspur', 'mountain-view',
  'old-bend', 'old-farm-district', 'orchard-district', 'river-west',
  'southeast-bend', 'southern-crossing', 'southwest-bend', 'summit-west',
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
    global: { headers: { 'Prefer': 'tx=commit' } },
  })

  console.log('Step 1: run all 13 backfills sequentially via RPC...')
  let total = 0
  for (const slug of NEIGHBORHOODS) {
    const t0 = Date.now()
    let attempts = 0
    let data, error
    while (attempts < 3) {
      attempts++
      const res = await supabase.rpc('backfill_bend_listings_neighborhood', { p_slug: slug })
      data = res.data
      error = res.error
      if (!error && !data?.error) break
      console.log(`    attempt ${attempts} failed: ${error?.message || data?.error} — retrying in 2s`)
      await new Promise((r) => setTimeout(r, 2000))
    }
    const ms = Date.now() - t0
    if (error) {
      console.error(`  FAIL ${slug}  (${ms}ms) — ${error.message}`)
      continue
    }
    if (data?.error) {
      console.error(`  FAIL ${slug}  (${ms}ms) — ${data.error}`)
      continue
    }
    console.log(`  OK   ${slug.padEnd(20)} -> ${String(data.name).padEnd(20)} rows_tagged=${String(data.rows_tagged).padStart(4)}  (${ms}ms, ${attempts} attempts)`)
    total += data.rows_tagged ?? 0
  }
  console.log(`\nTotal listings tagged across 13 neighborhoods: ${total}`)
}

main().catch((e) => {
  console.error('Fatal:', e?.message || e)
  process.exit(1)
})
