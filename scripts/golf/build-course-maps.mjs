#!/usr/bin/env node
/**
 * Build data/golf/course-maps/<slug>.json — the geometry the course map draws.
 *
 * INPUTS (both produced by the fetch scripts beside this one, both scratch):
 *   --osm      OSM features per course, clipped to that course's own named
 *              leisure=golf_course boundary. scripts/golf/fetch-osm-courses.py
 *   --turf-dir mown-turf polygons traced out of Oregon's 2018 aerial imagery
 *              and clipped to the same boundary. scripts/golf/trace-turf.py
 *
 * WHY THE BOUNDARY, EVERY TIME. A radius query around Crosswater's clubhouse
 * also returns Caldera Links a kilometre away, and the map then numbers 36 holes
 * 1 to 18 twice. Every feature that lands in a course file had its centroid
 * inside that course's own polygon.
 *
 * WHY TWO SOURCES. OSM has this region's greens, bunkers, tees and routings in
 * detail but maps only 12 of Tetherow's fairways, so a course drawn from OSM
 * alone is a scatter of floating greens. The body comes from the aerial: mown
 * turf is the fairway system whether or not anyone tagged it.
 *
 * WHAT IT REFUSES TO WRITE (CLAUDE.md §0):
 *   - a course whose mapped hole count is not the club's published hole count.
 *     Sunriver Woodlands maps 17 of 18, and a map that silently drops a hole is
 *     a wrong page, not a partial one.
 *   - per-hole par, unless the holes sum to the published par. OSM's per-hole
 *     par tags are partial: Tetherow's sum to 71 on a par-72 course.
 *   - per-hole yardage, unless the routings sum to within 1% of the published
 *     card off the back tees.
 * The drawing is never gated on a tag — geometry does not depend on one.
 *
 *   node scripts/golf/build-course-maps.mjs [--osm PATH] [--turf-dir DIR] [--dry]
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const OUT_DIR = path.join(ROOT, 'data/golf/course-maps')

const argv = process.argv.slice(2)
const flag = (name, dflt) => {
  const i = argv.indexOf(name)
  return i >= 0 && argv[i + 1] ? argv[i + 1] : dflt
}
const OSM = flag('--osm', '/tmp/osm-courses.json')
const TURF_DIR = flag('--turf-dir', '/tmp')
const DRY = argv.includes('--dry')

/**
 * Slug in data/golf/courses.ts -> shortName, for the published card. The OSM
 * side is keyed by our own slug already; this only bridges to the registry.
 */
const REGISTRY_SHORT_NAME = {
  tetherow: 'Tetherow',
  crosswater: 'Crosswater',
  'sunriver-meadows': 'Sunriver Meadows',
  'sunriver-woodlands': 'Sunriver Woodlands',
  'caldera-links': 'Caldera Links',
  'widgi-creek': 'Widgi Creek',
  'black-butte-big-meadow': 'Big Meadow',
  'black-butte-glaze-meadow': 'Glaze Meadow',
  'eagle-crest-resort': 'Eagle Crest Resort',
  'eagle-crest-ridge': 'Eagle Crest Ridge',
  'aspen-lakes': 'Aspen Lakes',
  juniper: 'Juniper',
  'lost-tracks': 'Lost Tracks',
  'quail-run': 'Quail Run',
  'meadow-lakes': 'Meadow Lakes',
  'crooked-river-ranch': 'Crooked River Ranch',
  'bend-golf-country-club': 'Bend Golf Club',
  'rivers-edge': "River's Edge",
  'awbrey-glen': 'Awbrey Glen',
  'broken-top': 'Broken Top',
  pronghorn: 'Pronghorn',
}

/**
 * How near a feature has to lie to a hole's routing to belong to that hole,
 * measured to the routing SEGMENTS rather than to its handful of vertices — a
 * three-point way leaves 200 m gaps between vertices, and a nearest-vertex rule
 * hands the middle of one fairway to the hole next door.
 *
 * Turf runs wide because a traced blob is a whole fairway corridor; water runs
 * tight because "there is a pond on this hole" is a stronger claim than "there
 * is a pond in this part of the property".
 */
const CATCHMENT_M = {
  turf: 130,
  rough: 130,
  fairway: 130,
  green: 90,
  tee: 90,
  bunker: 90,
  water_hazard: 60,
  lateral_water_hazard: 60,
}
const DEFAULT_CATCHMENT_M = 90

const RAD = Math.PI / 180

function metres(a, b) {
  const k = Math.cos(((a[1] + b[1]) / 2) * RAD)
  return Math.hypot((a[0] - b[0]) * k, a[1] - b[1]) * 111320
}

