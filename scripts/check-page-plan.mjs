#!/usr/bin/env node
/**
 * check-page-plan.mjs — ci:page-plan. THE ROUTE IS THE UNIT, NOT THE CONTRACT.
 *
 * Matt, 2026-09-05, on the site still reading as 112 separate decisions: "I'm
 * still having issues with the pages looking inconsistent across the entire site
 * and the correct content not being on the page."
 *
 * The measurement behind this gate: 25 page plans for 112 public routes. The other
 * 87 shipped with no objective, no section order and no competitive target, and
 * every gate was green -- because ci:page-purpose, ci:mockup-parity,
 * ci:mockup-coverage and ci:taste-canon all begin by enumerating THE CONTRACTS THAT
 * EXIST:
 *
 *     readdirSync(KITS).filter(dir => existsSync(dir + '/parity.json'))
 *
 * A page with no contract is not failing those gates. It is invisible to them. So
 * the plan was mandatory on the 22% that had one and optional on the 78% that did
 * not, which is backwards from how a standard spreads. This gate walks app/ and
 * asks each ROUTE for its plan.
 *
 * WHAT BINDS (canon: design_system/public/PAGE_PLAN.md):
 *
 *   1. COVERAGE. Every public app/**\/page.tsx resolves to a parity.json. Shrink-only
 *      against scripts/page-plan-baseline.json -- the uncovered routes are
 *      grandfathered, none may be added, and a route leaves by earning a plan.
 *   2. CLASS. Every contract declares a pageClass in the closed list
 *      (data/page-classes.json). The class owns the spine; design the CLASS, not the
 *      instance (TASTE.md).
 *   3. SPINE. Every section the class requires resolves in the page source. A page
 *      that drops one fails unless its contract carries a dated waivers[] entry
 *      naming the section and the reason.
 *   4. ANSWERS. Every mustAnswer entry binds to a section id that resolves in the
 *      page, or is explicitly null -- which reports as an open gap rather than
 *      passing silently. "The correct content is not on the page" becomes a build
 *      failure instead of a judgment call.
 *   5. BENCHMARK. Outside the system and capture classes: a benchmark block with a
 *      real measuredAt date, >=1 query, >=1 rival URL, and a NON-EMPTY loses[].
 *
 * WHY loses[] IS REQUIRED, AND WHY NOTHING HERE IS SCORED. Page-grade was killed
 * 2026-08-16 after it "scored pages, then deleted photography, maps, and listing
 * facts so a caption rule could pass" (PRODUCT.md). Any score an agent can satisfy
 * by removing content gets satisfied that way. So this gate never awards a number.
 * It checks that a rival was NAMED and that the comparison recorded something we
 * lose -- a benchmark with an empty loses[] is a pass that was not run, not a page
 * that won. Staleness is REPORTED, never failed: a gate that fails on the calendar
 * only teaches agents to touch the date.
 *
 * Usage:
 *   node scripts/check-page-plan.mjs                  # CI
 *   node scripts/check-page-plan.mjs --report         # full state, exit 0
 *   node scripts/check-page-plan.mjs --write-baseline # seed the ratchet
 */
