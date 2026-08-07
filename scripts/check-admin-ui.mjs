#!/usr/bin/env node
/**
 * check-admin-ui.mjs — the admin interior migration ratchet (P11A, 2026-08-06).
 *
 * P9 shipped the 11 locked destinations on the v2 language; 129 legacy pages
 * remain behind them. This gate makes that migration mechanical and one-way:
 * every count may only shrink, and a migrated page can never regress to raw
 * markup without failing the commit.
 *
 * Rules (AST via the TypeScript compiler — repo convention, never regex):
 *   A. RAW ELEMENTS — JSX intrinsic <h1> <h2> <button> <input> <select>
 *      <table> under app/admin. The v2 primitives own these; a raw element on
 *      a migrated surface is a drift back to the Frankenstein baseline.
 *   B. LEGACY PAGES — a page.tsx under app/admin that neither imports
 *      '@/components/admin/v2' nor is a redirect bridge. This is THE
 *      migration counter: 11C/11D/11E drive it to zero.
 *   C. EXTRA PRIMARY BUTTONS — more than one v2 <Button> with the primary
 *      variant (the default when no variant prop is given) in one file.
 *      "Exactly one primary action per view" is the locked ADMIN_UI.md rule.
 *   D. WIDTH SPRAWL — the number of DISTINCT `max-w-*` tokens across
 *      app/admin. The visual lock does not enumerate approved widths, so the
 *      gate does not invent a list — it ratchets the sprawl (21 measured
 *      2026-08-06) downward as families migrate.
 *
 * Baseline: scripts/admin-ui-baseline.json — per (rule, file) counts for A–C,
 * a global count for D. A count above baseline, or a NEW file with
 * violations, fails. Counts below baseline are reported as ratchetable;
 * re-seed with --write-baseline after a cleanup (the seed is checked in and
 * reviewed like any diff — shrink-only by review).
 */
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs'
import { join, relative } from 'node:path'
import ts from 'typescript'

const ROOT = process.cwd()
const SCAN_ROOT = 'app/admin'
const BASELINE_PATH = 'scripts/admin-ui-baseline.json'
const WRITE = process.argv.includes('--write-baseline')

const RAW_ELEMENTS = new Set(['h1', 'h2', 'button', 'input', 'select', 'table'])

/** Recursively list .tsx files under a dir. */
function walk(dir, out = []) {
  for (const e of readdirSync(join(ROOT, dir), { withFileTypes: true })) {
    const rel = join(dir, e.name)
    if (e.isDirectory()) walk(rel, out)
    else if (e.name.endsWith('.tsx')) out.push(rel)
  }
  return out
}

const files = walk(SCAN_ROOT)

/** Per-file scan results. */
const rawByFile = {} // file -> {h1: n, ...}
const legacyPages = [] // page.tsx files not on v2 and not bridges
const extraPrimaryByFile = {} // file -> extra primary-button count
const widthTokens = new Set()

for (const file of files) {
  const text = readFileSync(join(ROOT, file), 'utf8')
  const src = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)

  let importsV2 = false
  let importsRedirect = false
  let callsRedirect = false
  let hasJsx = false
  const rawCounts = {}
  let primaryButtons = 0

  const visit = (node) => {
    if (ts.isImportDeclaration(node)) {
      const spec = node.moduleSpecifier.getText(src).slice(1, -1)
      if (spec === '@/components/admin/v2' || spec.startsWith('@/components/admin/v2/')) importsV2 = true
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
      const callee = node.expression.getText(src)
      if (callee === 'redirect' || callee === 'permanentRedirect') callsRedirect = true
    }
    // A FRAGMENT renders too. Without this, `if (!row) redirect(...); return
    // <>{row.gci}</>` reads as a JSX-free redirect bridge and the whole rule-B
    // classification skips it. Caught 2026-08-07 while building the sibling
    // ci:entity-scope, which shares this bridge test — cosmetic here (a
    // migration counter), a hole there (an authorization check).
    if (ts.isJsxFragment(node)) hasJsx = true
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
      hasJsx = true
      const tag = node.tagName.getText(src)
      // Rule A — intrinsic elements only (lowercase identifier)
      if (RAW_ELEMENTS.has(tag)) rawCounts[tag] = (rawCounts[tag] ?? 0) + 1
      // Rule C — v2 Button primary count (default variant IS primary)
      if (tag === 'Button') {
        let variant = null
        for (const attr of node.attributes.properties) {
          if (ts.isJsxAttribute(attr) && attr.name.getText(src) === 'variant') {
            variant = attr.initializer?.getText(src)?.replace(/['"{}]/g, '') ?? null
          }
        }
        if (variant === null || variant === 'primary') primaryButtons += 1
      }
    }
    ts.forEachChild(node, visit)
  }
  visit(src)

  // Rule D — width tokens (string scan is fine here: class strings, not code)
  for (const m of text.matchAll(/max-w-(\[[^\]]+\]|[0-9a-z]+)/g)) widthTokens.add(m[0])

  if (Object.keys(rawCounts).length) rawByFile[file] = rawCounts
  // Rule C only counts files where v2 Button is actually in play
  if (importsV2 && primaryButtons > 1) extraPrimaryByFile[file] = primaryButtons - 1

  // Rule B — page.tsx classification. A true redirect BRIDGE renders nothing:
  // it calls redirect() and has no JSX. A legacy page with an auth-guard
  // redirect still renders — it stays on the legacy counter.
  if (file.endsWith('/page.tsx')) {
    const isBridge = importsRedirect && callsRedirect && !hasJsx
    if (!importsV2 && !isBridge) legacyPages.push(file)
  }
}

