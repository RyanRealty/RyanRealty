#!/usr/bin/env node
/**
 * backfill-deliverable-library.mjs — one-shot archive of deliverables that
 * finished BEFORE the content library existed (W10.2).
 *
 * Persistence fires on the in_production -> ready transition, so every producer
 * run that completed before this shipped has its output only in
 * marketing_brain_actions.executor_response and nothing in the bucket. Round 3
 * of review flagged the honest consequence: the library was live and empty, so
 * "a broker can come back to their finished work" was unobserved end to end.
 *
 * Ownership comes from public.resolve_deliverable_broker_slug — the same
 * function the app and the render worker use. Keys are built by the same pure
 * module. Idempotent (upsert), so re-running is safe.
 *
 * Usage:
 *   node scripts/backfill-deliverable-library.mjs --limit 5     # smoke test
 *   node scripts/backfill-deliverable-library.mjs               # full run
 *   node scripts/backfill-deliverable-library.mjs --dry-run
 */
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { loadDeliverablePath } from './lib/deliverable-path-runtime.mjs'

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
config({ path: join(REPO_ROOT, '.env.local') })

const BUCKET = 'marketing-deliverables'
const STATUSES = ['ready', 'approved', 'executed', 'measured']

const args = process.argv.slice(2)
const dryRun = args.includes('--dry-run')
const limitArg = args.indexOf('--limit')
const limit = limitArg >= 0 ? parseInt(args[limitArg + 1], 10) : null

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) {
  console.error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required')
  process.exit(1)
}
const supabase = createClient(url, key, { auth: { persistSession: false } })

const loaded = await loadDeliverablePath(REPO_ROOT)
if (!loaded.ok) {
  console.error('could not load the path module:', loaded.error)
  process.exit(1)
}
const { buildDeliverablePath } = loaded.mod

let query = supabase
  .from('marketing_brain_actions')
  .select('id, action_type, status, executor_response')
  .in('status', STATUSES)
  .not('executor_response', 'is', null)
  .order('executed_at', { ascending: false })
if (limit) query = query.limit(limit)

const { data: rows, error } = await query
if (error) {
  console.error('fetch failed:', error.message)
  process.exit(1)
}

console.log(`Backfilling ${rows.length} finished action(s)${dryRun ? ' [DRY RUN]' : ''}`)
const byBroker = new Map()
let archived = 0
let skipped = 0
let failed = 0

for (const row of rows) {
  const env = row.executor_response ?? {}
  // A deferral envelope is not a deliverable; anything else with real content is.
  // The old test looked at four fixed keys, so it skipped content:cma rows whose
  // output lives in cma_slug/preview_url (round 4). Treat a row as archivable if
  // it carries ANY content-bearing key beyond pure dispatch bookkeeping.
  const BOOKKEEPING = new Set([
    'dispatch_status', 'queued_at', 'ready_for_runtime', 'runtime_invocation_command',
    'runtime_invocation_command_alt', 'deferred_to_local_render', 'needs_render',
    'output_class', 'triggered_by', 'model', 'input_tokens', 'output_tokens', 'cost_usd',
    'completed_at', 'action_phase',
  ])
  const isDeferral =
    env.deferred_to_local_render === true || env.dispatch_status === 'queued_by_admin'
  const contentKeys = Object.keys(env).filter((k) => !BOOKKEEPING.has(k) && env[k] != null)
  if (isDeferral || contentKeys.length === 0) {
    skipped++
    continue
  }

  const { data: slug, error: slugErr } = await supabase.rpc('resolve_deliverable_broker_slug', {
    p_action_id: row.id,
  })
  const brokerSlug = !slugErr && typeof slug === 'string' && slug ? slug : 'matthew-ryan'

  const filename = `${String(row.action_type).replace(/[^a-z0-9]+/gi, '-')}.json`
  const path = buildDeliverablePath(brokerSlug, row.id, filename)
  if (!path) {
    failed++
    console.warn(`  ! ${row.id}: could not build a safe key`)
    continue
  }

  byBroker.set(brokerSlug, (byBroker.get(brokerSlug) ?? 0) + 1)
  if (dryRun) {
    archived++
    continue
  }

  const body = JSON.stringify(
    { action_type: row.action_type, status_at_backfill: row.status, backfilled: true, ...env },
    null,
    2,
  )
  const { error: upErr } = await supabase.storage
    .from(BUCKET)
    .upload(path, body, { contentType: 'application/json', upsert: true })
  if (upErr) {
    failed++
    console.warn(`  ! ${row.id}: ${upErr.message}`)
  } else {
    archived++
  }
}

console.log(`\narchived: ${archived}  skipped (no output): ${skipped}  failed: ${failed}`)
console.log('per broker:')
for (const [slug, n] of [...byBroker.entries()].sort((a, b) => b[1] - a[1])) {
  console.log(`  ${slug.padEnd(20)} ${n}`)
}
