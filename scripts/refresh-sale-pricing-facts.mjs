#!/usr/bin/env node
/**
 * Drain refresh_sale_pricing_facts_batch until every closed Central Oregon
 * residential sale is in sale_pricing_facts (1996+ — no date floor), then
 * rebuild the monthly market index and 36-month subdivision cells.
 */
import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

config({ path: join(dirname(fileURLToPath(import.meta.url)), '../.env.local') })

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) {
  console.error('missing supabase env')
  process.exit(1)
}
const sb = createClient(url, key, { auth: { persistSession: false } })

const limit = Number(process.env.PRICING_BATCH || 200)
const maxBatches = Number(process.env.PRICING_MAX_BATCHES || 2000)
let total = 0
let done = false

for (let i = 0; i < maxBatches; i++) {
  const { data, error } = await sb.rpc('refresh_sale_pricing_facts_batch', {
    p_limit: limit,
    p_job: 'sale_pricing_facts',
  })
  if (error) {
    console.error('batch failed', error.message)
    process.exit(1)
  }
  const row = data ?? {}
  total += Number(row.upserted ?? 0)
  console.log(
    JSON.stringify({
      batch: i + 1,
      scanned: row.scanned,
      upserted: row.upserted,
      last_key: row.last_key,
      done: row.done,
      running_upserted: total,
    }),
  )
  if (row.done) {
    done = true
    break
  }
}

let concessionsUpdated = 0
for (let i = 0; i < maxBatches; i++) {
  const { data, error } = await sb.rpc('backfill_sale_pricing_concessions_yn', { p_limit: 400 })
  if (error) {
    console.error('concessions backfill failed', error.message)
    process.exit(1)
  }
  concessionsUpdated += Number(data?.updated ?? 0)
  console.log(JSON.stringify({ concessionsBatch: i + 1, ...data, running_updated: concessionsUpdated }))
  if (data?.done) break
}

const { data: idx, error: idxErr } = await sb.rpc('refresh_pricing_indexes')
if (idxErr) {
  console.error('index refresh failed', idxErr.message)
  process.exit(1)
}

// stat-source-ok: backfill/ingest progress count, used to size or verify the run. Never published.
const { count } = await sb.from('sale_pricing_facts').select('listing_key', { count: 'exact', head: true })
console.log(JSON.stringify({ ok: true, done, facts: count, indexes: idx, upserted: total, concessionsUpdated }))
if (!done) process.exit(2)
