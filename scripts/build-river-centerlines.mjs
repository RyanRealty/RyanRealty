#!/usr/bin/env node
/**
 * Build data/cma/rivers-centerline.json — the named rivers a Central Oregon
 * buyer treats as a wall (Matt 2026-09-09: "if we're in a city that doesn't
 * really have that, then we use other major things to constrain us, like major
 * roadways, rivers, stuff like that").
 *
 * Source is the SAME TIGER extract the Atlas basemap draws
 * (data/basemap/central-oregon-*.json), decoded to plain [lon, lat] lines in
 * the shape lib/pricing/highway-cross.ts already reads for US-97, so one
 * crossing test serves both.
 *
 *   node scripts/build-river-centerlines.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')

// The rivers that actually divide a Central Oregon market. Everything else in
// the extract is out of area (Rogue, Klamath, John Day) or a creek.
const KEEP = new Set([
  'Deschutes River',
  'Little Deschutes River',
  'Crooked River',
  'Metolius River',
  'Fall River',
  'Spring River',
])

// Central Oregon only: the four counties the site serves, generously boxed.
const BOX = { minLon: -122.2, maxLon: -120.2, minLat: 43.2, maxLat: 45.1 }

function decodePath(path, q) {
  const out = []
  let lon = path[0] / q
  let lat = path[1] / q
  out.push([Number(lon.toFixed(5)), Number(lat.toFixed(5))])
  for (let i = 2; i < path.length; i += 2) {
    lon += path[i] / q
    lat += path[i + 1] / q
    out.push([Number(lon.toFixed(5)), Number(lat.toFixed(5))])
  }
  return out
}

const lines = []
const names = new Set()
for (const tier of ['central-oregon-near', 'central-oregon-region']) {
  const data = JSON.parse(readFileSync(join(ROOT, 'data/basemap', `${tier}.json`), 'utf8'))
  // Rivers arrive as LINES where they are narrow and as water BODIES where they
  // widen — the Deschutes through Bend is a polygon, which is why the line data
  // has a hole exactly where the town is. A body's ring is a wall the same way
  // a centerline is, so both are emitted.
  const features = [...(data.waterways ?? []), ...(data.bodies ?? [])]
  for (const w of features) {
    if ((w.c !== 'river' && w.c !== 'lake') || !KEEP.has(w.n)) continue
    for (const path of w.p ?? []) {
      const pts = decodePath(path, data.q)
      const inBox = pts.some(
        ([lon, lat]) => lon >= BOX.minLon && lon <= BOX.maxLon && lat >= BOX.minLat && lat <= BOX.maxLat,
      )
      if (!inBox || pts.length < 2) continue
      lines.push(pts)
      names.add(w.n)
    }
  }
}

const out = {
  source: 'TIGER/Line via data/basemap/central-oregon-{near,region}.json (river lines + named river bodies), decoded 2026-09-09',
  names: [...names].sort(),
  lines,
}
writeFileSync(join(ROOT, 'data/cma/rivers-centerline.json'), `${JSON.stringify(out)}\n`)
console.log(`rivers: ${out.names.join(', ')}`)
console.log(`lines: ${lines.length}, points: ${lines.reduce((n, l) => n + l.length, 0)}`)
