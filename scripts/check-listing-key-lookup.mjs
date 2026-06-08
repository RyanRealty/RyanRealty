#!/usr/bin/env node
/**
 * check-listing-key-lookup.mjs — CI gate: every listing-key READ resolves first.
 *
 * THE recurring bug this kills: listing-related data is looked up by a key that
 * is sometimes the MLS ListNumber (carried by canonical /homes-for-sale pretty
 * URLs) and sometimes the RETS ListingKey. Related tables (listing_photos,
 * listing_videos, listing_agents, listing_history, open_houses,
 * engagement_metrics, similar_listings_mv, saved_listings, likes) are keyed by
 * ListingKey. A read that does `.eq('listing_key', key)` with a ListNumber
 * silently returns NOTHING. It has broken photos, videos, history, and the
 * similar rail, repeatedly.
 *
 * This gate flags any `.eq('listing_key'|'ListingKey', X)` / `.in(...)` READ
 * that does not resolve the key first. A read is SAFE when, within its function,
 * it either:
 *   - calls resolveCanonicalListingKey(...), or
 *   - does a dual-column resolve itself (also references .eq('ListNumber', ...)),
 *   - or is annotated `// @canonical-key` (caller guarantees a ListingKey).
 * Writes (.update/.delete/.insert/.upsert) are exempt (ingest controls the key).
 *
 * Ratcheted: pre-existing unresolved reads are baselined; NEW ones fail CI.
 *
 * Usage:
 *   node scripts/check-listing-key-lookup.mjs            # CI
 *   node scripts/check-listing-key-lookup.mjs --report
 *   node scripts/check-listing-key-lookup.mjs --json
 *   node scripts/check-listing-key-lookup.mjs --write-baseline
 */

import { readFileSync, readdirSync, statSync, writeFileSync, existsSync } from 'node:fs'
import { join, resolve, relative } from 'node:path'

const ROOT = resolve(new URL('.', import.meta.url).pathname, '..')
const BASELINE_PATH = join(ROOT, 'scripts/listing-key-lookup-baseline.json')
const SCAN_DIRS = ['lib/data', 'app/actions', 'app/api']

const args = new Set(process.argv.slice(2))
const REPORT = args.has('--report')
const JSON_OUT = args.has('--json')
const WRITE_BASELINE = args.has('--write-baseline')

// A listing-key READ filter: .eq('listing_key'|'ListingKey', ...) or .in(...).
const READ_FILTER = /\.(?:eq|in)\(\s*['"](?:listing_key|ListingKey)['"]/
const WRITE_MARKER = /\.(?:update|delete|insert|upsert)\(/
const RESOLVE_CALL = /resolveCanonicalListingKey\s*\(/
// A function that ALSO filters by ListNumber / list_number (any form) is doing
// its own dual-column resolve (getListingRawRow, getListingPhotos, getListingTiles).
const DUAL_RESOLVE = /\.(?:eq|in)\(\s*['"](?:ListNumber|list_number)['"]/
const CANON_ANNOTATION = /@canonical-key/
const COMMENT_LINE = /^\s*(?:\*|\/\/|\/\*)/

function walk(dir, acc = []) {
  let entries
  try { entries = readdirSync(dir) } catch { return acc }
  for (const entry of entries) {
    const full = join(dir, entry)
    const st = statSync(full)
    if (st.isDirectory()) {
      if (entry === 'node_modules' || entry === '.next' || entry === 'sync') continue
      walk(full, acc)
    } else if (entry.endsWith('.ts') && !entry.endsWith('.test.ts')) {
      acc.push(full)
    }
  }
  return acc
}

function classifyFile(file) {
  const src = readFileSync(file, 'utf8')
  const lines = src.split('\n')
  const rel = relative(ROOT, file)
  const violations = []
  for (let i = 0; i < lines.length; i++) {
    if (!READ_FILTER.test(lines[i])) continue
    if (COMMENT_LINE.test(lines[i])) continue // docstring example, not a real query
    // Window above the filter: writes sit within a couple lines (the .from().delete()
    // chain); a resolve/dual-resolve sits within the function (either side of the read).
    const writeWin = lines.slice(Math.max(0, i - 6), i + 1).join('\n')
    if (WRITE_MARKER.test(writeWin)) continue
    const fnWin = lines.slice(Math.max(0, i - 70), i + 16).join('\n')
    const annWin = lines.slice(Math.max(0, i - 3), i + 1).join('\n')
    const safe =
      RESOLVE_CALL.test(fnWin) ||
      DUAL_RESOLVE.test(fnWin) ||
      CANON_ANNOTATION.test(annWin)
    if (!safe) violations.push(`${rel}:${i + 1}`)
  }
  return violations
}

function loadBaseline() {
  if (!existsSync(BASELINE_PATH)) return new Set()
  return new Set(JSON.parse(readFileSync(BASELINE_PATH, 'utf8')).violations ?? [])
}

function main() {
  const files = SCAN_DIRS.flatMap((d) => walk(join(ROOT, d)))
  const violations = files.flatMap(classifyFile).sort()

  if (WRITE_BASELINE) {
    writeFileSync(
      BASELINE_PATH,
      JSON.stringify({
        generatedAt: new Date().toISOString(),
        reason: 'Listing-key reads not yet routed through resolveCanonicalListingKey at gate-creation time. NEW unresolved reads fail CI; this list only shrinks.',
        total: violations.length,
        violations,
      }, null, 2) + '\n'
    )
    console.log(`Wrote baseline: ${violations.length} unresolved listing-key reads at ${relative(ROOT, BASELINE_PATH)}`)
    process.exit(0)
  }

  const baseline = loadBaseline()
  const newViolations = violations.filter((v) => !baseline.has(v))
  const fixedSinceBaseline = [...baseline].filter((v) => !violations.includes(v))

  if (JSON_OUT) {
    console.log(JSON.stringify({ total: violations.length, baselineSize: baseline.size, newViolations, fixedSinceBaseline }, null, 2))
    process.exit(newViolations.length === 0 ? 0 : 1)
  }

  console.log('Listing-key resolution check (ratcheted)')
  console.log('========================================')
  console.log()
  console.log(`Unresolved listing-key reads (total):  ${violations.length}`)
  console.log(`  Baseline (tracked debt):             ${baseline.size}`)
  console.log(`  NEW unresolved (CI BLOCKER):          ${newViolations.length}`)
  console.log(`  Fixed since baseline:                 ${fixedSinceBaseline.length}`)
  console.log()
  if (newViolations.length > 0) {
    console.log('NEW unresolved listing-key reads (these fail CI):')
    for (const v of newViolations) console.log(`  ${v}`)
    console.log()
    console.log('Fix: resolve the key first ->')
    console.log("  const canonicalKey = await resolveCanonicalListingKey(key)  // from @/lib/data")
    console.log('  ...then filter by canonicalKey. (Writes + already-resolved reads are exempt;')
    console.log('  annotate a guaranteed-canonical read with `// @canonical-key`.)')
  }

  if (REPORT) process.exit(0)
  process.exit(newViolations.length === 0 ? 0 : 1)
}

main()
