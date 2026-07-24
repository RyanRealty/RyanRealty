#!/usr/bin/env node
/**
 * check-no-report-rpc.mjs — ci:no-report-rpc (W8.1).
 *
 * ONE GENERATION PATH. Public market numbers come from market_stats_cache /
 * market_pulse_live, never from live aggregation over raw `listings`
 * (CLAUDE.md §0 + docs/DATABASE_FOR_AI_AGENTS.md "Don't aggregate raw listings
 * for market reports — use the cache").
 *
 * This gate exists because the second path was not hypothetical: /reports rendered
 * cache-based headline cards directly above an RPC-based table, and the two
 * published contradictory verdicts for the same city on one screen (Bend read
 * 507 active · MoS 3.9 "seller's market" in the card and 984 active · MoS 5.3
 * "balanced market" in the table). W8.1 migrated every public consumer onto the
 * cache. This gate keeps them there.
 *
 * WHAT IT BANS — outside the allowlist, a file may not:
 *   1. call supabase.rpc('get_city_period_metrics' | 'get_city_price_bands' |
 *      'get_city_metrics_timeseries', …)
 *   2. import a BANNED WRAPPER from '@/app/actions/reports'. That list is DERIVED
 *      from the module itself (every exported function that reaches a banned RPC,
 *      directly or through a private helper), not typed out — because that module
 *      is allowlisted BY PATH, so a NEW wrapper added there would otherwise call
 *      the RPC legally at home and then be imported by any public page invisibly.
 *
 * WHO IS ALLOWED (and why each is legitimate, not grandfathered debt):
 *   - app/actions/reports.ts — the wrapper definitions themselves.
 *   - app/admin/** — the ADMIN custom-report tools (arbitrary date range +
 *     property-type + price-band filters). A fixed-period cache cannot express
 *     those queries; these surfaces are internal, never public pages.
 *   - app/api/cron/market-stat-consistency/** — the MONITOR. Its entire job is
 *     comparing the RPC path against the cache path and alerting on |delta| > 1%.
 *     Banning the RPC here would delete the cross-check.
 *
 * AST-based (typescript compiler), never regex: a comment mentioning the RPC name
 * or a string in prose must not fail the build, and a renamed import must not
 * sneak past. See memory reference_code_inspecting_gates_use_ast.
 *
 * Exit 0 = no public surface reads the raw-listings report RPCs.
 */
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs'
import { join, relative, dirname } from 'node:path'
import ts from 'typescript'

const ROOT = process.cwd()

const BANNED_RPCS = new Set([
  'get_city_period_metrics',
  'get_city_price_bands',
  'get_city_metrics_timeseries',
])

/**
 * The wrapper module whose exports are derived, not typed out.
 * (Also the first entry of ALLOWED_PREFIXES — it defines the wrappers.)
 */
const WRAPPER_MODULE = 'app/actions/reports.ts'

/**
 * The three wrappers that existed when this gate was written. They are a FLOOR,
 * not the list: the real list is derived from the module below. Keeping them
 * pinned means a refactor that hides the RPC behind an import (making the
 * derivation see nothing) still can't silently empty the ban.
 */
const KNOWN_WRAPPERS = ['getReportMetrics', 'getReportPriceBands', 'getReportMetricsTimeSeries']

/**
 * Derive every EXPORTED function in `app/actions/reports.ts` that reaches a
 * banned RPC — directly, or through another function in the same module.
 *
 * WHY DERIVED. `app/actions/reports.ts` is allowlisted BY PATH, so nothing in
 * this gate looks at what it exports. With a hardcoded three-name ban, a NEW
 * wrapper added to that module — the ordinary shape of a future feature — would
 * call a banned RPC legally at home and then be imported by any public page
 * completely invisibly. The ban has to track the module, not a snapshot of it.
 *
 * Transitive on purpose: a wrapper that delegates to a private helper
 * (`async function fetchMetrics() { …rpc('get_city_period_metrics')… }`) reaches
 * the RPC just as surely as one that calls it inline.
 */