const current = {
  rawElements: rawByFile,
  legacyPages: legacyPages.sort(),
  extraPrimaryButtons: extraPrimaryByFile,
  distinctWidths: widthTokens.size,
}

const totals = {
  raw: Object.values(rawByFile).reduce((n, c) => n + Object.values(c).reduce((a, b) => a + b, 0), 0),
  legacyPages: legacyPages.length,
  extraPrimary: Object.values(extraPrimaryByFile).reduce((a, b) => a + b, 0),
  distinctWidths: widthTokens.size,
}

if (WRITE) {
  writeFileSync(join(ROOT, BASELINE_PATH), JSON.stringify(current, null, 2) + '\n')
  console.log(
    `admin-ui baseline seeded: ${totals.raw} raw elements across ${Object.keys(rawByFile).length} files · ` +
      `${totals.legacyPages} legacy pages · ${totals.extraPrimary} extra primary buttons · ` +
      `${totals.distinctWidths} distinct widths`
  )
  process.exit(0)
}

if (!existsSync(join(ROOT, BASELINE_PATH))) {
  console.error(`✗ admin-ui: missing ${BASELINE_PATH} — seed it with --write-baseline (then commit it).`)
  process.exit(1)
}
let baseline
try {
  baseline = JSON.parse(readFileSync(join(ROOT, BASELINE_PATH), 'utf8'))
} catch {
  console.error(`✗ admin-ui: unparseable ${BASELINE_PATH}.`)
  process.exit(1)
}

const failures = []
let ratchetable = 0

// Rule A — per (file, element)
for (const [file, counts] of Object.entries(current.rawElements)) {
  const base = baseline.rawElements?.[file] ?? {}
  for (const [el, n] of Object.entries(counts)) {
    const b = base[el] ?? 0
    if (n > b) failures.push(`${file}: ${n}× raw <${el}> (baseline ${b}) — use the v2 primitive`)
  }
}
// Rule B — set membership
const baseLegacy = new Set(baseline.legacyPages ?? [])
for (const p of current.legacyPages) {
  if (!baseLegacy.has(p)) failures.push(`${p}: NEW legacy page — new admin pages must render the v2 language`)
}
// Rule C — per file
for (const [file, n] of Object.entries(current.extraPrimaryButtons)) {
  const b = baseline.extraPrimaryButtons?.[file] ?? 0
  if (n > b) failures.push(`${file}: ${n + 1} primary Buttons (baseline ${b + 1}) — exactly one primary action per view`)
}
// Rule D — global
const baseWidths = baseline.distinctWidths ?? Infinity
if (current.distinctWidths > baseWidths) {
  failures.push(`width sprawl grew: ${current.distinctWidths} distinct max-w-* tokens (baseline ${baseWidths})`)
}

// Ratchet reporting (informational)
const baseTotals = {
  raw: Object.values(baseline.rawElements ?? {}).reduce((n, c) => n + Object.values(c).reduce((a, b) => a + b, 0), 0),
  legacyPages: (baseline.legacyPages ?? []).length,
}
if (totals.raw < baseTotals.raw || totals.legacyPages < baseTotals.legacyPages || totals.distinctWidths < baseWidths) {
  ratchetable = 1
}

if (failures.length) {
  console.error(`✗ admin-ui: ${failures.length} regression(s) vs the ratchet baseline:\n`)
  for (const f of failures) console.error(`  • ${f}`)
  console.error(`\n  The baseline only shrinks. Migrate to the v2 primitives; never widen the baseline.`)
  process.exit(1)
}

console.log(
  `✓ admin-ui: no regressions. ${totals.raw} raw elements (baseline ${baseTotals.raw}) · ` +
    `${totals.legacyPages}/${baseTotals.legacyPages} legacy pages · ${totals.distinctWidths} widths (baseline ${baseWidths}).` +
    (ratchetable ? ' Counts shrank — re-seed with --write-baseline and commit the smaller baseline.' : '')
)
