/**
 * import-ode-school-districts.mjs — load AUTHORITATIVE Oregon Department of
 * Education school-DISTRICT polygons into public.boundaries under
 * geo_type='school_district'.
 *
 * Closes the ODE half of decision W2.7 ("park / school-district / trail GIS
 * polygons as new boundaries geo_types — county + ODE, authoritative only").
 * Before this, `boundaries` carried school ATTENDANCE areas (geo_type='school',
 * Deschutes County GIS) but no district polygon anywhere; the only ODE GeoJSON
 * consumer was the video producer scripts/build_school_district_overlay.py,
 * whose data source (data.oregon.gov Socrata dataset njfk-3inm) is DEAD — it
 * 404s today, which is why data/school-districts/ was never populated.
 *
 * ── SOURCE (authoritative, verified 2026-07-24) ──────────────────────────────
 * ODE item "School District Boundaries All"
 *   https://www.arcgis.com/home/item.html?id=147c1a54b8384d34bf38615e32216097
 *   owner savanah.solario_ode (Oregon Department of Education), public,
 *   last modified 2026-06-01. Its itemData binds layer id 2 of:
 *   https://services.arcgis.com/uUvqNMGPm7axC2dD/arcgis/rest/services/EDUCATIONAL_BOUNDARIES/FeatureServer
 *   layer 2 = "School Districts (Single Feature)" — one polygon per district,
 *   197 districts statewide, fields School_District_Id / School_Distirct_Name
 *   (the typo is in the source schema) / School_District_URL / effDate /
 *   cSteward. Reprojected to WGS84 by the service via outSR=4326.
 *
 * Per feedback_gis_authoritative_only NOTHING here is approximated, buffered,
 * hand-drawn or LLM-generated. The polygon written is byte-for-byte the ODE
 * ring set, converted from Esri rings to GeoJSON and stored by upsert_boundary
 * (ST_Multi + ST_SetSRID 4326).
 *
 * ── SCOPE (why 6 rows and not 197) ───────────────────────────────────────────
 * The site publishes district content only for the canonical districts in
 * data/co-schools.ts (the source of truth for /schools and its district
 * context lines). A boundary row for a district no surface renders is dead
 * data that rots. So scope = the registry, joined to ODE by an EXPLICIT,
 * hand-verified School_District_Id map (below) — never fuzzy name matching.
 * The importer re-asserts the ODE name for each id at fetch time and ABORTS if
 * ODE renamed or re-keyed a district, rather than silently writing the wrong
 * polygon under a right-looking slug.
 *
 * `gilchrist` is UNMATCHED on purpose: ODE has no Gilchrist school district
 * (verified — a statewide LIKE '%Gilchrist%' query on layer 2 returns zero
 * rows; Gilchrist School sits inside Klamath County SD, id 2057). Writing
 * Klamath County SD's polygon under a "Gilchrist School District" label would
 * be a false claim, so it gets no row. Absent beats approximated.
 *
 * ── §0 GUARD (a wrong district polygon is worse than none) ───────────────────
 * Every district must CONTAIN the interior point of the authoritative city
 * boundary we already publish for its seat (Census TIGER rows in
 * public.boundaries, geo_type='city', read live through the boundary_geojson
 * RPC — no hardcoded coordinates). A district whose anchor city falls outside
 * it is REJECTED and never written.
 *
 * Usage:
 *   node scripts/gis/import-ode-school-districts.mjs             # dry run + match report
 *   node scripts/gis/import-ode-school-districts.mjs --write     # upsert verified polygons
 *   node scripts/gis/import-ode-school-districts.mjs --snapshot  # refresh data/boundary-geo-types.json
 */
import fs from 'node:fs'

const UA = 'RyanRealtyGIS/1.0 (matt@ryan-realty.com)'
const ODE_ITEM = '147c1a54b8384d34bf38615e32216097'
const ODE_LAYER =
  'https://services.arcgis.com/uUvqNMGPm7axC2dD/arcgis/rest/services/EDUCATIONAL_BOUNDARIES/FeatureServer/2'
const PUBLISHER = 'Oregon Department of Education'
const GEO_TYPE = 'school_district'
const SNAPSHOT_PATH = new URL('./boundary-provenance-snapshot.json', import.meta.url)

const WRITE = process.argv.includes('--write')
const SNAPSHOT = process.argv.includes('--snapshot')

