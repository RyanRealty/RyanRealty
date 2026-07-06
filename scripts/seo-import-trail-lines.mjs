/**
 * seo-import-trail-lines.mjs — import authoritative trail route linework into
 * public.trail_lines, one MultiLineString per data/co-trails.ts slug.
 *
 * Sources (all authoritative, all reprojected to WGS84 via outSR=4326):
 *   - USFS  National Forest System Trails (EDW Trans_Trail_NFS_Publish)
 *   - BPR   Bend Metro Park & Recreation District trails (BPRD_Trails_Public)
 *   - BLM   National GTLF nonmechanized trails (Oregon)
 * GIS rule (feedback_gis_authoritative_only): geometry MUST trace to an
 * authoritative source; never approximated. Trails with no authoritative REST
 * endpoint (Smith Rock — OPRD publishes only a PDF; Whoops — COTA-built, not in
 * the USFS federal layer; Pilot Butte summit — OPRD, no endpoint) keep a
 * trailhead point until a source is added here. Never a guessed line.
 *
 * §0 accuracy guard: keep only segments with a vertex within PROX_KM of the
 * registry trailhead, and REJECT a trail whose nearest kept vertex is still
 * > MAX_TH_KM away (guards against same-named trails elsewhere). Provenance
 * (source, source_url, verified_by) is written on every row.
 *
 * Usage:  node scripts/seo-import-trail-lines.mjs           # dry run (validate)
 *         node scripts/seo-import-trail-lines.mjs --write   # upsert the OK trails
 */
import fs from 'node:fs'

const UA = 'RyanRealtyGIS/1.0 (matt@ryan-realty.com)'
const PROX_KM = 6
const MAX_TH_KM = 1.5
const WRITE = process.argv.includes('--write')

const SOURCES = {
  usfs: {
    label: 'USFS National Forest System Trails (Trans_Trail_NFS_Publish)',
    url: 'https://apps.fs.usda.gov/arcx/rest/services/EDW/EDW_TrailNFSPublish_01/MapServer/0/query',
    nameField: 'trail_name',
  },
  bpr: {
    label: 'Bend Metro Park & Recreation District trails (BPRD_Trails_Public, All_Trails_2020)',
    url: 'https://services9.arcgis.com/nday1XDJ2wHr7eJc/arcgis/rest/services/BPRD_Trails_Public/FeatureServer/0/query',
    nameField: 'Trail_Name',
  },
  blm: {
    label: 'BLM National GTLF nonmechanized trails (Oregon)',
    url: 'https://services1.arcgis.com/KbxwQRRfWyEYLgp4/arcgis/rest/services/BLM_Natl_GTLF_Public_Nonmechanized_Trails/FeatureServer/5/query',
    nameField: 'ROUTE_PRMRY_NM',
    extraWhere: "ADMIN_ST = 'OR'",
  },
}

