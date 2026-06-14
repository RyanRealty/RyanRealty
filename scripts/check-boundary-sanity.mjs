#!/usr/bin/env node
/**
 * ci:boundary-sanity (G47) — enforcement for the oversized-community-boundary
 * class (found 2026-06-14: broken-top's boundary was 11,496 acres vs ~450 real,
 * so the subdivisions list, map shape, in-boundary listings, and counts were all
 * wrong). Tetherow had the same bug and was corrected (5,718ac -> 699ac).
 *
 * Rather than one-off patching each page, this gate fails the build when a
 * community/master-planned `neighborhood` boundary exceeds the plausible
 * threshold and is NOT explicitly baselined. So a NEW community can't be added
 * with a junk polygon, and the known-bad set is a tracked cleanup list that only
 * shrinks (correct a boundary -> refresh data/boundary-sanity.json -> drop it
 * from the baseline).
 *
 * Refresh the acreage snapshot (data/boundary-sanity.json) with:
 *   SELECT geo_slug, round((ST_Area(polygon::geography)/4046.86)::numeric,0)::int AS acres
 *   FROM public.boundaries WHERE geo_type='neighborhood' AND polygon IS NOT NULL
 *   ORDER BY acres DESC;
 *
 * Usage:
 *   node scripts/check-boundary-sanity.mjs                 # gate (exit 1 on violation)
 *   node scripts/check-boundary-sanity.mjs --write-baseline # accept current oversized set
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'

const SNAPSHOT = resolve('data/boundary-sanity.json')
const BASELINE = resolve('data/boundary-sanity-baseline.json')

function load(path, fallback) {
  if (!existsSync(path)) return fallback
  try {
    return JSON.parse(readFileSync(path, 'utf8'))
  } catch (e) {
    console.error(`[boundary-sanity] cannot parse ${path}: ${e.message}`)
    process.exit(1)
  }
}

const snap = load(SNAPSHOT, null)
if (!snap || !Array.isArray(snap.boundaries)) {
  console.error('[boundary-sanity] data/boundary-sanity.json missing or malformed.')
  process.exit(1)
}

const threshold = Number(snap.thresholdAcres) || 800
const oversized = snap.boundaries
  .filter((b) => Number(b.acres) > threshold)
  .map((b) => b.slug)
  .sort()

if (process.argv.includes('--write-baseline')) {
  writeFileSync(
    BASELINE,
    JSON.stringify(
      {
        note: 'Communities allowed to exceed thresholdAcres in data/boundary-sanity.json — either an un-corrected oversized polygon awaiting authoritative-plat correction (see memory reference-oversized-community-boundaries) or a genuinely large rural community. Correct a boundary, refresh the snapshot, then remove its slug here. A NEW oversized boundary not listed fails ci:boundary-sanity.',
        allowed: oversized,
      },
      null,
      2,
    ) + '\n',
  )
  console.log(`[boundary-sanity] baseline written: ${oversized.length} oversized boundaries accepted.`)
  process.exit(0)
}

const baseline = load(BASELINE, { allowed: [] })
const allowed = new Set(baseline.allowed ?? [])
const unbaselined = oversized.filter((slug) => !allowed.has(slug))

if (unbaselined.length > 0) {
  console.error(
    `\n[boundary-sanity] FAIL: ${unbaselined.length} community boundary polygon(s) exceed ${threshold} acres and are not baselined:`,
  )
  for (const slug of unbaselined) {
    const acres = snap.boundaries.find((b) => b.slug === slug)?.acres
    console.error(`   - ${slug} (${acres} acres)`)
  }
  console.error(
    '\nA community boundary this large is almost certainly an un-corrected polygon. Correct it to the\n' +
      'authoritative county plat (Deschutes DIAL / City of Bend GIS), refresh data/boundary-sanity.json, and\n' +
      'commit. If it is genuinely this large, accept it: npm run ci:boundary-sanity:baseline\n',
  )
  process.exit(1)
}

console.log(
  `[boundary-sanity] OK — ${oversized.length} oversized boundaries, all baselined (tracked for plat correction).`,
)
process.exit(0)
