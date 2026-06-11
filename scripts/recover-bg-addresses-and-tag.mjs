#!/usr/bin/env node
// #3 recovery: parse the Bend property address out of each contact's `background`
// text, geocode it (centroid-rejection guard), point-in-polygon for neighborhood,
// then write BOTH (a) the recovered street into a FUB address entry of type
// "Property" AND (b) the neighborhood:<slug> tag. Preserves all existing tags +
// existing addresses. Idempotent. LIMIT=10 for smoke test.
import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import fs from 'node:fs'
config({ path: '/Users/matthewryan/RyanRealty/.env.local' })

const FUB = 'https://api.followupboss.com/v1'
const AUTH = `Basic ${Buffer.from(process.env.FOLLOWUPBOSS_API_KEY.trim() + ':').toString('base64')}`
const H = { Authorization: AUTH, 'Content-Type': 'application/json', Accept: 'application/json', 'X-System': 'RyanRealtyAudit' }
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
const GKEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
const LIMIT = process.env.LIMIT ? parseInt(process.env.LIMIT, 10) : Infinity
const APPLY = process.env.APPLY === '1'   // default DRY RUN

const cands = JSON.parse(fs.readFileSync('/Users/matthewryan/RyanRealty/out/fub-nurture/bg-address-candidates.json', 'utf8'))
const work = cands.slice(0, LIMIT === Infinity ? cands.length : LIMIT)
console.log(`${APPLY ? 'APPLY' : 'DRY-RUN'} over ${work.length} candidates${LIMIT !== Infinity ? ` (LIMIT ${LIMIT})` : ''}`)

const stats = { processed: 0, geocoded: 0, no_match: 0, geo_fail: 0, centroid_reject: 0, tagged: 0, addr_written: 0, errors: 0 }
const sampleRows = []

for (const c of work) {
  stats.processed++
  const full = `${c.street}, Bend, OR`

  // geocode w/ retry + street-level guard (reject centroids/approximate)
  let loc = null, why = null
  for (let a = 0; a < 4 && !loc; a++) {
    try {
      const u = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(full)}&key=${GKEY}&region=us`
      const j = await (await fetch(u)).json()
      if (j.status === 'OK' && j.results?.[0]) {
        const res = j.results[0]; const types = res.types || []
        const street = types.includes('street_address') || types.includes('premise') || types.includes('subpremise') || res.geometry?.location_type === 'ROOFTOP' || res.geometry?.location_type === 'RANGE_INTERPOLATED'
        const centroid = types.includes('locality') || types.includes('postal_code') || types.includes('administrative_area_level_1') || types.includes('administrative_area_level_2') || res.geometry?.location_type === 'APPROXIMATE'
        if (street && !centroid && !res.partial_match) { loc = res.geometry.location; break }
        why = 'centroid'; break
      }
      if (j.status === 'OVER_QUERY_LIMIT') { await new Promise(s => setTimeout(s, 1200 * (a + 1))); continue }
      why = j.status; break
    } catch { await new Promise(s => setTimeout(s, 600 * (a + 1))) }
  }
  if (!loc) { if (why === 'centroid') stats.centroid_reject++; else stats.geo_fail++; continue }

  // PostGIS neighborhood
  let geo = null
  for (let a = 0; a < 3; a++) {
    try { const { data, error } = await supabase.rpc('lookup_address_geo', { lat: loc.lat, lng: loc.lng }); if (error) { await new Promise(s => setTimeout(s, 600 * (a + 1))); continue } geo = Array.isArray(data) ? data[0] : data; break } catch { await new Promise(s => setTimeout(s, 600 * (a + 1))) }
  }
  if (!geo?.neighborhood_slug) { stats.no_match++; continue }
  stats.geocoded++

  if (sampleRows.length < 15) sampleRows.push(`  id=${c.id} "${c.street}" -> neighborhood:${geo.neighborhood_slug}${geo.subdivision_slug ? ` +subdivision:${geo.subdivision_slug}` : ''}`)

  if (!APPLY) { stats.tagged++; continue }  // dry run: count what we WOULD do

  // fetch current tags + addresses to merge non-destructively
  let person
  try { person = await (await fetch(`${FUB}/people/${c.id}?fields=tags,addresses`, { headers: H })).json() } catch { stats.errors++; continue }
  const curTags = (person.tags || [])
  const newTags = [...new Set([...curTags, `neighborhood:${geo.neighborhood_slug}`, ...(geo.subdivision_slug ? [`subdivision:${geo.subdivision_slug}`] : [])])]
  const curAddrs = person.addresses || []
  // add the recovered property address only if not already present
  const already = curAddrs.some(a => (a.street || '').toLowerCase() === c.street.toLowerCase())
  const newAddrs = already ? curAddrs : [...curAddrs, { type: 'Property', street: c.street, city: 'Bend', state: 'OR' }]

  try {
    const r = await fetch(`${FUB}/people/${c.id}`, { method: 'PUT', headers: H, body: JSON.stringify({ tags: newTags, addresses: newAddrs }) })
    if (r.ok) {
      stats.tagged++; if (!already) stats.addr_written++
      await supabase.from('fub_person_geo').upsert({ fub_person_id: c.id, formatted_address: full, neighborhood_slug: geo.neighborhood_slug, subdivision_slug: geo.subdivision_slug ?? null, city_slug: geo.city_slug ?? null, updated_at: new Date().toISOString() }, { onConflict: 'fub_person_id' })
    } else { stats.errors++; if (stats.errors <= 3) console.log('  PUT fail', c.id, r.status, (await r.text()).slice(0, 120)) }
  } catch { stats.errors++ }
  await new Promise(s => setTimeout(s, 150))
}

console.log('\nsample resolved:')
for (const s of sampleRows) console.log(s)
console.log('\nSummary:', JSON.stringify(stats, null, 2))
