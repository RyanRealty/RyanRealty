/**
 * seo-import-school-boundaries.mjs — import authoritative school ATTENDANCE-AREA
 * polygons into public.boundaries (geo_type='school', geo_slug = the
 * data/co-schools.ts slug), so a school page can draw its attendance boundary.
 *
 * Source: Deschutes County GIS OpenData — "School Attendance Area"
 * (maps.deschutes.org, BoundaryFD MapServer layer 19). Covers Bend-La Pine (601),
 * Redmond (620), Sisters (640). Authoritative per feedback_gis_authoritative_only;
 * reprojected to WGS84 via outSR=4326. Provenance written on every row.
 *
 * Matching (§0 — a wrong attendance polygon is worse than none): the county
 * SCHOOL name is bare ("Summit"); the registry name carries the level
 * ("Summit High"). We match slugify(SCHOOL) as a prefix of the registry slug AND
 * require the level (from SCHOOL_TYPE) to agree. Anything ambiguous (0 or >1
 * candidate) is reported UNMATCHED for manual review, never guessed.
 *
 * Usage:  node scripts/seo-import-school-boundaries.mjs           # dry run (match report)
 *         node scripts/seo-import-school-boundaries.mjs --write   # upsert matched polygons
 */
import fs from 'node:fs'

const UA = 'RyanRealtyGIS/1.0 (matt@ryan-realty.com)'
const URL_Q =
  'https://maps.deschutes.org/arcgis/rest/services/OpenData/BoundaryFD/MapServer/19/query'
const WRITE = process.argv.includes('--write')

const slugify = (s) =>
  s.toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')

// Esri polygon rings -> GeoJSON MultiPolygon. Esri exterior rings wind clockwise
// (negative shoelace in x=lng/y=lat space); holes wind counterclockwise. Group
// each exterior ring with the holes that follow it.
function esriRingsToMultiPolygon(rings) {
  const area = (r) => {
    let a = 0
    for (let i = 0; i < r.length - 1; i++) a += r[i][0] * r[i + 1][1] - r[i + 1][0] * r[i][1]
    return a / 2
  }
  const polys = []
  for (const ring of rings || []) {
    if (area(ring) < 0) polys.push([ring]) // clockwise = new exterior
    else if (polys.length) polys[polys.length - 1].push(ring) // ccw = hole of current
    else polys.push([ring]) // stray hole with no exterior -> treat as exterior
  }
  return { type: 'MultiPolygon', coordinates: polys }
}
// County SCHOOL name -> extra slug base aliases (naming diffs vs the registry).
// SITE-66: JACK ENSWORTH / W.E. MILLER / LYNCH are the county's own names for
// Ensworth Elem, William E Miller Elem, M A Lynch Elem. Without these the
// prefix matcher cannot join them (verified 2026-09-10 against BoundaryFD/19).
const ALIASES = {
  'la-pine': ['lapine'],
  'jack-ensworth': ['ensworth'],
  'w-e-miller': ['william-e-miller'],
  lynch: ['m-a-lynch'],
}
const levelFromType = (t) => (t === 4 ? 'high' : t === 3 ? 'middle' : 'elementary') // 1 elem, 2 elem/middle→elem

/**
 * Parse the registry's own `level` field. Deriving level from the trailing
 * token of `name` misclassified "Three Rivers" (a middle school whose name
 * has no level token) as elementary, so county THREE RIVERS type 1 and type 3
 * both failed to match (SITE-66). The seed already has the level.
 */
function loadRegistry() {
  const src = fs.readFileSync(new URL('../data/co-schools.ts', import.meta.url), 'utf8')
  const out = []
  const re = /name:\s*'([^']+)',\s*\n\s*level:\s*'(elementary|middle|high)'/g
  for (const m of src.matchAll(re)) {
    out.push({ slug: slugify(m[1]), name: m[1], level: m[2] })
  }
  if (out.length < 50) throw new Error(`co-schools registry parse too small (${out.length})`)
  return out
}

/**
 * SITE-66 two-shape publisher checks for registry schools Deschutes BoundaryFD/19
 * does not cover. Printed, never written. A 2015 ODHS grade-1 layer exists and
 * is NOT ingested: vintage 2015, grade-1 early-learning catchments, name
 * collisions (Barnes Elementary ≠ Barnes Butte Elem). Wrong attendance is
 * worse than none.
 */