import { readFileSync, readdirSync, existsSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = process.cwd()
const KITS = 'design_system/ryan-realty/ui_kits'
const CLASSES_FILE = 'data/page-classes.json'
const BASELINE = 'scripts/page-plan-baseline.json'
const CANON = 'design_system/public/PAGE_PLAN.md'
const WRITE_BASELINE = process.argv.includes('--write-baseline')
const REPORT = process.argv.includes('--report')
const STALE_DAYS = 180

/** Authenticated / non-visitor trees. A route here is not a public page. */
const PRIVATE_PREFIXES = [
  'app/admin/', 'app/account/', 'app/dashboard/', 'app/login/',
  'app/signup/', 'app/forgot-password/', 'app/auth-error/', 'app/api/',
]
/**
 * Auth-gated routes that live OUTSIDE those trees. Verified by reading the file:
 * team/[slug]/edit calls requireBrokerSelfServiceSlug and redirects to
 * /admin/access-denied. Add only after confirming the redirect in the source.
 */
const PRIVATE_ROUTES = new Set(['app/team/[slug]/edit/page.tsx'])

const failures = []

// ── inputs ──────────────────────────────────────────────────────────────────
if (!existsSync(join(ROOT, CANON))) failures.push(`${CANON} is missing — the canon itself is gone.`)

let classes = {}
let routing = []
try {
  const parsed = JSON.parse(readFileSync(join(ROOT, CLASSES_FILE), 'utf8'))
  classes = parsed.classes ?? {}
  routing = Array.isArray(parsed.routing) ? parsed.routing : []
} catch (err) {
  failures.push(`${CLASSES_FILE} is missing or malformed (${err.message}). The class list is the closed vocabulary; without it nothing below can run.`)
}

/** Every public page route, walked from app/ — the whole point of this gate. */
function walkRoutes(dir, out = []) {
  for (const entry of readdirSync(join(ROOT, dir), { withFileTypes: true })) {
    const rel = `${dir}/${entry.name}`
    if (entry.isDirectory()) walkRoutes(rel, out)
    else if (entry.name === 'page.tsx') out.push(rel)
  }
  return out
}
const publicRoutes = walkRoutes('app')
  .filter((r) => !PRIVATE_PREFIXES.some((p) => r.startsWith(p)))
  .filter((r) => !r.includes('/(protected)/'))
  .filter((r) => !PRIVATE_ROUTES.has(r))
  .sort()

/** Contracts, keyed by the route they claim. */
const contracts = new Map()
for (const entry of readdirSync(join(ROOT, KITS), { withFileTypes: true })) {
  if (!entry.isDirectory()) continue
  const rel = `${KITS}/${entry.name}/parity.json`
  if (!existsSync(join(ROOT, rel))) continue
  let parsed
  try {
    parsed = JSON.parse(readFileSync(join(ROOT, rel), 'utf8'))
  } catch {
    continue // ci:mockup-coverage owns unparseable contracts
  }
  const route = typeof parsed.route === 'string' ? parsed.route.trim() : ''
  if (route) contracts.set(route, { rel, data: parsed })
}

const uncovered = publicRoutes.filter((r) => !contracts.has(r))

/**
 * Every public route must resolve to a class through the routing table. A route in a
 * tree the table has never seen (a new app/podcast/) would otherwise be silently
 * unclassified: its contract could claim any class and the cross-check below would be
 * skipped, because there is nothing to contradict. An unroutable route means the
 * taxonomy is incomplete, which is the exact silent gap this gate exists to close.
 */
for (const r of publicRoutes) {
  if (routing.some((x) => new RegExp(x.match).test(r))) continue
  failures.push(
    `${r} matches no rule in ${CLASSES_FILE}, so it belongs to no page class. Add a routing ` +
      `rule for its tree — deciding which of the eleven classes a new surface joins is a ` +
      `product decision, and it is made once, here, not per page.`,
  )
}

// ── 1. coverage ratchet (written at the end, once the loop has seen everything) ──
let baseline = []
let legacy = []
let spineDebt = []
try {
  const b = JSON.parse(readFileSync(join(ROOT, BASELINE), 'utf8'))
  baseline = Array.isArray(b.routes) ? b.routes : []
  legacy = Array.isArray(b.legacyContracts) ? b.legacyContracts : []
  spineDebt = Array.isArray(b.spineDebt) ? b.spineDebt : []
} catch {
  failures.push(`${BASELINE} is missing or malformed — seed it with --write-baseline.`)
}
const baselineSet = new Set(WRITE_BASELINE ? [] : baseline)
const legacySet = new Set(WRITE_BASELINE ? [] : legacy)
const spineDebtSet = new Set(WRITE_BASELINE ? [] : spineDebt)
let spineDebtHeld = 0
const seenLegacy = new Set()
const seenSpineDebt = []
for (const r of uncovered) {
  if (baselineSet.has(r)) continue
  failures.push(
    `${r} is a public page with NO PAGE PLAN. Write ` +
      `${KITS}/<slug>/parity.json with { route, pageClass, objective, mustAnswer, sectionOrder, ` +
      `requiredComponents, competitiveTarget, benchmark } per ${CANON}. The plan is not optional on a new page.`,
  )
}
const departed = baseline.filter((r) => !uncovered.includes(r))

// ── 2–5. per-contract checks ────────────────────────────────────────────────
const classTally = {}
let benchmarked = 0
let openGaps = 0
const stale = []

for (const route of publicRoutes) {
  const entry = contracts.get(route)
  if (!entry) continue
  const { rel, data: d } = entry
  const src = readFileSync(join(ROOT, route), 'utf8')

  // 2. class
  const cls = typeof d.pageClass === 'string' ? d.pageClass.trim() : ''
  const rule = routing.find((x) => new RegExp(x.match).test(route))
  if (!cls) {
    // No legacy case survives: all 25 contracts carried a pageClass as of 2026-09-05, so a
    // contract without one is new and unclassed. Without this being a FAILURE, a route could
    // leave the coverage ratchet by gaining a contract that declares nothing.
    failures.push(
      `${rel}: no pageClass. The routing table maps ${route} to "${rule?.class ?? 'no class — add a rule'}". ` +
        `A contract that names no class inherits no spine, so it asserts nothing about what the page carries.`,
    )
    continue
  }
  if (!classes[cls]) {
    failures.push(`${rel}: pageClass "${cls}" is not in the closed list (${Object.keys(classes).join(', ')}). Add the class to ${CLASSES_FILE} deliberately, or fix the contract.`)
    continue
  }
  if (rule && rule.class !== cls) {
    failures.push(`${rel}: declares pageClass "${cls}" but the routing table in ${CLASSES_FILE} maps ${route} to "${rule.class}". One of the two is wrong; a route's class is not a per-page opinion.`)
  }
  classTally[cls] = (classTally[cls] || 0) + 1
  const spec = classes[cls]

  // 3. spine — every section the class requires resolves in the page
  const waived = new Set(
    (Array.isArray(d.waivers) ? d.waivers : [])
      .filter((w) => w && typeof w.section === 'string' && typeof w.reason === 'string' && w.reason.trim().length >= 20 && /^\d{4}-\d{2}-\d{2}$/.test(String(w.date ?? '')))
      .map((w) => w.section),
  )
  for (const req of Array.isArray(spec.spine) ? spec.spine : []) {
    if (waived.has(req.id)) continue
    if (spineDebtSet.has(`${rel}::${req.id}`)) { spineDebtHeld++; continue }
    // "A|B" = either primitive satisfies the duty (a superseded pattern and its replacement).
    const alts = req.id.split('|')
    const token = alts.map((a) => (a.startsWith('#') ? `id="${a.slice(1)}"` : `<${a}`)).join(' or ')
    if (!alts.some((a) => src.includes(a.startsWith('#') ? `id="${a.slice(1)}"` : `<${a}`))) {
      seenSpineDebt.push(`${rel}::${req.id}`)
      failures.push(
        `${rel}: the ${cls} class requires ${req.id} and ${route} does not carry it (looked for ${token}). ` +
          `Why the class requires it: ${req.why} ` +
          `If this page is the honest exception, add a waivers[] entry { section, date, reason } saying so.`,
      )
    }
  }

  // 3b. objective — the visitor's job, in one sentence, and the act that completes it
  const objective = typeof d.objective === 'string' ? d.objective.trim() : ''
  if (objective.length < 40) {
    seenLegacy.add(rel)
    if (!legacySet.has(rel)) {
      failures.push(
        `${rel}: objective is ${objective ? `${objective.length} chars` : 'missing'}. State the visitor's ` +
          `job on this page and the one act that completes it. A page whose job is not written down is a ` +
          `page whose sections nobody can argue with.`,
      )
    }
  }

  // 4. mustAnswer — each question binds to a section that resolves, or is an open gap
  const answers = Array.isArray(d.mustAnswer) ? d.mustAnswer : []
  if (answers.length === 0 && spec.mustAnswer?.length) {
    seenLegacy.add(rel)
    if (!legacySet.has(rel)) failures.push(`${rel}: no mustAnswer. The ${cls} class's visitor arrives with ${spec.mustAnswer.length} question(s); name each and the section that answers it, or record it as a gap with "answeredBy": null.`)
  }
  for (const a of answers) {
    if (!a || typeof a !== 'object' || typeof a.question !== 'string') {
      failures.push(`${rel}: a mustAnswer entry is not { question, answeredBy }. answeredBy is a "#section-id" or null.`)
      continue
    }
    if (a.answeredBy === null) { openGaps++; continue }
    if (typeof a.answeredBy !== 'string' || !a.answeredBy.startsWith('#')) {
      failures.push(`${rel}: mustAnswer "${a.question.slice(0, 50)}" has answeredBy ${JSON.stringify(a.answeredBy)} — it must be a "#section-id" that renders, or null for an honest gap.`)
      continue
    }
    if (!src.includes(`id="${a.answeredBy.slice(1)}"`)) {
      failures.push(
        `${rel}: mustAnswer "${a.question.slice(0, 60)}" says it is answered at ${a.answeredBy}, and no such section renders in ${route}. ` +
          `Either the section was deleted and the answer went with it, or the contract describes a page that does not exist.`,
      )
    }
  }

  // 5. benchmark
  if (spec.benchmarkRequired === false) continue
  const b = d.benchmark
  if (!b || typeof b !== 'object') {
    seenLegacy.add(rel)
    if (!legacySet.has(rel)) {
      failures.push(`${rel}: no benchmark. A ${cls} page states the rival page it beats and what it loses on — see ${CANON} §4.`)
    }
    continue
  }
  const bad = []
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(b.measuredAt ?? ''))) bad.push('measuredAt must be YYYY-MM-DD — an undated comparison is not evidence')
  if (!Array.isArray(b.queries) || b.queries.length === 0) bad.push('queries[] must name at least one search the page competes for')
  if (!Array.isArray(b.rivals) || b.rivals.length === 0 || !b.rivals.every((r) => r && typeof r.url === 'string' && r.url.startsWith('http'))) {
    bad.push('rivals[] must name at least one real rival URL — "the field" is not a page')
  }
  if (!Array.isArray(b.loses) || b.loses.length === 0) {
    bad.push('loses[] must be non-empty. An empty loses[] is a comparison that was not run, not a page that won (PAGE_PLAN.md §4)')
  }
  if (bad.length) failures.push(`${rel}: benchmark is incomplete — ${bad.join('; ')}.`)
  else {
    benchmarked++
    const age = Math.floor((Date.now() - Date.parse(b.measuredAt)) / 86400000)
    if (age > STALE_DAYS) stale.push(`${rel} (${age}d)`)
  }
}

