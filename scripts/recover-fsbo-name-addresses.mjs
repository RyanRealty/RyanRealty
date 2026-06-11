#!/usr/bin/env node
// Recover property addresses stored IN THE NAME field for FSBO contacts
// (e.g. name="FSBO- 21416 Cougar Trl, Bend Or 97701"). Parse street + city,
// geocode (centroid guard), write a type:"Property" address + neighborhood tag.
// DRY-RUN default; APPLY=1 to write; LIMIT=n to cap. NEVER alters the name field.
import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
config({ path: '/Users/matthewryan/RyanRealty/.env.local' })
const FUB = 'https://api.followupboss.com/v1'
const AUTH = `Basic ${Buffer.from(process.env.FOLLOWUPBOSS_API_KEY.trim() + ':').toString('base64')}`
const H = { Authorization: AUTH, 'Content-Type': 'application/json', Accept: 'application/json', 'X-System': 'RyanRealtyAudit' }
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
const GKEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
const APPLY = process.env.APPLY === '1'
const LIMIT = process.env.LIMIT ? parseInt(process.env.LIMIT, 10) : Infinity

const STREET = /\b\d{2,6}\s+(?:[NSEW]{1,2}\s+)?[A-Za-z0-9'.\-]+(?:\s+[A-Za-z0-9'.\-]+){0,4}\s+(?:Rd|Road|St|Street|Ave|Avenue|Dr|Drive|Ln|Lane|Ct|Court|Way|Pl|Place|Blvd|Cir|Circle|Loop|Ter|Terrace|Pkwy|Hwy|Trl|Trail|Pt|Point|Run|Path)\b/i
const CITY = /\b(Bend|Redmond|Sisters|La Pine|Tumalo|Terrebonne|Sunriver|Prineville|Powell Butte)\b/i
const norm = s => String(s ?? '').replace(/\s+/g, ' ').trim()

const cands = []
let path = `${FUB}/people?limit=100&fields=id,firstName,lastName,name,tags,addresses,customSellerPropertyAddress`
while (path) {
  const r = await fetch(path, { headers: H }); if (!r.ok) { console.error('FUB', r.status); break }
  const d = await r.json(); const ppl = d.people || []; if (!ppl.length) break
  for (const p of ppl) {
    const addrs = Array.isArray(p.addresses) ? p.addresses : []
    if (addrs.some(a => (a.street || '').trim())) continue
    if (norm(p.customSellerPropertyAddress)) continue
    // street must appear in a NAME field
    const blob = `${norm(p.name)} | ${norm(p.firstName)} | ${norm(p.lastName)}`
    const m = blob.match(STREET)
    if (!m) continue
    const street = norm(m[0])
    const cm = blob.match(CITY)
    const city = cm ? cm[1] : 'Bend'
    cands.push({ id: p.id, raw: norm(p.name), street, city, tags: p.tags || [], addrs })
    if (cands.length >= LIMIT) break
  }
  if (cands.length >= LIMIT) break
  path = d._metadata?.nextLink || null
}
console.log(`${APPLY ? 'APPLY' : 'DRY-RUN'} | FSBO name-address candidates: ${cands.length}`)
console.log('parses:')
for (const c of cands.slice(0, 40)) console.log(`  ${c.id}  "${c.raw.slice(0,42)}"  ->  ${c.street}, ${c.city} OR`)
if (!APPLY) { console.log(`\nDRY-RUN. Set APPLY=1 to write. LIMIT=n to cap.`); process.exit(0) }

const stats = { processed: 0, geocoded: 0, no_match: 0, geo_fail: 0, centroid_reject: 0, tagged: 0, addr_written: 0, errors: 0 }
for (let i = 0; i < cands.length; i++) {
  const c = cands[i]; stats.processed++
  if (i % 25 === 0) console.log(`  ${i + 1}/${cands.length} tagged=${stats.tagged} addr=${stats.addr_written} no_match=${stats.no_match} err=${stats.errors}`)
  const full = `${c.street}, ${c.city}, OR`
  let loc = null, why = null
  for (let a = 0; a < 4 && !loc; a++) {
    try {
      const u = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(full)}&key=${GKEY}&region=us`
      const j = await (await fetch(u)).json()
      if (j.status === 'OK' && j.results?.[0]) {
        const res = j.results[0]; const ty = res.types || []
        const street = ty.includes('street_address') || ty.includes('premise') || ty.includes('subpremise') || res.geometry?.location_type === 'ROOFTOP' || res.geometry?.location_type === 'RANGE_INTERPOLATED'
        const centroid = ty.includes('locality') || ty.includes('postal_code') || ty.includes('administrative_area_level_1') || ty.includes('administrative_area_level_2') || res.geometry?.location_type === 'APPROXIMATE'
        if (street && !centroid && !res.partial_match) { loc = res.geometry.location; break }
        why = 'centroid'; break
      }
      if (j.status === 'OVER_QUERY_LIMIT') { await new Promise(s => setTimeout(s, 1200 * (a + 1))); continue }
      why = j.status; break
    } catch { await new Promise(s => setTimeout(s, 600 * (a + 1))) }
  }
  // always write the recovered address (data fix); tag only if in a Bend neighborhood
  let person
  try { person = await (await fetch(`${FUB}/people/${c.id}?fields=tags,addresses`, { headers: H })).json() } catch { stats.errors++; continue }
  const curAddrs = person.addresses || []
  let newAddrs = curAddrs
  if (!curAddrs.some(a => (a.street || '').toLowerCase() === c.street.toLowerCase())) newAddrs = [...curAddrs, { type: 'Property', street: c.street, city: c.city, state: 'OR' }]
  let newTags = person.tags || []
  let geo = null
  if (loc) {
    for (let a = 0; a < 3; a++) { try { const { data, error } = await supabase.rpc('lookup_address_geo', { lat: loc.lat, lng: loc.lng }); if (error) { await new Promise(s => setTimeout(s, 600 * (a + 1))); continue } geo = Array.isArray(data) ? data[0] : data; break } catch { await new Promise(s => setTimeout(s, 600 * (a + 1))) } }
    if (geo?.neighborhood_slug) { stats.geocoded++; newTags = [...new Set([...newTags, `neighborhood:${geo.neighborhood_slug}`, ...(geo.subdivision_slug ? [`subdivision:${geo.subdivision_slug}`] : [])])] }
    else stats.no_match++
  } else { if (why === 'centroid') stats.centroid_reject++; else stats.geo_fail++ }
  try {
    const r = await fetch(`${FUB}/people/${c.id}`, { method: 'PUT', headers: H, body: JSON.stringify({ tags: newTags, addresses: newAddrs }) })
    if (r.ok) { if (newAddrs !== curAddrs) stats.addr_written++; if (geo?.neighborhood_slug) { stats.tagged++; await supabase.from('fub_person_geo').upsert({ fub_person_id: c.id, formatted_address: full, neighborhood_slug: geo.neighborhood_slug, subdivision_slug: geo.subdivision_slug ?? null, city_slug: geo.city_slug ?? null, updated_at: new Date().toISOString() }, { onConflict: 'fub_person_id' }) } }
    else { stats.errors++; if (stats.errors <= 3) console.log('  PUT fail', c.id, r.status) }
  } catch { stats.errors++ }
  await new Promise(s => setTimeout(s, 140))
}
console.log('\nSummary:', JSON.stringify(stats, null, 2))
