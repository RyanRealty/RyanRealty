#!/usr/bin/env node
/**
 * check-boundary-provenance.mjs — ci:boundary-provenance.
 *
 * public.boundaries is the ONE place polygon geometry is allowed to come from,
 * and repo memory feedback_gis_authoritative_only is absolute: official GIS
 * sources only, never approximated or hand-drawn geometry. Until now that rule
 * was prose. ci:boundary-sanity (G47) guards community polygon SIZE; nothing
 * guarded WHERE a polygon came from, or which geo_types may exist at all — so
 * `boundaries` quietly accumulated 12 self-derived "Ryan Realty spatial
 * discovery v6" hulls and 12 crowd-sourced OpenStreetMap park shapes alongside
 * the county/state layers.
 *
 * This gate reads the provenance snapshot at
 * scripts/gis/boundary-provenance-snapshot.json (observations, refreshed from
 * live Supabase by `node scripts/gis/import-ode-school-districts.mjs
 * --snapshot`) and enforces four things. The POLICY lives here, in the gate, so
 * refreshing the snapshot can never loosen it.
 *
 *   1. DECLARED GEO_TYPES. Every geo_type present must be declared below with a
 *      named authoritative publisher. A new geo_type has to be declared here
 *      AND allowed by the boundaries_geo_type_check CHECK constraint
 *      (supabase/migrations/20260724223000_boundaries_geo_type_school_district.sql),
 *      which forces a human to name its source before any row lands.
 *
 *   2. BANNED GEO_TYPES — currently just 'trail'. Decision W2.7, recorded
 *      mechanically: trail geometry is LINEWORK, not area. It lives in
 *      public.trail_lines as MultiLineString(4326) from USFS
 *      Trans_Trail_NFS_Publish, BPRD BPRD_Trails_Public and BLM National GTLF,
 *      loaded by scripts/seo-import-trail-lines.mjs with a trailhead-proximity
 *      guard. A trail POLYGON could only be a corridor we buffered around that
 *      linework — invented geometry no agency publishes. So no 'trail' rows in
 *      boundaries, ever, unless an authoritative corridor layer is found and
 *      this decision is rewritten.
 *
 *   3. FLOORS. Each declared geo_type carries a minimum row count. Deleting the
 *      ODE school-district layer (or the school attendance areas, or the city
 *      polygons) and refreshing the snapshot turns the build RED instead of
 *      shipping a silently emptier map.
 *
 *   4. PUBLISHER POLICY. Every publisher must be either AUTHORITATIVE (an
 *      official agency GIS layer) or a listed NON_OFFICIAL debt entry whose row
 *      count may only SHRINK. An unrecognised publisher — "approximated",
 *      "hand-drawn", "estimated", some vendor, or a new self-derived hull —
 *      fails the build. That is the actual enforcement of
 *      feedback_gis_authoritative_only.
 *
 * Usage:
 *   node scripts/check-boundary-provenance.mjs            # gate (exit 1 on violation)
 *   node scripts/check-boundary-provenance.mjs --report   # human summary, exit 0
 */
import { readFileSync, existsSync } from 'node:fs'

const SNAPSHOT = 'scripts/gis/boundary-provenance-snapshot.json'
const REPORT = process.argv.includes('--report')

/** geo_type -> { minRows, why } — the declared surface of public.boundaries. */
const DECLARED_GEO_TYPES = {
  city: { minRows: 10, why: 'Census TIGER/Line 2024 places — city + CDP pages' },
  neighborhood: { minRows: 28, why: 'City of Bend GIS neighborhood districts + county plat unions — community pages' },
  subdivision: { minRows: 3200, why: 'Deschutes County GIS subdivision plats — subdivision pages' },
  park: { minRows: 18, why: 'Oregon State Parks (OPRD via Oregon GEO) + tracked OSM debt — park pages' },
  school: { minRows: 37, why: 'Deschutes County GIS school ATTENDANCE areas (BoundaryFD/19) — school pages' },
  school_district: {
    minRows: 6,
    why: 'Oregon Dept of Education "School District Boundaries All" (EDUCATIONAL_BOUNDARIES layer 2) — district polygons, W2.7',
  },
}

/** geo_types that must NEVER appear, with the recorded reason. */
const BANNED_GEO_TYPES = {
  trail: 'W2.7 decision: trail geometry is authoritative LINEWORK in public.trail_lines (USFS / BPRD / BLM). A trail polygon could only be a corridor we buffered ourselves — invented geometry. Keep trails in trail_lines.',
}

/** Official agency GIS publishers. A row sourced here is authoritative. */
const AUTHORITATIVE_PUBLISHERS = new Set([
  'City of Bend GIS',
  'Deschutes County GIS',
  'Deschutes County GIS Subdivisions',
  'Oregon Department of Education',
  'Oregon State Parks',
  'TIGER/Line 2024 Census Designated Places',
  'TIGER/Line 2024 Incorporated Places',
  // A dissolve of Deschutes County GIS plat polygons — county geometry, aggregated, not redrawn.
  'county_plat_union',
])

/**
 * Non-official publishers already in the table — TRACKED DEBT, not permission.
 * Each cap is today's row count. Adding a row under one of these fails the
 * build; re-sourcing rows to an official layer means lowering the cap here.
 * The numbers may only go DOWN.
 */