// ── write the ratchets ──────────────────────────────────────────────────────
if (WRITE_BASELINE) {
  writeFileSync(
    join(ROOT, BASELINE),
    JSON.stringify(
      {
        note:
          `ci:page-plan — THREE SHRINK-ONLY RATCHETS, canon ${CANON}. ` +
          `routes: public pages with no plan at all. legacyContracts: contracts that predate the v2 schema ` +
          `(pageClass/objective/mustAnswer/benchmark) and are grandfathered until their class is ground. ` +
          `spineDebt: "<contract>::<section>" pairs where a page misses a section its class requires — real ` +
          `product debt, held so the gate ships green and the number can only go down. NONE of the three may ` +
          `grow. A route or a row leaves by earning its plan; never regenerate to admit a new one.`,
        generatedAt: new Date().toISOString(),
        routes: uncovered,
        legacyContracts: [...seenLegacy].sort(),
        spineDebt: seenSpineDebt.sort(),
      },
      null,
      2,
    ) + '\n',
  )
  console.log(
    `page-plan: baseline written — ${uncovered.length} uncovered route(s) of ${publicRoutes.length}, ` +
      `${seenLegacy.size} legacy contract(s), ${seenSpineDebt.length} spine-debt row(s).`,
  )
  process.exit(0)
}

