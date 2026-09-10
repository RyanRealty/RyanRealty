/**
 * import-official-parks.mjs — re-source city-park polygons in public.boundaries
 * from official agency GIS. OSM rows are TRACKED DEBT (ci:boundary-provenance
 * NON_OFFICIAL_MAX). This script may only shrink that cap.
 *
 * Sources (authoritative, verified 2026-09-10):
 *   Deschutes County GIS Parks FeatureServer — parcel outlines of state, city
 *   and rural parks in Deschutes County. OPERATOR names the manager
 *   (BEND PARK & REC / CITY OF REDMOND / CITY OF SISTERS).
 *     https://services1.arcgis.com/znO8Hz1SuVVohYhZ/ArcGIS/rest/services/Parks/FeatureServer/0
 *   Crook County GIS OpenData/Places layer 4 "Parks"
 *     https://gis.crookcountyor.gov/server/rest/services/OpenData/Places/MapServer/4
 *
 * Matching is an EXPLICIT name map, never fuzzy. A county NAME that is not in
 * the map is ignored. A registry slug with no exact NAME is left as-is (OSM
 * debt stays until an official polygon is found). Multiple county polygons
 * with the same exact NAME are unioned — the layer is parcel outlines.
 *
 * American Legion Community Park (Redmond) is NOT in the Deschutes Parks
 * layer under that name (queried NAME / LOCATION=REDMOND, 2026-09-10). It
 * stays OSM until City of Redmond publishes a named polygon.
 *
 * Usage:
 *   node scripts/gis/import-official-parks.mjs           # dry run
 *   node scripts/gis/import-official-parks.mjs --write
 */
import { loadEnv, requireEnv } from '../../lib/platform/env.mjs'

const UA = 'RyanRealtyGIS/1.0 (matt@ryan-realty.com)'
const WRITE = process.argv.includes('--write')

const DESCHUTES_PARKS_LAYER =
  'https://services1.arcgis.com/znO8Hz1SuVVohYhZ/ArcGIS/rest/services/Parks/FeatureServer/0'
const CROOK_PARKS_LAYER =
  'https://gis.crookcountyor.gov/server/rest/services/OpenData/Places/MapServer/4'

/**
 * Registry slug -> exact county NAME values. One slug, one park. Extra parcels
 * under a different name (Sawyer Uplands, Shevlin Conservation Easement) are
 * not this park.
 */
const DESCHUTES_MATCH = {
  'drake-park': { names: ['Drake Park & Mirror Pond'], label: 'Drake Park' },
  'shevlin-park': { names: ['Shevlin Park'], label: 'Shevlin Park' },
  'riverbend-park': { names: ['Riverbend Park'], label: 'Riverbend Park' },
  'farewell-bend-park': { names: ['Farewell Bend Park'], label: 'Farewell Bend Park' },
  'sawyer-park': { names: ['Sawyer Park'], label: 'Sawyer Park' },
  'pine-nursery-park': { names: ['Pine Nursery Park'], label: 'Pine Nursery Park' },
  'juniper-park': { names: ['Juniper Park'], label: 'Juniper Park' },
  'big-sky-park': { names: ['Big Sky Park & Sports Complex'], label: 'Big Sky Park' },
  'dry-canyon': { names: ['Dry Canyon Trail'], label: 'Dry Canyon' },
  'village-green-city-park': { names: ['Village Green Park'], label: 'Village Green City Park' },
}

