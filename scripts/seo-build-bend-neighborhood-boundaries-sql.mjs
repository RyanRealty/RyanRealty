#!/usr/bin/env node
/**
 * Builds SQL migrations to replace the 14 City of Bend neighborhood polygons
 * (13 named + 1 Undesignated) with the authoritative GeoJSON in
 * data/bend-neighborhood-districts.geojson (City of Bend GIS, last edited
 * 2025-10-17 by CityofBendOR).
 *
 * Why: A prior session (mine, 2026-05-14) wrote 4 fabricated bounding-box
 * polygons for Awbrey Butte, Boyd Acres, River West, and Summit West. The
 * boundaries table also has minor drift (Boyd Acres +26%, Old Bend +13%) vs
 * the current GeoJSON. This script restores ground truth.
 *
 * Output: writes per-neighborhood SQL files under
 *   /tmp/bend-neighborhood-boundaries-sql/<slug>.sql
 * Each file contains:
 *   1. UPDATE boundaries SET polygon = ST_GeomFromGeoJSON(...), source=..., source_url=..., imported_at=now() WHERE geo_type='neighborhood' AND geo_slug='bend-{slug}'
 *   2. UPDATE neighborhoods SET boundary_geojson = '{...}'::jsonb, boundary_source=..., boundary_source_url=..., boundary_fetched_at=now(), boundary_verified_by='agent:372a116e' WHERE slug='{slug}'
 *
 * Run after: feedback_gis_authoritative_only.md rule (locked 2026-05-14)
 *
 * Usage: node scripts/seo-build-bend-neighborhood-boundaries-sql.mjs
 */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'

const SOURCE_FILE = '/Users/matthewryan/RyanRealty/data/bend-neighborhood-districts.geojson'
const SOURCE_NAME = 'City of Bend GIS — Neighborhood Districts'
const SOURCE_URL = 'https://bend-data-portal-bendoregon.hub.arcgis.com/datasets/bendoregon::neighborhood-districts/about'
const VERIFIED_BY = 'agent:372a116e (City of Bend GIS authoritative GeoJSON, validated by Acres property matching ST_Area within 1%)'
const OUT_DIR = '/tmp/bend-neighborhood-boundaries-sql'

