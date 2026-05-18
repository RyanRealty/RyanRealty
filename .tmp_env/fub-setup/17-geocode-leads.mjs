#!/usr/bin/env node
/**
 * Geocode FUB leads and tag them with canonical neighborhood + subdivision.
 *
 * For each lead with a mailing address that we trust to be their PROPERTY
 * address (default rule: leads with `owner-occupied` tag — mailing = property
 * for them):
 *   1. Geocode the address via Google Geocoding API
 *   2. Call public.lookup_address_geo(lat, lng) for the spatial lookup
 *   3. Store result in public.fub_person_geo
 *   4. Push tags back to FUB: city:<slug>, neighborhood:<slug>, subdivision:<slug>
 *
 * Strict mode: skip if no street + city + state. Two-pass per Matt's spec.
 *
 * Cost: ~3,266 owner-occupied leads × $0.005 Google Geocoding = ~$16.
 * Time: ~3,266 × 200ms (geocode + DB + tag) = ~11 minutes.
 *
 * Run: DELETE=1 to execute; otherwise dry-run.
 *      AUDIENCE=audience:seller to restrict to a tag.
 *      LIMIT=N to cap (default Infinity).
 */

import { createClient } from '@supabase/supabase-js'

const FUB_KEY = process.env.FOLLOWUPBOSS_API_KEY?.trim()
const GMAPS_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY?.trim()
const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPA_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const DELETE = process.env.DELETE === '1'
const AUDIENCE = process.env.AUDIENCE || 'owner-occupied'
const LIMIT = parseInt(process.env.LIMIT || '0', 10) || Infinity

if (!FUB_KEY) throw new Error('Missing FOLLOWUPBOSS_API_KEY')
if (!GMAPS_KEY) throw new Error('Missing NEXT_PUBLIC_GOOGLE_MAPS_API_KEY')
if (!SUPA_URL || !SUPA_KEY) throw new Error('Missing SUPABASE env vars')

const BASIC = Buffer.from(`${FUB_KEY}:`).toString('base64')
const supabase = createClient(SUPA_URL, SUPA_KEY)

