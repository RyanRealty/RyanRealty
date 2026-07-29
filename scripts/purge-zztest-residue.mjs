#!/usr/bin/env node
/**
 * Purge synthetic `zztest` rows that integration tests leave in LIVE Supabase.
 *
 * Why this exists
 * ---------------
 * `lib/**\/*.int.test.ts` runs against production, not a fixture database, and
 * `npm test` runs it — including from the pre-commit hook. So every commit can
 * write real rows to `cmas` and `marketing_brain_actions`. Each suite's
 * `afterAll` deletes the exact slugs it created, which misses any row whose
 * slug shape differs (`--v2`, a re-slug after a collision) or whose test threw
 * before recording the slug.
 *
 * Measured 2026-07-29: 20 orphan `cmas` rows and 14 orphan
 * `marketing_brain_actions` rows had accumulated, the oldest six days old. That
 * is not cosmetic. `/api/cron/cma-build-worker` scans a small fixed batch per
 * run, so dead probe rows consume the budget and a REAL client CMA queues
 * behind them: during the buyer-journey audit the worker spent an entire run on
 * zztest rows and a genuine CMA only built on its second invocation.
 *
 * Why it is NOT wired into the test `afterAll`
 * --------------------------------------------
 * That was tried first and reverted. The extra round trips pushed three
 * `afterAll` hooks past their 30s budget and failed the suite
 * (`Hook timed out in 30000ms`), especially while the database is loaded by the
 * 15-minute MV refresh documented in docs/plans/F7-sync-contention.md. Cleanup
 * must never be able to fail a test run, so it lives here instead: run it
 * on demand, or on a schedule, outside the hook budget.
 *
 * Usage
 * -----
 *   node scripts/purge-zztest-residue.mjs           # report only, deletes nothing
 *   node scripts/purge-zztest-residue.mjs --apply   # actually delete
 *
 * Safety: every probe fixture carries the `zztest` marker in its slug or
 * address and uses `@example.invalid` recipients, so the pattern cannot match a
 * real client record. The default is a dry run precisely so that claim can be
 * re-checked before anything is removed.
 */
import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'

const APPLY = process.argv.includes('--apply')

function loadEnv() {
  const raw = readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
  return Object.fromEntries(
    raw
      .split('\n')
      .filter((l) => l.includes('=') && !l.trimStart().startsWith('#'))
      .map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1).trim()]),
  )
}

const env = loadEnv()
const url = env.NEXT_PUBLIC_SUPABASE_URL
const key = env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY in .env.local')
  process.exit(2)
}
const sb = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })

const { data: cmaRows, error: cmaErr } = await sb
  .from('cmas')
  .select('id, slug, status')
  .or('slug.ilike.%zztest%,subject_address.ilike.%zztest%')
if (cmaErr) {
  console.error('cmas read failed:', cmaErr.message)
  process.exit(1)
}

const { data: actionRows, error: actionErr } = await sb
  .from('marketing_brain_actions')
  .select('id, target, status')
  .ilike('target', '%zztest%')
if (actionErr) {
  console.error('marketing_brain_actions read failed:', actionErr.message)
  process.exit(1)
}

const cmaIds = (cmaRows ?? []).map((r) => r.id)
console.log(`zztest residue: ${cmaIds.length} cmas, ${(actionRows ?? []).length} brain actions`)

if (!APPLY) {
  for (const r of (cmaRows ?? []).slice(0, 10)) console.log(`  cma  ${r.slug} (${r.status})`)
  for (const r of (actionRows ?? []).slice(0, 10)) console.log(`  act  ${r.target} (${r.status})`)
  console.log('\nDry run. Re-run with --apply to delete.')
  process.exit(0)
}

if (cmaIds.length > 0) {
  await sb.from('cma_comps').delete().in('cma_id', cmaIds)
  const { error } = await sb.from('cmas').delete().in('id', cmaIds)
  if (error) {
    console.error('cmas delete failed:', error.message)
    process.exit(1)
  }
}
const { error: delActErr } = await sb
  .from('marketing_brain_actions')
  .delete()
  .ilike('target', '%zztest%')
if (delActErr) {
  console.error('brain actions delete failed:', delActErr.message)
  process.exit(1)
}
console.log(`Deleted ${cmaIds.length} cmas and ${(actionRows ?? []).length} brain actions.`)
