#!/usr/bin/env node
/**
 * Backfill listings.ClosePrice from listing_history (RPC batches) and
 * listings.OriginalListPrice from details JSONB (RPC batches).
 *
 * Requires: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 * Migration: supabase/migrations/20260414190000_backfill_close_price_from_history_rpc.sql
 *
 * Usage:
 *   node --env-file=.env.local scripts/backfill-close-price-from-history.mjs --dry-run
 *   node --env-file=.env.local scripts/backfill-close-price-from-history.mjs --apply
 *
 * Options:
 *   --batch-size=N   ClosePrice batch per RPC (default 2000, max 10000)
 *   --olp-batch=N    OriginalListPrice batch (default 5000)
 *   --skip-olp       Do not run OriginalListPrice backfill
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
const batchSize = Math.min(10000, Math.max(1, argInt('batch-size', 2000)))
const olpBatch = Math.min(50000, Math.max(1, argInt('olp-batch', 5000)))
const skipOlp = argFlag('skip-olp')

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url?.trim() || !key?.trim()) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(url, key)

async function countClosedMissingClose() {
  // stat-source-ok: backfill/ingest progress count, used to size or verify the run. Never published.
  const { count, error } = await supabase
    .from('listings')
    .select('ListingKey', { count: 'exact', head: true })
    .ilike('StandardStatus', '%Closed%')
    .is('ClosePrice', null)
  if (error) throw new Error(error.message)
  return count ?? 0
}

async function countMissingOlp() {
  // stat-source-ok: backfill/ingest progress count, used to size or verify the run. Never published.
  const { count, error } = await supabase
    .from('listings')
    .select('ListingKey', { count: 'exact', head: true })
    .is('OriginalListPrice', null)
    .not('details', 'is', null)
  if (error) throw new Error(error.message)
  return count ?? 0
}

async function main() {
  const startMissingClose = await countClosedMissingClose()
  const startMissingOlp = skipOlp ? 0 : await countMissingOlp()

  console.log(
    JSON.stringify(
      {
        dryRun,
        batchSize,
        olpBatch,
        skipOlp,
        candidatesClosedNoClosePrice: startMissingClose,
        candidatesMissingOriginalListPriceApprox: startMissingOlp,
      },
      null,
      2
    )
  )

  if (dryRun) {
    console.log('Dry run only. Re-run with --apply to execute RPC batches.')
    return
  }

  const summary = {
    closePrice: { rounds: 0, totalUpdated: 0, lastBatch: 0 },
    originalListPrice: { rounds: 0, totalUpdated: 0, lastBatch: 0 },
  }

  for (;;) {
    const { data, error } = await supabase.rpc('apply_close_price_from_history_batch', {
      p_limit: batchSize,
    })
    if (error) {
      console.error('[ClosePrice batch]', error.message)
      process.exit(1)
    }
    const n = Number(data?.updated ?? 0) || 0
    summary.closePrice.rounds += 1
    summary.closePrice.totalUpdated += n
    summary.closePrice.lastBatch = n
    console.log(`ClosePrice batch ${summary.closePrice.rounds}: updated ${n}`)
    if (n === 0) break
  }

  if (!skipOlp) {
    for (;;) {
      const { data, error } = await supabase.rpc('apply_original_list_price_from_details_batch', {
        p_limit: olpBatch,
      })
      if (error) {
        console.error('[OriginalListPrice batch]', error.message)
        process.exit(1)
      }
      const n = Number(data?.updated ?? 0) || 0
      summary.originalListPrice.rounds += 1
      summary.originalListPrice.totalUpdated += n
      summary.originalListPrice.lastBatch = n
      const scanned = Number(data?.scanned ?? 0) || 0
      console.log(
        `OriginalListPrice batch ${summary.originalListPrice.rounds}: scanned ${scanned}, updated ${n}`
      )
      // p_limit bounds rows SCANNED (and therefore detoasted), not rows updated —
      // a batch can legitimately update 0 while work remains, so the RPC's `done`
      // flag is the only valid stop condition. See
      // supabase/migrations/20260801052500_bound_details_backfill_rpcs.sql
      if (data?.done === true) break
    }
  }

  const endMissingClose = await countClosedMissingClose()
  const endMissingOlp = skipOlp ? null : await countMissingOlp()

  console.log(
    JSON.stringify(
      {
        ...summary,
        remainingClosedNoClosePrice: endMissingClose,
        remainingMissingOriginalListPrice: endMissingOlp,
      },
      null,
      2
    )
  )
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
