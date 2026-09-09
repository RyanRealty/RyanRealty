#!/usr/bin/env node
/**
 * SITE-58 — a county's own recorded-subdivision polygons into public.boundaries
 * (geo_type='subdivision'). Official GIS only (feedback_gis_authoritative_only).
 * A hull around listing points is not a plat and is never written.
 *
 * Crook County publishes Public/LandGroup/MapServer/7 as "Sudivisions" (the
 * county's spelling; keywords say Subdivisions). Measured 2026-09-09: 211
 * named polygons. Brasada Ranch is OBJECTID 186 (888 acres). Ochoco Pointe is
 * OBJECTID 8 (59.5 acres, notes "PHASE 1, 2, 3, 4 & SOUTH"). Crooked River
 * Ranch is not on the layer — UPPER(name) LIKE '%CROOKED%' / '%CCR%' /
 * '%RIVER RANCH%' all return zero of 211. That community sits on the
 * Crook/Jefferson line; Crook does not publish it as a subdivision.
 *
 * Jefferson County, Oregon: the GIS page (jeffersoncountyor.gov/gis) sells
 * data; the public web map is "temporarily unavailable"; maps.co.jefferson.or.us
 * times out; gis.jeffersoncountyor.gov and maps.jeffersoncountyor.gov 302 with
 * no REST services directory. No recorded-plat layer is published. Haystack
 * Butte (Madras side) and Crooked River Ranch therefore stay on SITE-56's
 * no-polygon path until the county publishes one.
 *
 * Klamath County: the org we already pull taxlots from
 * (services.arcgis.com/H6Mh1bySxR4oHx6x) publishes KC_Taxlots, KC_Surveys
 * (10,571 survey-document polygons; SURVEY_TYPE mix ROS/CAD/LP/PLA/SUB/ODOT)
 * and SPR_Submissions. There is no subdivision plat layer on the live catalog
 * (KC_Subdivision from an old search 404s). Survey sheet extents are not plats.
 *
 * Usage:
 *   node scripts/gis/import-county-subdivisions.mjs --county crook
 *   node scripts/gis/import-county-subdivisions.mjs --county crook --write
 *   node scripts/gis/import-county-subdivisions.mjs --findings
 *
 * After --write: node scripts/gis/import-ode-school-districts.mjs --snapshot
 * then raise the subdivision floor in scripts/check-boundary-provenance.mjs.
 */
import { createClient } from '@supabase/supabase-js'
import { config as loadEnv } from 'dotenv'

loadEnv({ path: '.env.local' })
loadEnv()

const UA = 'RyanRealtyGIS/1.0 (matt@ryan-realty.com)'
const WRITE = process.argv.includes('--write')
const FINDINGS = process.argv.includes('--findings')
const args = process.argv.slice(2)
function arg(name, fallback = null) {
  const i = args.indexOf(`--${name}`)
  return i >= 0 && args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : fallback
}
const COUNTY = (arg('county', 'crook') || '').toLowerCase()

const COUNTIES = {
  crook: {
    label: 'Crook',
    url: 'https://gis.crookcountyor.gov/server/rest/services/Public/LandGroup/MapServer/7',
    source: 'Crook County GIS Subdivisions',
    nameField: 'name',
    notesField: 'notes',
    oidField: 'OBJECTID',
    pageSize: 200,
  },
}

/** Same function as lib/slug.ts — keep byte-identical so MLS names resolve. */
function slugify(name) {
  return (
    name
      .trim()
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, '')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '') || 'unknown'
  )
}

function displayLabel(name) {
  const s = String(name || '').trim()
  if (!s) return s
  return s.toLowerCase().replace(/(^|[\s/-])([a-z])/g, (_, a, b) => a + b.toUpperCase())
}