function deriveBannedWrappers() {
  const abs = join(ROOT, WRAPPER_MODULE)
  if (!existsSync(abs)) {
    // The module moved or was deleted. Fall back to the floor rather than
    // silently banning nothing, and say so.
    return { names: new Set(KNOWN_WRAPPERS), derived: [], note: `${WRAPPER_MODULE} not found` }
  }
  const sf = ts.createSourceFile(
    WRAPPER_MODULE,
    readFileSync(abs, 'utf8'),
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  )

  /** fnName -> { hitsRpc, callees, exported } */
  const fns = new Map()
  const ensure = (name) => {
    if (!fns.has(name)) fns.set(name, { hitsRpc: false, callees: new Set(), exported: false })
    return fns.get(name)
  }

  // Module-level identifiers bound to a banned RPC name, so `.rpc(RPC_NAME)`
  // counts (same indirection the file scanner handles).
  const bannedConsts = new Set()
  const collectConsts = (n) => {
    if (ts.isVariableDeclaration(n) && ts.isIdentifier(n.name)) {
      const v = staticString(n.initializer)
      if (v && BANNED_RPCS.has(v)) bannedConsts.add(n.name.text)
    }
    ts.forEachChild(n, collectConsts)
  }
  collectConsts(sf)

  const isExported = (node) =>
    !!node.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword)

  /** Walk one function body, recording the RPCs and functions it reaches. */
  const walkBody = (body, rec) => {
    const visit = (n) => {
      if (ts.isCallExpression(n)) {
        // `.rpc('get_city_…')` or `.rpc(CONST)`
        if (ts.isPropertyAccessExpression(n.expression) && n.expression.name.text === 'rpc') {
          const lit = staticString(n.arguments?.[0])
          const arg = n.arguments?.[0]
          if ((lit && BANNED_RPCS.has(lit)) || (arg && ts.isIdentifier(arg) && bannedConsts.has(arg.text))) {
            rec.hitsRpc = true
          }
        }
        // A call to another function in this module (by bare identifier).
        if (ts.isIdentifier(n.expression)) rec.callees.add(n.expression.text)
      }
      ts.forEachChild(n, visit)
    }
    visit(body)
  }

  const collectFns = (n) => {
    if (ts.isFunctionDeclaration(n) && n.name && n.body) {
      const rec = ensure(n.name.text)
      rec.exported = rec.exported || isExported(n)
      walkBody(n.body, rec)
    }
    // Any `const x = <expr>` binding. The WHOLE initializer is walked, not just
    // a bare arrow: every wrapper in this module is really
    // `const _fetch = unstable_cache(async () => { …rpc(…)… }, …)`, so matching
    // only ArrowFunction/FunctionExpression initializers saw none of them —
    // caught by the self-test below, which is why it exists.
    if (ts.isVariableStatement(n)) {
      for (const d of n.declarationList.declarations) {
        if (!ts.isIdentifier(d.name) || !d.initializer) continue
        const rec = ensure(d.name.text)
        rec.exported = rec.exported || isExported(n)
        walkBody(d.initializer, rec)
      }
    }
    ts.forEachChild(n, collectFns)
  }
  collectFns(sf)

  // Fixed point: a function is tainted if it hits the RPC or calls something tainted.
  const tainted = new Set()
  for (const [name, rec] of fns) if (rec.hitsRpc) tainted.add(name)
  let grew = true
  while (grew) {
    grew = false
    for (const [name, rec] of fns) {
      if (tainted.has(name)) continue
      for (const callee of rec.callees) {
        if (tainted.has(callee)) {
          tainted.add(name)
          grew = true
          break
        }
      }
    }
  }

  const exported = [...fns].filter(([, r]) => r.exported).map(([n]) => n)
  const derived = [...tainted].filter((n) => fns.get(n)?.exported).sort()
  return { names: new Set([...KNOWN_WRAPPERS, ...derived]), derived, exported, note: null }
}