/**
 * ODE School_District_Id -> { registryKey, odeName, anchorCity }
 *
 * registryKey  key in the DISTRICTS object of data/co-schools.ts (supplies the
 *              geo_slug + geo_label, so boundary slugs match the URLs the site
 *              already uses).
 * odeName      the exact School_Distirct_Name ODE serves for that id. Mismatch
 *              at fetch time = abort (ODE re-keyed something).
 * anchorCity   geo_slug of the city boundary that must fall INSIDE the polygon.
 */
const ODE_DISTRICTS = {
  1970: { registryKey: 'crookCounty', odeName: 'Crook County SD', anchorCity: 'prineville' },
  1976: { registryKey: 'bendLaPine', odeName: 'Bend-LaPine Admin SD 1', anchorCity: 'bend' },
  1977: { registryKey: 'redmond', odeName: 'Redmond SD 2J', anchorCity: 'redmond' },
  1978: { registryKey: 'sisters', odeName: 'Sisters SD 6', anchorCity: 'sisters' },
  2050: { registryKey: 'culver', odeName: 'Culver SD 4', anchorCity: 'culver' },
  2053: { registryKey: 'jefferson', odeName: 'Jefferson County SD 509J', anchorCity: 'madras' },
}

// ── env ──────────────────────────────────────────────────────────────────────
function env() {
  const src = fs.readFileSync(new URL('../../.env.local', import.meta.url), 'utf8')
  const url = (src.match(/NEXT_PUBLIC_SUPABASE_URL=(.+)/) || [])[1]?.trim()
  const key = (src.match(/SUPABASE_SERVICE_ROLE_KEY=(.+)/) || [])[1]?.trim()
  if (!url || !key) throw new Error('.env.local missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY')
  return { url, key }
}

// ── registry ─────────────────────────────────────────────────────────────────
/** Parse the DISTRICTS block of data/co-schools.ts -> { key: {district, districtSlug} }. */
function loadDistrictRegistry() {
  const src = fs.readFileSync(new URL('../../data/co-schools.ts', import.meta.url), 'utf8')
  const out = {}
  const re = /(\w+):\s*\{\s*district:\s*'([^']+)',\s*districtSlug:\s*'([^']+)'\s*\}/g
  for (const m of src.matchAll(re)) out[m[1]] = { district: m[2], districtSlug: m[3] }
  return out
}

// ── geometry ─────────────────────────────────────────────────────────────────
/** Esri rings -> GeoJSON MultiPolygon coordinates. Esri exteriors wind clockwise. */
function esriRingsToPolygons(rings) {
  const area = (r) => {
    let a = 0
    for (let i = 0; i < r.length - 1; i++) a += r[i][0] * r[i + 1][1] - r[i + 1][0] * r[i][1]
    return a / 2
  }
  const polys = []
  for (const ring of rings || []) {
    if (area(ring) < 0) polys.push([ring])
    else if (polys.length) polys[polys.length - 1].push(ring)
    else polys.push([ring])
  }
  return polys
}

/** All outer rings of a GeoJSON Polygon | MultiPolygon. */
function outerRings(geom) {
  if (!geom) return []
  if (geom.type === 'Polygon') return [geom.coordinates[0]]
  if (geom.type === 'MultiPolygon') return geom.coordinates.map((p) => p[0])
  return []
}

/** Area-weighted centroid of the LARGEST outer ring (an interior point for compact city shapes). */
function representativePoint(geom) {
  const rings = outerRings(geom)
  if (!rings.length) return null
  let best = null
  let bestA = -1
  for (const ring of rings) {
    let a = 0
    let cx = 0
    let cy = 0
    for (let i = 0; i < ring.length - 1; i++) {
      const cross = ring[i][0] * ring[i + 1][1] - ring[i + 1][0] * ring[i][1]
      a += cross
      cx += (ring[i][0] + ring[i + 1][0]) * cross
      cy += (ring[i][1] + ring[i + 1][1]) * cross
    }
    a /= 2
    if (Math.abs(a) < 1e-12) continue
    const p = [cx / (6 * a), cy / (6 * a)]
    if (Math.abs(a) > bestA) {
      bestA = Math.abs(a)
      best = p
    }
  }
  return best
}

/** Ray-cast point-in-polygon over GeoJSON MultiPolygon coordinates (outer ring minus holes). */
function pointInPolygons(pt, polygons) {
  const [x, y] = pt
  const inRing = (ring) => {
    let inside = false
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [xi, yi] = ring[i]
      const [xj, yj] = ring[j]
      if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside
    }
    return inside
  }
  for (const poly of polygons) {
    if (!inRing(poly[0])) continue
    let hole = false
    for (let h = 1; h < poly.length; h++) if (inRing(poly[h])) hole = true
    if (!hole) return true
  }
  return false
}