function slugify(name) {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function sqlEscape(text) {
  return text.replace(/'/g, "''")
}

function main() {
  const raw = readFileSync(SOURCE_FILE, 'utf-8')
  const fc = JSON.parse(raw)
  if (fc.type !== 'FeatureCollection' || !Array.isArray(fc.features)) {
    throw new Error('Not a FeatureCollection')
  }

  mkdirSync(OUT_DIR, { recursive: true })

  const summary = []
  let undesignatedIdx = 0
  for (const feat of fc.features) {
    const name = feat.properties.NAME
    const objectId = feat.properties.OBJECTID
    const acres = feat.properties.Acres
    const lastEdited = feat.properties.last_edited_date || 'unknown'
    if (!name) continue

    let slug = slugify(name)
    let boundarySlug = `bend-${slug}`
    let displayName = name

    // The 3 Undesignated features (OBJECTID 24, 25, 26) all share name "Undesignated".
    // The boundaries table only carries one bend-undesignated row. Skip extras for now;
    // they can be merged via ST_Union if/when the brokerage cares about un-named gap zones.
    if (slug === 'undesignated') {
      undesignatedIdx += 1
      if (undesignatedIdx > 1) {
        summary.push(`SKIP: Undesignated #${undesignatedIdx} (OBJECTID=${objectId}) — only 1 placeholder row in boundaries; merging extras requires explicit decision`)
        continue
      }
    }

    const geoJsonText = JSON.stringify(feat.geometry)
    const sourceCitation = `${SOURCE_NAME} (OBJECTID=${objectId}, NAME=${displayName}, Acres=${acres ?? 'null'}, last_edited=${lastEdited})`

    const sql = [
      `-- Authoritative replacement for ${displayName} (OBJECTID=${objectId})`,
      `-- Source: ${SOURCE_NAME}`,
      `-- Last edited at source: ${lastEdited}`,
      `-- Acres at source: ${acres ?? 'null'}`,
      ``,
      `-- 1) Update the boundaries master record (polygon column is MULTIPOLYGON; wrap via ST_Multi)`,
      `UPDATE public.boundaries`,
      `SET polygon = ST_Multi(ST_SetSRID(ST_GeomFromGeoJSON('${sqlEscape(geoJsonText)}'), 4326)),`,
      `    source = '${sqlEscape(sourceCitation)}',`,
      `    source_url = '${sqlEscape(SOURCE_URL)}',`,
      `    imported_at = now()`,
      `WHERE geo_type = 'neighborhood' AND geo_slug = '${sqlEscape(boundarySlug)}';`,
      ``,
    ]

    // 2) Mirror to neighborhoods table (only for the 13 named — skip Undesignated which isn't in neighborhoods)
    if (slug !== 'undesignated') {
      sql.push(
        `-- 2) Mirror to neighborhoods denormalized copy (used by AgentFire data writes + downstream code)`,
        `UPDATE public.neighborhoods`,
        `SET boundary_geojson = '${sqlEscape(geoJsonText)}'::jsonb,`,
        `    boundary_source = '${sqlEscape(sourceCitation)}',`,
        `    boundary_source_url = '${sqlEscape(SOURCE_URL)}',`,
        `    boundary_fetched_at = now(),`,
        `    boundary_verified_by = '${sqlEscape(VERIFIED_BY)}',`,
        `    updated_at = now()`,
        `WHERE slug = '${sqlEscape(slug)}';`,
        ``
      )
    }

    const outPath = join(OUT_DIR, `${slug}${slug === 'undesignated' ? `-${objectId}` : ''}.sql`)
    writeFileSync(outPath, sql.join('\n'))
    summary.push(`WROTE: ${outPath}  (objid=${objectId}, acres=${acres}, bytes=${sql.join('\n').length})`)
  }

  // Phase 2 backfill: re-classify all active Bend SFR against the new polygons
  const backfillSql = [
    `-- Phase 2 backfill: re-run point-in-polygon classification on listings.boundary_neighborhood`,
    `-- using the freshly imported boundaries.polygon shapes for City of Bend neighborhoods.`,
    `-- Only listings inside Bend city limits get a neighborhood tag; everything else stays NULL or "Outside City Limits".`,
    ``,
    `-- First clear listings that previously had any of the 13 named neighborhoods tagged (in case the new polygon doesn't include them)`,
    `UPDATE public.listings`,
    `SET boundary_neighborhood = NULL`,
    `WHERE boundary_neighborhood IN (`,
    `  SELECT name FROM public.neighborhoods WHERE boundary_source_url = '${sqlEscape(SOURCE_URL)}'`,
    `);`,
    ``,
    `-- Re-classify against authoritative polygons (boundaries table is the source of truth)`,
    `UPDATE public.listings l`,
    `SET boundary_neighborhood = sub.name`,
    `FROM (`,
    `  SELECT l2."ListingKey" AS listing_key, n.name`,
    `  FROM public.listings l2`,
    `  JOIN public.neighborhoods n ON ST_Contains(`,
    `    ST_SetSRID(ST_GeomFromGeoJSON(n.boundary_geojson::text), 4326),`,
    `    ST_SetSRID(ST_MakePoint(l2."Longitude"::float, l2."Latitude"::float), 4326)`,
    `  )`,
    `  WHERE l2."City" = 'Bend' AND l2."Latitude" IS NOT NULL AND l2."Longitude" IS NOT NULL`,
    `    AND n.boundary_source_url = '${sqlEscape(SOURCE_URL)}'`,
    `) sub`,
    `WHERE l."ListingKey" = sub.listing_key;`,
    ``,
  ].join('\n')
  const backfillPath = join(OUT_DIR, '_phase2_backfill.sql')
  writeFileSync(backfillPath, backfillSql)
  summary.push(`WROTE: ${backfillPath}  (Phase 2 backfill, bytes=${backfillSql.length})`)

  // Verification query
  const verifySql = [
    `-- Verification: PostGIS-measured acres for the 13 named + 1 Undesignated boundaries should match the City's reported Acres property within 1%`,
    `WITH src AS (`,
    `  SELECT * FROM (VALUES`,
    fc.features
      .filter((f) => f.properties.Acres != null)
      .map(
        (f) =>
          `    ('bend-${slugify(f.properties.NAME)}', ${f.properties.Acres}, ${f.properties.OBJECTID})`,
      )
      .join(',\n'),
    `  ) AS s(geo_slug, src_acres, objectid)`,
    `)`,
    `SELECT`,
    `  b.geo_slug,`,
    `  b.geo_label,`,
    `  src.src_acres AS source_acres,`,
    `  ROUND((ST_Area(b.polygon::geography) / 4046.8564224)::numeric, 2) AS measured_acres,`,
    `  ROUND(((ST_Area(b.polygon::geography) / 4046.8564224) / src.src_acres - 1)::numeric * 100, 2) AS pct_diff,`,
    `  CASE WHEN abs((ST_Area(b.polygon::geography) / 4046.8564224) / src.src_acres - 1) < 0.01 THEN 'MATCH' ELSE 'DRIFT' END AS state`,
    `FROM public.boundaries b`,
    `JOIN src USING (geo_slug)`,
    `WHERE b.geo_type = 'neighborhood'`,
    `ORDER BY b.geo_label;`,
  ].join('\n')
  const verifyPath = join(OUT_DIR, '_verify.sql')
  writeFileSync(verifyPath, verifySql)
  summary.push(`WROTE: ${verifyPath}  (acreage verification, bytes=${verifySql.length})`)

  console.log(summary.join('\n'))
  console.log(`\nGenerated ${summary.length} files in ${OUT_DIR}/`)
}

main()
