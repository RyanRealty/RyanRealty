#!/usr/bin/env node
/**
 * Geo-assign every west side Bend property to its city / neighborhood /
 * subdivision / planned community via Supabase boundaries (PostGIS).
 *
 * Calls the `public.geo_assign_batch(jsonb)` RPC (created via migration
 * 20260526_geo_assign_batch_rpc) over PostgREST with SUPABASE_SERVICE_ROLE_KEY.
 *
 * Input: out/westside-bend-merge/01-master-local-enriched.csv
 *        (already carries latitude + longitude from county records)
 * Output: out/westside-bend-merge/02-master-geo-enriched.csv
 *         out/westside-bend-merge/summary-geo-assign.json
 *
 * Usage:
 *   node --env-file=.env.local scripts/westside-bend-geo-assign.mjs
 */

import { readFile, writeFile } from 'node:fs/promises'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')
const INPUT = resolve(ROOT, 'out/westside-bend-merge/01-master-local-enriched.csv')
const OUTPUT = resolve(ROOT, 'out/westside-bend-merge/02-master-geo-enriched.csv')
const SUMMARY = resolve(ROOT, 'out/westside-bend-merge/summary-geo-assign.json')
const COMMUNITIES_JSON = resolve(ROOT, 'data/resort-communities.json')

const SB_URL = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
const SB_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
if (!SB_URL || !SB_KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const BATCH_SIZE = 150
const MAX_RETRIES = 4

// -------- CSV --------

function parseCsv(text) {
  const rows = []
  let row = []
  let field = ''
  let inQuotes = false
  let i = 0
  while (i < text.length) {
    const c = text[i]
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i += 2; continue }
        inQuotes = false; i += 1; continue
      }
      field += c; i += 1; continue
    }
    if (c === '"') { inQuotes = true; i += 1; continue }
    if (c === ',') { row.push(field); field = ''; i += 1; continue }
    if (c === '\r') { i += 1; continue }
    if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; i += 1; continue }
    field += c; i += 1
  }
  if (field.length > 0 || row.length > 0) { row.push(field); rows.push(row) }
  return rows
}

