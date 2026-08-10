#!/usr/bin/env node
/**
 * TRACK3 ratchet: fubPersonId / FUB_* identifier debt may only shrink.
 * Full rename is multi-session; this gate prevents NEW identifiers landing.
 *
 * Baseline: scripts/fub-identifiers-baseline.json
 *   node scripts/check-fub-identifiers-ratchet.mjs
 *   node scripts/check-fub-identifiers-ratchet.mjs --write-baseline
 */
import { readFileSync, writeFileSync, readdirSync, statSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = process.cwd()
const BASELINE = join(ROOT, 'scripts/fub-identifiers-baseline.json')
const WRITE = process.argv.includes('--write-baseline')
const ROOTS = ['app', 'lib', 'components']
const RE = /\bfubPersonId\b|\bFUB_[A-Z0-9_]+\b|\bfub_[a-z0-9_]+\b/g

function walk(dir, out = []) {
  let entries
  try {
    entries = readdirSync(dir)
  } catch {
    return out
  }
  for (const e of entries) {
    const p = join(dir, e)
    if (e === 'node_modules' || e === '.next' || e === 'dist') continue
    const s = statSync(p)
    if (s.isDirectory()) walk(p, out)
    else if (/\.(ts|tsx|js|mjs)$/.test(e) && !e.endsWith('.test.ts') && !e.endsWith('.test.tsx')) {
      out.push(p)
    }
  }
  return out
}

const files = ROOTS.flatMap((r) => walk(join(ROOT, r)))
const hits = []
for (const f of files) {
  const text = readFileSync(f, 'utf8')
  const matches = text.match(RE)
  if (matches?.length) {
    hits.push({
      file: f.slice(ROOT.length + 1),
      count: matches.length,
    })
  }
}
hits.sort((a, b) => a.file.localeCompare(b.file))
const total = hits.reduce((n, h) => n + h.count, 0)
const fileSet = hits.map((h) => h.file)

if (WRITE) {
  writeFileSync(
    BASELINE,
    JSON.stringify(
      {
        note: 'TRACK3 fub identifier ratchet — counts may only shrink. Full rename is separate work.',
        total,
        files: fileSet,
        generatedAt: new Date().toISOString(),
      },
      null,
      2,
    ) + '\n',
  )
  console.log(`fub-identifiers baseline written: ${total} hits across ${fileSet.length} files`)
  process.exit(0)
}

if (!existsSync(BASELINE)) {
  console.error('Missing scripts/fub-identifiers-baseline.json — run with --write-baseline once')
  process.exit(1)
}
const base = JSON.parse(readFileSync(BASELINE, 'utf8'))
const baseFiles = new Set(base.files ?? [])
const baseTotal = base.total ?? 0
const newFiles = fileSet.filter((f) => !baseFiles.has(f))
const failures = []
if (total > baseTotal) {
  failures.push(`total hits grew ${baseTotal} → ${total}`)
}
if (newFiles.length) {
  failures.push(`NEW files with fub identifiers:\n  ${newFiles.slice(0, 20).join('\n  ')}`)
}

console.log('fub-identifiers ratchet')
console.log('=======================')
console.log(`live: ${total} hits / ${fileSet.length} files · baseline: ${baseTotal} / ${baseFiles.size}`)
if (failures.length) {
  for (const f of failures) console.error('✗', f)
  process.exit(1)
}
console.log('✓ no new fub identifier surface; total ≤ baseline')
if (total < baseTotal) {
  console.log(`  Tip: re-baseline to lock the shrink (${baseTotal - total} hits cleared)`)
}
