#!/usr/bin/env node
/**
 * check-entity-scope.mjs — G66, the admin ENTITY READER scope ratchet (2026-08-07).
 *
 * WHY THIS EXISTS
 * ---------------
 * Three broker-scope holes were found on admin entity-reader pages in one
 * session. Each page checked "may this role open admin pages" and never
 * checked "does this role own THIS record":
 *
 *   · app/admin/(protected)/crm/deals/[id]/page.tsx — ran only getCrmAccess, so
 *     a restricted broker could walk sequential ids and read any deal's GCI,
 *     commission percent and split rows. Fixed in 4aa3de68.
 *   · app/admin/(protected)/people/[id]/portal/page.tsx — ran only
 *     requireAdminPage('people.view'), and CAPABILITY_ROLES['people.view']
 *     includes 'broker', so any broker could read any contact's saved homes,
 *     hidden homes, named areas, alert recipients and site activity. Fixed
 *     2026-08-07.
 *   · app/admin/(protected)/deals/[key]/page.tsx — same class, handled
 *     separately.
 *
 * `ci:crm-scope` (scripts/check-crm-scope.mjs) cannot see any of them: it
 * inspects WRITES in app/actions/crm*.ts. Nothing inspected READS. A dynamic
 * route segment IS a caller-supplied record id — that is the whole IDOR
 * surface — so this gate watches every page that has one.
 *
 * THE RULE
 * --------
 * Every `page.tsx` under app/admin that lives in a DYNAMIC ROUTE SEGMENT (any
 * path segment of the form `[…]`) must either:
 *
 *   (a) CALL one of the sanctioned scope-decision functions —
 *       `scopeBroker` / `isPersonInScope` (lib/crm/scope.ts),
 *       `dealInScope` (lib/crm/deal-scope.ts),
 *       `requirePersonInScope` (app/actions/crm.ts).
 *       These four are the complete set a page can reach: every other guard in
 *       the family (requireDealInScope, requireTaskAccess) is module-private to
 *       its action file and not callable from a page; or
 *   (b) be a pure REDIRECT BRIDGE — imports redirect/permanentRedirect from
 *       next/navigation, calls it, and renders NO JSX. A page with an
 *       auth-guard redirect still renders and is NOT a bridge (the disguise
 *       that fooled the first draft of G65's bridge heuristic); or
 *   (c) be listed in scripts/entity-scope-baseline.json.
 *
 * Detection is by CALL EXPRESSION, never by import presence: a page that
 * imports `requirePersonInScope` and never calls it is exactly the bug, so it
 * must fail. AST via the TypeScript compiler — repo convention, never regex; a
 * regex over source text matches doc comments and string literals, and this
 * file's whole job is to tell a real call from a mention of one.
 *
 * SHRINK-ONLY RATCHET
 * -------------------
 * A hard cut is impossible today — several baselined pages legitimately need no
 * scope (a KB article, an MLS listing: records with no per-broker owner). The
 * point is that no NEW unscoped entity reader can land. A page missing from the
 * baseline fails; a count above baseline fails; removing a baselined line while
 * the page is still unscoped fails (the ratchet cannot be gamed by deleting a
 * line — the page simply reads as NEW). Re-seed after a real fix with
 * `--write-baseline` and commit the smaller baseline; it is reviewed like any
 * diff.
 *
 * Break-tests: scripts/check-entity-scope.test.ts (9 cases, one per rule).
 *
 * Usage:
 *   node scripts/check-entity-scope.mjs                   # CI mode
 *   node scripts/check-entity-scope.mjs --report          # human readable, always exit 0
 *   node scripts/check-entity-scope.mjs --json            # machine readable
 *   node scripts/check-entity-scope.mjs --write-baseline  # re-seed after a fix
 */
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs'
import { join, sep } from 'node:path'
import ts from 'typescript'

const ROOT = process.cwd()
const SCAN_ROOT = 'app/admin'
const BASELINE_PATH = 'scripts/entity-scope-baseline.json'

const WRITE = process.argv.includes('--write-baseline')
const REPORT = process.argv.includes('--report')
const AS_JSON = process.argv.includes('--json')

/**
 * The sanctioned per-record scope decisions. Session checks (getCrmAccess,
 * requireCrmAccess, requireAdminPage) are deliberately NOT here — they
 * authenticate the caller and decide which SCREENS they may open; they say
 * nothing about which RECORD this url names.
 */
const SCOPE_FUNCTIONS = new Set(['scopeBroker', 'isPersonInScope', 'dealInScope', 'requirePersonInScope'])

const posix = (p) => p.split(sep).join('/')