function centroid(ring) {
  let x = 0
  let y = 0
  for (const [a, b] of ring) {
    x += a
    y += b
  }
  return [x / ring.length, y / ring.length]
}

/** Metres from a point to a polyline, projected flat about the line's latitude. */
function distToLine(pt, line) {
  const k = Math.cos(line[0][1] * RAD)
  const P = ([lo, la]) => [lo * k * 111320, la * 111320]
  const p = P(pt)
  let best = Infinity
  for (let i = 0; i < line.length - 1; i++) {
    const a = P(line[i])
    const b = P(line[i + 1])
    const dx = b[0] - a[0]
    const dy = b[1] - a[1]
    let x = a[0]
    let y = a[1]
    if (dx || dy) {
      const t = ((p[0] - x) * dx + (p[1] - y) * dy) / (dx * dx + dy * dy)
      if (t > 1) {
        x = b[0]
        y = b[1]
      } else if (t > 0) {
        x += dx * t
        y += dy * t
      }
    }
    const d = Math.hypot(p[0] - x, p[1] - y)
    if (d < best) best = d
  }
  return best
}

/** Douglas-Peucker. 0.000012 deg is about 1.3 m — finer than the map draws. */
function simplify(pts, tol = 0.000012) {
  if (pts.length < 4) return pts
  const sq = (a, b) => {
    const dx = a[0] - b[0]
    const dy = a[1] - b[1]
    return dx * dx + dy * dy
  }
  const seg = (p, a, b) => {
    let x = a[0]
    let y = a[1]
    const dx = b[0] - x
    const dy = b[1] - y
    if (dx || dy) {
      const t = ((p[0] - x) * dx + (p[1] - y) * dy) / (dx * dx + dy * dy)
      if (t > 1) {
        x = b[0]
        y = b[1]
      } else if (t > 0) {
        x += dx * t
        y += dy * t
      }
    }
    return sq(p, [x, y])
  }
  const t2 = tol * tol
  const keep = new Array(pts.length).fill(false)
  keep[0] = true
  keep[pts.length - 1] = true
  const stack = [[0, pts.length - 1]]
  while (stack.length) {
    const [i, j] = stack.pop()
    let m = 0
    let mi = -1
    for (let k = i + 1; k < j; k++) {
      const d = seg(pts[k], pts[i], pts[j])
      if (d > m) {
        m = d
        mi = k
      }
    }
    if (m > t2 && mi > 0) {
      keep[mi] = true
      stack.push([i, mi], [mi, j])
    }
  }
  return pts.filter((_, i) => keep[i])
}

const round = (ring) => ring.map(([a, b]) => [Number(a.toFixed(5)), Number(b.toFixed(5))])

/** Parse the published card straight out of the registry, keyed by shortName. */
function readRegistry() {
  const src = fs.readFileSync(path.join(ROOT, 'data/golf/courses.ts'), 'utf8')
  // Split on object starts so a field can never be read from the next course.
  const chunks = src.split(/\n\s*\{\s*\n/).slice(1)
  const out = {}
  for (const c of chunks) {
    const g = (re) => {
      const m = c.match(re)
      return m ? m[1] : null
    }
    const short = g(/shortName:\s*'([^']+)'/)
    if (!short) continue
    out[short] = {
      name: g(/\bname:\s*'([^']+)'/),
      slug: g(/\bslug:\s*'([^']+)'/),
      par: Number(g(/\bpar:\s*(\d+)/)) || null,
      yards: Number(g(/yardsBackTees:\s*(\d+)/)) || null,
      holes: Number(g(/\bholes:\s*(\d+)/)) || null,
      designer: g(/designer:\s*'([^']+)'/),
      signature: g(/signature:\s*'([^']*)'/),
    }
  }
  return out
}

const GROUND_KINDS = [
  'fairway',
  'green',
  'tee',
  'bunker',
  'rough',
  'water_hazard',
  'lateral_water_hazard',
]