const CROOK_MATCH = {
  'ochoco-creek-park': { names: ['Ochoco Creek Park'], label: 'Ochoco Creek Park' },
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

async function queryLayer(layer) {
  const params = new URLSearchParams({
    where: '1=1',
    outFields: '*',
    returnGeometry: 'true',
    outSR: '4326',
    f: 'json',
    resultRecordCount: '2000',
  })
  const res = await fetch(`${layer}/query?${params}`, { headers: { 'User-Agent': UA } })
  const j = await res.json()
  if (j.error) throw new Error(`${layer} query failed: ${JSON.stringify(j.error).slice(0, 300)}`)
  return j.features || []
}

function collect(feats, match, nameField, extraAttr) {
  const bySlug = {}
  for (const [slug, spec] of Object.entries(match)) {
    bySlug[slug] = { slug, label: spec.label, names: spec.names, coords: [], extras: [] }
  }
  const wanted = new Map()
  for (const [slug, spec] of Object.entries(match)) {
    for (const n of spec.names) wanted.set(n, slug)
  }
  for (const f of feats) {
    const name = String(f.attributes?.[nameField] ?? '').trim()
    const slug = wanted.get(name)
    if (!slug) continue
    const polys = esriRingsToPolygons(f.geometry?.rings)
    if (!polys.length) continue
    bySlug[slug].coords.push(...polys)
    if (extraAttr) bySlug[slug].extras.push(String(f.attributes?.[extraAttr] ?? '').trim())
  }
  return Object.values(bySlug)
}

async function rpc(name, body) {
  const { url, key } = await env()
  const res = await fetch(`${url}/rest/v1/rpc/${name}`, {
    method: 'POST',
    headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const text = await res.text()
  if (!res.ok) throw new Error(`${name} -> ${res.status} ${text.slice(0, 200)}`)
  return text ? JSON.parse(text) : null
}

async function main() {
  const desFeats = await queryLayer(DESCHUTES_PARKS_LAYER)
  const crookFeats = await queryLayer(CROOK_PARKS_LAYER)
  console.log(`Deschutes Parks polygons: ${desFeats.length}`)
  console.log(`Crook Parks polygons: ${crookFeats.length}`)

  const des = collect(desFeats, DESCHUTES_MATCH, 'NAME', 'OPERATOR')
  const crook = collect(crookFeats, CROOK_MATCH, 'name', null)

  const ok = []
  const missing = []
  for (const row of [...des, ...crook]) {
    if (!row.coords.length) {
      missing.push(row.slug)
      console.log(`  MISS   ${row.slug} — no exact NAME among ${row.names.join(' | ')}`)
      continue
    }
    const isCrook = Boolean(CROOK_MATCH[row.slug])
    const operator = [...new Set(row.extras.filter(Boolean))].join('/')
    const source = isCrook
      ? `Crook County GIS — Parks (OpenData/Places/4); name=${row.names[0]}`
      : `Deschutes County GIS — Parks (OPERATOR=${operator || 'n/a'}); NAME=${row.names[0]}`
    const sourceUrl = isCrook ? CROOK_PARKS_LAYER : DESCHUTES_PARKS_LAYER
    ok.push({
      slug: row.slug,
      label: row.label,
      geojson: { type: 'MultiPolygon', coordinates: row.coords },
      source,
      sourceUrl,
      note: `${row.coords.length} polygon(s)`,
    })
    console.log(`  MATCH  ${row.slug} ← ${row.names[0]} (${row.coords.length} poly)`)
  }

  if (missing.length) {
    console.log(`\n${missing.length} registry park(s) with no official polygon this run (OSM row left in place):`)
    for (const s of missing) console.log(`  KEEP-OSM ${s}`)
  }

  if (!WRITE) {
    console.log(`\n(dry run — ${ok.length} official. Pass --write to upsert.)`)
    return
  }
  for (const d of ok) {
    await rpc('upsert_boundary', {
      p_geo_type: 'park',
      p_geo_slug: d.slug,
      p_geo_label: d.label,
      p_geojson: d.geojson,
      p_source: d.source,
      p_source_url: d.sourceUrl,
    })
    console.log(`  write park/${d.slug}: ok (${d.note})`)
  }
  console.log(`\n${ok.length} park polygon(s) upserted. Refresh snapshot: node scripts/gis/import-ode-school-districts.mjs --snapshot`)
}

main().catch((e) => {
  console.error('FATAL', e.message)
  process.exit(1)
})
