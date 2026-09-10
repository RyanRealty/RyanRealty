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
 * 5. A receipt evaluated on or after 2026-09-08 records the INSTRUMENT — the
 *    evaluator and builder models, the rubric version, what was captured, a
 *    hash over the shots, the three scorings behind the median, the named
 *    defects, and what prior mark it was compared to. The rise rule then
 *    compares like with like, and a prior mark from another instrument
 *    re-baselines instead of stalling on a human (SITE-M1, 2026-09-08).
 *    Contract + computations: scripts/lib/taste-receipt.mjs. Receipts already
 *    dated on/after the cutoff when the rule landed sit in
 *    taste-receipt-v2-baseline.json (shrink-only).
 * 6. A catalog-class receipt (listing, homepage, search, sell, city family)
 *    names adaptedFrom and each defect names replaceWith. Empty adaptedFrom
 *    is inventing a layout (SITE-45). Receipts that predate this rule sit in
 *    taste-receipt-catalog-baseline.json (shrink-only). The next score of
 *    that class must name the modules. Layout locks (listing hero bleed)
 *    fail immediately — they are not a baseline.
 *
 * Seed unreviewed with `--write-baseline`, the v2 backlog with
 * `--write-v2-baseline`, catalog receipts with `--write-catalog-baseline`.
 * Wired as ci:taste-canon.
 */