// ── supabase ─────────────────────────────────────────────────────────────────
async function rpc(name, body) {
  const { url, key } = env()
  const res = await fetch(`${url}/rest/v1/rpc/${name}`, {
    method: 'POST',
    headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const text = await res.text()
  if (!res.ok) throw new Error(`${name} -> ${res.status} ${text.slice(0, 200)}`)
  return text ? JSON.parse(text) : null
}

async function cityGeometry(slug) {
  const gj = await rpc('boundary_geojson', { p_geo_type: 'city', p_geo_slug: slug })
  return gj ? JSON.parse(gj) : null
}

// ── snapshot (input for ci:boundary-provenance) ──────────────────────────────
/** Reduce a provenance string to the publisher it names. */
export function publisherOf(source) {
  return String(source || '')
    .split(/\s+—\s+|\s+\(|;/)[0]
    .trim()
}

async function writeSnapshot() {
  const { url, key } = env()
  const rows = []
  for (let offset = 0; ; offset += 1000) {
    const res = await fetch(
      `${url}/rest/v1/boundaries?select=geo_type,source&order=geo_type&limit=1000&offset=${offset}`,
      { headers: { apikey: key, Authorization: `Bearer ${key}` } },
    )
    if (!res.ok) throw new Error(`boundaries read ${res.status} ${(await res.text()).slice(0, 200)}`)
    const page = await res.json()
    rows.push(...page)
    if (page.length < 1000) break
  }
  const byType = {}
  const byPublisher = {}
  for (const r of rows) {
    const pub = publisherOf(r.source)
    const t = (byType[r.geo_type] ??= { rows: 0, publishers: {} })
    t.rows++
    t.publishers[pub] = (t.publishers[pub] ?? 0) + 1
    byPublisher[pub] = (byPublisher[pub] ?? 0) + 1
  }
  const geoTypes = {}
  for (const k of Object.keys(byType).sort()) {
    const pubs = {}
    for (const p of Object.keys(byType[k].publishers).sort()) pubs[p] = byType[k].publishers[p]
    geoTypes[k] = { rows: byType[k].rows, publishers: pubs }
  }
  const publishers = {}
  for (const p of Object.keys(byPublisher).sort()) publishers[p] = byPublisher[p]

  const out = {
    note:
      'Provenance snapshot of public.boundaries — the input to ci:boundary-provenance (scripts/check-boundary-provenance.mjs). ' +
      'OBSERVATIONS ONLY: the POLICY (which geo_types may exist, which publishers count as authoritative, the non-official ratchet caps) ' +
      'lives in the gate script, so refreshing this file can never loosen the policy. ' +
      'Refresh with: node scripts/gis/import-ode-school-districts.mjs --snapshot',
    query:
      // stat-source-ok: backfill/ingest progress count, used to size or verify the run. Never published.
      "select geo_type, source, count(*) from public.boundaries group by 1,2 -- read here via PostgREST select=geo_type,source (paged 1000); publisher = source split on ' — ' / ' (' / ';'",
    generatedAt: new Date().toISOString(),
    totalRows: rows.length,
    geoTypes,
    publishers,
  }
  fs.writeFileSync(SNAPSHOT_PATH, JSON.stringify(out, null, 2) + '\n')
  console.log(`snapshot written: ${rows.length} boundary rows across ${Object.keys(geoTypes).length} geo_types`)
  for (const [k, v] of Object.entries(geoTypes)) {
    const pubs = Object.entries(v.publishers).map(([p, n]) => `${p} (${n})`).join(' | ')
    console.log(`  ${k}: ${v.rows} rows · ${pubs}`)
  }
}

// ── main ─────────────────────────────────────────────────────────────────────
async function main() {
  if (SNAPSHOT) return writeSnapshot()

  const registry = loadDistrictRegistry()
  const ids = Object.keys(ODE_DISTRICTS)
  const mappedKeys = new Set(Object.values(ODE_DISTRICTS).map((d) => d.registryKey))
  const unmatchedRegistry = Object.keys(registry).filter((k) => !mappedKeys.has(k))

  const params = new URLSearchParams({
    where: `School_District_Id IN (${ids.join(',')})`,
    outFields: 'School_District_Id,School_Distirct_Name,School_District_URL,effDate,cSteward',
    returnGeometry: 'true',
    outSR: '4326',
    f: 'json',
  })
  const res = await fetch(`${ODE_LAYER}/query?${params}`, { headers: { 'User-Agent': UA } })
  const j = await res.json()
  if (j.error) throw new Error(`ODE query failed: ${JSON.stringify(j.error).slice(0, 300)}`)
  const feats = j.features || []
  console.log(`ODE layer 2 returned ${feats.length} of ${ids.length} requested districts\n`)
  if (feats.length !== ids.length) {
    throw new Error(`ABORT: expected ${ids.length} ODE districts, got ${feats.length}. ODE re-keyed the layer — re-verify ODE_DISTRICTS before writing.`)
  }

  const ok = []
  const rejected = []
  for (const f of feats) {
    const a = f.attributes || {}
    const id = a.School_District_Id
    const spec = ODE_DISTRICTS[id]
    const odeName = a.School_Distirct_Name
    if (odeName !== spec.odeName) {
      throw new Error(`ABORT: ODE id ${id} is now "${odeName}", map expects "${spec.odeName}". Re-verify before writing.`)
    }
    const reg = registry[spec.registryKey]
    if (!reg) throw new Error(`ABORT: data/co-schools.ts has no DISTRICTS.${spec.registryKey}`)

    const polygons = esriRingsToPolygons(f.geometry?.rings)
    if (!polygons.length) {
      rejected.push(`${odeName}: ODE returned no rings`)
      continue
    }

    // §0 anchor: the district must contain our authoritative city boundary's interior point.
    const cityGeom = await cityGeometry(spec.anchorCity)
    if (!cityGeom) {
      rejected.push(`${odeName}: no city boundary row for anchor "${spec.anchorCity}" — cannot verify`)
      continue
    }
    const anchor = representativePoint(cityGeom)
    if (!anchor) {
      rejected.push(`${odeName}: could not compute an interior point for anchor city "${spec.anchorCity}"`)
      continue
    }
    if (!pointInPolygons(anchor, polygons)) {
      rejected.push(
        `${odeName}: anchor city ${spec.anchorCity} (${anchor[1].toFixed(5)}, ${anchor[0].toFixed(5)}) is NOT inside the polygon`,
      )
      continue
    }

    const eff = a.effDate ? new Date(a.effDate).toISOString().slice(0, 10) : 'unknown'
    ok.push({
      slug: reg.districtSlug,
      label: reg.district,
      geojson: { type: 'MultiPolygon', coordinates: polygons },
      source: `${PUBLISHER} — School District Boundaries All (EDUCATIONAL_BOUNDARIES/2); ODE_ID=${id}, DISTRICT=${odeName}, effDate=${eff}, steward=${a.cSteward || 'n/a'}`,
      sourceUrl: `https://www.arcgis.com/home/item.html?id=${ODE_ITEM}`,
      note: `anchor ${spec.anchorCity} inside · ${polygons.length} polygon(s) · ${polygons.reduce((n, p) => n + p[0].length, 0)} outer vertices`,
    })
    console.log(`  VERIFIED ${odeName} (ODE ${id}) -> ${GEO_TYPE}/${reg.districtSlug} — ${ok[ok.length - 1].note}`)
  }

  if (rejected.length) {
    console.log(`\n${rejected.length} REJECTED (never written):`)
    for (const r of rejected) console.log(`  REJECT ${r}`)
  }
  if (unmatchedRegistry.length) {
    console.log(`\n${unmatchedRegistry.length} registry district(s) with no ODE polygon (no row written, by design):`)
    for (const k of unmatchedRegistry) {
      console.log(`  UNMATCHED ${registry[k].districtSlug} ("${registry[k].district}") — ODE publishes no district by this name`)
    }
  }

  if (!WRITE) {
    console.log(`\n(dry run — ${ok.length} verified. Pass --write to upsert, then --snapshot to refresh the gate input.)`)
    return
  }
  for (const d of ok) {
    await rpc('upsert_boundary', {
      p_geo_type: GEO_TYPE,
      p_geo_slug: d.slug,
      p_geo_label: d.label,
      p_geojson: d.geojson,
      p_source: d.source,
      p_source_url: d.sourceUrl,
    })
    // ODE ships Jefferson 509J with a ring self-intersection. An invalid polygon
    // breaks ST_Contains/ST_Intersects, so repair the TOPOLOGY — the RPC raises
    // rather than write anything whose area moved, so this can never reshape,
    // simplify or approximate the authoritative ring set.
    const repair = await rpc('repair_boundary_geometry', { p_geo_type: GEO_TYPE, p_geo_slug: d.slug })
    console.log(`  write ${GEO_TYPE}/${d.slug}: ok (${repair})`)
  }
  console.log(`\n${ok.length} district polygon(s) upserted. Now run --snapshot and commit data/boundary-geo-types.json.`)
}

main().catch((e) => {
  console.error('FATAL', e.message)
  process.exit(1)
})
