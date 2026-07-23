#!/usr/bin/env node
/**
 * check-process-canon.mjs — G44: THE LOOP stays the single canonical process.
 *
 * docs/DEVELOPMENT_PROCESS.md is the versioned source of truth for how all
 * development happens (the ingest->diagnose->prioritize->fix->verify->ship->
 * measure->learn->lock->compete cycle). Three failure modes would quietly
 * dissolve it back into scattered plans, so this gate fails the build on:
 *
 *   1. POINTER LOSS — an entry point every agent loads (CLAUDE.md, the
 *      producer TEMPLATE, the cron system-prompt builder) no longer points at
 *      docs/DEVELOPMENT_PROCESS.md.
 *   2. VERSION DRIFT — a pointer's "THE LOOP vX.Y.Z" version differs from the
 *      doc's own "**Version: X.Y.Z**" header (the doc changed but its
 *      consumers were not re-verified).
 *   3. ROGUE PLANS — a new .md lands in docs/plans/ without being registered
 *      in the canon's "Registered plan documents" table. Plans are inputs to
 *      THE LOOP, not parallel processes.
 *
 * Usage: node scripts/check-process-canon.mjs
 */
import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { join, relative } from 'node:path'

const CANON = 'docs/DEVELOPMENT_PROCESS.md'

const ENTRY_POINTS = [
  'CLAUDE.md',
  'marketing_brain_skills/producers/TEMPLATE.md',
  'lib/marketing-brain/producer-output-class.ts',
]

const fails = []

if (!existsSync(CANON)) {
  console.error(`FAIL: ${CANON} does not exist — the canonical process doc was deleted.`)
  process.exit(1)
}

const canon = readFileSync(CANON, 'utf8')
const verMatch = canon.match(/\*\*Version:\s*(\d+\.\d+\.\d+)\*\*/)
if (!verMatch) fails.push(`${CANON}: missing the "**Version: X.Y.Z**" header`)
const version = verMatch?.[1]

for (const ep of ENTRY_POINTS) {
  if (!existsSync(ep)) {
    fails.push(`entry point missing from disk: ${ep}`)
    continue
  }
  const src = readFileSync(ep, 'utf8')
  if (!src.includes('docs/DEVELOPMENT_PROCESS.md')) {
    fails.push(`${ep}: no pointer to docs/DEVELOPMENT_PROCESS.md`)
    continue
  }
  const pv = src.match(/THE LOOP v(\d+\.\d+\.\d+)/)
  if (!pv) {
    fails.push(`${ep}: pointer lacks a "THE LOOP vX.Y.Z" version marker`)
  } else if (version && pv[1] !== version) {
    fails.push(`${ep}: points at THE LOOP v${pv[1]} but the canon is v${version} — update the pointer in the same commit as the canon change`)
  }
}

// --- Rogue-plan check (W13.2: recursive + deletions arm) ---
// Parse the "Registered plan documents" table's FIRST column (the `Doc` cell) —
// backticked entries there are registrations; backticks in the Status/description
// column (cross-references) are NOT. An entry ending in `/` registers a whole
// PACKAGE directory (every file within is covered).
function parseRegistry(src) {
  const start = src.indexOf('## Registered plan documents')
  const sec = start >= 0 ? src.slice(start).split('\n## ')[0] : ''
  const files = new Set()
  const dirs = new Set()
  for (const line of sec.split('\n')) {
    if (!line.startsWith('|')) continue
    const docCell = line.split('|')[1] ?? ''
    if (/^\s*Doc\s*$/.test(docCell) || /^\s*:?-+:?\s*$/.test(docCell)) continue // header / separator
    for (const m of docCell.matchAll(/`([^`]+)`/g)) {
      const e = m[1].trim()
      if (e.endsWith('/')) dirs.add(e.replace(/\/+$/, ''))
      else if (e.endsWith('.md')) files.add(e)
    }
  }
  return { files, dirs }
}

// Recursively list every .md under docs/plans, relative to docs/plans.
function walkMd(dir, base, out) {
  let entries
  try { entries = readdirSync(dir, { withFileTypes: true }) } catch { return }
  for (const e of entries) {
    const full = join(dir, e.name)
    if (e.isDirectory()) walkMd(full, base, out)
    else if (e.name.endsWith('.md')) out.push(relative(base, full))
  }
}

const { files: regFiles, dirs: regDirs } = parseRegistry(canon)
const planMd = []
walkMd('docs/plans', 'docs/plans', planMd)

// 1. Rogue: every .md must be registered — its own row (basename for a top-level
//    file; full relative path for a subdir file) OR covered by a registered
//    package directory. Recursion closes the "hide a rogue plan in a subdir" gap.
for (const rel of planMd) {
  const topDir = rel.includes('/') ? rel.split('/')[0] : null
  const coveredByPackage = topDir != null && regDirs.has(topDir)
  const registered = regFiles.has(rel) // rel is the basename for top-level files
  if (!coveredByPackage && !registered) {
    fails.push(`docs/plans/${rel} is not registered in ${CANON} "Registered plan documents" — add a row, place it inside a registered package directory, or do not create rogue plan docs`)
  }
}

// 2. Deletions arm: a registered Doc (file or package dir) that no longer exists
//    on disk is a stale registration — the registry must track reality.
for (const f of regFiles) {
  if (!existsSync(join('docs/plans', f))) {
    fails.push(`registered plan "${f}" in ${CANON} no longer exists on disk — remove its row or restore the file`)
  }
}
for (const d of regDirs) {
  if (!existsSync(join('docs/plans', d))) {
    fails.push(`registered package "${d}/" in ${CANON} no longer exists on disk — remove its row`)
  }
}
const planFiles = planMd // for the summary line below

console.log('Process-canon sync check (G44)')
console.log('==============================')
console.log(`Canon version: v${version ?? '?'} · entry points: ${ENTRY_POINTS.length} · plan docs: ${planFiles.length}`)
if (fails.length === 0) {
  console.log('THE LOOP canon, pointers, and plan registry are in sync.')
  process.exit(0)
}
console.log()
for (const f of fails) console.log('FAIL  ' + f)
process.exit(1)
