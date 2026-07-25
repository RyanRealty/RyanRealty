#!/usr/bin/env node
/**
 * check-claude-canon.mjs — ci:claude-canon (W13.1).
 *
 * CLAUDE.md is the always-loaded rule file. When it cites a path that no longer
 * exists, a doc that describes a decommissioned system, or a design token the
 * brand retired, every agent session inherits the drift. This gate makes the
 * canon mechanically honest:
 *
 *   1. FUB-ERA INVENTORY MAY ONLY SHRINK. The Follow Up Boss era docs are the
 *      explicit list below (policy lives HERE, not in data — a doc refresh
 *      cannot loosen it). A NEW docs/FUB_*.md fails. Every era doc still on
 *      disk must open with the <!-- FUB-ERA-ARCHIVED --> marker so an agent
 *      that opens one is told on line 1 not to build against it.
 *
 *   2. CANON DOCS CITE ZERO FUB-ERA PATHS. CLAUDE.md and the live top-level
 *      doc set must not route anyone into the archive as if it were live.
 *
 *   3. THE CITATION SET IS A RATCHET. Every OTHER tracked file that cites a
 *      FUB-era doc (code comments, skills, migrations, old plans) is frozen in
 *      scripts/claude-canon-baseline.json. A file not in the baseline gaining
 *      a citation fails; the set may only shrink. Refresh with
 *      `node scripts/check-claude-canon.mjs --write-baseline` (only after
 *      REMOVING citations, never to admit new ones).
 *
 *   4. CLAUDE.md CITES NO DEAD PATH. Every relative markdown-link target in
 *      CLAUDE.md must exist on disk. (The 2026-06-15 video_production_skills
 *      deletion left a year of dead links; this stops the next one.)
 *
 *   5. NO RETIRED V1 DESIGN TOKEN RESURFACES. The retired hexes (#D4AF37,
 *      #C8A864, #F2EBDD) may appear in CLAUDE.md only on lines that say so
 *      ("retired"), never as a value to use.
 *
 * Wired into ci:gates. Referenced by CLAUDE.md "Mechanical guardrails" and
 * docs/archive/fub-era/README.md.
 */
import { execSync } from 'node:child_process'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'

const ROOT = process.cwd()
const BASELINE_PATH = 'scripts/claude-canon-baseline.json'
const WRITE_BASELINE = process.argv.includes('--write-baseline')

/** The complete FUB-era archive inventory (docs/archive/fub-era/README.md). */
const FUB_ERA_DOCS = [
  'docs/FOLLOWUPBOSS-SETUP.md',
  'docs/FUB_AGENT_LINK_AND_EXPIRED_LP_RESEARCH_2026-05-17.md',
  'docs/FUB_AUDIT_2026-05-17.md',
  'docs/FUB_BROKER_DIGESTS.md',
  'docs/FUB_BUILD_COMPLETE_2026-05-17.md',
  'docs/FUB_BUYER_WORKFLOW_2026-05-17.md',
  'docs/FUB_CLEANUP_FINAL_2026-05-17.md',
  'docs/FUB_COMPLETE_LEAD_FLOW_2026-05-17.md',
  'docs/FUB_COMPLETION_FINAL_2026-05-17.md',
  'docs/FUB_CRM_FEATURE_SPEC.md',
  'docs/FUB_CUSTOM_FIELDS.md',
  'docs/FUB_FSBO_WORKFLOW.md',
  'docs/FUB_GEO_TAGGING_2026-05-17.md',
  'docs/FUB_LEAD_WORKFLOW_LIVE_AUDIT_2026-05-29.md',
  'docs/FUB_OPTIMIZATION_AUDIT_2026-05-17.md',
  'docs/FUB_ROUND2_COMPLETE_2026-05-17.md',
  'docs/FUB_SELLER_WORKFLOW_2026-05-17.md',
  'docs/FUB_SMART_LISTS_STARTER_PACK.md',
  'docs/FUB_UI_SETUP_RUNBOOK.md',
  'docs/HANDOFF_FUB_SMART_LIST_WIRING_2026-05-27.md',
]
const MARKER = '<!-- FUB-ERA-ARCHIVED -->'

/**
 * Docs that route agents (must never cite the archive as live). Top-level live
 * docs only — docs/fub-crm-spec/ is the FUB REBUILD reference (a different,
 * still-live corpus) and the plans/ledger files are historical record.
 */
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

const failures = []

// ── 1. inventory ratchet + archive markers ───────────────────────────────────
const onDisk = execSync('git ls-files docs', { encoding: 'utf8' })
  .split('\n')
  .filter(Boolean)