async function reportMissingPublishers(registry, matched) {
  const missing = registry.filter((r) => !matched[r.slug])
  if (!missing.length) return
  console.log(`\n${missing.length} registry school(s) still without an attendance polygon:`)
  for (const r of missing) console.log(`  NO-POLYGON ${r.slug} (${r.level})`)

  const checks = []
  const get = async (url) => {
    try {
      const res = await fetch(url, { headers: { 'User-Agent': UA } })
      const text = await res.text()
      let json = null
      try {
        json = JSON.parse(text)
      } catch {
        json = { _head: text.slice(0, 160) }
      }
      return { status: res.status, json }
    } catch (e) {
      return { error: e.message }
    }
  }

  const crookBound = await get(
    'https://gis.crookcountyor.gov/server/rest/services/OpenData/Boundary_Group/MapServer?f=json',
  )
  const crookLayers = (crookBound.json?.layers || []).map((l) => `${l.id}:${l.name}`).join(', ')
  checks.push(
    `Crook GIS OpenData/Boundary_Group ${crookBound.error || crookBound.status}: layers=[${crookLayers}]. School Districts + School Board Zones, no school ATTENDANCE layer.`,
  )

  const crookDist = await get(
    'https://gis.crookcountyor.gov/server/rest/services/Public/Districts_Group/MapServer?f=json',
  )
  const distLayers = (crookDist.json?.layers || []).map((l) => l.name).join(', ')
  checks.push(
    `Crook GIS Public/Districts_Group ${crookDist.error || crookDist.status}: layers=[${distLayers}]. Fire/water/parks districts, no school attendance.`,
  )

  const ode = await get(
    'https://services.arcgis.com/uUvqNMGPm7axC2dD/arcgis/rest/services/EDUCATIONAL_BOUNDARIES/FeatureServer?f=json',
  )
  const odeLayers = (ode.json?.layers || []).map((l) => `${l.id}:${l.name}`).join(', ')
  checks.push(
    `ODE EDUCATIONAL_BOUNDARIES ${ode.error || ode.status}: layers=[${odeLayers}]. Districts only; no school-level attendance.`,
  )

  const jeffHttps = await get('https://maps.co.jefferson.or.us/arcgis/rest/services?f=json')
  const jeffHttp = await get('http://maps.co.jefferson.or.us/arcgis/rest/services?f=json')
  checks.push(
    `Jefferson GIS HTTPS ${jeffHttps.error || jeffHttps.status}; HTTP ${jeffHttp.error || jeffHttp.status}. No public REST catalog (SITE-58 sold/down; re-verified SITE-66).`,
  )

  const odhs = await get(
    'https://services.arcgis.com/uUvqNMGPm7axC2dD/ArcGIS/rest/services/Elementary_School_Attendance_Boundaries/FeatureServer/0?f=json',
  )
  checks.push(
    `ODHS/OHA Elementary_School_Attendance_Boundaries ${odhs.error || odhs.status} name=${odhs.json?.name || '?'} — vintage 2015 grade-1 catchments. NOT ingested (wrong year, wrong grain).`,
  )

  console.log('\nPublisher checks (two shapes; no geometry invented):')
  for (const c of checks) console.log(`  CHECK  ${c}`)
}

async function main() {
  const registry = loadRegistry()
  const params = new URLSearchParams({ where: '1=1', outFields: 'SCHOOL,SCHOOL_TYPE,DISTRICT', returnGeometry: 'true', outSR: '4326', f: 'json' })
  const j = await (await fetch(`${URL_Q}?${params}`, { headers: { 'User-Agent': UA } })).json()
  const feats = j.features || []
  console.log(`county attendance polygons: ${feats.length}`)

  const matched = {}
  const unmatched = []
  for (const f of feats) {
    const school = f.attributes?.SCHOOL
    const type = f.attributes?.SCHOOL_TYPE
    const district = f.attributes?.DISTRICT
    const rings = f.geometry?.rings
    if (!school || !rings) continue
    const polys = esriRingsToMultiPolygon(rings).coordinates
    const base = slugify(school)
    const bases = [base, ...(ALIASES[base] || [])]
    const level = levelFromType(type)
    const cands = registry.filter(
      (r) => r.level === level && bases.some((b) => r.slug === b || r.slug.startsWith(b + '-')),
    )
    if (cands.length === 1) {
      const slug = cands[0].slug
      if (!matched[slug]) matched[slug] = { label: cands[0].name, coords: [], school, districts: new Set() }
      matched[slug].coords.push(...polys) // union split attendance areas into one MultiPolygon
      matched[slug].districts.add(district)
      console.log(`  MATCH  ${school} (${level}, d${district}) → ${slug}`)
    } else {
      unmatched.push(`${school} (${level}, d${district}) → ${cands.length} candidates${cands.length ? ': ' + cands.map((c) => c.slug).join(',') : ''}`)
    }
  }
  console.log(`\n${Object.keys(matched).length} matched, ${unmatched.length} unmatched:`)
  for (const u of unmatched) console.log('  UNMATCHED ' + u)

  await reportMissingPublishers(registry, matched)

  if (!WRITE) {
    console.log('\n(dry run — pass --write to upsert matched polygons)')
    return
  }
  const env = fs.readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
  const url = (env.match(/NEXT_PUBLIC_SUPABASE_URL=(.+)/) || [])[1]?.trim()
  const key = (env.match(/SUPABASE_SERVICE_ROLE_KEY=(.+)/) || [])[1]?.trim()
  for (const [slug, m] of Object.entries(matched)) {
    const res = await fetch(`${url}/rest/v1/rpc/upsert_boundary`, {
      method: 'POST',
      headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        p_geo_type: 'school',
        p_geo_slug: slug,
        p_geo_label: m.label,
        p_geojson: { type: 'MultiPolygon', coordinates: m.coords },
        p_source: `Deschutes County GIS — School Attendance Area (BoundaryFD/19); SCHOOL=${m.school}, DISTRICT=${[...m.districts].join('/')}`,
        p_source_url: URL_Q.replace('/query', ''),
      }),
    })
    console.log(`  write school/${slug}: ${res.status === 204 ? 'ok' : (await res.text()).slice(0, 120)}`)
  }
}
main().catch((e) => console.log('FATAL', e.message))