import { readFileSync, readdirSync, existsSync, writeFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { join } from 'node:path'
import { RECEIPT_V2_FROM, isV2Receipt, receiptV2Problems } from './lib/taste-receipt.mjs'
import {
  CATALOG_PATH,
  catalogReceiptProblems,
  classForRoute,
  layoutLockProblems,
  loadTasteCatalog,
} from './lib/taste-catalog.mjs'

const ROOT = process.cwd()
const KITS = 'design_system/ryan-realty/ui_kits'
const BASELINE = 'scripts/taste-review-baseline.json'
const SHOTS_BASELINE = 'scripts/taste-review-shots-baseline.json'
const TELLS_BASELINE = 'scripts/taste-tells-baseline.json'
const V2_BASELINE = 'scripts/taste-receipt-v2-baseline.json'
const CATALOG_BASELINE = 'scripts/taste-receipt-catalog-baseline.json'
const CANON = 'design_system/public/TASTE.md'
const POINTERS = ['CLAUDE.md', 'AGENTS.md', '.claude/skills/frontend-design/SKILL.md']
const WRITE_BASELINE = process.argv.includes('--write-baseline')
const WRITE_V2_BASELINE = process.argv.includes('--write-v2-baseline')
const WRITE_CATALOG_BASELINE = process.argv.includes('--write-catalog-baseline')

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

const rubricText = existsSync(join(ROOT, CANON)) ? readFileSync(join(ROOT, CANON), 'utf8') : ''

function loadCatalog() {
  const abs = join(ROOT, CATALOG_PATH)
  if (!existsSync(abs)) return null
  try {
    return loadTasteCatalog(JSON.parse(readFileSync(abs, 'utf8')))
  } catch (err) {
    failures.push(`${CATALOG_PATH} is malformed: ${err instanceof Error ? err.message : String(err)}`)
    return null
  }
}
const catalog = loadCatalog()
if (catalog?.problems?.length) {
  for (const p of catalog.problems) failures.push(`${CATALOG_PATH}: ${p}`)
}

/**
 * The receipt this route carries at HEAD. A working-tree receipt that says
 * "first" while a scored one is already committed is dodging the rise rule.
 * No git (a fresh fixture, a shallow export) simply means no prior to compare.
 */
function committedReceipt(rel) {
  try {
    const out = execFileSync('git', ['show', `HEAD:${rel}`], {
      cwd: ROOT,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    })
    const tr = JSON.parse(out)?.tasteReview
    return tr && typeof tr === 'object' ? tr : null
  } catch {
    return null
  }
}

const unreviewed = []
const shotless = []
const v2Broken = new Map()
const catalogBroken = new Map()
let complete = 0
let v2Complete = 0
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
  if (catalog && catalog.problems.length === 0) {
    const kit = rel.split('/').at(-2)
    const classKey = classForRoute(catalog, kit)
    if (classKey) {
      const cp = catalogReceiptProblems(catalog, classKey, d.tasteReview)
      if (cp.length) catalogBroken.set(rel, cp)
    }
  }
  if (!isV2Receipt(d.tasteReview)) continue
  const problems = receiptV2Problems(d.tasteReview, {
    root: ROOT,
    rubricText,
    headReceipt: committedReceipt(rel),
  })
  if (problems.length > 0) v2Broken.set(rel, problems)
  else v2Complete += 1
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

if (WRITE_V2_BASELINE) {
  writeFileSync(
    join(ROOT, V2_BASELINE),
    JSON.stringify(
      {
        note:
          `ci:taste-canon — SHRINK-ONLY. Receipts already dated on or after ${RECEIPT_V2_FROM} when the instrument fields landed, so they predate the rule. A route leaves by its next evaluator pass writing a full receipt (scripts/lib/taste-receipt.mjs); no route may be added.`,
        generatedAt: new Date().toISOString(),
        routes: [...v2Broken.keys()].sort(),
      },
      null,
      2,
    ) + '\n',
  )
  console.log(`taste-canon: v2 baseline written with ${v2Broken.size} legacy receipt(s).`)
  process.exit(0)
}

if (WRITE_CATALOG_BASELINE) {
  writeFileSync(
    join(ROOT, CATALOG_BASELINE),
    JSON.stringify(
      {
        note:
          'ci:taste-canon — SHRINK-ONLY. Catalog-class receipts that predate adaptedFrom + replaceWith. A route leaves by its next evaluator pass naming the modules it fetched; no route may be added.',
        generatedAt: new Date().toISOString(),
        routes: [...catalogBroken.keys()].sort(),
      },
      null,
      2,
    ) + '\n',
  )
  console.log(`taste-canon: catalog baseline written with ${catalogBroken.size} receipt(s).`)
  process.exit(0)
}

const b = readJson(BASELINE, 'seed with --write-baseline')
const baseline = Array.isArray(b?.routes) ? b.routes : []
const baselineSet = new Set(baseline)
for (const rel of unreviewed.filter((r) => !baselineSet.has(r))) {
  failures.push(
    `${rel} has no tasteReview JSON. Record the receipt in ${CANON} ("The receipt") after a SEPARATE agent on a different model grades rendered 1440 and 375.`,
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

const vb = readJson(V2_BASELINE, 'legacy receipts baseline — seed with --write-v2-baseline')
const v2Base = Array.isArray(vb?.routes) ? vb.routes : []
const v2Set = new Set(v2Base)
for (const [rel, problems] of v2Broken) {
  if (v2Set.has(rel)) continue
  failures.push(
    `${rel} tasteReview is dated ${RECEIPT_V2_FROM} or later and does not record its instrument:\n` +
      problems.map((p) => `      - ${p}`).join('\n') +
      `\n      Shape + computations: scripts/lib/taste-receipt.mjs · rule: ${CANON}.`,
  )
}
const v2Stale = v2Base.filter((rel) => !v2Broken.has(rel))

let catalogStale = []
if (catalog && catalog.problems.length === 0) {
  const lock = layoutLockProblems(catalog, {
    existsSync: (p) => existsSync(join(ROOT, p)),
    readFileSync: (p, enc) => readFileSync(join(ROOT, p), enc),
  })
  for (const row of lock) failures.push(row)

  const catalogAbs = join(ROOT, CATALOG_BASELINE)
  if (!existsSync(catalogAbs)) {
    if (catalogBroken.size > 0) {
      failures.push(
        `${CATALOG_BASELINE} is missing — seed with --write-catalog-baseline (${catalogBroken.size} catalog receipt(s) without adaptedFrom/replaceWith).`,
      )
    }
  } else {
    const cb = readJson(CATALOG_BASELINE, 'catalog receipts baseline — seed with --write-catalog-baseline')
    const catalogBase = Array.isArray(cb?.routes) ? cb.routes : []
    const catalogSet = new Set(catalogBase)
    for (const [rel, problems] of catalogBroken) {
      if (catalogSet.has(rel)) continue
      failures.push(
        `${rel} is a catalog class and its tasteReview does not name adaptedFrom (or defects omit replaceWith):\n` +
          problems.map((p) => `      - ${p}`).join('\n') +
          `\n      Fetch node scripts/lib/taste-catalog.mjs <class> --preflight before building.`,
      )
    }
    catalogStale = catalogBase.filter((rel) => !catalogBroken.has(rel))
  }
}

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
    `${v2Complete} with a full instrument receipt (>= ${RECEIPT_V2_FROM}) · ` +
    `${unreviewed.length} unreviewed (baseline) · ${shotless.length} shotless (baseline) · ` +
    `${v2Broken.size} legacy receipt(s) (baseline) · ${catalogBroken.size} catalog receipt(s) (baseline) · ${dirty.length} known tell(s)` +
    (shotStale.length ? ` · remove from shots baseline: ${shotStale.join(', ')}` : '') +
    (v2Stale.length ? ` · remove from v2 baseline: ${v2Stale.join(', ')}` : '') +
    (catalogStale.length ? ` · remove from catalog baseline: ${catalogStale.join(', ')}` : '') +
    (tellStale.length ? ` · remove from tells baseline: ${tellStale.join(', ')}` : ''),
)
