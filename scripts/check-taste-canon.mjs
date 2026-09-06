#!/usr/bin/env node
/**
 * check-taste-canon.mjs — TASTE IS A GATE, NOT A DOC (Matt, 2026-09-01).
 * Pixel receipts 2026-09-05 (X research: a JSON score without PNGs is the bug).
 *
 * 1. Pointers cannot rot (CLAUDE.md, AGENTS.md, frontend-design → TASTE.md).
 * 2. Every public parity.json has a tasteReview, or sits in the shrink-only
 *    unreviewed baseline.
 * 3. A tasteReview is complete only with desktop + 375 PNG paths that exist
 *    and an evaluator that is not the builder ("pending" is not an evaluator).
 *    Shotless reviews sit in taste-review-shots-baseline.json (shrink-only).
 * 4. Named slop tells (leftover HUD / PlaceFaceStrip on place openings, Atlas
 *    how-to caption) sit in taste-tells-baseline.json (shrink-only). New files
 *    may not grow the list. A score cannot outvote a tell.
 *
 * Seed unreviewed with `--write-baseline`. Wired as ci:taste-canon.
 */
import { readFileSync, readdirSync, existsSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = process.cwd()
const KITS = 'design_system/ryan-realty/ui_kits'
const BASELINE = 'scripts/taste-review-baseline.json'
const SHOTS_BASELINE = 'scripts/taste-review-shots-baseline.json'
const TELLS_BASELINE = 'scripts/taste-tells-baseline.json'
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

function readJson(rel, label) {
  try {
    return JSON.parse(readFileSync(join(ROOT, rel), 'utf8'))
  } catch {
    failures.push(`${rel} is missing or malformed — ${label}`)
    return null
  }
}

function shotOk(rel) {
  if (typeof rel !== 'string' || !rel.trim()) return false
  if (rel.includes('..') || rel.startsWith('/')) return false
  return existsSync(join(ROOT, rel))
}

function reviewShape(tr) {
  if (!tr || typeof tr !== 'object') return { json: false, shots: false, evaluator: false }
  const json =
    /^\d{4}-\d{2}-\d{2}$/.test(String(tr.evaluatedAt ?? '')) &&
    Number.isFinite(tr.score) &&
    tr.score >= 0 &&
    tr.score <= 100 &&
    typeof tr.beats === 'string' &&
    tr.beats.trim().length >= 20 &&
    typeof tr.evaluator === 'string' &&
    tr.evaluator.trim().length > 0
  const evaluator = json && !/\bpending\b/i.test(tr.evaluator) && !/\bself[- ]?score/i.test(tr.evaluator)
  const shots =
    tr.shots &&
    typeof tr.shots === 'object' &&
    shotOk(tr.shots.desktop) &&
    shotOk(tr.shots.mobile375)
  return { json, shots, evaluator }
}

const kitDirs = readdirSync(join(ROOT, KITS), { withFileTypes: true })
  .filter((e) => e.isDirectory())
  .map((e) => `${KITS}/${e.name}/parity.json`)
  .filter((rel) => existsSync(join(ROOT, rel)))

const unreviewed = []
const shotless = []
let complete = 0
for (const rel of kitDirs) {
  let d
  try {
    d = JSON.parse(readFileSync(join(ROOT, rel), 'utf8'))
  } catch {
    continue
  }
  const route = typeof d.route === 'string' ? d.route.trim() : ''
  if (!route.startsWith('app/') || route.startsWith('app/admin')) continue
  if (!existsSync(join(ROOT, route))) continue
  const { json, shots, evaluator } = reviewShape(d.tasteReview)
  if (!json) {
    unreviewed.push(rel)
    continue
  }
  if (!shots || !evaluator) {
    shotless.push(rel)
    continue
  }
  complete += 1
}

if (WRITE_BASELINE) {
  writeFileSync(
    join(ROOT, BASELINE),
    JSON.stringify(
      {
        note:
          'ci:taste-canon — SHRINK-ONLY. Public routes whose parity.json has no tasteReview JSON yet. A route leaves by earning an evaluator pass; no route may be added.',
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

const b = readJson(BASELINE, 'seed with --write-baseline')
const baseline = Array.isArray(b?.routes) ? b.routes : []
const baselineSet = new Set(baseline)
for (const rel of unreviewed.filter((r) => !baselineSet.has(r))) {
  failures.push(
    `${rel} has no tasteReview JSON. Record { evaluatedAt, score, beats, evaluator, shots: { desktop, mobile375 } } after a SEPARATE agent grades rendered 1440 and 375.`,
  )
}

const sb = readJson(SHOTS_BASELINE, 'shotless reviews baseline')
const shotBase = Array.isArray(sb?.routes) ? sb.routes : []
const shotSet = new Set(shotBase)
for (const rel of shotless.filter((r) => !shotSet.has(r))) {
  failures.push(
    `${rel} tasteReview has no on-disk desktop + 375 PNGs (or evaluator is still "pending"). ` +
      `Bind shots.desktop and shots.mobile375 to files in the repo. A score without pictures is not a pass.`,
  )
}
const shotStale = shotBase.filter((rel) => !shotless.includes(rel))

const TELL_FILES = [
  { rel: 'components/site/v3/V3Atlas.client.tsx', re: /Pinch or scroll to zoom/ },
  { rel: 'app/cities/[slug]/page.tsx', re: /<PlaceFaceStrip/ },
  { rel: 'app/cities/[slug]/[neighborhoodSlug]/page.tsx', re: /<PlaceFaceStrip/ },
  { rel: 'app/communities/[slug]/page.tsx', re: /<PlaceFaceStrip/ },
  { rel: 'app/subdivisions/[slug]/page.tsx', re: /<PlaceFaceStrip/ },
]
const dirty = []
for (const { rel, re } of TELL_FILES) {
  const abs = join(ROOT, rel)
  if (!existsSync(abs)) continue
  const src = readFileSync(abs, 'utf8')
  if (re.test(src)) dirty.push(rel)
}
const tb = readJson(TELLS_BASELINE, 'taste tells baseline')
const tellBase = Array.isArray(tb?.files) ? tb.files : []
const tellSet = new Set(tellBase)
for (const rel of dirty.filter((r) => !tellSet.has(r))) {
  failures.push(
    `${rel} introduces a taste tell (leftover HUD PlaceFaceStrip or Atlas how-to caption). ` +
      `A tasteReview score cannot outvote this. Remove the tell; do not grow ${TELLS_BASELINE}.`,
  )
}
const tellStale = tellBase.filter((rel) => !dirty.includes(rel))

if (failures.length > 0) {
  console.error('taste-canon FAILED:')
  for (const f of failures) console.error(`  ✗ ${f}`)
  process.exit(1)
}

console.log(
  `taste-canon OK — pointers intact · ${complete} complete review(s) with PNGs · ` +
    `${unreviewed.length} unreviewed (baseline) · ${shotless.length} shotless (baseline) · ` +
    `${dirty.length} known tell(s)` +
    (shotStale.length ? ` · remove from shots baseline: ${shotStale.join(', ')}` : '') +
    (tellStale.length ? ` · remove from tells baseline: ${tellStale.join(', ')}` : ''),
)
