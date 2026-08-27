#!/usr/bin/env node
/**
 * H8 — active inventory snapshot by city (CO service area).
 * Counts active listings via service role and writes durable warehouse rows.
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

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..')
config({ path: join(ROOT, '.env.local') })

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) {
  console.error('Need NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const sb = createClient(url, key, { auth: { persistSession: false } })
const args = process.argv.slice(2)
const dryRun = args.includes('--dry-run')

// Align with lib/data/analytics/co-cities + CENTRAL_OREGON_CITY_SLUGS proper names.
const cities = [
  'Bend',
  'Redmond',
  'Sisters',
  'Sunriver',
  'La Pine',
  'Terrebonne',
  'Tumalo',
  'Prineville',
  'Madras',
  'Culver',
  'Powell Butte',
  'Crooked River Ranch',
  'Black Butte Ranch',
  'Camp Sherman',
  'Brothers',
  'Alfalfa',
  'Metolius',
  'Warm Springs',
  'Gateway',
  'Ashwood',
  'Crooked River',
  'Paulina',
  'Post',
  'Mitchell',
]

function citySlug(city) {
  return city.trim().toLowerCase().replace(/\s+/g, '-')
}

const asOfDate = new Date().toISOString().slice(0, 10)
const computedAt = new Date().toISOString()
const byCity = []

for (const city of cities) {
  // stat-source-ok: writes analytics_inventory_snapshot, which no surface reads today. If anything ever renders this table, this count must move to lib/data/ first.
  const { count, error } = await sb
    .from('listings')
    .select('*', { count: 'exact', head: true })
    .eq('City', city)
    .ilike('StandardStatus', 'Active%')
  if (error) {
    byCity.push({ city, error: error.message, active: null })
  } else {
    byCity.push({ city, active: count ?? 0 })
  }
}

const totalActive = byCity.reduce((s, r) => s + (typeof r.active === 'number' ? r.active : 0), 0)

const rows = byCity
  .filter((r) => typeof r.active === 'number')
  .map((r) => ({
    as_of: asOfDate,
    city: r.city,
    city_slug: citySlug(r.city),
    active_count: r.active,
    geo_scope: 'central-oregon-service-area',
    methodology: 'active_ilike+service_area_v1',
    computed_at: computedAt,
  }))

let writeResult = { written: 0, error: null }
if (!dryRun && rows.length) {
  const { error } = await sb.from('analytics_inventory_snapshot').upsert(rows, {
    onConflict: 'as_of,city_slug',
  })
  if (error) {
    writeResult = { written: 0, error: error.message }
    console.error('Warehouse write failed:', error.message)
    process.exitCode = 2
  } else {
    writeResult = { written: rows.length, error: null }
  }
}

const out = {
  asOf: asOfDate,
  computedAt,
  geo: 'central-oregon-service-area',
  note: dryRun
    ? 'H8 dry-run — no warehouse write'
    : writeResult.error
      ? `H8 warehouse write failed: ${writeResult.error}`
      : `H8 warehouse upserted ${writeResult.written} city rows into analytics_inventory_snapshot`,
  byCity,
  totalActive,
  warehouse: writeResult,
  errors: byCity.filter((r) => r.error).map((r) => ({ city: r.city, error: r.error })),
}

console.log(JSON.stringify(out, null, 2))