/** Recursively list page.tsx files under a dir. */
function walkPages(dir, out = []) {
  for (const e of readdirSync(join(ROOT, dir), { withFileTypes: true })) {
    const rel = join(dir, e.name)
    if (e.isDirectory()) walkPages(rel, out)
    else if (e.name === 'page.tsx') out.push(posix(rel))
  }
  return out
}

/** A route is dynamic when ANY path segment is `[id]` / `[...slug]` / `[[...slug]]`. */
function isDynamicRoute(file) {
  return file.split('/').some((seg) => seg.startsWith('[') && seg.endsWith(']'))
}

/**
 * Parse one page and answer the two questions the rule turns on.
 *
 * The bridge test is G65's (scripts/check-admin-ui.mjs) — imports redirect,
 * calls redirect, renders no JSX — hardened by one line: a JSX FRAGMENT
 * (`<>…</>`) also counts as rendering. G65 tracks a migration counter where
 * that gap is cosmetic; here a page rendering `<>{record}</>` behind a
 * conditional redirect would read as a bridge and skip the whole rule.
 */
function inspect(file) {
  const text = readFileSync(join(ROOT, file), 'utf8')
  const src = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)

  let importsRedirect = false
  let callsRedirect = false
  let hasJsx = false
  const scopeCalls = new Set()

  const visit = (node) => {
    if (ts.isImportDeclaration(node)) {
      const spec = node.moduleSpecifier.getText(src).slice(1, -1)
      if (spec === 'next/navigation') {
        const named = node.importClause?.namedBindings
        if (named && ts.isNamedImports(named)) {
          for (const el of named.elements) {
            if (el.name.text === 'redirect' || el.name.text === 'permanentRedirect') importsRedirect = true
          }
        }
      }
    }
    if (ts.isCallExpression(node)) {
      // Callee NAME, so `await requirePersonInScope(…)` and `crm.scopeBroker(…)`
      // both count, while an import specifier, a comment, or a string literal
      // naming the same function never does.
      let name = null
      if (ts.isIdentifier(node.expression)) name = node.expression.text
      else if (ts.isPropertyAccessExpression(node.expression)) name = node.expression.name.text
      if (name && SCOPE_FUNCTIONS.has(name)) scopeCalls.add(name)
      if (name === 'redirect' || name === 'permanentRedirect') callsRedirect = true
    }
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node) || ts.isJsxFragment(node)) {
      hasJsx = true
    }
    ts.forEachChild(node, visit)
  }
  visit(src)

  return {
    scopeCalls: [...scopeCalls].sort(),
    isBridge: importsRedirect && callsRedirect && !hasJsx,
  }
}

// ── scan ─────────────────────────────────────────────────────────────────
if (!existsSync(join(ROOT, SCAN_ROOT))) {
  console.error(`✗ entity-scope: ${SCAN_ROOT} not found under ${ROOT} — nothing scanned, refusing to pass.`)
  process.exit(1)
}

const dynamicPages = walkPages(SCAN_ROOT).filter(isDynamicRoute).sort()

const scoped = []
const bridges = []
const unscoped = []

for (const file of dynamicPages) {
  const { scopeCalls, isBridge } = inspect(file)
  if (scopeCalls.length) scoped.push({ file, scopeCalls })
  else if (isBridge) bridges.push(file)
  else unscoped.push(file)
}

const current = { count: unscoped.length, unscopedDynamicPages: unscoped }

// ── --write-baseline ─────────────────────────────────────────────────────
if (WRITE) {
  const payload = {
    note:
      'G66 ci:entity-scope — SHRINK-ONLY. Every page.tsx under app/admin in a dynamic route ' +
      'segment must CALL scopeBroker / isPersonInScope / dealInScope / requirePersonInScope, or be a ' +
      'pure redirect bridge (redirect + no JSX), or be listed here. This list is the debt, not the ' +
      'permission: it may only shrink. A page missing from it fails, a count above `count` fails, and ' +
      'deleting a line while the page is still unscoped fails (it reads as NEW). Re-seed ONLY after ' +
      'genuinely adding a scope check: `node scripts/check-entity-scope.mjs --write-baseline`, then ' +
      'commit the smaller baseline. Never hand-add a path to let a new page through.',
    seeded: new Date().toISOString().slice(0, 10),
    count: current.count,
    unscopedDynamicPages: current.unscopedDynamicPages,
  }
  writeFileSync(join(ROOT, BASELINE_PATH), JSON.stringify(payload, null, 2) + '\n')
  console.log(
    `entity-scope baseline seeded: ${dynamicPages.length} dynamic admin pages · ` +
      `${scoped.length} scoped · ${bridges.length} redirect bridge(s) · ${current.count} unscoped (baselined).`
  )
  process.exit(0)
}