// slug -> { th:[lat,lng] (co-trails.ts trailhead), src, terms }
const TRAILS = {
  // USFS
  'south-sister-climber-trail': { th: [44.0349917, -121.7656861], src: 'usfs', terms: ['SOUTH SISTER CLIMBER'] },
  'green-lakes': { th: [44.030375, -121.7358389], src: 'usfs', terms: ['GREEN LAKES'] },
  'tumalo-mountain': { th: [43.9998528, -121.6637083], src: 'usfs', terms: ['TUMALO MOUNTAIN'] },
  'tumalo-falls': { th: [44.0318028, -121.5661556], src: 'usfs', terms: ['NORTH FORK', 'TUMALO FALLS'] },
  'benham-falls': { th: [43.9310306, -121.4132278], src: 'usfs', terms: ['DESCHUTES RIVER'] },
  'ray-atkeson-trail': { th: [44.013487, -121.736897], src: 'usfs', terms: ['RAY ATKESON'] },
  'peterson-ridge': { th: [44.280732, -121.549999], src: 'usfs', terms: ['PETERSON RIDGE'] },
  'alder-springs': { th: [44.423848, -121.364331], src: 'usfs', terms: ['ALDER SPRINGS'] },
  'gray-butte': { th: [44.428816, -121.09023], src: 'usfs', terms: ['GRAY BUTTE'] },
  // 'PHIL' not "PHIL'S" (apostrophe breaks the ArcGIS LIKE); proximity keeps the complex.
  'phils-trail': { th: [44.044608, -121.384984], src: 'usfs', terms: ['PHIL'] },
  // BPR (Bend Park & Rec in-town)
  // The registry entry is the River Run Reach specifically (not the whole 15-mi
  // DRT), so match that reach + its First St connector.
  'deschutes-river-trail-first-street': { th: [44.067515, -121.313723], src: 'bpr', terms: ['RIVER RUN REACH', '1ST ST CONNECTOR'] },
  'shevlin-park': { th: [44.082648, -121.378386], src: 'bpr', terms: ['SHEVLIN'] },
  'sawyer-park': { th: [44.085933, -121.308777], src: 'bpr', terms: ['SAWYER'] },
  'riley-ranch': { th: [44.095967, -121.326886], src: 'bpr', terms: ['RILEY RANCH'] },
  // BLM
  'steelhead-falls': { th: [44.411145, -121.2927], src: 'blm', terms: ['STEELHEAD'] },
}

const R = 6371
const km = (aLat, aLng, bLat, bLng) => {
  const p = Math.PI / 180, dLat = (bLat - aLat) * p, dLng = (bLng - aLng) * p
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(aLat * p) * Math.cos(bLat * p) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(s))
}
const toLines = (g) => (!g ? [] : g.type === 'LineString' ? [g.coordinates] : g.type === 'MultiLineString' ? g.coordinates : [])

async function fetchSegments(src, term) {
  const nf = src.nameField
  const where = `UPPER(${nf}) LIKE '%${term}%'` + (src.extraWhere ? ` AND ${src.extraWhere}` : '')
  const params = new URLSearchParams({ where, outFields: nf, returnGeometry: 'true', outSR: '4326', f: 'geojson', resultRecordCount: '600' })
  const j = await (await fetch(`${src.url}?${params}`, { headers: { 'User-Agent': UA } })).json()
  return (j.features || []).map((f) => ({ name: f.properties?.[nf], geometry: f.geometry }))
}

async function main() {
  const validated = {}
  for (const [slug, { th, src, terms }] of Object.entries(TRAILS)) {
    const source = SOURCES[src]
    const [thLat, thLng] = th
    const kept = []
    const names = new Set()
    for (const term of terms) {
      let feats = []
      try {
        feats = await fetchSegments(source, term)
      } catch (e) {
        console.log(`  ${slug}: fetch err ${e.message}`)
      }
      for (const f of feats) {
        for (const line of toLines(f.geometry)) {
          let near = Infinity
          for (const [lng, lat] of line) near = Math.min(near, km(thLat, thLng, lat, lng))
          if (near <= PROX_KM) {
            kept.push(line)
            if (f.name) names.add(f.name)
          }
        }
      }
    }
    let nearest = Infinity
    for (const line of kept) for (const [lng, lat] of line) nearest = Math.min(nearest, km(thLat, thLng, lat, lng))
    const ok = kept.length > 0 && nearest <= MAX_TH_KM
    console.log(`${ok ? 'OK  ' : 'SKIP'} [${src}] ${slug}: ${kept.length} seg / nearest ${nearest === Infinity ? '∞' : nearest.toFixed(2)}km / ${[...names].join(', ') || '—'}`)
    if (ok)
      validated[slug] = {
        geojson: { type: 'MultiLineString', coordinates: kept },
        source: `${source.label}; segments: ${[...names].join(', ')}`,
        source_url: source.url.replace('/query', ''),
        verified_by: `proximity<=${MAX_TH_KM}km to registry trailhead (nearest ${nearest.toFixed(2)}km)`,
      }
  }

  if (!WRITE) {
    console.log(`\n${Object.keys(validated).length} trails validated (dry run — pass --write to upsert)`)
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
