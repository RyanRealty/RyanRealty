#!/usr/bin/env node
/**
 * ci:boundary-sanity (G47) — enforcement for the oversized-community-boundary
 * class (found 2026-06-14: broken-top's boundary was 11,496 acres vs ~450 real,
 * so the subdivisions list, map shape, in-boundary listings, and counts were all
 * wrong). Tetherow had the same bug and was corrected (5,718ac -> 699ac).
 *
 * Rather than one-off patching each page, this gate fails the build when a
 * `neighborhood` boundary exceeds the plausible threshold and is NOT accounted
 * for in data/boundary-sanity-baseline.json, in one of two ways:
 *
 *   allowed   — the polygon is WRONG (or unchecked) and awaits correction. The
 *               community pages read this list as their one trust rule
 *               (lib/communities/community-outline.ts): an outline listed here
 *               is read by nothing on the page, not the map and not the homes
 *               list. Every entry names why in `evidence`.
 *   verified  — the polygon is genuinely this large: an authoritative county or
 *               city line, checked. Each entry records the acres it was checked
 *               at, its source and the evidence. When the measured acres move
 *               more than 1% from the recorded acres the polygon changed, and
 *               the entry fails until someone checks it again.
 *
 * WHY TWO LISTS (2026-09-25). The baseline used to be one list meaning both
 * "awaiting correction" and "genuinely large", and the community pages read
 * it as "do not trust". After the 2026-08-23 rebuilds from county plats the
 * snapshot was never refreshed (last 2026-06-14), so Sunriver, Brasada Ranch
 * and Three Rivers, correct and genuinely large, drew no map for a month.
 *
 * Refresh the acreage snapshot (data/boundary-sanity.json) with:
 *   SELECT geo_slug, round((ST_Area(polygon::geography)/4046.86)::numeric,0)::int AS acres
 *   FROM public.boundaries WHERE geo_type='neighborhood' AND polygon IS NOT NULL
 *   ORDER BY acres DESC;
 *
 * Usage:
 *   node scripts/check-boundary-sanity.mjs                  # gate (exit 1 on violation)
 *   node scripts/check-boundary-sanity.mjs --write-baseline # add every unaccounted oversized slug to `allowed` (untrusted until checked)
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'

const SNAPSHOT = resolve('data/boundary-sanity.json')
const BASELINE = resolve('data/boundary-sanity-baseline.json')
/** A verified polygon whose measured acres move more than this has changed. */
const VERIFIED_DRIFT = 0.01

function load(path, fallback) {
  if (!existsSync(path)) return fallback
  try {
    return JSON.parse(readFileSync(path, 'utf8'))
  } catch (e) {
    console.error(`[boundary-sanity] cannot parse ${path}: ${e.message}`)
    process.exit(1)
  }
}

/**
 * Every violation of the baseline contract, as sentences. Pure: the snapshot
 * and the baseline are passed in, so the rule is tested on fixtures.
 */
export function boundarySanityFailures(snap, baseline) {
  const failures = []
  const threshold = Number(snap.thresholdAcres) || 800
  const acresBySlug = new Map(snap.boundaries.map((b) => [b.slug, Number(b.acres)]))
  const allowed = new Set(baseline.allowed ?? [])
  const evidence = baseline.evidence ?? {}
  const verified = baseline.verified ?? {}
  const oversized = snap.boundaries
    .filter((b) => Number(b.acres) > threshold)
    .map((b) => b.slug)
    .sort()

  for (const slug of oversized) {
    if (!allowed.has(slug) && !(slug in verified)) {
      failures.push(
        `${slug} (${acresBySlug.get(slug)} acres) exceeds ${threshold} acres and is neither verified nor listed as awaiting correction`,
      )
    }
  }
  for (const slug of allowed) {
    if (slug in verified) failures.push(`${slug} is both verified and awaiting correction; it is one or the other`)
    if (typeof evidence[slug] !== 'string' || evidence[slug].trim().length < 40) {
      failures.push(`${slug} awaits correction with no evidence: say what is wrong with it (40+ characters)`)
    }
  }
  for (const [slug, entry] of Object.entries(verified)) {
    const measured = acresBySlug.get(slug)
    if (measured == null) {
      failures.push(`${slug} is verified but has no row in data/boundary-sanity.json: refresh the snapshot or drop the entry`)
      continue
    }
    const recorded = Number(entry?.acres)
    if (!Number.isFinite(recorded) || recorded <= 0) {
      failures.push(`${slug} is verified with no recorded acres`)
      continue
    }
    if (Math.abs(measured - recorded) / recorded > VERIFIED_DRIFT) {
      failures.push(
        `${slug} was verified at ${recorded} acres and now measures ${measured}: the polygon changed, check it again and re-record`,
      )
    }
    if (typeof entry?.source !== 'string' || entry.source.trim().length < 10) {
      failures.push(`${slug} is verified with no source`)
    }
    if (typeof entry?.evidence !== 'string' || entry.evidence.trim().length < 40) {
      failures.push(`${slug} is verified with no evidence (40+ characters)`)
    }
  }
  return { failures, oversized, threshold }
}

function main() {
  const snap = load(SNAPSHOT, null)
  if (!snap || !Array.isArray(snap.boundaries)) {
    console.error('[boundary-sanity] data/boundary-sanity.json missing or malformed.')
    process.exit(1)
  }
  const baseline = load(BASELINE, { allowed: [], evidence: {}, verified: {} })

  if (process.argv.includes('--write-baseline')) {
    const { oversized } = boundarySanityFailures(snap, baseline)
    const verified = baseline.verified ?? {}
    const allowed = new Set(baseline.allowed ?? [])
    const evidence = { ...(baseline.evidence ?? {}) }
    const today = new Date().toISOString().slice(0, 10)
    let added = 0
    for (const slug of oversized) {
      if (slug in verified || allowed.has(slug)) continue
      allowed.add(slug)
      evidence[slug] = `Baselined by --write-baseline on ${today}: oversized and not yet checked, so no community page reads it.`
      added += 1
    }
    writeFileSync(
      BASELINE,
      JSON.stringify({ ...baseline, allowed: [...allowed].sort(), evidence }, null, 2) + '\n',
    )
    console.log(`[boundary-sanity] baseline written: ${added} oversized boundaries added as awaiting correction.`)
    process.exit(0)
  }

  const { failures, oversized, threshold } = boundarySanityFailures(snap, baseline)
  if (failures.length > 0) {
    console.error(`\n[boundary-sanity] FAIL (${failures.length}):`)
    for (const f of failures) console.error(`   - ${f}`)
    console.error(
      '\nA community boundary this large is almost certainly an un-corrected polygon. Correct it to the\n' +
        'authoritative county plat (Deschutes DIAL / City of Bend GIS), refresh data/boundary-sanity.json, and\n' +
        'commit. If it is genuinely this large, record it under `verified` with its acres, source and evidence.\n',
    )
    process.exit(1)
  }
  const allowed = (baseline.allowed ?? []).length
  console.log(
    `[boundary-sanity] OK — ${oversized.length} boundaries over ${threshold} acres, every one verified or awaiting correction; ${allowed} awaiting correction (untrusted by the community pages).`,
  )
  process.exit(0)
}

if (import.meta.url === `file://${process.argv[1]}`) main()
