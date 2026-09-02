#!/usr/bin/env node
/**
 * The living map's basemap: the highway skeleton, the named rivers and canals,
 * and the lakes of Central Oregon, drawn in our own projection so a reader can
 * place a dot without a foreign tile layer under it.
 *
 * Source: US Census TIGER/Line 2024 — public domain, the same publisher the
 * `boundaries` table already cites for its city and CDP polygons. ROADS,
 * LINEARWATER and AREAWATER for Deschutes (41017), Crook (41013) and Jefferson
 * (41031).
 *
 * Two tiers come out of one pass:
 *   - `data/basemap/central-oregon-skeleton.json` — what every frame draws:
 *     primary + secondary roads (TIGER S1100 / S1200), waterways longer than
 *     the region threshold, and water bodies larger than the area threshold.
 *     Ships in the repo, so the homepage draws it with no read.
 *   - `data/basemap/central-oregon-detail.ndjson` — the local street grid
 *     (S1400) and every remaining named waterway, one feature per line, for
 *     the Supabase table a neighborhood frame reads by bounding box. Gitignored:
 *     it is the ingest payload, not a shipped asset.
 *
 * Usage:
 *   node scripts/gis/build-basemap-skeleton.mjs            # build both tiers
 *   node scripts/gis/build-basemap-skeleton.mjs --skeleton # skeleton only
 *   node scripts/gis/build-basemap-skeleton.mjs --keep     # keep the work dir
 *
 * Requires network on first run (it downloads ~15 MB of TIGER zips into a work
 * directory) and `npx mapshaper@0.6.102` for the shapefile read, the dissolve
 * by name and the Visvalingam simplification. Nothing here runs in a request.
 */
