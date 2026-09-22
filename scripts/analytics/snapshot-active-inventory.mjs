#!/usr/bin/env node
/**
 * H8 — active inventory snapshot by city (CO service area).
 * Thin caller of lib/data/analytics/snapshotActiveInventory.ts.
 * The Vercel cron imports that module directly; this file is for local runs.
 *
 *   node scripts/analytics/snapshot-active-inventory.mjs
 *   node scripts/analytics/snapshot-active-inventory.mjs --json
 *   node scripts/analytics/snapshot-active-inventory.mjs --dry-run   # no write
 *
 * Requires:
 *   NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in .env.local
 *   migration 20260810150000_analytics_feature_inventory.sql (analytics_inventory_snapshot)
 */
import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { tsImport } from 'tsx/esm/api'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..')
config({ path: join(ROOT, '.env.local'), quiet: true })

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) {
  console.error('Need NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const { snapshotActiveInventory } = await tsImport(
  '../../lib/data/analytics/snapshotActiveInventory.ts',
  import.meta.url,
)

const args = process.argv.slice(2)
const dryRun = args.includes('--dry-run')
const sb = createClient(url, key, { auth: { persistSession: false } })
const result = await snapshotActiveInventory({ client: sb, dryRun })

if (!result.ok && result.error) console.error(result.error)
console.log(JSON.stringify(result, null, 2))

const countsOk = result.errors.length === 0 && result.error == null
process.exitCode = (dryRun ? countsOk : result.ok) ? 0 : 1
