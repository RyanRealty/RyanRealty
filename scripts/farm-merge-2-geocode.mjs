#!/usr/bin/env node
// STEP 2: assign neighborhood + subdivision to each deduped farm property using
// the SUPPLIED lat/lng (point-in-polygon via lookup_address_geo RPC). No Google.
// Writes 02-geocoded.json. Resumable: caches results by apn.
import fs from 'node:fs'
import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
config({ path: '/Users/matthewryan/RyanRealty/.env.local' })
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
const OUT = '/Users/matthewryan/RyanRealty/out/farm-merge'

const recs = JSON.parse(fs.readFileSync(OUT + '/01-deduped.json', 'utf8'))
const cacheFile = OUT + '/02-geo-cache.json'
const cache = fs.existsSync(cacheFile) ? JSON.parse(fs.readFileSync(cacheFile, 'utf8')) : {}

let done = 0, hit = 0, miss = 0, err = 0
const CONCURRENCY = 8
let idx = 0
async function worker() {
  while (idx < recs.length) {
    const i = idx++; const r = recs[i]
    if (cache[r.apn] !== undefined) { done++; continue }
    const lat = parseFloat(r.lat), lng = parseFloat(r.lng)
    if (!isFinite(lat) || !isFinite(lng)) { cache[r.apn] = null; miss++; done++; continue }
    let ok = false
    for (let a = 0; a < 3 && !ok; a++) {
      try {
        const { data, error } = await supabase.rpc('lookup_address_geo', { lat, lng })
        if (error) { await new Promise(s => setTimeout(s, 400 * (a + 1))); continue }
        const g = Array.isArray(data) ? data[0] : data
        cache[r.apn] = g ? { n: g.neighborhood_slug || null, s: g.subdivision_slug || null, c: g.city_slug || null } : null
        ok = true; if (g?.neighborhood_slug) hit++; else miss++
      } catch { await new Promise(s => setTimeout(s, 400 * (a + 1))) }
    }
    if (!ok) { cache[r.apn] = null; err++ }
    done++
    if (done % 1000 === 0) { fs.writeFileSync(cacheFile, JSON.stringify(cache)); process.stderr.write(`  ${done}/${recs.length} hit=${hit} miss=${miss} err=${err}\n`) }
  }
}
await Promise.all(Array.from({ length: CONCURRENCY }, worker))
fs.writeFileSync(cacheFile, JSON.stringify(cache))

// attach to records
let tagged = 0
for (const r of recs) {
  const g = cache[r.apn]
  r.neighborhood_slug = g?.n || null
  r.subdivision_slug = g?.s || null
  r.city_slug = g?.c || null
  if (r.neighborhood_slug) tagged++
}
fs.writeFileSync(OUT + '/02-geocoded.json', JSON.stringify(recs))
const summary = { total: recs.length, neighborhood_assigned: tagged, no_neighborhood: recs.length - tagged }
fs.writeFileSync(OUT + '/02-summary.json', JSON.stringify(summary, null, 2))
console.log(JSON.stringify(summary, null, 2))
