#!/usr/bin/env node
/**
 * G33 — Community / neighborhood content-richness gate.
 *
 * Enforces D96 (2026-05-29): EVERY resort/planned community and Bend
 * neighborhood that has a detail page MUST carry rich, verified content
 * (overview prose + at-a-glance facts + amenities/drive-times) sourced from a
 * `data/resort-community-<slug>.json` config. Thin pages are not acceptable
 * (owner directive: "it must be rich in content. hard code the gates to ensure
 * we get the best output").
 *
 * Coverage model (mirrors mockup-parity / page-dal baselines so the gate
 * enforces without blocking the build mid-rollout):
 *   - REQUIRED = every resort/planned community slug (data/resort-communities.json)
 *     + every Bend neighborhood slug (BEND_NEIGHBORHOODS below).
 *   - A geo is COVERED when data/resort-community-<slug>.json exists and parses
 *     with non-empty about_prose AND at least one of amenities/drive_times.
 *   - data/community-content-baseline.json lists the slugs ALLOWED to be missing
 *     today (the rollout backlog). The gate FAILS if:
 *       (a) a REQUIRED geo is missing AND not in the baseline (no new thin pages), OR
 *       (b) a baselined geo is now COVERED but still listed (baseline must shrink).
 *   - Goal: baseline → empty (all geos rich). Content facts are NEVER invented;
 *     a geo gets removed from the baseline only when a VERIFIED config lands.
 */

import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = process.cwd()
const errors = []

// Bend neighborhoods with detail pages (geo_type='neighborhood', bend-* slugs).
// 'bend-undesignated' is a catch-all bucket, not a real neighborhood page.
const BEND_NEIGHBORHOODS = [
  'bend-awbrey-butte', 'bend-boyd-acres', 'bend-century-west', 'bend-larkspur',
  'bend-mountain-view', 'bend-old-bend', 'bend-old-farm-district', 'bend-orchard-district',
  'bend-river-west', 'bend-southeast-bend', 'bend-southern-crossing', 'bend-southwest-bend',
  'bend-summit-west',
]

function readJson(rel) {
  const abs = join(ROOT, rel)
  if (!existsSync(abs)) return null
  try {
    return JSON.parse(readFileSync(abs, 'utf8'))
  } catch {
    return null
  }
}

// REQUIRED geos
const registry = readJson('data/resort-communities.json')
const communitySlugs = (registry?.communities ?? []).map((c) => c.slug)
const required = [...communitySlugs, ...BEND_NEIGHBORHOODS]

// Currently-allowed-missing backlog
const baseline = new Set(readJson('data/community-content-baseline.json')?.missing ?? [])

/** A geo is covered when its config exists with usable rich content. */
function isCovered(slug) {
  const c = readJson(`data/resort-community-${slug}.json`)
  if (!c) return false
  const prose = Array.isArray(c.about_prose)
    ? c.about_prose.filter((p) => typeof p === 'string' && p.trim()).length > 0
    : typeof c.about_prose === 'string' && c.about_prose.trim().length > 0
  const hasDetail =
    (Array.isArray(c.amenities) && c.amenities.length > 0) ||
    (Array.isArray(c.drive_times) && c.drive_times.length > 0)
  return prose && hasDetail
}

const covered = []
const missing = []
for (const slug of required) {
  if (isCovered(slug)) covered.push(slug)
  else missing.push(slug)
}

// (a) new thin pages — missing AND not baselined
const newThin = missing.filter((s) => !baseline.has(s))
for (const slug of newThin) {
  errors.push(
    `${slug}: no rich content config (data/resort-community-${slug}.json with about_prose + amenities/drive_times).\n` +
    `  D96: every community/neighborhood page MUST be content-rich. Author a VERIFIED config\n` +
    `  (primary sources, no invented facts) or add the slug to data/community-content-baseline.json\n` +
    `  with a reason if the page is intentionally deferred.`
  )
}

// (b) baseline must shrink — a covered geo should not still be baselined
const staleBaseline = [...baseline].filter((s) => covered.includes(s))
for (const slug of staleBaseline) {
  errors.push(
    `${slug}: now has rich content but is still in data/community-content-baseline.json.\n` +
    `  Remove it from the baseline (coverage must shrink toward zero).`
  )
}

const pct = required.length ? Math.round((covered.length / required.length) * 100) : 100

if (errors.length) {
  console.error('\nG33 community-content gate FAILED:\n')
  for (const e of errors) console.error('  - ' + e + '\n')
  console.error(`  Coverage: ${covered.length}/${required.length} (${pct}%). Backlog: ${missing.length}.`)
  process.exit(1)
}

console.log(
  `G33 community-content gate passed. Coverage ${covered.length}/${required.length} (${pct}%); ` +
  `${baseline.size} in rollout backlog (must shrink to 0).`
)
