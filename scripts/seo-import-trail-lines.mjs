/**
 * seo-import-trail-lines.mjs — import authoritative trail route linework into
 * public.trail_lines, one MultiLineString per data/co-trails.ts slug.
 *
 * Source (phase 1): USFS National Forest System Trails (EDW Trans_Trail_NFS_
 * Publish) — the authoritative federal trail layer. GIS rule
 * (feedback_gis_authoritative_only): geometry MUST trace to an authoritative
 * source; never approximated. Non-USFS trails (Bend Park & Rec in-town trails,
 * Oregon State Parks Smith Rock, BLM Steelhead Falls) are phase 2 and keep a
 * trailhead point until their source linework is added here.
 *
 * §0 accuracy guard: the national layer has same-named trails in other forests,
 * so we keep only segments with a vertex within PROX_KM of the registry
 * trailhead and REJECT a trail whose nearest kept vertex is still > MAX_TH_KM
 * away (a sign the name matched the wrong place). Provenance (source, source_url,
 * verified_by) is written on every row.
 *
 * Usage:  node scripts/seo-import-trail-lines.mjs           # dry run (validate)
 *         node scripts/seo-import-trail-lines.mjs --write   # upsert the OK trails
 */
import fs from 'node:fs'

const UA = 'RyanRealtyGIS/1.0 (matt@ryan-realty.com)'
const USFS = 'https://apps.fs.usda.gov/arcx/rest/services/EDW/EDW_TrailNFSPublish_01/MapServer/0'
const PROX_KM = 6 // keep segments with a vertex within 6km of the trailhead
const MAX_TH_KM = 1.5 // reject if nearest kept vertex is farther than this
const WRITE = process.argv.includes('--write')

// registry slug -> { th:[lat,lng] (co-trails.ts trailhead), terms:[USFS trail_name LIKE terms] }
const USFS_TRAILS = {
  'south-sister-climber-trail': { th: [44.0349917, -121.7656861], terms: ['SOUTH SISTER CLIMBER'] },
  'green-lakes': { th: [44.030375, -121.7358389], terms: ['GREEN LAKES'] },
  'tumalo-mountain': { th: [43.9998528, -121.6637083], terms: ['TUMALO MOUNTAIN'] },
  'tumalo-falls': { th: [44.0318028, -121.5661556], terms: ['NORTH FORK', 'TUMALO FALLS'] },
  'benham-falls': { th: [43.9310306, -121.4132278], terms: ['DESCHUTES RIVER'] },
  'ray-atkeson-trail': { th: [44.013487, -121.736897], terms: ['RAY ATKESON'] },
  'peterson-ridge': { th: [44.280732, -121.549999], terms: ['PETERSON RIDGE'] },
  'alder-springs': { th: [44.423848, -121.364331], terms: ['ALDER SPRINGS'] },
  'gray-butte': { th: [44.428816, -121.09023], terms: ['GRAY BUTTE'] },
}

const R = 6371
const km = (aLat, aLng, bLat, bLng) => {
  const p = Math.PI / 180
  const dLat = (bLat - aLat) * p,
    dLng = (bLng - aLng) * p
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(aLat * p) * Math.cos(bLat * p) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(s))
}
const toLines = (g) => (!g ? [] : g.type === 'LineString' ? [g.coordinates] : g.type === 'MultiLineString' ? g.coordinates : [])

async function fetchSegments(term) {
  const params = new URLSearchParams({
    where: `trail_name LIKE '%${term}%'`,
    outFields: 'trail_name',
    returnGeometry: 'true',
    outSR: '4326',
    f: 'geojson',
    resultRecordCount: '400',
  })
  const j = await (await fetch(`${USFS}/query?${params}`, { headers: { 'User-Agent': UA } })).json()
  return j.features || []
}

async function main() {
  const validated = {}
  for (const [slug, { th, terms }] of Object.entries(USFS_TRAILS)) {
    const [thLat, thLng] = th
    const kept = []
    const names = new Set()
    for (const term of terms) {
      let feats = []
      try {
        feats = await fetchSegments(term)
      } catch (e) {
        console.log(`  ${slug}: fetch err ${e.message}`)
      }
      for (const f of feats) {
        for (const line of toLines(f.geometry)) {
          let near = Infinity
          for (const [lng, lat] of line) near = Math.min(near, km(thLat, thLng, lat, lng))
          if (near <= PROX_KM) {
            kept.push(line)
            names.add(f.properties?.trail_name)
          }
        }
      }
    }
    let nearest = Infinity
    for (const line of kept) for (const [lng, lat] of line) nearest = Math.min(nearest, km(thLat, thLng, lat, lng))
    const ok = kept.length > 0 && nearest <= MAX_TH_KM
    console.log(`${ok ? 'OK  ' : 'SKIP'} ${slug}: ${kept.length} seg / nearest ${nearest === Infinity ? '∞' : nearest.toFixed(2)}km / ${[...names].join(', ') || '—'}`)
    if (ok)
      validated[slug] = {
        geojson: { type: 'MultiLineString', coordinates: kept },
        source: `USFS National Forest System Trails (Trans_Trail_NFS_Publish); segments: ${[...names].join(', ')}`,
        source_url: USFS,
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
