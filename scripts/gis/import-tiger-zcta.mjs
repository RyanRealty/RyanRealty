/**
 * import-tiger-zcta.mjs — load Census TIGER ZCTA5 polygons into
 * public.boundaries under geo_type='zip' for the ten CANONICAL_ZIPS the
 * public /zip/[zip] route publishes.
 *
 * Source (authoritative, verified 2026-09-10, two query shapes):
 *   1. TIGERweb PUMA_TAD_TAZ_UGA_ZCTA MapServer layer 11
 *      "ZIP Code Tabulation Areas" — count for the ten ZCTA5 values = 10.
 *   2. Same service layer 1 "2020 Census ZIP Code Tabulation Areas" — same
 *      ten ZCTA5 values, count = 10.
 * A ZCTA is the Census polygon that approximates a USPS ZIP, not the delivery
 * route. TIGER/Line 2024 still ships the 2020 ZCTA vintage (Census does not
 * redraw ZCTAs annually). Publisher stamped on every row.
 *
 * Scope is the registry in app/zip/[zip]/_v3/zip-constants.ts, not every
 * Oregon ZCTA. A boundary row for a ZIP the site does not render is dead data.
 *
 * Requires the boundaries_geo_type_check to include 'zip'
 * (migration 20260910013000_boundaries_geo_type_zip.sql) applied on hosted
 * Supabase before --write.
 *
 * Usage:
 *   node scripts/gis/import-tiger-zcta.mjs           # dry run
 *   node scripts/gis/import-tiger-zcta.mjs --write
 */
import fs from 'node:fs'
import { loadEnv, requireEnv } from '../../lib/platform/env.mjs'

const UA = 'RyanRealtyGIS/1.0 (matt@ryan-realty.com)'
const WRITE = process.argv.includes('--write')
const ZCTA_LAYER =
  'https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/PUMA_TAD_TAZ_UGA_ZCTA/MapServer/11'
const PUBLISHER = 'TIGER/Line 2024 ZIP Code Tabulation Areas'
const SOURCE_URL = ZCTA_LAYER

function loadCanonicalZips() {
  const src = fs.readFileSync(new URL('../../app/zip/[zip]/_v3/zip-constants.ts', import.meta.url), 'utf8')
  const block = src.match(/CANONICAL_ZIPS = new Set\(\[([\s\S]*?)\]\)/)?.[1]
  if (!block) throw new Error('CANONICAL_ZIPS Set literal not found in zip-constants.ts')
  const zips = [...block.matchAll(/'(\d{5})'/g)].map((m) => m[1])
  if (zips.length !== 10) throw new Error(`expected 10 canonical ZIPs, got ${zips.length}`)
  return zips
}

async function env() {
  await loadEnv()
  return {
    url: requireEnv('NEXT_PUBLIC_SUPABASE_URL'),
    key: requireEnv('SUPABASE_SERVICE_ROLE_KEY'),
  }
}

function esriRingsToPolygons(rings) {
  const area = (r) => {
    let a = 0
    for (let i = 0; i < r.length - 1; i++) a += r[i][0] * r[i + 1][1] - r[i + 1][0] * r[i][1]
    return a / 2
  }
  const polys = []
  for (const ring of rings || []) {
    if (!Array.isArray(ring) || ring.length < 4) continue
    if (area(ring) < 0) polys.push([ring])
    else if (polys.length) polys[polys.length - 1].push(ring)
    else polys.push([ring])
  }
  return polys
}

async function rpc(name, body) {
  const { url, key } = await env()
  const res = await fetch(`${url}/rest/v1/rpc/${name}`, {
    method: 'POST',
    headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const text = await res.text()
  if (!res.ok) throw new Error(`${name} -> ${res.status} ${text.slice(0, 240)}`)
  return text ? JSON.parse(text) : null
}

async function main() {
  const zips = loadCanonicalZips()
  const where = `ZCTA5 IN (${zips.map((z) => `'${z}'`).join(',')})`
  const params = new URLSearchParams({
    where,
    outFields: 'ZCTA5,GEOID,BASENAME,NAME,MTFCC,AREALAND,AREAWATER',
    returnGeometry: 'true',
    outSR: '4326',
    f: 'json',
  })
  const res = await fetch(`${ZCTA_LAYER}/query?${params}`, { headers: { 'User-Agent': UA } })
  const j = await res.json()
  if (j.error) throw new Error(`TIGER ZCTA query failed: ${JSON.stringify(j.error).slice(0, 300)}`)
  const feats = j.features || []
  console.log(`TIGER ZCTA layer 11 returned ${feats.length} of ${zips.length} requested ZCTAs`)

  const byZip = new Map()
  for (const f of feats) {
    const zcta = String(f.attributes?.ZCTA5 ?? '').trim()
    const polys = esriRingsToPolygons(f.geometry?.rings)
    if (!zcta || !polys.length) continue
    const prev = byZip.get(zcta)
    if (prev) prev.coords.push(...polys)
    else {
      byZip.set(zcta, {
        zcta,
        geoid: f.attributes?.GEOID,
        mtfcc: f.attributes?.MTFCC,
        coords: polys,
      })
    }
  }

  const missing = zips.filter((z) => !byZip.has(z))
  if (missing.length) {
    throw new Error(`ABORT: TIGER returned no polygon for ${missing.join(', ')}. Refusing to write a partial ZIP set.`)
  }

  const ok = []
  for (const z of zips) {
    const row = byZip.get(z)
    ok.push({
      slug: z,
      label: `ZIP ${z}`,
      geojson: { type: 'MultiPolygon', coordinates: row.coords },
      source: `${PUBLISHER} (GEOID=${row.geoid}, ZCTA5=${row.zcta}, MTFCC=${row.mtfcc})`,
      note: `${row.coords.length} polygon(s)`,
    })
    console.log(`  VERIFIED ZCTA ${z} — ${row.coords.length} polygon(s)`)
  }

  if (!WRITE) {
    console.log(`\n(dry run — ${ok.length} verified. Pass --write to upsert after the zip CHECK migration is on hosted.)`)
    return
  }
  for (const d of ok) {
    await rpc('upsert_boundary', {
      p_geo_type: 'zip',
      p_geo_slug: d.slug,
      p_geo_label: d.label,
      p_geojson: d.geojson,
      p_source: d.source,
      p_source_url: SOURCE_URL,
    })
    console.log(`  write zip/${d.slug}: ok (${d.note})`)
  }
  console.log(`\n${ok.length} ZIP polygon(s) upserted. Refresh snapshot: node scripts/gis/import-ode-school-districts.mjs --snapshot`)
}

main().catch((e) => {
  console.error('FATAL', e.message)
  process.exit(1)
})