const eraShaped = onDisk.filter(
  (f) =>
    /^docs\/FUB_[^/]*\.md$/.test(f) ||
    f === 'docs/FOLLOWUPBOSS-SETUP.md' ||
    /^docs\/HANDOFF_FUB_SMART_LIST_WIRING[^/]*\.md$/.test(f),
)
for (const f of eraShaped) {
  if (!FUB_ERA_DOCS.includes(f)) {
    failures.push(`NEW FUB-era doc ${f} — the inventory may only shrink. Do not add FUB docs; the system is decommissioned.`)
  }
}
for (const f of FUB_ERA_DOCS) {
  if (!existsSync(path.join(ROOT, f))) continue // deleted = shrunk, fine
  const head = readFileSync(path.join(ROOT, f), 'utf8').slice(0, 400)
  if (!head.includes(MARKER)) {
    failures.push(`${f} is missing the ${MARKER} marker + decommission banner on line 1.`)
  }
}

// ── 2 + 3. citation scan ─────────────────────────────────────────────────────
const eraNames = FUB_ERA_DOCS.map((f) => path.basename(f))
const citationRe = new RegExp(
  eraNames.map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|'),
)
const tracked = execSync('git ls-files', { encoding: 'utf8' }).split('\n').filter(Boolean)
const SCAN_SKIP = new Set([...FUB_ERA_DOCS, BASELINE_PATH, 'scripts/check-claude-canon.mjs'])
const BINARY_RE = /\.(png|jpg|jpeg|webp|gif|ico|pdf|mp4|mp3|otf|ttf|woff2?|zip)$/i

const citing = []
for (const f of tracked) {
  if (SCAN_SKIP.has(f) || f.startsWith('docs/archive/') || BINARY_RE.test(f)) continue
  let text
  try {
    text = readFileSync(path.join(ROOT, f), 'utf8')
  } catch {
    continue
  }
  if (citationRe.test(text)) citing.push(f)
}

for (const f of CANON_DOCS) {
  if (citing.includes(f)) {
    failures.push(`CANON doc ${f} cites a FUB-era doc. Repoint the citation to docs/archive/fub-era/README.md or delete it.`)
  }
}

const nonCanonCiting = citing.filter((f) => !CANON_DOCS.includes(f)).sort()
if (WRITE_BASELINE) {
  writeFileSync(
    BASELINE_PATH,
    JSON.stringify(
      {
        note:
          'Ratchet for ci:claude-canon check 3: tracked files still citing a FUB-era doc path. May only SHRINK — remove citations, then refresh with node scripts/check-claude-canon.mjs --write-baseline. Never regenerate to admit a new citation.',
        generatedAt: new Date().toISOString(),
        files: nonCanonCiting,
      },
      null,
      2,
    ) + '\n',
  )
  console.log(`baseline written: ${nonCanonCiting.length} file(s) still cite a FUB-era doc.`)
}
let baseline = []
try {
  baseline = JSON.parse(readFileSync(path.join(ROOT, BASELINE_PATH), 'utf8')).files ?? []
} catch {
  failures.push(`${BASELINE_PATH} is missing or unreadable. Generate it: node scripts/check-claude-canon.mjs --write-baseline`)
}
for (const f of nonCanonCiting) {
  if (!baseline.includes(f)) {
    failures.push(`${f} cites a FUB-era doc and is NOT in the baseline — new citations of the archive are banned.`)
  }
}

// ── 4. CLAUDE.md dead links ──────────────────────────────────────────────────
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

// ── 5. retired v1 tokens ─────────────────────────────────────────────────────
const lines = claude.split('\n')
lines.forEach((line, i) => {
  for (const hex of RETIRED_HEXES) {
    if (line.includes(hex) && !/retired/i.test(line)) {
      failures.push(`CLAUDE.md:${i + 1} uses retired v1 token ${hex} without marking it retired.`)
    }
  }
})

// ── verdict ──────────────────────────────────────────────────────────────────
console.log('CLAUDE.md canon gate (ci:claude-canon)')
console.log('======================================')
console.log(
  `era docs on disk: ${FUB_ERA_DOCS.filter((f) => existsSync(path.join(ROOT, f))).length}/${FUB_ERA_DOCS.length} · citing files (ratchet): ${nonCanonCiting.length}/${baseline.length} · CLAUDE.md links checked: dead ${deadLinks.size}`,
)
if (failures.length > 0) {
  console.error(`\n✗ ci:claude-canon — ${failures.length} failure(s):`)
  for (const f of failures) console.error(`  - ${f}`)
  process.exit(1)
}
console.log('\n✓ Canon is honest: archive marked, no live doc routes into it, no dead CLAUDE.md link, no retired token resurfaced.')