// ── baseline load (missing or unparseable fails LOUDLY) ───────────────────
if (!existsSync(join(ROOT, BASELINE_PATH))) {
  console.error(`✗ entity-scope: missing ${BASELINE_PATH} — seed it with --write-baseline (then commit it).`)
  console.error('  Without the baseline the ratchet has no floor and this gate would pass on anything.')
  process.exit(1)
}
let baseline
try {
  baseline = JSON.parse(readFileSync(join(ROOT, BASELINE_PATH), 'utf8'))
} catch (err) {
  console.error(`✗ entity-scope: unparseable ${BASELINE_PATH} — ${err.message}`)
  process.exit(1)
}
if (!baseline || !Array.isArray(baseline.unscopedDynamicPages)) {
  console.error(`✗ entity-scope: ${BASELINE_PATH} has no \`unscopedDynamicPages\` array — the baseline is malformed.`)
  process.exit(1)
}

const baselineSet = new Set(baseline.unscopedDynamicPages)
const baselineCount = baseline.unscopedDynamicPages.length

// ── --report / --json ────────────────────────────────────────────────────
if (AS_JSON) {
  console.log(
    JSON.stringify(
      { dynamicPages: dynamicPages.length, scoped, bridges, unscoped, baselineCount, baselined: [...baselineSet] },
      null,
      2
    )
  )
  process.exit(0)
}
if (REPORT) {
  console.log(`entity-scope — ${dynamicPages.length} dynamic page(s) under ${SCAN_ROOT}\n`)
  for (const s of scoped) console.log(`  ✓ ${s.file}  [${s.scopeCalls.join(', ')}]`)
  for (const b of bridges) console.log(`  → ${b}  (redirect bridge, renders nothing)`)
  for (const u of unscoped) console.log(`  ${baselineSet.has(u) ? '·' : '✗'} ${u}  ${baselineSet.has(u) ? '(baselined)' : 'NEW — UNSCOPED'}`)
  console.log(`\n${scoped.length} scoped · ${bridges.length} bridges · ${unscoped.length} unscoped (baseline ${baselineCount}).`)
  process.exit(0)
}

// ── CI mode ──────────────────────────────────────────────────────────────
const failures = []

for (const file of unscoped) {
  if (!baselineSet.has(file)) {
    failures.push(
      `${file}: dynamic route segment, NO broker-scope check — a restricted broker can read any record by id`
    )
  }
}
if (current.count > baselineCount) {
  failures.push(`unscoped dynamic pages grew: ${current.count} (baseline ${baselineCount}) — the baseline only shrinks`)
}

// Informational: a baselined page that now carries a check (or no longer exists).
const stillUnscoped = new Set(unscoped)
const stale = [...baselineSet].filter((f) => !stillUnscoped.has(f))

if (failures.length) {
  console.error(`✗ entity-scope: ${failures.length} unscoped admin entity reader(s):\n`)
  for (const f of failures) console.error(`  • ${f}`)
  console.error('\n  A dynamic segment IS a caller-supplied record id. requireAdminPage / getCrmAccess only')
  console.error("  decide which SCREENS a role may open — CAPABILITY_ROLES['people.view'] includes 'broker' —")
  console.error('  so neither says a word about which RECORD this url names.')
  console.error('\n  Fix (pick the one that fits the entity):')
  console.error("    const guard = await requirePersonInScope(personId, access); if (!guard.ok) notFound()")
  console.error('    const scope = scopeBroker(access); if (!isPersonInScope(scope, row.assigned_broker)) notFound()')
  console.error('    if (!dealInScope(scopeBroker(access), deal.assigned_broker, person?.assigned_broker)) notFound()')
  console.error(`\n  If the record genuinely has no per-broker owner, add it to ${BASELINE_PATH} with that reasoning`)
  console.error('  in the commit message. The baseline is reviewed like any diff.\n')
  process.exit(1)
}

console.log(
  `✓ entity-scope: ${dynamicPages.length} dynamic admin page(s) — ${scoped.length} carry a broker-scope call, ` +
    `${bridges.length} redirect bridge(s), ${unscoped.length}/${baselineCount} baselined-unscoped.` +
    (stale.length
      ? ` ${stale.length} baseline entr${stale.length === 1 ? 'y is' : 'ies are'} now scoped or gone — re-seed with --write-baseline and commit the smaller baseline.`
      : '')
)