async function fub(method, path, body = null) {
  const res = await fetch(`https://api.followupboss.com/v1${path}`, {
    method,
    headers: {
      Authorization: `Basic ${BASIC}`,
      'Content-Type': 'application/json',
      'X-System': 'RyanRealty-Web',
      'X-System-Key': 'ryan-realty-2026-seller-workflow',
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  if (method === 'GET') return await res.json()
  return res.status
}

async function geocode(address) {
  const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${GMAPS_KEY}&region=us&components=country:US|administrative_area:OR`
  const r = await fetch(url)
  const j = await r.json()
  if (j.status !== 'OK' || !j.results?.length) return null
  const top = j.results[0]
  return {
    lat: top.geometry.location.lat,
    lng: top.geometry.location.lng,
    confidence: top.geometry.location_type,    // ROOFTOP | RANGE_INTERPOLATED | GEOMETRIC_CENTER | APPROXIMATE
    formatted: top.formatted_address,
  }
}

async function lookupSpatial(lat, lng) {
  const { data, error } = await supabase.rpc('lookup_address_geo', { lat, lng })
  if (error) {
    console.warn(`  RPC error: ${error.message}`)
    return null
  }
  return Array.isArray(data) ? data[0] : data
}

function isStrictAddress(mailing) {
  if (!mailing) return false
  if (!mailing.street || !mailing.city) return false
  if (!mailing.state || mailing.state.length !== 2) return false
  return true
}

async function* iterateLeads() {
  let next = `/people?tags=${encodeURIComponent(AUDIENCE)}&limit=100&sort=id&fields=id,name,addresses,tags`
  let seen = 0
  while (next) {
    const j = await fub('GET', next)
    const people = j.people || []
    if (!people.length) return
    for (const p of people) {
      yield p
      seen++
      if (seen >= LIMIT) return
    }
    const nl = j._metadata?.nextLink
    next = nl ? nl.replace('https://api.followupboss.com/v1', '') : null
    await new Promise(r => setTimeout(r, 50))
  }
}

async function main() {
  console.log(`=== FUB Lead Geocoding + Neighborhood Tagging ===`)
  console.log(`Mode: ${DELETE ? 'EXECUTE' : 'DRY-RUN'}`)
  console.log(`Audience filter: tag=${AUDIENCE}`)
  console.log(`Limit: ${LIMIT === Infinity ? 'all matching' : LIMIT}`)
  console.log()

  const stats = {
    scanned: 0,
    strict_pass: 0,
    partial_skip: 0,
    no_address: 0,
    geocoded: 0,
    geocode_failed: 0,
    spatial_hits: 0,
    spatial_miss: 0,
    written_db: 0,
    written_fub: 0,
    errors: 0,
  }
  const partials = []
  const samples = []
  const neighborhoodCounts = {}

  for await (const person of iterateLeads()) {
    stats.scanned++
    if (stats.scanned % 100 === 0) console.log(`  scanned ${stats.scanned}…`)

    const mailing = person.addresses?.[0]
    if (!mailing) { stats.no_address++; continue }
    if (!isStrictAddress(mailing)) {
      stats.partial_skip++
      partials.push({ id: person.id, name: person.name, mailing })
      continue
    }
    stats.strict_pass++

    const addrStr = `${mailing.street}, ${mailing.city}, ${mailing.state} ${mailing.code || ''}`.trim()

    if (!DELETE) {
      // Dry-run: just count, don't burn geocoding credits
      if (samples.length < 5) samples.push({ id: person.id, name: person.name, addr: addrStr })
      continue
    }

    // GEOCODE
    let g
    try { g = await geocode(addrStr) }
    catch (e) { stats.errors++; console.warn(`  geocode error id=${person.id}: ${e.message}`); continue }
    if (!g) { stats.geocode_failed++; continue }
    stats.geocoded++

    // SPATIAL LOOKUP
    const spatial = await lookupSpatial(g.lat, g.lng)
    const matched = !!(spatial && (spatial.city_slug || spatial.neighborhood_slug || spatial.subdivision_slug))
    if (matched) stats.spatial_hits++; else stats.spatial_miss++

    if (matched && spatial.neighborhood_slug) {
      neighborhoodCounts[spatial.neighborhood_slug] = (neighborhoodCounts[spatial.neighborhood_slug] || 0) + 1
    }

    // INFER OWNER + GEO
    const mailingState = (mailing.state || '').toUpperCase()
    const geoScope = mailingState === 'OR'
      ? (spatial?.city_slug ? 'local' : 'out-of-area')
      : 'out-of-state'

    // PERSIST TO SUPABASE
    const { error: dbErr } = await supabase.from('fub_person_geo').upsert({
      fub_person_id: person.id,
      source_address: addrStr,
      source_type: 'mailing',
      latitude: g.lat,
      longitude: g.lng,
      geocode_confidence: g.confidence,
      formatted_address: g.formatted,
      city_slug: spatial?.city_slug ?? null,
      neighborhood_slug: spatial?.neighborhood_slug ?? null,
      subdivision_slug: spatial?.subdivision_slug ?? null,
      geo_scope: geoScope,
      owner_type: 'occupied',
      geocoded_at: new Date().toISOString(),
      tagged_in_fub_at: null,
    }, { onConflict: 'fub_person_id' })
    if (dbErr) { stats.errors++; console.warn(`  DB error id=${person.id}: ${dbErr.message}`); continue }
    stats.written_db++

    // PUSH TAGS TO FUB
    const tags = []
    if (spatial?.city_slug) tags.push(`city:${spatial.city_slug}`)
    if (spatial?.neighborhood_slug) tags.push(`neighborhood:${spatial.neighborhood_slug}`)
    if (spatial?.subdivision_slug) tags.push(`subdivision:${spatial.subdivision_slug}`)
    tags.push(`geo:${geoScope}`)
    if (tags.length) {
      const r = await fub('PUT', `/people/${person.id}?mergeTags=true`, { tags })
      if (r >= 200 && r < 300) {
        stats.written_fub++
        await supabase.from('fub_person_geo')
          .update({ tagged_in_fub_at: new Date().toISOString() })
          .eq('fub_person_id', person.id)
      } else {
        stats.errors++
      }
    }

    await new Promise(r => setTimeout(r, 100))
  }

  console.log('\n=== Summary ===')
  for (const [k, v] of Object.entries(stats)) console.log(`  ${k.padEnd(18)} ${v}`)

  console.log('\n=== Top neighborhoods matched ===')
  const sortedN = Object.entries(neighborhoodCounts).sort((a, b) => b[1] - a[1])
  for (const [n, c] of sortedN.slice(0, 20)) {
    console.log(`  ${n.padEnd(35)} ${c}`)
  }

  if (samples.length) {
    console.log('\n=== Sample addresses (dry-run preview) ===')
    for (const s of samples) console.log(`  id=${s.id} ${s.name}  ${s.addr}`)
  }

  if (partials.length) {
    console.log(`\n=== ${partials.length} leads with partial address (skipped by strict mode) ===`)
    // Write to a CSV for Matt to triage
    const out = ['fub_person_id,name,street,city,state,code']
    for (const p of partials) {
      out.push([p.id, p.name, p.mailing?.street ?? '', p.mailing?.city ?? '', p.mailing?.state ?? '', p.mailing?.code ?? '']
        .map(v => `"${(v || '').toString().replace(/"/g, '""')}"`).join(','))
    }
    const csvPath = '/Users/matthewryan/RyanRealty/.tmp_env/fub-setup/partials-for-manual-review.csv'
    await import('node:fs').then(fs => fs.writeFileSync(csvPath, out.join('\n')))
    console.log(`  CSV written to ${csvPath}`)
  }

  if (!DELETE) console.log('\n  → re-run with DELETE=1 to execute (will burn ~$16 in Google Geocoding API).')
}

main().catch(e => { console.error('FATAL:', e); process.exit(1) })
