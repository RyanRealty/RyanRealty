#!/usr/bin/env node
/**
 * V2 of geocode-leads — same bug as 16 v1 had: silent skip on FUB API
 * transient errors. v2 adds:
 *   - fubWithRetry() wrapper (exp backoff on 429 + 5xx, up to 5 attempts)
 *   - Geocoder retry on transient errors
 *   - Post-write completeness audit: how many owner-occupied leads are
 *     in fub_person_geo and have neighborhood tags pushed back to FUB
 *   - Idempotent — re-running upserts; doesn't double-charge geocoding
 *     since results stay in fub_person_geo (skip if already present)
 *
 * Run: DELETE=1 to execute (default dry-run).
 *      AUDIENCE=owner-occupied (default) — which tag to iterate
 *      LIMIT=N to cap
 *      SKIP_CACHED=1 to skip leads already in fub_person_geo
 */

import { createClient } from '@supabase/supabase-js'

const FUB_KEY = process.env.FOLLOWUPBOSS_API_KEY?.trim()
const GMAPS_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY?.trim()
const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPA_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const DELETE = process.env.DELETE === '1'
const AUDIENCE = process.env.AUDIENCE || 'owner-occupied'
const LIMIT = parseInt(process.env.LIMIT || '0', 10) || Infinity
const SKIP_CACHED = process.env.SKIP_CACHED === '1'

if (!FUB_KEY) throw new Error('Missing FOLLOWUPBOSS_API_KEY')
if (!GMAPS_KEY) throw new Error('Missing NEXT_PUBLIC_GOOGLE_MAPS_API_KEY')
if (!SUPA_URL || !SUPA_KEY) throw new Error('Missing SUPABASE env vars')

const BASIC = Buffer.from(`${FUB_KEY}:`).toString('base64')
const supabase = createClient(SUPA_URL, SUPA_KEY)

async function fubRaw(method, path, body = null) {
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
  const text = await res.text()
  let json = null
  try { json = JSON.parse(text) } catch {}
  return { status: res.status, json }
}

async function fubWithRetry(method, path, body = null, maxAttempts = 5) {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const r = await fubRaw(method, path, body)
      if (r.status >= 200 && r.status < 300) return { ok: true, ...r }
      if (r.status === 429 || (r.status >= 500 && r.status < 600)) {
        const wait = Math.min(1000 * Math.pow(2, attempt - 1), 15_000)
        console.warn(`  [fub-retry ${attempt}/${maxAttempts}] ${r.status} ${path.slice(0, 60)} — wait ${wait}ms`)
        await new Promise(r => setTimeout(r, wait))
        continue
      }
      return { ok: false, ...r }  // 4xx, don't retry
    } catch (e) {
      const wait = Math.min(1000 * Math.pow(2, attempt - 1), 15_000)
      console.warn(`  [fub-retry ${attempt}/${maxAttempts}] threw ${e.message} — wait ${wait}ms`)
      await new Promise(r => setTimeout(r, wait))
    }
  }
  return { ok: false, status: 0, error: 'max retries exceeded' }
}