const wrapperDerivation = deriveBannedWrappers()
const BANNED_WRAPPERS = wrapperDerivation.names

/**
 * SELF-TEST on the derivation. A silently-broken AST walk would derive an empty
 * set and leave only the floor, which is the failure mode this whole change
 * exists to remove — so prove the walk still works against the wrappers we KNOW
 * call the RPC. Scoped to the known names that are still exported, so genuinely
 * retiring one is not a false failure.
 */
const derivationProblems = []
if (wrapperDerivation.note) {
  derivationProblems.push(
    `cannot derive the banned-wrapper list: ${wrapperDerivation.note}. ` +
      `If ${WRAPPER_MODULE} moved, update WRAPPER_MODULE and ALLOWED_PREFIXES together.`,
  )
} else {
  const stillExported = KNOWN_WRAPPERS.filter((n) => wrapperDerivation.exported.includes(n))
  const missed = stillExported.filter((n) => !wrapperDerivation.derived.includes(n))
  if (missed.length) {
    derivationProblems.push(
      `the banned-wrapper derivation did not detect ${missed.join(', ')} in ${WRAPPER_MODULE}, ` +
        `but ${missed.length > 1 ? 'those wrappers call' : 'that wrapper calls'} a retired raw-\`listings\` RPC. ` +
        `The AST walk is broken — fix deriveBannedWrappers(), do not widen KNOWN_WRAPPERS.`,
    )
  }
}

/** Paths permitted to reach the RPC. Prefix-matched against the repo-relative path. */
const ALLOWED_PREFIXES = [
  'app/actions/reports.ts',
  'app/admin/',
  'app/api/cron/market-stat-consistency/',
]

const SCAN_ROOTS = ['app', 'components', 'lib']

const problems = []

function isAllowed(rel) {
  return ALLOWED_PREFIXES.some((p) => rel === p || rel.startsWith(p))
}

function walk(dir, out) {
  for (const name of readdirSync(join(ROOT, dir))) {
    const rel = join(dir, name)
    if (rel.includes('node_modules') || rel.includes('.next')) continue
    const st = statSync(join(ROOT, rel))
    if (st.isDirectory()) {
      walk(rel, out)
      continue
    }
    if (!/\.(ts|tsx)$/.test(name)) continue
    if (/\.test\.tsx?$|\.int\.test\.tsx?$|__tests__/.test(rel)) continue
    out.push(rel)
  }
  return out
}

/**
 * Statically resolve a node to a string when it provably is one: a literal, a
 * template with no substitutions, or a concatenation/template whose every part is
 * itself statically resolvable. `'get_city_' + 'period_metrics'` and
 * `` `get_city_${'period'}_metrics` `` both resolve; anything depending on a
 * runtime value returns null (the honest boundary of an AST-only gate).
 */
function staticString(node) {
  if (!node) return null
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return node.text
  if (ts.isParenthesizedExpression(node)) return staticString(node.expression)
  if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.PlusToken) {
    const l = staticString(node.left)
    const r = staticString(node.right)
    return l != null && r != null ? l + r : null
  }
  if (ts.isTemplateExpression(node)) {
    let out = node.head.text
    for (const span of node.templateSpans) {
      const part = staticString(span.expression)
      if (part == null) return null
      out += part + span.literal.text
    }
    return out
  }
  return null
}

/** The statically-known text of a call's first argument, if any. */
function firstStringArg(node) {
  return staticString(node.arguments?.[0])
}

