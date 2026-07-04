/**
 * seo-import-trail-lines-osm.mjs — import trail route linework from OpenStreetMap
 * (Overpass API) for the trails that have NO authoritative government REST
 * endpoint: Smith Rock (OPRD publishes only a PDF), Pilot Butte summit (OPRD),
 * and Whoops (a COTA-built trail absent from the USFS federal layer).
 *
 * OSM is the same fallback source already used in this repo for the city-park
 * polygons (migration 20260603130000). Provenance is recorded as OpenStreetMap
 * with the Overpass query, so it is clearly distinguished from the USFS/BPR/BLM
 * gov-sourced lines. Never approximated by hand.
 *
 * §0 accuracy guard: match named ways within a bbox around the known trailhead,
 * keep only segments with a vertex within PROX_KM, and REJECT if the nearest
 * kept vertex is > MAX_TH_KM away.
 *
 * Usage:  node scripts/seo-import-trail-lines-osm.mjs           # dry run
 *         node scripts/seo-import-trail-lines-osm.mjs --write   # upsert the OK trails
 */
import fs from 'node:fs'

const UA = 'RyanRealtyGIS/1.0 (matt@ryan-realty.com)'
const OVERPASS = 'https://overpass-api.de/api/interpreter'
const PROX_KM = 4
const MAX_TH_KM = 1.5
const WRITE = process.argv.includes('--write')

// slug -> { th:[lat,lng], name (OSM name regex), pad (bbox half-size in deg) }
const TRAILS = {
  'misery-ridge': { th: [44.365891, -121.137377], name: 'Misery Ridge', pad: 0.03 },
  'smith-rock-river-trail': { th: [44.365891, -121.137377], name: 'River Trail', pad: 0.025 },
  'pilot-butte': { th: [44.060673, -121.283364], name: 'Pilot Butte', pad: 0.02 },
  'whoops-trail': { th: [44.044608, -121.384984], name: 'Whoops', pad: 0.04 },
}

const R = 6371
const km = (aLat, aLng, bLat, bLng) => {
  const p = Math.PI / 180, dLat = (bLat - aLat) * p, dLng = (bLng - aLng) * p
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(aLat * p) * Math.cos(bLat * p) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(s))
}

async function overpass(th, pad, name) {
  const [lat, lng] = th
  const bbox = `${lat - pad},${lng - pad},${lat + pad},${lng + pad}`
  const q = `[out:json][timeout:60];way["highway"~"path|footway|track|steps|cycleway|bridleway"]["name"~"${name}",i](${bbox});out geom;`
  // Overpass returns an XML error page when the dispatcher is busy / rate-limits;
  // retry a couple times with backoff.
  for (let attempt = 0; attempt < 4; attempt++) {
    const r = await fetch(OVERPASS, { method: 'POST', headers: { 'User-Agent': UA, 'Content-Type': 'text/plain' }, body: q })
    const text = await r.text()
    if (text.trimStart().startsWith('{')) {
      const j = JSON.parse(text)
      return (j.elements || []).filter((e) => e.type === 'way' && e.geometry).map((e) => ({ name: e.tags?.name, line: e.geometry.map((p) => [p.lon, p.lat]) }))
    }
    await new Promise((res) => setTimeout(res, 3000 * (attempt + 1)))
  }
  throw new Error('overpass returned non-JSON after retries')
}

async function main() {
  const validated = {}
  for (const [slug, { th, name, pad }] of Object.entries(TRAILS)) {
    const [thLat, thLng] = th
    let ways = []
    try {
      ways = await overpass(th, pad, name)
    } catch (e) {
      console.log(`  ${slug}: overpass err ${e.message}`)
    }
    const kept = []
    const names = new Set()
    for (const w of ways) {
      let near = Infinity
      for (const [lng, lat] of w.line) near = Math.min(near, km(thLat, thLng, lat, lng))
      if (near <= PROX_KM) {
        kept.push(w.line)
        if (w.name) names.add(w.name)
      }
    }
    let nearest = Infinity
    for (const line of kept) for (const [lng, lat] of line) nearest = Math.min(nearest, km(thLat, thLng, lat, lng))
    const ok = kept.length > 0 && nearest <= MAX_TH_KM
    console.log(`${ok ? 'OK  ' : 'SKIP'} ${slug}: ${kept.length} way(s) / nearest ${nearest === Infinity ? '∞' : nearest.toFixed(2)}km / ${[...names].join(', ') || '—'}`)
    if (ok)
      validated[slug] = {
        geojson: { type: 'MultiLineString', coordinates: kept },
        source: `OpenStreetMap via Overpass (named ways "${name}" near the trailhead); contributors, ODbL`,
        source_url: 'https://www.openstreetmap.org',
        verified_by: `proximity<=${MAX_TH_KM}km to registry trailhead (nearest ${nearest.toFixed(2)}km)`,
      }
    await new Promise((r) => setTimeout(r, 1200)) // be gentle to Overpass
  }

  if (!WRITE) {
    console.log(`\n${Object.keys(validated).length} validated (dry run — pass --write to upsert)`)
    return
  }
  const env = fs.readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
  const url = (env.match(/NEXT_PUBLIC_SUPABASE_URL=(.+)/) || [])[1]?.trim()
  const key = (env.match(/SUPABASE_SERVICE_ROLE_KEY=(.+)/) || [])[1]?.trim()
  for (const [slug, r] of Object.entries(validated)) {
    const res = await fetch(`${url}/rest/v1/rpc/upsert_trail_line`, {
      method: 'POST',
      headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_slug: slug, p_geojson: r.geojson, p_source: r.source, p_source_url: r.source_url, p_verified_by: r.verified_by }),
    })
    console.log(`  write ${slug}: ${res.status === 204 ? 'ok' : (await res.text()).slice(0, 120)}`)
  }
}
main().catch((e) => console.log('FATAL', e.message))