function esriRingsToMultiPolygon(rings) {
  const area = (r) => {
    let a = 0
    for (let i = 0; i < r.length - 1; i++) a += r[i][0] * r[i + 1][1] - r[i + 1][0] * r[i][1]
    return a / 2
  }
  const polys = []
  for (const ring of rings || []) {
    if (!ring || ring.length < 4) continue
    if (area(ring) < 0) polys.push([ring])
    else if (polys.length) polys[polys.length - 1].push(ring)
    else polys.push([ring])
  }
  return { type: 'MultiPolygon', coordinates: polys }
}

const SQFT_PER_SQMI = 27_878_400
const SQFT_PER_ACRE = 43_560

async function fetchJson(url) {
  const res = await fetch(url, { headers: { 'User-Agent': UA } })
  const text = await res.text()
  if (!res.ok) throw new Error(`${url} -> ${res.status} ${text.slice(0, 200)}`)
  return JSON.parse(text)
}

async function fetchLayer(county) {
  const features = []
  let offset = 0
  for (;;) {
    const params = new URLSearchParams({
      where: '1=1',
      outFields: [county.oidField, county.nameField, county.notesField, 'Shape.STArea()']
        .filter(Boolean)
        .join(','),
      returnGeometry: 'true',
      outSR: '4326',
      resultOffset: String(offset),
      resultRecordCount: String(county.pageSize),
      f: 'json',
    })
    const page = await fetchJson(`${county.url}/query?${params}`)
    if (page.error) throw new Error(`layer query: ${JSON.stringify(page.error)}`)
    const feats = page.features || []
    features.push(...feats)
    if (feats.length < county.pageSize) break
    offset += feats.length
  }
  return features
}

async function existingSubdivisionSlugs(sb) {
  const slugs = new Set()
  for (let from = 0; ; from += 1000) {
    const { data, error } = await sb
      .from('boundaries')
      .select('geo_slug')
      .eq('geo_type', 'subdivision')
      .range(from, from + 999)
    if (error) throw error
    for (const r of data || []) if (r.geo_slug) slugs.add(r.geo_slug)
    if ((data || []).length < 1000) break
  }
  return slugs
}

function printFindings() {
  console.log(`SITE-58 county catalog, probed 2026-09-09

Crook
  REST: https://gis.crookcountyor.gov/server/rest/services (OpenData, Public, surveys)
  Recorded-subdivision layer: Public/LandGroup/MapServer/7 "Sudivisions"
  Count: 211 named polygons. Brasada Ranch and Ochoco Pointe present.
  Crooked River Ranch: not on the layer (0 of 211).
  Surveys/MapServer type=SUBDIV is 28 survey filings, not the complete plat set.

Jefferson
  GIS page sells data. Public web map "temporarily unavailable".
  maps.co.jefferson.or.us timed out. gis.jeffersoncountyor.gov / maps.jeffersoncountyor.gov
  302 with no REST services directory. No recorded-plat layer published.

Klamath
  Org https://services.arcgis.com/H6Mh1bySxR4oHx6x — KC_Taxlots, KC_Surveys
  (10,571 survey-document polygons), SPR_Submissions. No subdivision plat layer.
  KC_Subdivision from an old search is not on the live catalog.

Josephine
  Taxlots only (already ingested). No subdivision plat layer found.
`)
}