function scan(rel) {
  const src = readFileSync(join(ROOT, rel), 'utf8')
  // Cheap pre-filter. It must trip on the module specifier too — a file can reach
  // the wrappers without ever spelling one (`import * as R`, `await import(...)`,
  // `require(...)`). `actions/reports` (not the @/-prefixed form) so a RELATIVE
  // specifier like '../actions/reports' also trips it: app/reports/page.tsx
  // already imports a sibling action that way, so relative is house style here.
  let touches = src.includes('actions/reports')
  for (const n of BANNED_RPCS) if (src.includes(n)) touches = true
  for (const n of BANNED_WRAPPERS) if (src.includes(n)) touches = true
  // A concatenated/templated RPC name never appears whole in the source, so also
  // wake up for the shared prefix every banned RPC starts with.
  if (src.includes('get_city_')) touches = true
  if (!touches) return

  const sf = ts.createSourceFile(rel, src, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  const line = (node) => sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1

  // Pre-pass: identifiers bound to a banned RPC name, so `const N = 'get_city_…'`
  // followed by `.rpc(N)` is caught rather than read as an opaque identifier.
  const bannedConstNames = new Set()
  const collectConsts = (n) => {
    // `const N = 'get_city_…'`
    if (ts.isVariableDeclaration(n) && ts.isIdentifier(n.name)) {
      const v = staticString(n.initializer)
      if (v && BANNED_RPCS.has(v)) bannedConstNames.add(n.name.text)
    }
    // `let N: string; … N = 'get_city_…'` — declaration-only binding, assigned later.
    if (
      ts.isBinaryExpression(n) &&
      n.operatorToken.kind === ts.SyntaxKind.EqualsToken &&
      ts.isIdentifier(n.left)
    ) {
      const v = staticString(n.right)
      if (v && BANNED_RPCS.has(v)) bannedConstNames.add(n.left.text)
    }
    ts.forEachChild(n, (c) => {
      collectConsts(c)
    })
  }
  collectConsts(sf)

  const visit = (node) => {
    // 1. supabase.rpc('get_city_*', …)
    if (
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      node.expression.name.text === 'rpc'
    ) {
      const name = firstStringArg(node)
      if (name && BANNED_RPCS.has(name)) {
        problems.push(
          `${rel}:${line(node)} calls .rpc('${name}') — that RPC aggregates raw \`listings\`. ` +
            `Public market numbers must come from market_stats_cache / market_pulse_live ` +
            `(getCityMarketDetail, getMarketPulse, getPriceHistory, getCityRangeReport).`,
        )
      }
    }

    // 1b. supabase.rpc(CONST) where CONST is a module-level string holding a
    //     banned name — the indirection a determined bypass reaches for first.
    if (
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      node.expression.name.text === 'rpc'
    ) {
      const a = node.arguments?.[0]
      if (a && ts.isIdentifier(a) && bannedConstNames.has(a.text)) {
        problems.push(
          `${rel}:${line(node)} calls .rpc(${a.text}) where ${a.text} holds a retired ` +
            `raw-\`listings\` RPC name. Read the cache instead.`,
        )
      }
    }

    // 2. Any import FORM that pulls a banned wrapper out of app/actions/reports:
    //    named, aliased, namespace (`import * as R`), or a re-export.
    // Resolve relative specifiers against the file's own directory so
    // '../actions/reports' from app/reports/page.tsx is recognised as the same
    // module as '@/app/actions/reports'. A bare-suffix match alone let every
    // relative import through — the single most likely accidental bypass, since
    // sibling actions are already imported relatively in that directory.
    const isReportsModule = (spec) => {
      if (spec === '@/app/actions/reports') return true
      if (spec.startsWith('.')) {
        const resolved = join(dirname(rel), spec).replace(/\\/g, '/')
        return /(^|\/)app\/actions\/reports$/.test(resolved)
      }
      return /(^|\/)app\/actions\/reports$/.test(spec)
    }

    if (
      (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
      node.moduleSpecifier &&
      ts.isStringLiteral(node.moduleSpecifier) &&
      isReportsModule(node.moduleSpecifier.text)
    ) {
      const bindings = ts.isImportDeclaration(node)
        ? node.importClause?.namedBindings
        : node.exportClause
      const kind = ts.isImportDeclaration(node) ? 'imports' : 're-exports'

      // `export * from '@/app/actions/reports'` — no exportClause at all, so the
      // named-elements branch below never fires. A barrel doing this re-exports
      // the wrappers under its OWN specifier, and a consumer importing them from
      // the barrel is invisible to this gate — the two-hop bypass.
      if (ts.isExportDeclaration(node) && !node.exportClause) {
        problems.push(
          `${rel}:${line(node)} \`export *\` from @/app/actions/reports — that re-exports the ` +
            `raw-\`listings\` RPC wrappers under this module's name, where nothing can see them. ` +
            `Re-export the specific cache DAL you mean, or drop the barrel.`,
        )
      } else if (bindings && ts.isNamespaceImport(bindings)) {
        // `import * as R from '@/app/actions/reports'` — the whole surface, so any
        // banned member is reachable as R.getReportMetrics(...).
        problems.push(
          `${rel}:${line(bindings)} namespace-imports @/app/actions/reports as ` +
            `'${bindings.name.text}' — that exposes the raw-\`listings\` RPC wrappers. ` +
            `Import the specific cache DAL you need instead.`,
        )
      } else if (bindings && (ts.isNamedImports(bindings) || ts.isNamedExports(bindings))) {
        for (const el of bindings.elements) {
          // propertyName is the ORIGINAL name when aliased (`x as y`).
          const original = (el.propertyName ?? el.name).text
          if (BANNED_WRAPPERS.has(original)) {
            problems.push(
              `${rel}:${line(el)} ${kind} ${original} from @/app/actions/reports — that wrapper ` +
                `calls a raw-\`listings\` RPC. Read the cache instead (getCityRangeReport for the ` +
                `/reports table, getCityMarketDetail + getMarketPulse for a single geo).`,
            )
          }
        }
      }
    }

    // 2b. Dynamic access: `await import('@/app/actions/reports')` and
    //     `require('@/app/actions/reports')` both hand back the whole module.
    if (ts.isCallExpression(node)) {
      const isDynImport = node.expression.kind === ts.SyntaxKind.ImportKeyword
      const isRequire = ts.isIdentifier(node.expression) && node.expression.text === 'require'
      if (isDynImport || isRequire) {
        const spec = firstStringArg(node)
        if (spec && isReportsModule(spec)) {
          problems.push(
            `${rel}:${line(node)} ${isRequire ? 'require()s' : 'dynamically imports'} ` +
              `@/app/actions/reports — that module's report wrappers call raw-\`listings\` RPCs. ` +
              `Read the cache instead.`,
          )
        }
      }
    }

    ts.forEachChild(node, (c) => {
      visit(c)
    })
  }
  visit(sf)
}

const files = []
for (const top of SCAN_ROOTS) if (existsSync(join(ROOT, top))) walk(top, files)

let scanned = 0
for (const rel of files) {
  const norm = relative(ROOT, join(ROOT, rel))
  if (isAllowed(norm)) continue
  scanned++
  scan(norm)
}

console.log('Raw-listings report-RPC gate (ci:no-report-rpc)')
console.log('==============================================')
console.log(`  scanned ${scanned} source files outside the allowlist (${ALLOWED_PREFIXES.join(', ')})`)
console.log(
  `  banned wrappers (derived from ${WRAPPER_MODULE}): ${[...BANNED_WRAPPERS].sort().join(', ')}`,
)
problems.unshift(...derivationProblems)
if (problems.length) {
  for (const p of problems) console.error(`  ✗ ${p}`)
  console.error(`\n\x1b[31m✗ ci:no-report-rpc: ${problems.length} problem(s).\x1b[0m`)
  process.exit(1)
}
console.log('✓ No public surface reads get_city_period_metrics / _price_bands / _metrics_timeseries.')
process.exit(0)