const NON_OFFICIAL_MAX = {
  'Ryan Realty spatial discovery v6': {
    max: 12,
    debt: 'Self-derived hulls over Spark MLS subdivision aliases (Sunriver, Black Butte Ranch, Broken Top, ...). Not agency geometry. Re-source to Deschutes County GIS plat unions and lower this cap.',
  },
  'OpenStreetMap contributors': {
    max: 12,
    debt: 'Crowd-sourced park shapes. Bend Metro Park & Recreation District, City of Redmond and City of Prineville publish authoritative park layers. Re-source and lower this cap.',
  },
}

function fail(lines) {
  console.error('\n[31m✗ ci:boundary-provenance FAILED[0m\n')
  for (const l of lines) console.error('  - ' + l + '\n')
  console.error(
    'public.boundaries is the authoritative-geometry table (repo memory feedback_gis_authoritative_only).\n' +
      'Refresh the snapshot after a legitimate change:\n' +
      '  node scripts/gis/import-ode-school-districts.mjs --snapshot\n',
  )
  process.exit(1)
}

if (!existsSync(SNAPSHOT)) {
  fail([`${SNAPSHOT} is missing. Generate it: node scripts/gis/import-ode-school-districts.mjs --snapshot`])
}

let snap
try {
  snap = JSON.parse(readFileSync(SNAPSHOT, 'utf8'))
} catch (e) {
  fail([`${SNAPSHOT} is not valid JSON: ${e.message}`])
}

const geoTypes = snap?.geoTypes
const publishers = snap?.publishers
if (!geoTypes || typeof geoTypes !== 'object' || !publishers || typeof publishers !== 'object') {
  fail([`${SNAPSHOT} is malformed — expected "geoTypes" and "publishers" objects.`])
}

const problems = []

// 1 + 2 — declared / banned geo_types
for (const [type, info] of Object.entries(geoTypes)) {
  if (BANNED_GEO_TYPES[type]) {
    problems.push(
      `geo_type "${type}" is BANNED from public.boundaries (${info.rows} row(s) found).\n    ${BANNED_GEO_TYPES[type]}`,
    )
    continue
  }
  if (!DECLARED_GEO_TYPES[type]) {
    problems.push(
      `geo_type "${type}" (${info.rows} row(s)) is NOT declared in DECLARED_GEO_TYPES.\n` +
        '    Declare it here with its authoritative publisher, and add it to boundaries_geo_type_check in a migration.',
    )
  }
}

// 3 — floors
for (const [type, spec] of Object.entries(DECLARED_GEO_TYPES)) {
  const got = geoTypes[type]?.rows ?? 0
  if (got < spec.minRows) {
    problems.push(
      `geo_type "${type}" has ${got} row(s), floor is ${spec.minRows} — ${spec.why}.\n` +
        '    Rows disappeared, or the layer was never loaded. A shrinking boundary layer silently blanks maps and geo pages.',
    )
  }
}

// 4 — publisher policy
for (const [pub, count] of Object.entries(publishers)) {
  if (AUTHORITATIVE_PUBLISHERS.has(pub)) continue
  const debt = NON_OFFICIAL_MAX[pub]
  if (!debt) {
    problems.push(
      `publisher "${pub}" (${count} row(s)) is neither an authoritative agency layer nor a tracked debt entry.\n` +
        '    Geometry in public.boundaries must trace to an official GIS publisher. Never approximate, buffer or hand-draw a polygon.',
    )
    continue
  }
  if (count > debt.max) {
    problems.push(
      `publisher "${pub}" grew to ${count} row(s); the ratchet cap is ${debt.max}.\n` +
        `    ${debt.debt}\n    This list may only shrink — do not raise the cap.`,
    )
  }
}

if (problems.length && !REPORT) fail(problems)

const totalRows = Object.values(geoTypes).reduce((n, t) => n + t.rows, 0)
const debtRows = Object.keys(NON_OFFICIAL_MAX).reduce((n, p) => n + (publishers[p] ?? 0), 0)

console.log(
  `ci:boundary-provenance OK — ${totalRows} boundary rows across ${Object.keys(geoTypes).length} declared geo_types ` +
    `(snapshot ${snap.generatedAt}).`,
)
for (const [type, spec] of Object.entries(DECLARED_GEO_TYPES)) {
  const t = geoTypes[type]
  const pubs = Object.entries(t?.publishers ?? {})
    .map(([p, n]) => `${p} (${n})`)
    .join(', ')
  console.log(`   ${type}: ${t?.rows ?? 0} rows (floor ${spec.minRows}) — ${pubs}`)
}
if (debtRows) {
  console.log(`   tracked non-official debt: ${debtRows} row(s) — caps may only shrink:`)
  for (const [p, d] of Object.entries(NON_OFFICIAL_MAX)) {
    const c = publishers[p] ?? 0
    if (c) console.log(`     ${p}: ${c}/${d.max}`)
  }
}
console.log(`   banned geo_types: ${Object.keys(BANNED_GEO_TYPES).join(', ')} (trail geometry lives in public.trail_lines)`)

if (problems.length) {
  console.log('\n(--report) would-fail findings:')
  for (const p of problems) console.log('  - ' + p)
}
process.exit(0)