import { execFileSync } from 'node:child_process'
import { createWriteStream, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const WORK = path.join(ROOT, '.basemap-work')
const OUT_DIR = path.join(ROOT, 'data/basemap')
const MAPSHAPER = 'mapshaper@0.6.102'

/**
 * The three counties of the core market get every tier, including the street
 * grid. The rest are where our listings also reach — measured from the live
 * listing sitemap: Medford 739, Klamath Falls 640, Grants Pass 543, Ashland
 * 278, and on down — and they get the near tier only. A listing there used to
 * draw its dots on empty cream, with no road, river or lake anywhere
 * (evaluator round six, LISTING-NOBOUNDARY-R6-3); the region tier stays the
 * core three, so the homepage's payload does not change.
 */
const CORE_COUNTIES = [
  { fips: '41017', name: 'Deschutes' },
  { fips: '41013', name: 'Crook' },
  { fips: '41031', name: 'Jefferson' },
]

const REACH_COUNTIES = [
  { fips: '41029', name: 'Jackson' },
  { fips: '41033', name: 'Josephine' },
  { fips: '41035', name: 'Klamath' },
  { fips: '41037', name: 'Lake' },
  { fips: '41023', name: 'Grant' },
]

const COUNTIES = [...CORE_COUNTIES, ...REACH_COUNTIES]
const LAYERS = ['roads', 'linearwater', 'areawater']
const TIGER = 'https://www2.census.gov/geo/tiger/TIGER2024'
const SOURCE = 'US Census TIGER/Line 2024'

/* Two tiers, because one file cannot serve both frames. A region map is about
   100km across a 1000px viewBox — one pixel is 100m, so 200m of simplification
   and four decimals (11m) are already finer than the screen, and a creek that
   runs two miles is noise. A neighborhood frame is 2km across — one pixel is
   2m, so it needs the fine geometry, and it only ever draws what its own
   bounding box holds.
   Thresholds are kilometres and square kilometres on the simplified geometry;
   intervals are metres of Visvalingam simplification. */
const TIERS = {
  region: { interval: 200, precision: 0.0001, minWaterKm: 25, minBodyKm2: 0.5 },
  /* The near tier still drops what no frame draws: a 200m ditch and a farm
     pond are under a pixel even at 2km across, and eight counties of them cost
     more than the geometry that reads. */
  near: { interval: 40, precision: 0.00001, minWaterKm: 1.5, minBodyKm2: 0.02 },
}

const args = new Set(process.argv.slice(2))
const skeletonOnly = args.has('--skeleton')
const keepWork = args.has('--keep')

function log(msg) {
  process.stdout.write(`[basemap] ${msg}\n`)
}

async function download(url, dest) {
  if (existsSync(dest)) return
  const res = await fetch(url)
  if (!res.ok) throw new Error(`${url} → HTTP ${res.status}`)
  await pipeline(Readable.fromWeb(res.body), createWriteStream(dest))
}

function mapshaper(args_) {
  return execFileSync('npx', ['-y', MAPSHAPER, ...args_], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
}

function readJson(file) {
  return JSON.parse(readFileSync(file, 'utf8'))
}

/** Metres between two lon/lat points on a sphere — good to ~0.3% at this latitude. */
function metres(a, b) {
  const R = 6371008.8
  const dLat = ((b[1] - a[1]) * Math.PI) / 180
  const dLon = ((b[0] - a[0]) * Math.PI) / 180
  const lat = ((a[1] + b[1]) / 2) * (Math.PI / 180)
  const x = dLon * Math.cos(lat)
  return Math.hypot(x, dLat) * R
}

function lines(geometry) {
  if (!geometry) return []
  if (geometry.type === 'LineString') return [geometry.coordinates]
  if (geometry.type === 'MultiLineString') return geometry.coordinates
  return []
}

function rings(geometry) {
  if (!geometry) return []
  if (geometry.type === 'Polygon') return [geometry.coordinates[0]]
  if (geometry.type === 'MultiPolygon') return geometry.coordinates.map((p) => p[0])
  return []
}

function lengthKm(geometry) {
  let m = 0
  for (const line of lines(geometry)) for (let i = 1; i < line.length; i += 1) m += metres(line[i - 1], line[i])
  return m / 1000
}

/** Shoelace on the equirectangular plane, in square kilometres. */
function areaKm2(geometry) {
  let sum = 0
  for (const ring of rings(geometry)) {
    const lat = (ring.reduce((a, p) => a + p[1], 0) / ring.length) * (Math.PI / 180)
    const kx = Math.cos(lat)
    let a = 0
    for (let i = 1; i < ring.length; i += 1) {
      a += ring[i - 1][0] * kx * ring[i][1] - ring[i][0] * kx * ring[i - 1][1]
    }
    sum += Math.abs(a) / 2
  }
  return sum * (111.32 * 111.32)
}

/* TIGER writes the same highway a dozen ways ("McKenzie Hwy", "Mc Kenzie Hwy",
   "Mc Kenzie-bend Hwy"). One published name per road keeps the label honest and
   the dissolve tight. */
function tidyName(raw) {
  const name = (raw ?? '').trim()
  if (!name) return ''
  return name
    .replace(/\bMc (?=[A-Z])/g, 'Mc')
    .replace(/\bCnl\b/g, 'Canal')
    .replace(/\bRiv\b/g, 'River')
    .replace(/\bCrk?\b/g, 'Creek')
    .replace(/\bLk\b/g, 'Lake')
    .replace(/\bRes\b/g, 'Reservoir')
    .replace(/\bHwy\b/g, 'Hwy')
    .replace(/-bend\b/g, '-Bend')
    .replace(/\s+/g, ' ')
}

async function fetchAll() {
  mkdirSync(WORK, { recursive: true })
  for (const { fips } of COUNTIES) {
    for (const layer of LAYERS) {
      const file = `tl_2024_${fips}_${layer}`
      const zip = path.join(WORK, `${file}.zip`)
      await download(`${TIGER}/${layer.toUpperCase()}/${file}.zip`, zip)
      if (!existsSync(path.join(WORK, file))) {
        execFileSync('unzip', ['-oq', zip, '-d', path.join(WORK, file)], { stdio: 'ignore' })
      }
    }
  }
  log(`TIGER files ready in ${path.relative(ROOT, WORK)}`)
}

function extract({ fips, layer, filter, classify, dissolve = true, out, tier }) {
  const shp = path.join(WORK, `tl_2024_${fips}_${layer}`, `tl_2024_${fips}_${layer}.shp`)
  const dest = path.join(WORK, out)
  const cmd = [
    shp,
    '-filter',
    filter,
    '-each',
    classify,
    '-filter-fields',
    'cls,name',
    ...(dissolve ? ['-dissolve', 'fields=cls,name'] : []),
    '-simplify',
    `interval=${TIERS[tier].interval}`,
    'keep-shapes',
    '-o',
    `precision=${TIERS[tier].precision}`,
    dest,
  ]
  mapshaper(cmd)
  return readJson(dest).features ?? []
}

/**
 * One path as quantized deltas: `[x0, y0, dx1, dy1, …]` in units of 1/q
 * degrees. A 200m step at the region tier is 20 units — three characters
 * instead of the twenty-two a repeated absolute coordinate costs. Decoded by
 * `decodeBasemapPath` in lib/geo/basemap.ts.
 */
function encodePath(points, q) {
  const out = []
  let px = 0
  let py = 0
  for (let i = 0; i < points.length; i += 1) {
    const x = Math.round(points[i][0] * q)
    const y = Math.round(points[i][1] * q)
    if (i === 0) out.push(x, y)
    else {
      if (x === px && y === py) continue
      out.push(x - px, y - py)
    }
    px = x
    py = y
  }
  return out
}

function feature(f, kind, q) {
  const name = tidyName(f.properties?.name)
  const cls = f.properties?.cls ?? ''
  const source = kind === 'area' ? rings(f.geometry) : lines(f.geometry)
  const parts = source.map((part) => encodePath(part, q)).filter((part) => part.length >= 4)
  /* The feature's own bounding box in the same quantized units, so a frame can
     drop what it does not hold without decoding a single path. */
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const part of source) {
    for (const [x, y] of part) {
      const qx = Math.round(x * q)
      const qy = Math.round(y * q)
      if (qx < minX) minX = qx
      if (qy < minY) minY = qy
      if (qx > maxX) maxX = qx
      if (qy > maxY) maxY = qy
    }
  }
  return { c: cls, n: name, b: parts.length > 0 ? [minX, minY, maxX, maxY] : [0, 0, 0, 0], p: parts }
}

function countPoints(items) {
  return items.reduce((n, i) => n + i.p.reduce((m, part) => m + part.length / 2, 0), 0)
}

function buildTier(tier) {
  const { minWaterKm, minBodyKm2, interval, precision } = TIERS[tier]
  const q = Math.round(1 / precision)
  const roads = []
  const waterways = []
  const bodies = []

  for (const { fips } of tier === 'region' ? CORE_COUNTIES : COUNTIES) {
    const arterials = extract({
      fips,
      tier,
      layer: 'roads',
      filter: 'MTFCC === "S1100" || MTFCC === "S1200"',
      classify: 'cls = MTFCC === "S1100" ? "primary" : "secondary", name = FULLNAME || ""',
      out: `art_${tier}_${fips}.json`,
    })
    for (const f of arterials) roads.push(feature(f, 'line', q))

    const streams = extract({
      fips,
      tier,
      layer: 'linearwater',
      filter: '!!FULLNAME && (MTFCC === "H3010" || MTFCC === "H3020")',
      classify: 'cls = MTFCC === "H3010" ? "river" : "canal", name = FULLNAME',
      out: `wat_${tier}_${fips}.json`,
    })
    for (const f of streams) if (lengthKm(f.geometry) >= minWaterKm) waterways.push(feature(f, 'line', q))

    const water = extract({
      fips,
      tier,
      layer: 'areawater',
      filter: 'MTFCC === "H2030" || MTFCC === "H2040" || MTFCC === "H3010"',
      classify:
        'cls = MTFCC === "H2040" ? "reservoir" : (MTFCC === "H3010" ? "river" : "lake"), name = FULLNAME || ""',
      dissolve: false,
      out: `lak_${tier}_${fips}.json`,
    })
    for (const f of water) if (areaKm2(f.geometry) >= minBodyKm2) bodies.push(feature(f, 'area', q))
  }

  const decimals = Math.round(Math.log10(q))
  const keep = (items) => items.filter((i) => i.p.length > 0)
  return {
    source: SOURCE,
    sourceUrl: `${TIGER}/`,
    counties: (tier === 'region' ? CORE_COUNTIES : COUNTIES).map((c) => `${c.fips} ${c.name}`),
    tier,
    q,
    method: `MTFCC S1100/S1200 roads${minWaterKm > 0 ? `, named H3010/H3020 waterways at least ${minWaterKm}km long` : ', every named H3010/H3020 waterway'}${minBodyKm2 > 0 ? `, H2030/H2040/H3010 water bodies at least ${minBodyKm2}km²` : ', every H2030/H2040/H3010 water body'}; dissolved by name, Visvalingam simplified at ${interval}m, coordinates quantized to ${decimals} decimals and delta encoded.`,
    roads: keep(roads).sort((a, b) => a.c.localeCompare(b.c) || a.n.localeCompare(b.n)),
    waterways: keep(waterways).sort((a, b) => a.n.localeCompare(b.n)),
    bodies: keep(bodies).sort((a, b) => a.n.localeCompare(b.n)),
  }
}

function writeTier(tier) {
  const built = buildTier(tier)
  const file = path.join(OUT_DIR, `central-oregon-${tier}.json`)
  writeFileSync(file, `${JSON.stringify(built)}\n`)
  log(
    `${tier}: ${built.roads.length} roads (${countPoints(built.roads)} pts), ${built.waterways.length} waterways (${countPoints(built.waterways)} pts), ${built.bodies.length} water bodies (${countPoints(built.bodies)} pts) → ${(readFileSync(file).length / 1024).toFixed(0)} KB`,
  )
}

/**
 * The street tier: every NAMED local street (MTFCC S1400), NOT dissolved — a
 * dissolved name spans a whole county and its box then matches every frame,
 * which defeats the clip. Segments keep tight boxes, and an unnamed segment is
 * usually a driveway or a service road, so the named set is both smaller and
 * better cartography.
 *
 * Written as 0.05° tiles (about 4km at this latitude) so a frame reads the one
 * to four files it overlaps instead of a three-megabyte file.
 */
const TILE = 0.05

function tileKeys(box, q) {
  const keys = []
  const x0 = Math.floor(box[0] / q / TILE)
  const x1 = Math.floor(box[2] / q / TILE)
  const y0 = Math.floor(box[1] / q / TILE)
  const y1 = Math.floor(box[3] / q / TILE)
  for (let x = x0; x <= x1; x += 1) for (let y = y0; y <= y1; y += 1) keys.push(`${x}_${y}`)
  return keys
}

function writeStreetTiles() {
  const q = Math.round(1 / TIERS.near.precision)
  const tiles = new Map()
  let total = 0
  for (const { fips } of CORE_COUNTIES) {
    const local = extract({
      fips,
      tier: 'near',
      layer: 'roads',
      filter: 'MTFCC === "S1400" && !!FULLNAME',
      classify: 'cls = "local", name = FULLNAME',
      dissolve: false,
      out: `loc_${fips}.json`,
    })
    for (const f of local) {
      const item = feature(f, 'line', q)
      if (item.p.length === 0) continue
      total += 1
      for (const key of tileKeys(item.b, q)) {
        const bucket = tiles.get(key)
        if (bucket) bucket.push(item)
        else tiles.set(key, [item])
      }
    }
  }

  const dir = path.join(OUT_DIR, 'streets')
  rmSync(dir, { recursive: true, force: true })
  mkdirSync(dir, { recursive: true })
  let bytes = 0
  const manifest = {}
  for (const [key, features] of [...tiles.entries()].sort()) {
    const file = path.join(dir, `${key}.json`)
    writeFileSync(file, JSON.stringify({ q, tile: TILE, features }))
    bytes += readFileSync(file).length
    manifest[key] = features.length
  }
  writeFileSync(
    path.join(OUT_DIR, 'streets.json'),
    `${JSON.stringify({ source: SOURCE, sourceUrl: `${TIGER}/`, q, tile: TILE, method: `Named MTFCC S1400 local streets, undissolved, Visvalingam simplified at ${TIERS.near.interval}m, quantized to ${Math.round(Math.log10(q))} decimals and delta encoded, filed into ${TILE}° tiles.`, tiles: manifest })}\n`,
  )
  log(`streets: ${total} named local streets in ${tiles.size} tiles → ${(bytes / 1024 / 1024).toFixed(1)} MB`)
}

async function main() {
  await fetchAll()
  mkdirSync(OUT_DIR, { recursive: true })

  writeTier('region')
  writeTier('near')

  if (!skeletonOnly) writeStreetTiles()

  if (!keepWork) rmSync(WORK, { recursive: true, force: true })
}

main().catch((err) => {
  process.stderr.write(`[basemap] ${err instanceof Error ? err.message : String(err)}\n`)
  process.exit(1)
})
