#!/usr/bin/env node
/**
 * Imports the authoritative City of Bend GIS neighborhood polygons from
 * data/bend-neighborhood-districts.geojson into:
 *   - public.boundaries (geo_type='neighborhood', geo_slug='bend-{slug}', polygon as MultiPolygon)
 *   - public.neighborhoods (denorm copy in boundary_geojson, plus provenance metadata)
 *
 * Calls the server-side RPC import_bend_neighborhood_boundary(slug, geojson_text, source, source_url, verified_by)
 * which does both UPDATEs atomically inside one transaction per neighborhood.
 *
 * Replaces all 14 polygons in one run (13 named + 1 Undesignated). Idempotent.
 *
 * Why: a prior session fabricated 4 polygons (Awbrey Butte, Boyd Acres, River West,
 * Summit West) and the boundaries table also has minor drift on others (Boyd Acres +26%,
 * Old Bend +13%). This script restores the canonical City of Bend GIS shapes.
 *
 * Reference: docs/seo-neighborhood-polygon-fix-2026-05-14.md
 *            ~/.claude/projects/-Users-matthewryan-RyanRealty/memory/feedback_gis_authoritative_only.md
 *
 * Usage: node --env-file=.env.local scripts/seo-import-bend-neighborhood-boundaries.mjs
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'

const SOURCE_FILE = '/Users/matthewryan/RyanRealty/data/bend-neighborhood-districts.geojson'
const SOURCE_NAME = 'City of Bend GIS — Neighborhood Districts'
const SOURCE_URL = 'https://bend-data-portal-bendoregon.hub.arcgis.com/datasets/bendoregon::neighborhood-districts/about'
const VERIFIED_BY = 'agent:372a116e (City of Bend GIS authoritative GeoJSON, validated by Acres property matching ST_Area within 1%)'

function slugify(name) {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    console.error('NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY required')
    process.exit(1)
  }
  const supabase = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const raw = readFileSync(SOURCE_FILE, 'utf-8')
  const fc = JSON.parse(raw)
  if (fc.type !== 'FeatureCollection' || !Array.isArray(fc.features)) {
    throw new Error('Not a FeatureCollection')
  }

  console.log(`Loaded ${fc.features.length} features from ${SOURCE_FILE}`)

  let undesignatedIdx = 0
  const results = []
  for (const feat of fc.features) {
    const name = feat.properties?.NAME
    if (!name) continue
    let slug = slugify(name)
    if (slug === 'undesignated') {
      undesignatedIdx += 1
      if (undesignatedIdx > 1) {
        console.log(`  SKIP: Undesignated #${undesignatedIdx} (OBJECTID=${feat.properties.OBJECTID}) — boundaries only has 1 bend-undesignated row`)
        continue
      }
    }

    const objectId = feat.properties.OBJECTID
    const acres = feat.properties.Acres
    const lastEdited = feat.properties.last_edited_date || 'unknown'

    const sourceCitation = `${SOURCE_NAME} (OBJECTID=${objectId}, NAME=${name}, Acres=${acres ?? 'null'}, last_edited=${lastEdited})`
    const geoJsonText = JSON.stringify(feat.geometry)

    const { data, error } = await supabase.rpc('import_bend_neighborhood_boundary', {
      p_slug: slug,
      p_geojson: geoJsonText,
      p_source: sourceCitation,
      p_source_url: SOURCE_URL,
      p_verified_by: VERIFIED_BY,
    })

    if (error) {
      console.error(`  FAIL: ${name} (slug=${slug}) — ${error.message}`)
      results.push({ slug, status: 'fail', error: error.message })
      continue
    }

    const measured = data?.measured_acres
    const sourceAcres = acres
    const diff = sourceAcres ? (((measured - sourceAcres) / sourceAcres) * 100).toFixed(2) : null
    const state = sourceAcres && Math.abs((measured - sourceAcres) / sourceAcres) < 0.01 ? 'MATCH' : (sourceAcres ? 'DRIFT' : 'NA')

    console.log(
      `  OK: ${name.padEnd(20)}  acres(src)=${String(sourceAcres ?? 'null').padStart(10)}  acres(measured)=${String(measured).padStart(10)}  diff=${(diff ?? '-').toString().padStart(6)}%  ${state}  boundaries=${data.boundaries_rows_updated}  neighborhoods=${data.neighborhoods_rows_updated}`,
    )
    results.push({ slug, ...data, source_acres: sourceAcres, diff_pct: diff, state })
  }

  console.log('\n--- summary ---')
  const matches = results.filter((r) => r.state === 'MATCH').length
  const drifts = results.filter((r) => r.state === 'DRIFT').length
  const nas = results.filter((r) => r.state === 'NA').length
  const fails = results.filter((r) => r.status === 'fail').length
  console.log(`MATCH (within 1% of source acres): ${matches}`)
  console.log(`DRIFT (acres do not match source within 1%): ${drifts}`)
  console.log(`NA    (source Acres null, no check): ${nas}`)
  console.log(`FAIL  (RPC error): ${fails}`)
  if (drifts > 0 || fails > 0) process.exit(1)
}

main().catch((e) => {
  console.error('Fatal:', e?.message || e)
  process.exit(1)
})
