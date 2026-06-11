#!/usr/bin/env node
// Backfill neighborhood:<slug> tags onto Bend FUB people without one.
// Uses cursor pagination to reach beyond FUB's 2000-offset cap.
import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
config({ path: '/Users/matthewryan/RyanRealty/.env.local' })

const FUB_BASE = 'https://api.followupboss.com/v1'
const FUB_KEY = process.env.FOLLOWUPBOSS_API_KEY.trim()
const AUTH = `Basic ${Buffer.from(`${FUB_KEY}:`).toString('base64')}`
const HEADERS = { Authorization: AUTH, 'Content-Type': 'application/json', Accept: 'application/json' }

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
)

// Opt-in cap for smoke-testing (GEOCODE_LIMIT=15). Default = unlimited.
const LIMIT = process.env.GEOCODE_LIMIT ? parseInt(process.env.GEOCODE_LIMIT, 10) : Infinity

console.log('Walking all city:bend people via cursor pagination...')
const targets = []
let nextCursor = null, walked = 0
while (true) {
  const url = nextCursor
    ? `${FUB_BASE}/people?tags=city:bend&limit=100&next=${nextCursor}&fields=allFields`
    : `${FUB_BASE}/people?tags=city:bend&limit=100&fields=allFields`
  const r = await fetch(url, { headers: HEADERS })
  if (!r.ok) { console.error('FAIL', r.status); break }
  const data = await r.json()
  const ps = data.people || []
  if (ps.length === 0) break
  for (const p of ps) {
    if ((p.tags || []).some(t => t.startsWith('neighborhood:'))) continue
    let addr = null
    const a = (p.addresses || []).find(a => a.street && a.city)
    if (a) addr = `${a.street}, ${a.city}, ${a.state || 'OR'} ${a.postalCode || ''}`.trim()
    else if (p.customSellerPropertyAddress) addr = p.customSellerPropertyAddress
    if (addr) targets.push({ id: p.id, addr, tags: p.tags || [] })
  }
  walked += ps.length
  if (walked % 1000 === 0) console.log(`  walked ${walked}, ${targets.length} need tag`)
  if (targets.length >= LIMIT) break
  nextCursor = data._metadata?.next || null
  if (!nextCursor) break
}
if (targets.length > LIMIT) targets.length = LIMIT
console.log(`Targets: ${targets.length}${LIMIT !== Infinity ? ` (capped at GEOCODE_LIMIT=${LIMIT})` : ''}`)
console.log()

const stats = { total: targets.length, geocoded: 0, no_match: 0, tagged: 0, errors: 0 }
for (let i = 0; i < targets.length; i++) {
  const t = targets[i]
  if (i % 50 === 0) console.log(`  ${i + 1}/${targets.length}  tagged=${stats.tagged} no_match=${stats.no_match} err=${stats.errors}`)

  // geocode with retry/backoff. NO components filter (it wrongly ZERO_RESULTS-es
  // valid bare-street strings). Instead, reject any result that didn't resolve to
  // a real street address — a locality/centroid fallback would mis-tag the
  // neighborhood (data-accuracy: never tag off a city centroid).
  let latLng = null, gstatus = null
  for (let a = 0; a < 4 && !latLng; a++) {
    try {
      const u = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(t.addr)}&key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}&region=us`
      const j = await (await fetch(u)).json()
      gstatus = j.status
      if (j.status === 'OK' && j.results?.[0]) {
        const res = j.results[0]
        const types = res.types || []
        const partial = res.partial_match === true
        const isStreetLevel = types.includes('street_address') || types.includes('premise') || types.includes('subpremise') || types.includes('rooftop') || res.geometry?.location_type === 'ROOFTOP' || res.geometry?.location_type === 'RANGE_INTERPOLATED'
        const isCentroid = types.includes('locality') || types.includes('postal_code') || types.includes('administrative_area_level_1') || types.includes('administrative_area_level_2') || res.geometry?.location_type === 'APPROXIMATE'
        if (isStreetLevel && !isCentroid && !partial) { latLng = res.geometry.location; break }
        // resolved but only to a centroid/approximate -> not trustworthy, skip
        gstatus = 'CENTROID_REJECT'; break
      }
      if (j.status === 'OVER_QUERY_LIMIT') { await new Promise(s => setTimeout(s, 1200 * (a + 1))); continue }
      break // ZERO_RESULTS / REQUEST_DENIED / etc — don't retry
    } catch { await new Promise(s => setTimeout(s, 600 * (a + 1))) }
  }
  if (!latLng) { stats.errors++; stats.gstat = stats.gstat || {}; stats.gstat[gstatus || 'fetch_fail'] = (stats.gstat[gstatus || 'fetch_fail'] || 0) + 1; continue }

  // PostGIS lookup with retry
  let geo = null, rpcErr = false
  for (let a = 0; a < 3; a++) {
    try {
      const { data, error } = await supabase.rpc('lookup_address_geo', { lat: latLng.lat, lng: latLng.lng })
      if (error) { rpcErr = true; await new Promise(s => setTimeout(s, 600 * (a + 1))); continue }
      geo = Array.isArray(data) ? data[0] : data; rpcErr = false; break
    } catch { rpcErr = true; await new Promise(s => setTimeout(s, 600 * (a + 1))) }
  }
  if (rpcErr) { stats.errors++; stats.rpc_err = (stats.rpc_err || 0) + 1; continue }

  if (!geo?.neighborhood_slug) { stats.no_match++; continue }
  stats.geocoded++

  const newTags = [...new Set([...t.tags, `neighborhood:${geo.neighborhood_slug}`])]
  if (geo.subdivision_slug) newTags.push(`subdivision:${geo.subdivision_slug}`)
  try {
    const r = await fetch(`${FUB_BASE}/people/${t.id}`, {
      method: 'PUT', headers: HEADERS, body: JSON.stringify({ tags: newTags })
    })
    if (r.ok) {
      stats.tagged++
      await supabase.from('fub_person_geo').upsert({
        fub_person_id: t.id, formatted_address: t.addr,
        neighborhood_slug: geo.neighborhood_slug,
        subdivision_slug: geo.subdivision_slug ?? null,
        city_slug: geo.city_slug ?? null,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'fub_person_id' })
    } else stats.errors++
  } catch { stats.errors++ }

  await new Promise(r => setTimeout(r, 200))
}

console.log()
console.log('═══ Summary ═══')
console.log(JSON.stringify(stats, null, 2))
