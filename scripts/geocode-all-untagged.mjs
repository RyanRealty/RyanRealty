#!/usr/bin/env node
// All-source neighborhood backfill: walk EVERY FUB person (not just city:bend),
// find those with no neighborhood:* tag but a usable street address (addresses[]
// street, else customSellerPropertyAddress, else background phrase), geocode with
// centroid-rejection guard, point-in-polygon, and tag the ones that land inside a
// Bend neighborhood. Out-of-area addresses geocode + correctly no_match (skipped).
// Idempotent. LIMIT=N to cap. APPLY=1 to write (default DRY-RUN).
import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
config({ path: '/Users/matthewryan/RyanRealty/.env.local' })

const FUB = 'https://api.followupboss.com/v1'
const AUTH = `Basic ${Buffer.from(process.env.FOLLOWUPBOSS_API_KEY.trim() + ':').toString('base64')}`
const H = { Authorization: AUTH, 'Content-Type': 'application/json', Accept: 'application/json', 'X-System': 'RyanRealtyAudit' }
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
const GKEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
const LIMIT = process.env.LIMIT ? parseInt(process.env.LIMIT, 10) : Infinity
const APPLY = process.env.APPLY === '1'

const PHRASE = /selling your (?:home|property) at\s+([0-9][^,.]*?)(?:,|\.|\s+we['’]d|\s+we would|$)/i
const clean = s => (s || '').replace(/\s+/g, ' ').trim()

// 1) Collect targets across ALL people
console.log(`${APPLY ? 'APPLY' : 'DRY-RUN'} — walking all people for untagged-with-address...`)
const targets = []
let path = `${FUB}/people?limit=100&fields=id,tags,addresses,customSellerPropertyAddress,background`
let walked = 0
while (path) {
  const r = await fetch(path, { headers: H }); if (!r.ok) { console.error('FAIL', r.status); break }
  const d = await r.json(); const ppl = d.people || []; if (!ppl.length) break
  for (const p of ppl) {
    if ((p.tags || []).some(t => String(t).startsWith('neighborhood:'))) continue
    const addrs = Array.isArray(p.addresses) ? p.addresses : []
    const a = addrs.find(x => (x.street || '').trim())
    let addr = null, fromField = null
    if (a) { addr = `${clean(a.street)}, ${clean(a.city) || 'Bend'}, ${clean(a.state) || 'OR'} ${clean(a.code || a.postalCode || '')}`.trim(); fromField = 'addresses' }
    else if ((p.customSellerPropertyAddress || '').trim()) { addr = clean(p.customSellerPropertyAddress); fromField = 'spa' }
    else { const m = (p.background || '').match(PHRASE); if (m) { addr = `${clean(m[1])}, Bend, OR`; fromField = 'background' } }
    if (addr) targets.push({ id: p.id, addr, fromField, tags: p.tags || [] })
    if (targets.length >= LIMIT) break
  }
  walked += ppl.length
  if (walked % 2000 === 0) console.log(`  walked ${walked}, ${targets.length} targets`)
  if (targets.length >= LIMIT) break
  path = d._metadata?.nextLink || null
}
if (targets.length > LIMIT) targets.length = LIMIT
console.log(`Targets: ${targets.length}\n`)

const stats = { processed: 0, geocoded: 0, no_match: 0, geo_fail: 0, centroid_reject: 0, tagged: 0, addr_written: 0, errors: 0 }
const byFrom = {}
const sample = []

for (let i = 0; i < targets.length; i++) {
  const t = targets[i]; stats.processed++
  if (i % 100 === 0) console.log(`  ${i + 1}/${targets.length} tagged=${stats.tagged} no_match=${stats.no_match} err=${stats.errors}`)

  let loc = null, why = null
  for (let a = 0; a < 4 && !loc; a++) {
    try {
      const u = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(t.addr)}&key=${GKEY}&region=us`
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

  let geo = null
  for (let a = 0; a < 3; a++) {
    try { const { data, error } = await supabase.rpc('lookup_address_geo', { lat: loc.lat, lng: loc.lng }); if (error) { await new Promise(s => setTimeout(s, 600 * (a + 1))); continue } geo = Array.isArray(data) ? data[0] : data; break } catch { await new Promise(s => setTimeout(s, 600 * (a + 1))) }
  }
  if (!geo?.neighborhood_slug) { stats.no_match++; continue }
  stats.geocoded++; byFrom[t.fromField] = (byFrom[t.fromField] || 0) + 1
  if (sample.length < 15) sample.push(`  id=${t.id} [${t.fromField}] "${t.addr.slice(0,40)}" -> neighborhood:${geo.neighborhood_slug}`)

  if (!APPLY) { stats.tagged++; continue }

  let person
  try { person = await (await fetch(`${FUB}/people/${t.id}?fields=tags,addresses`, { headers: H })).json() } catch { stats.errors++; continue }
  const newTags = [...new Set([...(person.tags || []), `neighborhood:${geo.neighborhood_slug}`, ...(geo.subdivision_slug ? [`subdivision:${geo.subdivision_slug}`] : [])])]
  const curAddrs = person.addresses || []
  // only write a Property address when the address came from spa/background (addresses[] already has it otherwise)
  let newAddrs = curAddrs
  if (t.fromField !== 'addresses') {
    const street = t.addr.split(',')[0].trim()
    if (!curAddrs.some(x => (x.street || '').toLowerCase() === street.toLowerCase())) newAddrs = [...curAddrs, { type: 'Property', street, city: 'Bend', state: 'OR' }]
  }
  try {
    const r = await fetch(`${FUB}/people/${t.id}`, { method: 'PUT', headers: H, body: JSON.stringify({ tags: newTags, addresses: newAddrs }) })
    if (r.ok) { stats.tagged++; if (newAddrs !== curAddrs) stats.addr_written++
      await supabase.from('fub_person_geo').upsert({ fub_person_id: t.id, formatted_address: t.addr, neighborhood_slug: geo.neighborhood_slug, subdivision_slug: geo.subdivision_slug ?? null, city_slug: geo.city_slug ?? null, updated_at: new Date().toISOString() }, { onConflict: 'fub_person_id' })
    } else { stats.errors++; if (stats.errors <= 3) console.log('  PUT fail', t.id, r.status) }
  } catch { stats.errors++ }
  await new Promise(s => setTimeout(s, 140))
}
console.log('\nsample:'); for (const s of sample) console.log(s)
console.log('\ntagged by address source:', JSON.stringify(byFrom))
console.log('Summary:', JSON.stringify(stats, null, 2))