function csvEscape(value) {
  const s = value == null ? '' : String(value)
  if (/[",\r\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`
  return s
}

function rowsToCsv(headers, rows) {
  const out = [headers.map(csvEscape).join(',')]
  for (const r of rows) out.push(headers.map((h) => csvEscape(r[h])).join(','))
  return out.join('\n') + '\n'
}

// -------- PostgREST RPC --------

async function callGeoAssignBatch(points) {
  const url = `${SB_URL.replace(/\/+$/, '')}/rest/v1/rpc/geo_assign_batch`
  let lastErr = null
  for (let attempt = 0; attempt < MAX_RETRIES; attempt += 1) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          apikey: SB_KEY,
          Authorization: `Bearer ${SB_KEY}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({ points }),
      })
      if (res.ok) return res.json()
      const text = await res.text().catch(() => '')
      lastErr = new Error(`RPC HTTP ${res.status}: ${text.slice(0, 200)}`)
      if (res.status !== 504 && res.status !== 502 && res.status !== 503) throw lastErr
    } catch (err) {
      lastErr = err
    }
    const backoff = 1500 * Math.pow(2, attempt)
    console.warn(`[geo-assign] retry ${attempt + 1}/${MAX_RETRIES} after ${backoff}ms — ${lastErr.message}`)
    await new Promise((r) => setTimeout(r, backoff))
  }
  throw lastErr
}

// -------- Planned community map --------

function normalizeSubdivision(s) {
  return String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

async function loadPlannedCommunityIndex() {
  const json = JSON.parse(await readFile(COMMUNITIES_JSON, 'utf8'))
  const byAliasNorm = new Map()
  const byCommunitySlug = new Map()
  for (const c of json.communities || []) {
    byCommunitySlug.set(c.slug, { slug: c.slug, label: c.label, city_slug: c.city_slug })
    for (const alias of c.subdivision_aliases || []) {
      const key = normalizeSubdivision(alias)
      byAliasNorm.set(key, { slug: c.slug, label: c.label })
    }
  }
  return { byAliasNorm, byCommunitySlug }
}

// -------- Main --------

async function main() {
  const csvText = await readFile(INPUT, 'utf8')
  const allRows = parseCsv(csvText)
  const headers = allRows.shift() || []
  const headerIdx = new Map(headers.map((h, i) => [h, i]))
  console.log(`[geo-assign] CSV rows: ${allRows.length}`)

  const { byAliasNorm, byCommunitySlug } = await loadPlannedCommunityIndex()

  const points = []
  for (let i = 0; i < allRows.length; i += 1) {
    const r = allRows[i]
    if (r.length < 5) continue
    const lat = Number(r[headerIdx.get('latitude')])
    const lon = Number(r[headerIdx.get('longitude')])
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue
    points.push({ idx: i, lon, lat })
  }
  console.log(`[geo-assign] Points with valid lat/lng: ${points.length}`)

  const matches = new Map() // idx -> [{geo_type, geo_slug, geo_label, area_m2}]
  for (let off = 0; off < points.length; off += BATCH_SIZE) {
    const batch = points.slice(off, off + BATCH_SIZE)
    const t0 = Date.now()
    const rows = await callGeoAssignBatch(batch)
    for (const row of rows) {
      const k = Number(row.idx)
      if (!matches.has(k)) matches.set(k, [])
      matches.get(k).push({
        geo_type: row.geo_type,
        geo_slug: row.geo_slug,
        geo_label: row.geo_label,
        area_m2: Number(row.area_m2),
      })
    }
    console.log(`[geo-assign] batch ${off}-${off + batch.length} (${rows.length} hits, ${Date.now() - t0}ms)`)
  }

  const newColumns = [
    'city_slug',
    'neighborhood_slug',
    'neighborhood_label',
    'neighborhoods_all',
    'subdivision_slug',
    'subdivision_label',
    'planned_community_slug',
    'planned_community_label',
    'geo_assign_method',
  ]
  const outHeaders = [...headers, ...newColumns]
  const outRows = []
  const stats = {
    total: 0,
    geo_assigned: 0,
    city_matched: 0,
    neighborhood_matched: 0,
    subdivision_matched: 0,
    planned_community_matched: 0,
    by_city: {},
    by_neighborhood: {},
    by_planned_community: {},
    no_lat_lng: 0,
    no_polygon_match: 0,
  }

  for (let i = 0; i < allRows.length; i += 1) {
    const r = allRows[i]
    if (r.length < 5) continue
    const rowObj = Object.fromEntries(headers.map((h, j) => [h, r[j] ?? '']))
    stats.total += 1

    const lat = Number(r[headerIdx.get('latitude')])
    const lon = Number(r[headerIdx.get('longitude')])
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
      stats.no_lat_lng += 1
      outRows.push({ ...rowObj, geo_assign_method: 'no_lat_lng' })
      continue
    }

    const hits = matches.get(i) || []
    if (hits.length === 0) {
      stats.no_polygon_match += 1
      outRows.push({ ...rowObj, geo_assign_method: 'no_polygon_match' })
      continue
    }
    stats.geo_assigned += 1

    const cities = hits.filter((h) => h.geo_type === 'city')
    const neighborhoods = hits.filter((h) => h.geo_type === 'neighborhood').sort((a, b) => a.area_m2 - b.area_m2)
    const subdivisions = hits.filter((h) => h.geo_type === 'subdivision').sort((a, b) => a.area_m2 - b.area_m2)

    const city_slug = cities[0]?.geo_slug || ''
    const neighborhood = neighborhoods[0] || null
    const subdivision = subdivisions[0] || null

    if (city_slug) {
      stats.city_matched += 1
      stats.by_city[city_slug] = (stats.by_city[city_slug] || 0) + 1
    }
    if (neighborhood) {
      stats.neighborhood_matched += 1
      stats.by_neighborhood[neighborhood.geo_slug] = (stats.by_neighborhood[neighborhood.geo_slug] || 0) + 1
    }
    if (subdivision) stats.subdivision_matched += 1

    let pc = null
    if (subdivision) {
      const aliasKey = normalizeSubdivision(subdivision.geo_label)
      const aliasMatch = byAliasNorm.get(aliasKey)
      if (aliasMatch) pc = aliasMatch
    }
    if (!pc) {
      for (const nb of neighborhoods) {
        const direct = byCommunitySlug.get(nb.geo_slug)
        if (direct) { pc = { slug: direct.slug, label: direct.label }; break }
      }
    }
    if (pc) {
      stats.planned_community_matched += 1
      stats.by_planned_community[pc.slug] = (stats.by_planned_community[pc.slug] || 0) + 1
    }

    outRows.push({
      ...rowObj,
      city_slug,
      neighborhood_slug: neighborhood?.geo_slug || '',
      neighborhood_label: neighborhood?.geo_label || '',
      neighborhoods_all: neighborhoods.map((n) => n.geo_slug).join('; '),
      subdivision_slug: subdivision?.geo_slug || '',
      subdivision_label: subdivision?.geo_label || '',
      planned_community_slug: pc?.slug || '',
      planned_community_label: pc?.label || '',
      geo_assign_method: 'postgis',
    })
  }

  await writeFile(OUTPUT, rowsToCsv(outHeaders, outRows), 'utf8')
  await writeFile(SUMMARY, JSON.stringify(stats, null, 2), 'utf8')

  console.log('[geo-assign] === Summary ===')
  console.log(`  Total              : ${stats.total}`)
  console.log(`  Geo-assigned       : ${stats.geo_assigned}`)
  console.log(`  City matched       : ${stats.city_matched}`)
  console.log(`  Neighborhood match : ${stats.neighborhood_matched}`)
  console.log(`  Subdivision match  : ${stats.subdivision_matched}`)
  console.log(`  Planned community  : ${stats.planned_community_matched}`)
  console.log(`  No lat/lng         : ${stats.no_lat_lng}`)
  console.log(`  No polygon match   : ${stats.no_polygon_match}`)
  console.log('[geo-assign] By city:')
  for (const [k, v] of Object.entries(stats.by_city).sort((a, b) => b[1] - a[1])) {
    console.log(`    ${k.padEnd(18)} ${v}`)
  }
  console.log('[geo-assign] By neighborhood:')
  for (const [k, v] of Object.entries(stats.by_neighborhood).sort((a, b) => b[1] - a[1])) {
    console.log(`    ${k.padEnd(28)} ${v}`)
  }
  console.log('[geo-assign] By planned community:')
  for (const [k, v] of Object.entries(stats.by_planned_community).sort((a, b) => b[1] - a[1])) {
    console.log(`    ${k.padEnd(28)} ${v}`)
  }
  console.log(`[geo-assign] Output: ${OUTPUT}`)
}

main().catch((err) => {
  console.error('[geo-assign] FATAL:', err.message)
  console.error(err.stack)
  process.exit(1)
})
