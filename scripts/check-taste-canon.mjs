#!/usr/bin/env node
/**
 * check-taste-canon.mjs — TASTE IS A GATE, NOT A DOC (Matt, 2026-09-01).
 *
 * "Every future coding session must be able to have the same taste. Whether
 * it's Claude, whether it's Grok, whatever — if I point it at the repo and
 * tell it to start working, it will need to use this." A rule that lives in
 * prose is skipped by the next agent (CLAUDE.md §6). This gate makes two
 * things mechanical:
 *
 *   1. THE POINTERS CANNOT ROT. CLAUDE.md, AGENTS.md (the cross-agent file
 *      Cursor and every other tool reads), and the frontend-design skill must
 *      each cite design_system/public/TASTE.md. Delete the pointer, fail.
 *
 *   2. EVERY PUBLIC PAGE RECORDS ITS EVALUATOR PASS. Each public route's
 *      parity.json carries a `tasteReview` block:
 *        { "evaluatedAt": "YYYY-MM-DD", "score": <0-100>,
 *          "beats": "<the named page this one must beat, and on what>",
 *          "evaluator": "<separate agent, never the builder>" }
 *      TASTE.md's own finding is that self-evaluation fails, so the block is
 *      the receipt that a second agent graded the rendered page. Routes that
 *      predate the rule sit in scripts/taste-review-baseline.json, which is
 *      SHRINK-ONLY: a page may leave the baseline by earning a review; no
 *      route may be added. Every route created after 2026-09-01 needs the
 *      block from its first commit.
 *
 * Seed the baseline once with `--write-baseline`. Wired as ci:taste-canon.
 */
import { readFileSync, readdirSync, existsSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = process.cwd()
const KITS = 'design_system/ryan-realty/ui_kits'
const BASELINE = 'scripts/taste-review-baseline.json'
const CANON = 'design_system/public/TASTE.md'
const POINTERS = ['CLAUDE.md', 'AGENTS.md', '.claude/skills/frontend-design/SKILL.md']
const WRITE_BASELINE = process.argv.includes('--write-baseline')

const failures = []

if (!existsSync(join(ROOT, CANON))) failures.push(`${CANON} is missing — the canon itself is gone.`)
for (const rel of POINTERS) {
  const abs = join(ROOT, rel)
  if (!existsSync(abs)) {
    failures.push(`${rel} is missing — it must point at ${CANON}.`)
    continue
  }
  if (!readFileSync(abs, 'utf8').includes(CANON)) {
    failures.push(`${rel} no longer cites ${CANON}. The next agent will not load the taste canon.`)
  }
}

const contracts = readdirSync(join(ROOT, KITS), { withFileTypes: true })
  .filter((e) => e.isDirectory())
  .map((e) => `${KITS}/${e.name}/parity.json`)
  .filter((rel) => existsSync(join(ROOT, rel)))

const unreviewed = []
let reviewed = 0
for (const rel of contracts) {
  let d
  try {
    d = JSON.parse(readFileSync(join(ROOT, rel), 'utf8'))
  } catch {
    continue // ci:mockup-coverage owns unparseable contracts
  }
  const route = typeof d.route === 'string' ? d.route.trim() : ''
  if (!route.startsWith('app/') || route.startsWith('app/admin')) continue
  if (!existsSync(join(ROOT, route))) continue
  const tr = d.tasteReview
  const ok =
    tr &&
    typeof tr === 'object' &&
    /^\d{4}-\d{2}-\d{2}$/.test(String(tr.evaluatedAt ?? '')) &&
    Number.isFinite(tr.score) &&
    tr.score >= 0 &&
    tr.score <= 100 &&
    typeof tr.beats === 'string' &&
    tr.beats.trim().length >= 20 &&
    typeof tr.evaluator === 'string' &&
    tr.evaluator.trim().length > 0
  if (ok) reviewed += 1
  else unreviewed.push(rel)
}

if (WRITE_BASELINE) {
  writeFileSync(
    join(ROOT, BASELINE),
    JSON.stringify(
      {
        note:
          'ci:taste-canon — SHRINK-ONLY. Public routes whose parity.json has no tasteReview block yet. A route leaves by earning an evaluator pass (design_system/public/TASTE.md); no route may be added.',
        generatedAt: new Date().toISOString(),
        routes: unreviewed.sort(),
      },
      null,
      2,
    ) + '\n',
  )
  console.log(`taste-canon: baseline written with ${unreviewed.length} unreviewed route(s).`)
  process.exit(0)
}

let baseline = []
try {
  const b = JSON.parse(readFileSync(join(ROOT, BASELINE), 'utf8'))
  baseline = Array.isArray(b.routes) ? b.routes : []
} catch {
  failures.push(`${BASELINE} is missing or malformed — seed it with --write-baseline.`)
}
const baselineSet = new Set(baseline)
const newUnreviewed = unreviewed.filter((rel) => !baselineSet.has(rel))
const stale = baseline.filter((rel) => !unreviewed.includes(rel))

for (const rel of newUnreviewed) {
  failures.push(
    `${rel} has no valid tasteReview block. Run the TASTE.md evaluator pass (a SEPARATE agent grades ` +
      `the rendered page at desktop and 375px) and record { evaluatedAt, score, beats, evaluator }.`,
  )
}

if (failures.length > 0) {
  console.error('taste-canon FAILED:')
  for (const f of failures) console.error(`  ✗ ${f}`)
  process.exit(1)
}

console.log(
  `taste-canon OK — pointers intact · ${reviewed} public route(s) carry an evaluator pass · ` +
    `${unreviewed.length} still in the shrink-only baseline` +
    (stale.length > 0 ? ` (${stale.length} baseline row(s) may now be removed: ${stale.join(', ')})` : ''),
)
