#!/usr/bin/env node
/**
 * Backfill listings."DaysOnMarket" and "CumulativeDaysOnMarket" via RPC batches.
 * Uses details JSON and CloseDate − on-market for closed rows (see migration).
 *
 *   node --env-file=.env.local scripts/backfill-listing-dom-metrics.mjs --dry-run
 *   node --env-file=.env.local scripts/backfill-listing-dom-metrics.mjs --apply
 *
 * Options: --batch-size=N (default 3000, max 15000)
 */

import { createClient } from '@supabase/supabase-js'

function argFlag(name) {
  return process.argv.includes(`--${name}`)
}

function argInt(name, fallback) {
  const m = process.argv.find((a) => a.startsWith(`--${name}=`))
  if (!m) return fallback
  const v = Number(m.split('=')[1])
  return Number.isFinite(v) ? v : fallback
}

const dryRun = argFlag('dry-run') || !argFlag('apply')
const batchSize = Math.min(15000, Math.max(1, argInt('batch-size', 3000)))

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url?.trim() || !key?.trim()) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(url, key)

async function countMissingDom() {
  const { count, error } = await supabase
    .from('listings')
    .select('ListingKey', { count: 'exact', head: true })
    .or('DaysOnMarket.is.null,CumulativeDaysOnMarket.is.null')
  if (error) throw new Error(error.message)
  return count ?? 0
}

async function main() {
  const start = await countMissingDom()
  console.log(JSON.stringify({ dryRun, batchSize, rowsMissingDomOrCdom: start }, null, 2))
  if (dryRun) {
    console.log('Dry run. Re-run with --apply.')
    return
  }
  let rounds = 0
  let total = 0
  let last = 0
  for (;;) {
    const { data, error } = await supabase.rpc('apply_listing_dom_metrics_batch', { p_limit: batchSize })
    if (error) {
      console.error(error.message)
      process.exit(1)
    }
    last = Number(data?.updated ?? 0) || 0
    rounds += 1
    total += last
    console.log(`Round ${rounds}: updated ${last}`)
    if (last === 0) break
  }
  const end = await countMissingDom()
  console.log(JSON.stringify({ rounds, totalUpdated: total, rowsStillMissingDomOrCdom: end }, null, 2))
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