// ── output ──────────────────────────────────────────────────────────────────
const needBench = publicRoutes.filter((r) => {
  const c = routing.find((x) => new RegExp(x.match).test(r))
  return c && classes[c.class]?.benchmarkRequired !== false
}).length

console.log('page plans (ci:page-plan)')
console.log('=========================')
console.log(`  public routes            : ${publicRoutes.length}`)
console.log(`  with a plan              : ${publicRoutes.length - uncovered.length}`)
console.log(`  uncovered (baselined)    : ${uncovered.length}`)
console.log(`  classed                  : ${Object.values(classTally).reduce((a, b) => a + b, 0)}  ${JSON.stringify(classTally)}`)
console.log(`  benchmarked              : ${benchmarked} of ${needBench} routes whose class requires one`)
console.log(`  recorded content gaps    : ${openGaps}`)
console.log(`  spine debt (grandfathered): ${spineDebtHeld}  — sections a page owes its class; shrink-only`)
if (departed.length) console.log(`  baseline rows now stale  : ${departed.length} (${departed.slice(0, 4).join(', ')}${departed.length > 4 ? ', …' : ''}) — refresh with --write-baseline`)
if (stale.length) console.log(`  benchmarks over ${STALE_DAYS}d     : ${stale.length} — ${stale.slice(0, 5).join(', ')}`)

if (REPORT) {
  console.log('\nuncovered routes:')
  for (const r of uncovered) {
    const c = routing.find((x) => new RegExp(x.match).test(r))
    console.log(`  ${(c?.class ?? '???').padEnd(10)} ${r}`)
  }
  process.exit(0)
}

if (failures.length) {
  console.error(`\nFAIL — ${failures.length} page-plan violation(s):\n`)
  for (const f of failures) console.error('  ✗ ' + f)
  console.error(`\nThe plan is what makes 112 pages one site instead of 112 decisions. Canon: ${CANON}`)
  process.exit(1)
}
const covered = publicRoutes.length - uncovered.length
console.log(
  `\nOK — no regressions. ${covered}/${publicRoutes.length} routes carry a plan; ` +
    `${uncovered.length} are grandfathered in the shrink-only baseline and are the work queue, not a pass. ` +
    `Grind them with /site-consistency, one class at a time.`,
)