async function geocodeWithRetry(address, maxAttempts = 3) {
  const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${GMAPS_KEY}&region=us&components=country:US|administrative_area:OR`
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const r = await fetch(url)
      const j = await r.json()
      if (j.status === 'OK' && j.results?.length) {
        const top = j.results[0]
        return {
          lat: top.geometry.location.lat,
          lng: top.geometry.location.lng,
          confidence: top.geometry.location_type,
          formatted: top.formatted_address,
        }
      }
      if (j.status === 'OVER_QUERY_LIMIT' || j.status === 'UNKNOWN_ERROR') {
        const wait = 1000 * attempt
        console.warn(`  [geocode-retry ${attempt}/${maxAttempts}] ${j.status} — wait ${wait}ms`)
        await new Promise(r => setTimeout(r, wait))
        continue
      }
      // ZERO_RESULTS, REQUEST_DENIED etc — no retry, just null
      return null
    } catch (e) {
      const wait = 1000 * attempt
      console.warn(`  [geocode-retry ${attempt}/${maxAttempts}] threw ${e.message} — wait ${wait}ms`)
      await new Promise(r => setTimeout(r, wait))
    }
  }
  return null
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
  if (!mailing.street?.trim() || !mailing.city?.trim()) return false
  if (!mailing.state || mailing.state.length !== 2) return false
  return true
}

async function* iterateLeads() {
  let next = `/people?tags=${encodeURIComponent(AUDIENCE)}&limit=100&sort=id&fields=id,name,addresses,tags`
  let seen = 0
  while (next) {
    const r = await fubWithRetry('GET', next)
    if (!r.ok) {
      console.error(`  ❌ GET people failed after retries: ${r.status}`)
      return
    }
    const j = r.json
    const people = j?.people || []
    if (!people.length) return
    for (const p of people) {
      yield p
      seen++
      if (seen >= LIMIT) return
    }
    const nl = j?._metadata?.nextLink
    next = nl ? nl.replace('https://api.followupboss.com/v1', '') : null
    await new Promise(r => setTimeout(r, 50))
  }
}

async function getCachedIds() {
  if (!SKIP_CACHED) return new Set()
  const { data } = await supabase.from('fub_person_geo').select('fub_person_id')
  return new Set((data || []).map(r => r.fub_person_id))
}

async function main() {
  console.log(`=== FUB Lead Geocoding v2 (with retry + audit) ===`)
  console.log(`Mode: ${DELETE ? 'EXECUTE' : 'DRY-RUN'}`)
  console.log(`Audience tag: ${AUDIENCE}`)
  console.log(`Skip cached: ${SKIP_CACHED}`)
  console.log(`Limit: ${LIMIT === Infinity ? 'all' : LIMIT}\n`)

  const cached = await getCachedIds()
  if (SKIP_CACHED) console.log(`Already cached in fub_person_geo: ${cached.size}\n`)

  const stats = {
    scanned: 0, strict_pass: 0, partial_skip: 0, skipped_cached: 0,
    geocoded: 0, geocode_failed: 0, spatial_hits: 0, spatial_miss: 0,
    written_db: 0, written_fub: 0, errors: 0,
  }
  const partials = []
  const neighborhoodCounts = {}

  for await (const person of iterateLeads()) {
    stats.scanned++
    if (stats.scanned % 100 === 0) {
      console.log(`  scanned ${stats.scanned} (geo ${stats.geocoded}, db ${stats.written_db}, fub ${stats.written_fub}, errors ${stats.errors})`)
    }

    if (cached.has(person.id)) { stats.skipped_cached++; continue }

    const mailing = person.addresses?.[0]
    if (!isStrictAddress(mailing)) {
      stats.partial_skip++
      partials.push({ id: person.id, name: person.name, mailing })
      continue
    }
    stats.strict_pass++

    const addrStr = `${mailing.street}, ${mailing.city}, ${mailing.state} ${mailing.code || ''}`.trim()
    if (!DELETE) continue  // dry-run only counts

    const g = await geocodeWithRetry(addrStr)
    if (!g) { stats.geocode_failed++; continue }
    stats.geocoded++

    const spatial = await lookupSpatial(g.lat, g.lng)
    const matched = !!(spatial && (spatial.city_slug || spatial.neighborhood_slug || spatial.subdivision_slug))
    if (matched) stats.spatial_hits++; else stats.spatial_miss++
    if (matched && spatial.neighborhood_slug) {
      neighborhoodCounts[spatial.neighborhood_slug] = (neighborhoodCounts[spatial.neighborhood_slug] || 0) + 1
    }

    const mailingState = (mailing.state || '').toUpperCase()
    const geoScope = mailingState === 'OR'
      ? (spatial?.city_slug ? 'local' : 'out-of-area')
      : 'out-of-state'

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
    }, { onConflict: 'fub_person_id' })
    if (dbErr) { stats.errors++; continue }
    stats.written_db++

    const tags = []
    if (spatial?.city_slug) tags.push(`city:${spatial.city_slug}`)
    if (spatial?.neighborhood_slug) tags.push(`neighborhood:${spatial.neighborhood_slug}`)
    if (spatial?.subdivision_slug) tags.push(`subdivision:${spatial.subdivision_slug}`)
    tags.push(`geo:${geoScope}`)
    if (tags.length) {
      const r = await fubWithRetry('PUT', `/people/${person.id}?mergeTags=true`, { tags })
      if (r.ok) {
        stats.written_fub++
        await supabase.from('fub_person_geo').update({ tagged_in_fub_at: new Date().toISOString() }).eq('fub_person_id', person.id)
      } else { stats.errors++ }
    }

    await new Promise(r => setTimeout(r, 80))
  }

  console.log('\n=== Summary ===')
  for (const [k, v] of Object.entries(stats)) console.log(`  ${k.padEnd(16)} ${v}`)

  console.log('\n=== Top 20 neighborhoods matched ===')
  for (const [n, c] of Object.entries(neighborhoodCounts).sort((a, b) => b[1] - a[1]).slice(0, 20)) {
    console.log(`  ${n.padEnd(40)} ${c}`)
  }

  if (partials.length) {
    const out = ['fub_person_id,name,street,city,state,code']
    for (const p of partials) {
      out.push([p.id, p.name, p.mailing?.street ?? '', p.mailing?.city ?? '', p.mailing?.state ?? '', p.mailing?.code ?? '']
        .map(v => `"${(v || '').toString().replace(/"/g, '""')}"`).join(','))
    }
    const csvPath = '/Users/matthewryan/RyanRealty/.tmp_env/fub-setup/partials-for-manual-review.csv'
    await import('node:fs').then(fs => fs.writeFileSync(csvPath, out.join('\n')))
    console.log(`\n  ${partials.length} partial-address leads → ${csvPath}`)
  }

  // Audit: how complete is the geocoding for the audience tag?
  console.log('\n=== Completeness audit ===')
  const r = await fubWithRetry('GET', `/people?tags=${encodeURIComponent(AUDIENCE)}&limit=1`)
  const audienceN = r.json?._metadata?.total ?? 0
  const { count: geoN } = await supabase.from('fub_person_geo').select('fub_person_id', { count: 'exact', head: true })
  console.log(`  ${AUDIENCE} leads in FUB: ${audienceN}`)
  console.log(`  Geocoded rows in fub_person_geo: ${geoN}`)
  console.log(`  Coverage: ${audienceN > 0 ? ((geoN / audienceN) * 100).toFixed(1) : 0}%`)
}

main().catch(e => { console.error('FATAL:', e); process.exit(1) })
