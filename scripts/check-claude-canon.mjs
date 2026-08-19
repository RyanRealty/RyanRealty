#!/usr/bin/env node
/**
 * check-claude-canon.mjs — ci:claude-canon (W13.1).
 *
 * CLAUDE.md is the always-loaded rule file. When it cites a path that no longer
 * exists, or a design token the brand retired, every agent session inherits the
 * drift. This gate makes the canon mechanically honest:
 *
 *   1. NO RETIRED VENDOR-CRM DOC PATHS. docs/FUB_*.md and any docs path that
 *      pairs FOLLOW+BOSS are gone. A new one fails.
 *
 *   2. NO VENDOR-CRM PRODUCT NAME IN TRACKED TEXT. The live CRM is
 *      public.crm_people / /admin/crm. Historical product names may not
 *      re-enter the tree.
 *
 *   3. CLAUDE.md CITES NO DEAD PATH.
 *
 *   4. NO RETIRED V1 DESIGN TOKEN RESURFACES.
 *
 *   5. CLAUDE.md MAY ONLY SHRINK. Byte budget in scripts/claude-canon-baseline.json.
 *
 * Wired into ci:gates.
 */
import { execSync } from 'node:child_process'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'

const ROOT = process.cwd()
const BASELINE_PATH = 'scripts/claude-canon-baseline.json'
const WRITE_BASELINE = process.argv.includes('--write-baseline')

const CANON_DOCS = [
  'CLAUDE.md',
  'AGENTS.md',
  'docs/README.md',
  'docs/FEATURES.md',
  'docs/MASTER_SPEC.md',
  'docs/SITE_SPEC.md',
  'docs/DEVELOPMENT_PROCESS.md',
]

const RETIRED_HEXES = ['#D4AF37', '#C8A864', '#F2EBDD']
const VENDOR_NAME_RE = new RegExp(
  ['follo', 'w\\s*up\\s*b', 'oss'].join('') + '|' + ['follo', 'wupb', 'oss'].join(''),
  'i',
)
const BINARY_RE = /\.(png|jpg|jpeg|webp|gif|ico|pdf|mp4|mp3|otf|ttf|woff2?|zip)$/i

const failures = []

const onDisk = execSync('git ls-files docs', { encoding: 'utf8' })
  .split('\n')
  .filter(Boolean)
const bannedDocs = onDisk.filter((f) => {
  if (/^docs\/FUB_[^/]*\.md$/.test(f)) return true
  if (/^docs\/HANDOFF_FUB_/.test(f)) return true
  const upper = f.toUpperCase()
  return f.startsWith('docs/') && upper.includes('FOLLOW') && upper.includes('BOSS')
})
for (const f of bannedDocs) {
  failures.push(`retired vendor-CRM doc still tracked: ${f}. Delete it. CRM is lib/crm/send-event.ts + /admin/crm.`)
}

const tracked = execSync('git ls-files', { encoding: 'utf8' }).split('\n').filter(Boolean)
const SCAN_SKIP = new Set([BASELINE_PATH, 'scripts/check-claude-canon.mjs'])
const nameHits = []
for (const f of tracked) {
  if (SCAN_SKIP.has(f) || BINARY_RE.test(f)) continue
  let text
  try {
    text = readFileSync(path.join(ROOT, f), 'utf8')
  } catch {
    continue
  }
  if (VENDOR_NAME_RE.test(text)) nameHits.push(f)
}
for (const f of nameHits) {
  failures.push(`${f} still names the retired vendor CRM. Point at /admin/crm or delete the line.`)
}

const claudeBytes = Buffer.byteLength(readFileSync(path.join(ROOT, 'CLAUDE.md')))
if (WRITE_BASELINE) {
  writeFileSync(
    BASELINE_PATH,
    JSON.stringify(
      {
        note:
          'Ratchets for ci:claude-canon. `files` is unused (vendor-CRM citations must be zero). `claudeBytes`: CLAUDE.md size. May only shrink. Refresh with node scripts/check-claude-canon.mjs --write-baseline after a shrink.',
        generatedAt: new Date().toISOString(),
        claudeBytes,
        files: [],
      },
      null,
      2,
    ) + '\n',
  )
  console.log(`baseline written: CLAUDE.md ${claudeBytes} bytes.`)
}

let baselineBytes = null
try {
  const parsed = JSON.parse(readFileSync(path.join(ROOT, BASELINE_PATH), 'utf8'))
  baselineBytes = typeof parsed.claudeBytes === 'number' ? parsed.claudeBytes : null
} catch {
  failures.push(`${BASELINE_PATH} is missing or unreadable. Generate it: node scripts/check-claude-canon.mjs --write-baseline`)
}

const claude = readFileSync(path.join(ROOT, 'CLAUDE.md'), 'utf8')
const linkRe = /\]\(([^)]+)\)/g
let m
const deadLinks = new Set()
while ((m = linkRe.exec(claude)) !== null) {
  const target = m[1].trim()
  if (/^(https?:|mailto:|#|~)/.test(target)) continue
  const clean = target.split('#')[0].replace(/^\.\//, '')
  if (!clean || clean.includes('<')) continue
  if (!existsSync(path.join(ROOT, clean))) deadLinks.add(clean)
}
for (const d of deadLinks) {
  failures.push(`CLAUDE.md links to ${d}, which does not exist on disk.`)
}

const lines = claude.split('\n')
lines.forEach((line, i) => {
  for (const hex of RETIRED_HEXES) {
    if (line.includes(hex) && !/retired/i.test(line)) {
      failures.push(`CLAUDE.md:${i + 1} uses retired v1 token ${hex} without marking it retired.`)
    }
  }
})

if (baselineBytes === null && !WRITE_BASELINE) {
  failures.push(
    `${BASELINE_PATH} has no claudeBytes budget. Record it: node scripts/check-claude-canon.mjs --write-baseline`,
  )
} else if (baselineBytes !== null && claudeBytes > baselineBytes) {
  failures.push(
    `CLAUDE.md grew to ${claudeBytes} bytes, over its ${baselineBytes}-byte budget (+${claudeBytes - baselineBytes}). ` +
      `This file loads into EVERY session — it may only shrink. Put the new rule in the doc that owns the surface and ` +
      `leave a pointer here, or remove an equal weight of duplication and refresh with --write-baseline.`,
  )
}

console.log('CLAUDE.md canon gate (ci:claude-canon)')
console.log('======================================')
console.log(
  `banned docs: ${bannedDocs.length} · vendor-name hits: ${nameHits.length} · CLAUDE.md links dead ${deadLinks.size} · CLAUDE.md ${claudeBytes}/${baselineBytes ?? '—'} bytes`,
)
if (failures.length > 0) {
  console.error(`\n✗ ci:claude-canon — ${failures.length} failure(s):`)
  for (const f of failures) console.error(`  - ${f}`)
  process.exit(1)
}
console.log('\n✓ Canon is honest: no vendor-CRM docs, no dead CLAUDE.md link, no retired token resurfaced.')