async function main() {
  if (FINDINGS) {
    printFindings()
    return
  }

  const county = COUNTIES[COUNTY]
  if (!county) {
    console.error(`unknown county "${COUNTY}". Known: ${Object.keys(COUNTIES).join(', ')}`)
    process.exit(1)
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY')
  const sb = createClient(url, key)

  const feats = await fetchLayer(county)
  console.log(`${county.label} layer features: ${feats.length} from ${county.url}`)

  const grouped = new Map()
  let skippedNoName = 0
  let skippedNoGeom = 0
  for (const f of feats) {
    const attrs = f.attributes || {}
    const rawName = String(attrs[county.nameField] || '').trim()
    if (!rawName) {
      skippedNoName++
      continue
    }
    const rings = f.geometry?.rings
    const mp = esriRingsToMultiPolygon(rings)
    if (!mp.coordinates.length) {
      skippedNoGeom++
      continue
    }
    const slug = slugify(rawName)
    const areaSqFt = Number(attrs['Shape.STArea()'] ?? attrs['Shape.STArea'] ?? 0)
    let g = grouped.get(slug)
    if (!g) {
      g = {
        slug,
        name: rawName,
        label: displayLabel(rawName),
        oids: [],
        notes: [],
        coords: [],
        areaSqFt: 0,
      }
      grouped.set(slug, g)
    }
    g.oids.push(attrs[county.oidField])
    const notes = String(attrs[county.notesField] || '').trim()
    if (notes && notes !== ' ' && !g.notes.includes(notes)) g.notes.push(notes)
    g.coords.push(...mp.coordinates)
    g.areaSqFt += Number.isFinite(areaSqFt) ? areaSqFt : 0
  }
  console.log(`grouped slugs: ${grouped.size}  no-name: ${skippedNoName}  no-geom: ${skippedNoGeom}`)

  const existing = await existingSubdivisionSlugs(sb)
  console.log(`existing subdivision slugs in boundaries: ${existing.size}`)

  const toWrite = []
  const collisions = []
  const oversized = []
  for (const g of [...grouped.values()].sort((a, b) => a.slug.localeCompare(b.slug))) {
    const acres = g.areaSqFt / SQFT_PER_ACRE
    const sqmi = g.areaSqFt / SQFT_PER_SQMI
    if (sqmi >= 1) oversized.push({ slug: g.slug, acres: Math.round(acres), sqmi: +sqmi.toFixed(2) })
    if (existing.has(g.slug)) {
      collisions.push(g.slug)
      continue
    }
    const oidList = g.oids.join(',')
    const noteBit = g.notes.length ? `; notes=${g.notes.join(' | ')}` : ''
    toWrite.push({
      slug: g.slug,
      label: g.label,
      geojson: { type: 'MultiPolygon', coordinates: g.coords },
      source: `${county.source} (LandGroup/7 OBJECTID=${oidList}${noteBit})`,
      acres: Math.round(acres),
    })
  }

  const targets = ['brasada-ranch', 'ochoco-pointe', 'crooked-river-ranch']
  console.log('\nSITE-58 targets:')
  for (const t of targets) {
    const g = grouped.get(t)
    const w = toWrite.find((r) => r.slug === t)
    if (!g) console.log(`  ${t}: NOT ON LAYER`)
    else if (existing.has(t)) console.log(`  ${t}: already in boundaries, skip (${g.name}, ${Math.round(g.areaSqFt / SQFT_PER_ACRE)} ac)`)
    else console.log(`  ${t}: WRITE ${g.name} ${w?.acres} ac OBJECTID=${g.oids.join(',')}`)
  }

  console.log(`\nwill insert: ${toWrite.length}`)
  console.log(`slug collisions with existing Deschutes (skipped): ${collisions.length}`)
  if (collisions.length) console.log(`  ${collisions.join(' ')}`)
  console.log(`≥1 sq mi (recorded rural plats, still ingested): ${oversized.length}`)
  for (const o of oversized.sort((a, b) => b.acres - a.acres).slice(0, 12)) {
    console.log(`  ${o.acres} ac  ${o.sqmi} sqmi  ${o.slug}`)
  }

  if (!WRITE) {
    console.log('\n(dry run — pass --write to upsert)')
    return
  }

  let ok = 0
  let fail = 0
  for (const row of toWrite) {
    const { error } = await sb.rpc('upsert_boundary', {
      p_geo_type: 'subdivision',
      p_geo_slug: row.slug,
      p_geo_label: row.label,
      p_geojson: row.geojson,
      p_source: row.source,
      p_source_url: county.url,
    })
    if (error) {
      fail++
      console.error(`  FAIL ${row.slug}: ${error.message}`)
      continue
    }
    ok++
    if (ok % 25 === 0) console.log(`  wrote ${ok}/${toWrite.length}`)
  }
  console.log(`wrote ${ok}, failed ${fail}`)
  console.log('next: node scripts/gis/import-ode-school-districts.mjs --snapshot')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
