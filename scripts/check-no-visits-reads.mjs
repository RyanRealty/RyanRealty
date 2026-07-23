#!/usr/bin/env node
/**
 * check-no-visits-reads.mjs — ci:no-visits-reads (W1.5).
 *
 * The legacy `visits` table is RETIRED for reads. It now only takes a stray
 * legacy WordPress-beacon trickle (via an old anon INSERT policy); all real
 * traffic writes to `visitor_sessions` + `visitor_events`. Four analytics
 * readers (the admin dashboard, traffic-sources + lead-flow reports, and the
 * partnership-revenue action) were reading `visits` and silently showing that
 * stale trickle. They are repointed to the live tables; this gate keeps it that
 * way — any new `.from('visits')` read fails the build. Reads must go to
 * visitor_sessions (session + attribution + identity) or visitor_events
 * (per-page-view path). The table itself is left in place (the beacon still
 * inserts, and dropping it is a separate migration decision).
 *
 * Usage: node scripts/check-no-visits-reads.mjs
 */
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

// `.from('visits')` / `.from("visits")` — the retired-table read. Matches the
// Supabase query builder call specifically, not the word "visits" in prose.
const VISITS_READ = /\.from\(\s*['"]visits['"]\s*\)/

function walk(dir, out) {
  let entries
  try { entries = readdirSync(dir, { withFileTypes: true }) } catch { return }
  for (const e of entries) {
    if (e.name === 'node_modules' || e.name === '.next' || e.name.startsWith('.')) continue
    const full = join(dir, e.name)
    if (e.isDirectory()) walk(full, out)
    else if (/\.(ts|tsx|js|mjs)$/.test(e.name) && !/\.test\.|\.spec\./.test(e.name)) out.push(full)
  }
}

const files = []
for (const root of ['app', 'lib']) walk(root, files)

const hits = []
for (const f of files) {
  const src = readFileSync(f, 'utf8')
  if (VISITS_READ.test(src)) {
    const line = src.split('\n').findIndex((l) => VISITS_READ.test(l)) + 1
    hits.push(`${f.replace(/\\/g, '/')}:${line}`)
  }
}

console.log('Retired-visits-table read gate (ci:no-visits-reads)')
console.log('===================================================')
console.log(`files scanned: ${files.length}`)
if (hits.length) {
  console.error(`\n\x1b[31m✗ ci:no-visits-reads: ${hits.length} read(s) from the retired \`visits\` table\x1b[0m`)
  for (const h of hits) console.error(`  ✗ ${h} — read visitor_sessions / visitor_events instead (visits carries only a stale legacy beacon trickle).`)
  process.exit(1)
}
console.log('✓ No reads from the retired `visits` table; analytics read the live visitor_sessions / visitor_events.')
process.exit(0)
