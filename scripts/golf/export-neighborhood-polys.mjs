#!/usr/bin/env node
/**
 * Export the neighborhood boundary polygons the golf pipeline uses as a course
 * extent, to /tmp/course-neighborhood-polys.json for fetch-osm-courses.py.
 *
 * WHY THIS EXISTS. fetch-osm-courses.py clips each course to its own named
 * OpenStreetMap `leisure=golf_course` polygon. Four Central Oregon courses have
 * no such polygon — Pronghorn, Broken Top, Brasada Canyons and Awbrey Glen —
 * and the pipeline read that as "OpenStreetMap has no data for these courses."
 * It does: each has a complete eighteen `golf=hole` ways. They simply sit inside
 * no golf_course polygon, so a boundary-clipped fetch could never see them.
 *
 * The fix is a second boundary provenance, not a looser one. `public.boundaries`
 * holds authoritative neighborhood polygons from City of Bend GIS, Deschutes
 * County DIAL, Oregon GEO and Census TIGER, one row per resort community. A
 * course inside a community whose polygon we already own is clipped to THAT,
 * with the same centroid-inside rule and the same one-course-per-boundary
 * guarantee. It is not a radius: a radius around Crosswater also returns Caldera
 * Links a kilometre away, which is why the OSM path is boundary-clipped in the
 * first place.
 *
 *   node scripts/golf/export-neighborhood-polys.mjs [--out PATH]
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createClient } from '@supabase/supabase-js'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')

/**
 * Course slug in data/golf/courses.ts -> the neighborhood boundary that holds
 * it. Written out rather than derived: `awbrey-glen` is a neighborhood row of
 * its own AND the golf course sits on Awbrey Butte, so the course's holes fall
 * inside `bend-awbrey-butte` and not inside `awbrey-glen`. A slug match would
 * pick the wrong polygon and return nothing.
 */
export const COURSE_NEIGHBORHOOD = {
  'pronghorn-nicklaus': 'pronghorn',
  'pronghorn-fazio': 'pronghorn',
  'broken-top-club': 'broken-top',
  'brasada-canyons': 'brasada-ranch',
  'awbrey-glen': 'bend-awbrey-butte',
}

function env() {
  const file = path.join(ROOT, '.env.local')
  if (!fs.existsSync(file)) return
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
    if (m) process.env[m[1]] ??= m[2].replace(/^["']|["']$/g, '')
  }
}

async function main() {
  env()
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) {
    console.error('✗ Supabase env missing (NEXT_PUBLIC_SUPABASE_URL + a key).')
    process.exit(1)
  }
  const sb = createClient(url, key)
  const argv = process.argv.slice(2)
  const i = argv.indexOf('--out')
  const out = i >= 0 && argv[i + 1] ? argv[i + 1] : '/tmp/course-neighborhood-polys.json'

  const wanted = [...new Set(Object.values(COURSE_NEIGHBORHOOD))]
  const result = {}
  for (const slug of wanted) {
    const { data, error } = await sb.rpc('boundary_geojson', {
      p_geo_type: 'neighborhood',
      p_geo_slug: slug,
    })
    if (error) {
      console.error(`✗ ${slug}: ${error.message}`)
      process.exit(1)
    }
    if (!data) {
      console.error(`✗ ${slug}: no neighborhood boundary row`)
      process.exit(1)
    }
    const g = JSON.parse(data)
    const polys = g.type === 'Polygon' ? [g.coordinates] : g.coordinates
    const rings = polys.map((p) => p[0]).filter((r) => Array.isArray(r) && r.length > 3)
    if (!rings.length) {
      console.error(`✗ ${slug}: boundary has no usable outer ring`)
      process.exit(1)
    }
    result[slug] = { slug, geoType: 'neighborhood', rings }
    const pts = rings.reduce((n, r) => n + r.length, 0)
    console.log(`  ${slug.padEnd(20)} ${g.type} · ${rings.length} ring(s) · ${pts} points`)
  }
  const payload = { source: 'public.boundaries (geo_type=neighborhood)', courses: COURSE_NEIGHBORHOOD, polys: result }
  fs.writeFileSync(out, JSON.stringify(payload))
  console.log(`\n✓ ${wanted.length} neighborhood boundaries -> ${out}`)
}

void main()
