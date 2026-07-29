#!/usr/bin/env node
/**
 * check-community-alias-cities.mjs — the registry's city coverage matches the DB.
 *
 * THE CLASS (2026-07-29): a community page's alias matcher only scans active
 * SFR tiles pulled for the community's registry city + mls_cities. When MLS
 * listings for a community carry a City spelling outside that set, the page
 * silently renders fewer homes than exist (Caldera Springs: 0 shown vs 31
 * real, hidden under City='Bend'; Black Butte Ranch: 38 hidden under its own
 * city name). No error, no fallback — just a wrong number in front of buyers.
 *
 * THE ASSERTION: for every community in data/resort-communities.json, every
 * MLS City that carries >= MIN_LEAK active single-family listings matching the
 * community's subdivision_aliases MUST be in {city} UNION mls_cities. A leak
 * fails the gate with the exact registry edit to make.
 *
 * DB-dependent (live Supabase) — runs with the local/nightly data gates, not
 * the secret-less static chain. Wire: package.json ci:data-access chain.
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'

const MIN_LEAK = 2 // 1 stray mis-tagged listing is noise; 2+ is a real leak

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
if (!url || !key) {
  console.error('community-alias-cities: SKIP (no Supabase credentials in env)')
  process.exit(0)
}
const supabase = createClient(url, key)

const registry = JSON.parse(readFileSync('data/resort-communities.json', 'utf8'))
const failures = []

for (const c of registry.communities) {
  const aliases = c.subdivision_aliases ?? []
  if (aliases.length === 0) continue
  const allowed = new Set([c.city, ...(c.mls_cities ?? [])])

  const { data, error } = await supabase
    .from('listings')
    .select('City')
    .eq('StandardStatus', 'Active')
    .eq('PropertyType', 'A')
    .in('SubdivisionName', aliases)
    .limit(1000)
  if (error) {
    console.error(`community-alias-cities: query failed for ${c.slug}: ${error.message}`)
    process.exit(1)
  }

  const counts = new Map()
  for (const row of data ?? []) {
    const city = (row.City ?? '').trim()
    if (city) counts.set(city, (counts.get(city) ?? 0) + 1)
  }
  for (const [city, n] of counts) {
    if (n >= MIN_LEAK && !allowed.has(city)) {
      failures.push(
        `${c.slug}: ${n} active listings under MLS City='${city}' not covered by registry city='${c.city}' + mls_cities=[${(c.mls_cities ?? []).join(', ')}] — add '${city}' to mls_cities in data/resort-communities.json`,
      )
    }
  }
}

if (failures.length > 0) {
  console.error('community-alias-cities: FAIL — community pages are hiding inventory:')
  for (const f of failures) console.error('  ' + f)
  process.exit(1)
}
console.log(`community-alias-cities: OK — ${registry.communities.length} communities, registry city coverage matches the MLS.`)
