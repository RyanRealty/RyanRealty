#!/usr/bin/env node
/**
 * H8 skeleton — active inventory snapshot by city (CO service area).
 * Counts active listings via service role and logs JSON.
 * Does not yet write a warehouse table (optional later).
 *
 *   node scripts/analytics/snapshot-active-inventory.mjs
 *   node scripts/analytics/snapshot-active-inventory.mjs --json
 *
 * Requires: NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in .env.local
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

// Align with lib/data/analytics/co-cities + CENTRAL_OREGON_CITY_SLUGS proper names.
// Keep inline so this script stays zero-TS-import (skeleton, node-only).
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
]

const asOf = new Date().toISOString()
const byCity = []

for (const city of cities) {
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
const out = {
  asOf,
  geo: 'central-oregon-service-area-skeleton',
  note: 'H8 skeleton — counts only; no durable inventory_snapshot table yet',
  byCity,
  totalActive,
  errors: byCity.filter((r) => r.error).map((r) => ({ city: r.city, error: r.error })),
}

console.log(JSON.stringify(out, null, 2))
