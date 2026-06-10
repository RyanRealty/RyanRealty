#!/usr/bin/env node
/**
 * Sync the SkySlope master file into Supabase for the /admin/deals dashboard.
 *
 * Reads tmp/skyslope-master/master.json (produced by skyslope-master-file.mjs)
 * and upserts:
 *   - public.skyslope_transactions  (one row per property)
 *   - public.skyslope_dashboard_meta (totals + findings, single row)
 *
 * Full refresh chain (also see skyslope-dashboard-refresh.mjs):
 *   1. node --env-file=.env.local scripts/skyslope-master-inventory.mjs
 *   2. node scripts/skyslope-master-analyze.mjs
 *   3. node scripts/skyslope-master-file.mjs
 *   4. node --env-file=.env.local scripts/skyslope-sync-dashboard.mjs
 *
 * Requires NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY.
 */
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createClient } from '@supabase/supabase-js'

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const masterPath = path.join(REPO, 'tmp/skyslope-master/master.json')

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}
const supabase = createClient(url, key)
const master = JSON.parse(await fs.readFile(masterPath, 'utf8'))

const rows = master.properties.map((p) => ({
  property_key: p.key,
  address: p.address,
  broker: p.broker,
  stage: p.stage,
  stage_detail: p.stageDetail,
  zombie: p.zombie,
  compliance_state: p.rollup.complianceState,
  headline: p.headline,
  cycles: p.cycles,
  rollup: p.rollup,
  synced_at: new Date().toISOString(),
}))

const { error: txError } = await supabase.from('skyslope_transactions').upsert(rows, { onConflict: 'property_key' })
if (txError) {
  console.error('skyslope_transactions upsert failed:', txError.message)
  process.exit(1)
}

// Remove properties that no longer exist in the master (folder deleted/merged)
const keys = rows.map((r) => r.property_key)
const { data: existing } = await supabase.from('skyslope_transactions').select('property_key')
const stale = (existing || []).map((r) => r.property_key).filter((k) => !keys.includes(k))
if (stale.length) {
  await supabase.from('skyslope_transactions').delete().in('property_key', stale)
  console.log(`removed ${stale.length} stale rows: ${stale.join(', ')}`)
}

const { error: metaError } = await supabase.from('skyslope_dashboard_meta').upsert(
  {
    id: 1,
    totals: master.totals,
    system_findings: master.systemFindings,
    bn_review: master.brokerNotesReview,
    generated_at: master.generatedAt,
    synced_at: new Date().toISOString(),
  },
  { onConflict: 'id' }
)
if (metaError) {
  console.error('skyslope_dashboard_meta upsert failed:', metaError.message)
  process.exit(1)
}

console.log(`synced ${rows.length} properties + meta to Supabase`)