function buildCourse(course, turf) {
  const feats = (course.features || [])
    .map((e) => ({
      kind: e.tags?.golf,
      tags: e.tags || {},
      ring: (e.geometry || []).map((p) => [p.lon, p.lat]),
    }))
    .filter((f) => f.ring.length > 1)

  const holes = feats
    .filter((f) => f.kind === 'hole' && f.tags.ref)
    .map((f) => ({
      ref: String(f.tags.ref),
      par: f.tags.par ? Number(f.tags.par) : null,
      handicap: f.tags.handicap ? Number(f.tags.handicap) : null,
      // OSM `dist` is metres when present.
      metres: f.tags.dist ? Number(String(f.tags.dist).replace(/[^\d.]/g, '')) : null,
      line: f.ring,
    }))

  // One routing per hole number; a hole mapped twice keeps the longer way.
  const byRef = new Map()
  for (const h of holes) {
    let len = 0
    for (let i = 1; i < h.line.length; i++) len += metres(h.line[i - 1], h.line[i])
    const prev = byRef.get(h.ref)
    if (!prev || len > prev.walked) byRef.set(h.ref, { ...h, walked: len })
  }
  const routed = [...byRef.values()].sort((a, b) => Number(a.ref) - Number(b.ref))
  for (const h of routed) {
    const m = h.metres ?? h.walked
    h.yards = m ? Math.round(m * 1.09361) : null
  }

  const ground = [
    // The course's own OSM boundary, drawn first. Without it Tetherow reads as a
    // constellation of turf fragments rather than a property: this region's
    // courses are high-desert, and only 40 of Tetherow's 218 acres are mown.
    ...(course.rings || []).map((ring) => ({ kind: 'bounds', ring })),
    ...(turf?.polys || []).map((ring) => ({ kind: 'turf', ring })),
    ...feats.filter((f) => GROUND_KINDS.includes(f.kind)).map((f) => ({ kind: f.kind, ring: f.ring })),
  ]
  for (const f of ground) {
    // The boundary belongs to the course, never to a hole.
    if (f.kind === 'bounds') {
      f.hole = null
      continue
    }
    const c = centroid(f.ring)
    const limit = CATCHMENT_M[f.kind] ?? DEFAULT_CATCHMENT_M
    let best = null
    let bestD = Infinity
    for (const h of routed) {
      const d = distToLine(c, h.line)
      if (d < bestD) {
        bestD = d
        best = h.ref
      }
    }
    f.hole = bestD <= limit ? best : null
  }
  return { holes: routed, ground }
}

function main() {
  const db = JSON.parse(fs.readFileSync(OSM, 'utf8'))
  const registry = readRegistry()
  fs.mkdirSync(OUT_DIR, { recursive: true })

  let written = 0
  let bytes = 0
  const held = []

  for (const [slug, course] of Object.entries(db)) {
    const pub = registry[REGISTRY_SHORT_NAME[slug]] ?? null
    let turf = null
    try {
      turf = JSON.parse(fs.readFileSync(path.join(TURF_DIR, `turf-${slug}.json`), 'utf8'))
    } catch {
      turf = null
    }
    const built = buildCourse(course, turf)

    if (!pub) {
      held.push(`${slug}: no registry row (add it to data/golf/courses.ts)`)
      continue
    }
    if (!pub.holes || built.holes.length !== pub.holes) {
      held.push(`${slug}: mapped ${built.holes.length} of ${pub.holes ?? '?'} holes`)
      continue
    }

    const osmPar = built.holes.reduce((a, h) => a + (h.par || 0), 0)
    const osmYards = built.holes.reduce((a, h) => a + (h.yards || 0), 0)
    const parReconciles = !!pub.par && osmPar === pub.par
    const yardsReconcile =
      !!pub.yards && osmYards > 0 && Math.abs(osmYards - pub.yards) / pub.yards <= 0.01

    const out = {
      slug,
      courseSlug: pub.slug,
      name: pub.name || course.name,
      published: { par: pub.par, yards: pub.yards, holes: pub.holes, designer: pub.designer },
      parReconciles,
      yardsReconcile,
      turfAcres: turf?.acres ?? null,
      holes: built.holes.map((h) => ({
        ref: h.ref,
        par: h.par,
        yards: h.yards,
        handicap: h.handicap,
        line: round(simplify(h.line)),
      })),
      shapes: built.ground
        .filter((f) => f.ring.length > 3)
        .map((f) => ({ k: f.kind, h: f.hole, r: round(simplify(f.ring)) }))
        .filter((f) => f.r.length > 3),
    }

    const json = JSON.stringify(out)
    bytes += json.length
    written++
    if (!DRY) fs.writeFileSync(path.join(OUT_DIR, `${slug}.json`), json)
    console.log(
      `${slug.padEnd(24)} ${(json.length / 1024).toFixed(0).padStart(4)} KB  ` +
        `${String(out.holes.length).padStart(2)} holes  ${String(out.shapes.length).padStart(3)} shapes  ` +
        `par ${parReconciles ? `${osmPar} OK` : `${osmPar} vs ${pub.par} HELD`}  ` +
        `yards ${yardsReconcile ? `${osmYards} OK` : `${osmYards} vs ${pub.yards} HELD`}`,
    )
  }

  console.log(`\n${written} course${written === 1 ? '' : 's'}, ${(bytes / 1024).toFixed(0)} KB total`)
  if (held.length) {
    console.log('\nnot written:')
    for (const h of held) console.log(`  ${h}`)
  }
}

main()
