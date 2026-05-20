#!/usr/bin/env node
/**
 * fetch-deschutes-parcel.mjs — Deschutes County taxlot polygon fetcher.
 *
 * Queries the Deschutes County ArcGIS REST taxlot layer at:
 *   https://maps.deschutes.org/arcgis/rest/services/Dial2_Taxlots/MapServer/0
 *
 * Two query modes:
 *   1. Point-in-polygon — give a lat/lng, returns the taxlot containing it.
 *   2. By TAXLOT id — give a TAXLOT string, returns that specific taxlot.
 *
 * Output: GeoJSON FeatureCollection saved to data/parcels/<slug>.geojson.
 *
 * Per CLAUDE.md memory `feedback_gis_authoritative_only.md` — polygons MUST
 * come from City of Bend GIS, Deschutes County DIAL, Oregon GEO, or Census
 * TIGER. Never approximate. Every polygon carries source + URL + fetched_at.
 *
 * Usage:
 *   node scripts/fetch-deschutes-parcel.mjs --slug 19496-tumalo-reservoir-rd \
 *        --lat 44.138729 --lng -121.349064
 *
 *   node scripts/fetch-deschutes-parcel.mjs --slug some-listing --taxlot "161136D000601"
 */

import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = path.resolve(__dirname, '..')
const LAYER_URL =
  'https://maps.deschutes.org/arcgis/rest/services/Dial2_Taxlots/MapServer/0/query'
const SOURCE_LABEL =
  'Deschutes County GIS (DIAL) Taxlot layer — maps.deschutes.org/arcgis'

function parseArgs(argv) {
  const args = { slug: null, lat: null, lng: null, taxlot: null }
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--slug') args.slug = argv[++i]
    else if (a === '--lat') args.lat = parseFloat(argv[++i])
    else if (a === '--lng') args.lng = parseFloat(argv[++i])
    else if (a === '--taxlot') args.taxlot = argv[++i]
    else if (a === '--help' || a === '-h') usageAndExit(0)
  }
  return args
}

function usageAndExit(code) {
  console.error(
    'Usage:\n' +
      '  node scripts/fetch-deschutes-parcel.mjs --slug <slug> --lat <lat> --lng <lng>\n' +
      '  node scripts/fetch-deschutes-parcel.mjs --slug <slug> --taxlot <TAXLOT_ID>\n',
  )
  process.exit(code)
}

async function queryByPoint(lat, lng) {
  const params = new URLSearchParams({
    where: '1=1',
    geometry: JSON.stringify({ x: lng, y: lat }),
    geometryType: 'esriGeometryPoint',
    inSR: '4326',
    spatialRel: 'esriSpatialRelIntersects',
    outFields: '*',
    returnGeometry: 'true',
    outSR: '4326',
    f: 'geojson',
  })
  const url = `${LAYER_URL}?${params.toString()}`
  console.log(`→ querying Deschutes ArcGIS by point (${lat}, ${lng})`)
  const res = await fetch(url, {
    headers: { Accept: 'application/geo+json, application/json' },
  })
  if (!res.ok) {
    throw new Error(`Deschutes ArcGIS returned HTTP ${res.status}: ${await res.text()}`)
  }
  return res.json()
}

async function queryByTaxlot(taxlot) {
  const params = new URLSearchParams({
    where: `TAXLOT='${taxlot.replace(/'/g, "''")}'`,
    outFields: '*',
    returnGeometry: 'true',
    outSR: '4326',
    f: 'geojson',
  })
  const url = `${LAYER_URL}?${params.toString()}`
  console.log(`→ querying Deschutes ArcGIS by TAXLOT ${taxlot}`)
  const res = await fetch(url, {
    headers: { Accept: 'application/geo+json, application/json' },
  })
  if (!res.ok) {
    throw new Error(`Deschutes ArcGIS returned HTTP ${res.status}: ${await res.text()}`)
  }
  return res.json()
}

function ringAcres(ring) {
  const LAT_FT_PER_DEG = 364_000
  const LNG_FT_PER_DEG = 261_000
  let area_ft2_2 = 0
  for (let i = 0; i < ring.length - 1; i++) {
    const [x1, y1] = ring[i]
    const [x2, y2] = ring[i + 1]
    area_ft2_2 +=
      x1 * LNG_FT_PER_DEG * (y2 * LAT_FT_PER_DEG) -
      x2 * LNG_FT_PER_DEG * (y1 * LAT_FT_PER_DEG)
  }
  return Math.abs(area_ft2_2) / 2 / 43_560
}

async function main() {
  const args = parseArgs(process.argv)
  if (!args.slug) {
    console.error('--slug is required')
    usageAndExit(1)
  }
  let geojson
  let queryDescriptor
  if (args.lat !== null && args.lng !== null) {
    geojson = await queryByPoint(args.lat, args.lng)
    queryDescriptor = { mode: 'point', lat: args.lat, lng: args.lng }
  } else if (args.taxlot) {
    geojson = await queryByTaxlot(args.taxlot)
    queryDescriptor = { mode: 'taxlot', taxlot: args.taxlot }
  } else {
    console.error('Provide either --lat + --lng OR --taxlot')
    usageAndExit(1)
  }

  if (!geojson.features || geojson.features.length === 0) {
    console.error('No taxlot polygon matched the query.')
    process.exit(2)
  }
  if (geojson.features.length > 1) {
    console.warn(`WARN: ${geojson.features.length} features matched; using the first.`)
  }

  const feature = geojson.features[0]
  const props = feature.properties || {}
  const taxlotId =
    props.TAXLOT ||
    props['Taxlot_Assessor_Account.TAXLOT'] ||
    Object.entries(props).find(([k]) => k.endsWith('.TAXLOT'))?.[1] ||
    'UNKNOWN'
  const addressLine =
    props.Address ||
    props['Taxlot_Assessor_Account.Address'] ||
    Object.entries(props).find(([k]) => k.endsWith('.Address'))?.[1] ||
    null

  let acres = null
  if (feature.geometry?.type === 'Polygon') {
    acres = +ringAcres(feature.geometry.coordinates[0]).toFixed(2)
  } else if (feature.geometry?.type === 'MultiPolygon') {
    let total = 0
    for (const poly of feature.geometry.coordinates) total += ringAcres(poly[0])
    acres = +total.toFixed(2)
  }

  const out = {
    version: '1',
    source: SOURCE_LABEL,
    layer: LAYER_URL,
    query: queryDescriptor,
    fetched_at: new Date().toISOString(),
    taxlot: taxlotId,
    address: addressLine,
    properties: props,
    acres_computed: acres,
    geometry: feature.geometry,
    raw_geojson_feature: feature,
  }

  const outDir = path.join(REPO_ROOT, 'data', 'parcels')
  await mkdir(outDir, { recursive: true })
  const outPath = path.join(outDir, `${args.slug}.geojson`)
  await writeFile(outPath, JSON.stringify(out, null, 2))
  console.log(`✓ wrote ${outPath}`)
  console.log(`  TAXLOT : ${taxlotId}`)
  if (addressLine) console.log(`  address: ${addressLine}`)
  console.log(`  acres  : ${acres}`)
}

main().catch((err) => {
  console.error(`✗ FAILED: ${err.message}`)
  process.exit(1)
})
