#!/usr/bin/env node
/**
 * check-toast-read-discipline.mjs — `npm run ci:toast-discipline` (G62).
 *
 * THE CLASS (measured, documented in docs/TOAST_READ_DISCIPLINE.md):
 * `public.listings.details` is a ~10 KB jsonb document per row. 86% of the
 * table's 14 GB lives in TOAST, and TOAST is 12x larger than shared_buffers.
 * Postgres CANNOT read one key out of a TOASTed value — `details->>'X'`
 * reassembles the whole document from its chunks, parses it, and throws the
 * rest away. So the cost is per CANDIDATE row, not per returned row: +1.4 ms/row
 * warm-index floor, ~3.8 ms/row seq-scan realistic. `LIMIT 60` saves nothing
 * when the predicate feeding the limit reads `details`.
 *
 * WHAT IT COST, 2026-07-31: a single `details->>` predicate over a broad
 * candidate set produced a 335-second search query and an anon-facing outage
 * (fixed in 967ed3bf), and the same expression inside `listing_tile_mv_src` /
 * `listing_search_mv_src` is the mechanism behind the documented 8-day matview
 * staleness incident — a matview pays the detoast on EVERY refresh, forever,
 * and fails silently into stale data instead of a red build.
 *
 * There was no gate. Code review cannot see this: the bug is invisible on small
 * result sets and looks like an ordinary column reference. This is the gate.
 *
 * ── FOUR RULES, each able to fail on its own ────────────────────────────────
 *
 *   A1 broad select    A supabase-js `.from('listings')` read whose select
 *                      list projects `details` (bare, `details->>Key`, or an
 *                      aliased `X:details->>Key`) or `*` (which INCLUDES
 *                      details), with NO narrowing `.eq()` / `.in()` on the
 *                      primary key ("ListNumber" / "ListingKey"). A bare
 *                      `.select()` with no argument is `*`.
 *
 *   A2 details predicate
 *                      A filter / sort keyed on a `details` expression on the
 *                      same kind of un-narrowed chain: `.order('details->>X')`,
 *                      `.filter('details->>X', …)`, `.or('details…')`,
 *                      `.contains('details', …)`, `.not('details', …)`, and the
 *                      whole `.eq/.neq/.gt/.gte/.lt/.lte/.like/.ilike/.is/.in`
 *                      family. This is the shape that caused the 335 s query:
 *                      the predicate detoasts every row it EXAMINES.
 *
 *   A3 helper columns  A call site that hands a `details` / `*` column string
 *                      to a helper whose `columns` parameter feeds an
 *                      UN-NARROWED `.from('listings').select(<param>)`. The
 *                      TOAST doc calls this out explicitly: "A helper that
 *                      takes `columns: string` as a parameter — check every
 *                      call site, not the helper." Resolved through REAL
 *                      module resolution (tsconfig paths, `@/` alias,
 *                      relative), so renaming the import or switching to a
 *                      relative specifier cannot dodge it.
 *
 *   A4 sql definition  A NEW `CREATE [MATERIALIZED] VIEW` or `CREATE FUNCTION`
 *                      in supabase/migrations/**.sql whose BODY reads
 *                      `details->`, `details->>`, `details ?`, `details @>`, or
 *                      passes `details` into a jsonb function. Definitions are
 *                      the expensive ones: the cost is paid on every refresh /
 *                      every call, and a blown pg_cron statement_timeout is
 *                      silent. A migration that merely REFERENCES an existing
 *                      object (REFRESH / GRANT / COMMENT / ALTER / DROP, or a
 *                      SELECT against the matview) does NOT trip.
 *
 * ── WHAT DELIBERATELY DOES NOT TRIP (the false-positive shapes) ─────────────
 *
 *   - A single-row lookup by primary key. `.select('details').eq('ListingKey',
 *     k).maybeSingle()` reads ONE ~10 KB document. That is the listing-detail
 *     page and it is correct. Narrowing on "ListNumber"/"ListingKey" via
 *     `.eq()`, `.in()`, or `.match({...})` exempts the chain — that is exactly
 *     the "bounded by a unique or near-unique indexed predicate" carve-out the
 *     doc names.
 *   - A call site passing 'details' into a helper that IS pk-narrowed
 *     (getListingFieldsByListingKey / getListingFieldsByListNumber). A3 only
 *     knows about helpers whose listings chain is un-narrowed.
 *   - `{ head: true }` count-only reads for A1. A HEAD request returns no rows,
 *     so the projection is never materialized. It does NOT exempt A2: a
 *     details PREDICATE still detoasts every row it examines, count or not.
 *   - Any table that is not `listings`. `admin_audit.details`,
 *     `listing_private.private_data`, and the narrow matviews
 *     (listing_tile_mv / listing_search_mv / listing_boundary_xref_mv, which
 *     carry no details column on purpose) are all out of scope.
 *   - SQL that names an existing object. `REFRESH MATERIALIZED VIEW
 *     listing_search_mv;` in a migration is a reference, not a definition.
 *
 * ── SCOPE ───────────────────────────────────────────────────────────────────
 * TS: lib/**.ts + app/**.{ts,tsx} — the production read surface, matching G48
 * (ci:row-cap). Crons live in app/api/cron/** and ARE covered. scripts/** is
 * deliberately out: the backfill/reconciliation scripts exist precisely to read
 * details across the whole table (scripts/backfill-virtual-tours.mjs is named
 * in the doc as a predicate that must NOT be "optimized"), so scanning them
 * would be a pure false-positive factory.
 * SQL: supabase/migrations/**.sql.
 *
 * ── RATCHET ─────────────────────────────────────────────────────────────────
 * scripts/toast-read-baseline.json records the known-remaining sites as a
 * MULTISET of { rule, file, key } — key is a normalized signature of the
 * offending expression, never a line number, so unrelated edits above a site do
 * not churn the baseline and swapping one violation for a different one in the
 * same file is still caught. The multiset may only SHRINK: a new (rule, file,
 * key) or a higher count fails. Shrinking passes with a notice; run
 * `--write-baseline` to lock the improvement in.
 *
 * ── ESCAPE HATCH ────────────────────────────────────────────────────────────
 *   // toast-ok: <reason>     (TS, same or previous line)
 *   -- toast-ok: <reason>     (SQL, same or previous line, or anywhere inside
 *                              the definition body)
 * The reason is REQUIRED — a bare `toast-ok` does not suppress. Reserved for
 * reads provably bounded to a handful of rows by construction. If you cannot
 * write the sentence, you do not have the carve-out.
 *
 * AST-based (memory: reference_code_inspecting_gates_use_ast) — parses with the
 * TypeScript compiler and resolves modules with ts.resolveModuleName. No regex
 * over source for any TS rule.
 *
 * Usage:
 *   node scripts/check-toast-read-discipline.mjs                  # CI, exit 1 on new sites
 *   node scripts/check-toast-read-discipline.mjs --report         # same output, always exit 0
 *   node scripts/check-toast-read-discipline.mjs --json           # machine-readable
 *   node scripts/check-toast-read-discipline.mjs --write-baseline # re-seed the ratchet
 */
import { readFileSync, writeFileSync, readdirSync, statSync, existsSync, realpathSync } from 'node:fs'
import { join, resolve, relative } from 'node:path'
import ts from 'typescript'

const ROOT = resolve(new URL('.', import.meta.url).pathname, '..')
const BASELINE_PATH = join(ROOT, 'scripts/toast-read-baseline.json')

const args = new Set(process.argv.slice(2))
const REPORT = args.has('--report')
const JSON_OUT = args.has('--json')
const WRITE_BASELINE = args.has('--write-baseline')

const TS_ROOTS = ['lib', 'app']
const SQL_ROOT = 'supabase/migrations'

const SKIP_DIRS = new Set(['node_modules', '.next', '__tests__', '.git', 'out'])
const TS_EXT_RE = /\.(ts|tsx)$/
const TS_SKIP_RE = /(\.test\.|\.spec\.|\.d\.ts$)/

/** The table whose jsonb payload lives in TOAST. */
const TOAST_TABLE = 'listings'
/** The jsonb column. */
const TOAST_COLUMN = 'details'
/**
 * Columns whose equality/`in` bounds the candidate set to a handful of rows.
 * Both are unique (or near-unique) and indexed on public.listings.
 */
const PK_COLUMNS = new Set(['listnumber', 'listingkey', 'list_number', 'listing_key'])

/** `details`, `details->X`, `details->>X`, `alias:details->>X` — as a whole token. */
const DETAILS_TOKEN_RE = new RegExp(`(^|[^A-Za-z0-9_])${TOAST_COLUMN}([^A-Za-z0-9_]|$)`)

const PRAGMA_TS_RE = /\/\/\s*toast-ok:\s*\S/
const PRAGMA_SQL_RE = /--\s*toast-ok:\s*\S/

// ── file walking ────────────────────────────────────────────────────────────

function walkFiles(dirAbs, match, acc = []) {
  let entries
  try {
    entries = readdirSync(dirAbs)
  } catch {
    return acc
  }
  for (const entry of entries) {
    if (SKIP_DIRS.has(entry)) continue
    const abs = join(dirAbs, entry)
    let st
    try {
      st = statSync(abs)
    } catch {
      continue
    }
    if (st.isDirectory()) walkFiles(abs, match, acc)
    else if (match(entry)) acc.push(abs)
  }
  return acc
}

const tsFiles = TS_ROOTS.flatMap((r) =>
  walkFiles(join(ROOT, r), (n) => TS_EXT_RE.test(n) && !TS_SKIP_RE.test(n)),
).sort()

const sqlFiles = walkFiles(join(ROOT, SQL_ROOT), (n) => n.endsWith('.sql')).sort()

const rel = (abs) => relative(ROOT, abs).split('\\').join('/')

// ── module resolution (A3) ──────────────────────────────────────────────────
// Resolved the way the Next build does, so `@/lib/data/sync/syncWrites`,
// `@/lib/data/sync/./syncWrites` and a plain `../sync/syncWrites` all land on
// the SAME file. Comparing specifier TEXT is the unsound version of this check.

const RESOLVE_OPTS = (() => {
  const configPath = ts.findConfigFile(ROOT, ts.sys.fileExists, 'tsconfig.json')
  const parsed = configPath
    ? ts.parseJsonConfigFileContent(
        ts.readConfigFile(configPath, ts.sys.readFile).config,
        ts.sys,
        ROOT,
      )
    : { options: {} }
  return { ...parsed.options, moduleResolution: ts.ModuleResolutionKind.Bundler }
})()
const RESOLVE_CACHE = ts.createModuleResolutionCache(ROOT, (f) => f, RESOLVE_OPTS)

function canonicalTarget(spec, containingFile) {
  const r = ts.resolveModuleName(spec, containingFile, RESOLVE_OPTS, ts.sys, RESOLVE_CACHE)
    .resolvedModule
  if (!r) return null
  try {
    return realpathSync(r.resolvedFileName)
  } catch {
    return r.resolvedFileName
  }
}

// ── AST helpers ─────────────────────────────────────────────────────────────

const parsed = new Map()

function parseFile(abs) {
  if (parsed.has(abs)) return parsed.get(abs)
  let text
  try {
    text = readFileSync(abs, 'utf8')
  } catch {
    parsed.set(abs, null)
    return null
  }
  const sf = ts.createSourceFile(
    abs,
    text,
    ts.ScriptTarget.Latest,
    /* setParentNodes */ true,
    abs.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  )
  const entry = { sf, lines: text.split('\n') }
  parsed.set(abs, entry)
  return entry
}

function walk(node, visit) {
  visit(node)
  node.forEachChild((child) => walk(child, visit))
}

function lineOf(sf, node) {
  return sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1
}

/** `// toast-ok: <reason>` on this line or the one above it. */
function hasTsPragma(lines, line1) {
  const here = lines[line1 - 1] ?? ''
  const above = lines[line1 - 2] ?? ''
  return PRAGMA_TS_RE.test(here) || PRAGMA_TS_RE.test(above)
}

/**
 * The static string value of an expression, or null. Handles string literals,
 * no-substitution templates, templates (literal spans only, substitutions
 * become a `?` placeholder so a `${x}` interpolation can never be mistaken for
 * an exact column name), `a ?? b` / `a || b` (both sides joined), and a
 * file-local `const NAME = '...'`.
 */
function staticString(node, sf) {
  if (!node) return null
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return node.text
  if (ts.isTemplateExpression(node)) {
    let out = node.head.text
    for (const span of node.templateSpans) out += `?${span.literal.text}`
    return out
  }
  if (ts.isParenthesizedExpression(node)) return staticString(node.expression, sf)
  if (
    ts.isBinaryExpression(node) &&
    (node.operatorToken.kind === ts.SyntaxKind.QuestionQuestionToken ||
      node.operatorToken.kind === ts.SyntaxKind.BarBarToken)
  ) {
    const left = staticString(node.left, sf)
    const right = staticString(node.right, sf)
    return [left, right].filter(Boolean).join(',') || null
  }
  if (ts.isIdentifier(node) && sf) {
    // A file-local `const COLS = 'a, b, details'` used as the select list.
    return stringConstants(sf).get(node.text) ?? null
  }
  return null
}

/** file -> Map(constName -> literal string). Built once; the lookup is hot. */
const stringConstCache = new Map()
function stringConstants(sf) {
  const cached = stringConstCache.get(sf)
  if (cached) return cached
  const map = new Map()
  walk(sf, (n) => {
    if (
      ts.isVariableDeclaration(n) &&
      ts.isIdentifier(n.name) &&
      n.initializer &&
      (ts.isStringLiteral(n.initializer) || ts.isNoSubstitutionTemplateLiteral(n.initializer)) &&
      !map.has(n.name.text)
    ) {
      map.set(n.name.text, n.initializer.text)
    }
  })
  stringConstCache.set(sf, map)
  return map
}

/** Split a PostgREST select list on top-level commas (embedded `t(a,b)` stays whole). */
function splitColumns(selectList) {
  const parts = []
  let depth = 0
  let current = ''
  for (const ch of selectList) {
    if (ch === '(' || ch === '[') depth++
    else if (ch === ')' || ch === ']') depth--
    if (ch === ',' && depth === 0) {
      parts.push(current)
      current = ''
    } else current += ch
  }
  parts.push(current)
  return parts.map((p) => p.trim()).filter(Boolean)
}

/**
 * Classify a select list. `null` = safe. Otherwise the reason token, which also
 * becomes the baseline key so the ratchet is line-independent.
 */
function classifySelectList(selectList) {
  if (selectList === null) return null
  const cols = splitColumns(selectList)
  // `.select()` with no argument, or an empty string, is `*`.
  if (cols.length === 0) return '*'
  for (const col of cols) {
    // A top-level `*` pulls every column, `details` included. `t(*)` is the
    // EMBEDDED table's star and does not touch listings.details.
    if (col === '*') return '*'
  }
  for (const col of cols) {
    if (DETAILS_TOKEN_RE.test(col)) return col.replace(/\s+/g, '')
  }
  return null
}

/**
 * The method calls chained onto `node` (a `.from('listings')` CallExpression):
 * `[{ name, node }]` in application order.
 */
function chainCalls(fromCall) {
  const calls = []
  let cur = fromCall
  for (;;) {
    const parent = cur.parent
    if (!parent) break
    if (ts.isPropertyAccessExpression(parent) && parent.expression === cur) {
      const grand = parent.parent
      if (grand && ts.isCallExpression(grand) && grand.expression === parent) {
        calls.push({ name: parent.name.text, node: grand })
        cur = grand
        continue
      }
      break
    }
    if (ts.isAwaitExpression(parent) || ts.isParenthesizedExpression(parent)) {
      cur = parent
      continue
    }
    break
  }
  return calls
}

/** Nearest enclosing function-like node, or the source file. */
function enclosingScope(node) {
  let cur = node.parent
  while (cur) {
    if (
      ts.isFunctionDeclaration(cur) ||
      ts.isFunctionExpression(cur) ||
      ts.isArrowFunction(cur) ||
      ts.isMethodDeclaration(cur) ||
      ts.isSourceFile(cur)
    )
      return cur
    cur = cur.parent
  }
  return null
}

/**
 * Every supabase method call that belongs to a `.from('listings')` read.
 *
 * The chain itself when it carries a `.select()` — precise, and the common
 * case. When the chain has NO select the query is being built across several
 * statements (`let q = sb.from('listings'); q = q.select(cols); q = q.eq(...)`),
 * which no chain-local walk can follow, so the enclosing function is the unit.
 * Same tradeoff, and same reasoning, as G-search-perf-budget's R6.
 */
function queryCalls(fromCall) {
  const chain = chainCalls(fromCall)
  if (chain.some((c) => c.name === 'select')) return { calls: chain, granularity: 'chain' }
  const scope = enclosingScope(fromCall)
  if (!scope) return { calls: chain, granularity: 'chain' }
  const calls = []
  walk(scope, (n) => {
    if (!ts.isCallExpression(n)) return
    if (!ts.isPropertyAccessExpression(n.expression)) return
    calls.push({ name: n.expression.name.text, node: n })
  })
  return { calls, granularity: 'function' }
}

/** Does any call in this query bound the candidate set to a handful of rows? */
function isPkNarrowed(calls, sf) {
  for (const call of calls) {
    if (call.name === 'eq' || call.name === 'in') {
      const col = staticString(call.node.arguments[0], sf)
      if (col && PK_COLUMNS.has(col.replace(/"/g, '').trim().toLowerCase())) return true
    }
    if (call.name === 'match') {
      const arg = call.node.arguments[0]
      if (arg && ts.isObjectLiteralExpression(arg)) {
        for (const prop of arg.properties) {
          const name = prop.name && (ts.isIdentifier(prop.name) || ts.isStringLiteral(prop.name))
            ? prop.name.text
            : null
          if (name && PK_COLUMNS.has(name.replace(/"/g, '').trim().toLowerCase())) return true
        }
      }
    }
  }
  return false
}

/** `{ head: true }` anywhere in a `.select()` options object — count-only read. */
function isHeadOnly(calls) {
  for (const call of calls) {
    if (call.name !== 'select') continue
    const opts = call.node.arguments[1]
    if (opts && ts.isObjectLiteralExpression(opts)) {
      for (const prop of opts.properties) {
        if (
          ts.isPropertyAssignment(prop) &&
          prop.name &&
          ts.isIdentifier(prop.name) &&
          prop.name.text === 'head' &&
          prop.initializer.kind === ts.SyntaxKind.TrueKeyword
        )
          return true
      }
    }
  }
  return false
}

/** Filter/sort methods whose FIRST string argument is a column expression. */
const COLUMN_FIRST_ARG_METHODS = new Set([
  'order', 'filter', 'not', 'contains', 'containedBy', 'overlaps', 'textSearch',
  'eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'like', 'ilike', 'likeAllOf', 'likeAnyOf',
  'ilikeAllOf', 'ilikeAnyOf', 'is', 'in', 'rangeGt', 'rangeGte', 'rangeLt',
  'rangeLte', 'rangeAdjacent',
])
/** Methods whose WHOLE first argument is a filter expression string. */
const EXPRESSION_ARG_METHODS = new Set(['or', 'and'])

// ── A3: helpers whose `columns` parameter feeds an un-narrowed listings read ──

/**
 * `.select(x)` where x is a parameter (or `param.prop`) of the enclosing
 * function. Returns the binding, or null.
 */
function selectArgParamBinding(selectCall, fnNode) {
  const arg = selectCall.node.arguments[0]
  if (!arg) return null
  const params = fnNode.parameters ?? []
  const paramIndexNamed = (name) =>
    params.findIndex((p) => ts.isIdentifier(p.name) && p.name.text === name)

  // `select(options.columns)` / `select(options.columns ?? 'default')`
  let target = arg
  if (
    ts.isBinaryExpression(target) &&
    (target.operatorToken.kind === ts.SyntaxKind.QuestionQuestionToken ||
      target.operatorToken.kind === ts.SyntaxKind.BarBarToken)
  )
    target = target.left

  if (ts.isPropertyAccessExpression(target) && ts.isIdentifier(target.expression)) {
    const idx = paramIndexNamed(target.expression.text)
    if (idx >= 0) return { paramIndex: idx, property: target.name.text }
  }
  if (ts.isIdentifier(target)) {
    const idx = paramIndexNamed(target.text)
    if (idx >= 0) return { paramIndex: idx, property: null }
    // `const columns = options.columns ?? '...'` then `.select(columns)`
    let via = null
    walk(fnNode, (n) => {
      if (
        via === null &&
        ts.isVariableDeclaration(n) &&
        ts.isIdentifier(n.name) &&
        n.name.text === target.text &&
        n.initializer
      ) {
        let init = n.initializer
        if (
          ts.isBinaryExpression(init) &&
          (init.operatorToken.kind === ts.SyntaxKind.QuestionQuestionToken ||
            init.operatorToken.kind === ts.SyntaxKind.BarBarToken)
        )
          init = init.left
        if (ts.isPropertyAccessExpression(init) && ts.isIdentifier(init.expression)) {
          const idx2 = paramIndexNamed(init.expression.text)
          if (idx2 >= 0) via = { paramIndex: idx2, property: init.name.text }
        }
      }
    })
    if (via) return via
  }
  return null
}

/** The declared name of a function-like node, when it has one. */
function functionName(fnNode) {
  if (ts.isFunctionDeclaration(fnNode) && fnNode.name) return fnNode.name.text
  const parent = fnNode.parent
  if (parent && ts.isVariableDeclaration(parent) && ts.isIdentifier(parent.name))
    return parent.name.text
  if (parent && ts.isPropertyAssignment(parent) && ts.isIdentifier(parent.name))
    return parent.name.text
  return null
}

function isFromToastTable(node, sf) {
  if (!ts.isCallExpression(node)) return false
  if (!ts.isPropertyAccessExpression(node.expression)) return false
  if (node.expression.name.text !== 'from') return false
  const arg = staticString(node.arguments[0], sf)
  return arg === TOAST_TABLE
}

// ── scan ────────────────────────────────────────────────────────────────────

const sites = []
const addSite = (rule, file, key, line, detail) =>
  sites.push({ rule, file, key, line, detail })

/** file(abs) -> [{ name, paramIndex, property, narrowed }] */
const helpersByFile = new Map()

function scanTsFile(abs) {
  const entry = parseFile(abs)
  if (!entry) return
  const { sf, lines } = entry
  const file = rel(abs)

  walk(sf, (node) => {
    if (!isFromToastTable(node, sf)) return
    const { calls } = queryCalls(node)
    const narrowed = isPkNarrowed(calls, sf)
    const headOnly = isHeadOnly(calls)

    // ── A1 ──
    for (const call of calls) {
      if (call.name !== 'select') continue
      const arg = call.node.arguments[0]
      const raw = arg ? staticString(arg, sf) : ''
      // A dynamic select argument (a parameter, a computed expression) is not
      // classifiable here — A3 covers the parameter case at the CALL sites.
      if (arg && raw === null) continue
      const reason = classifySelectList(raw ?? '')
      if (!reason) continue
      if (narrowed || headOnly) continue
      const line = lineOf(sf, call.node)
      if (hasTsPragma(lines, line)) continue
      addSite(
        'A1 broad select',
        file,
        `select:${reason}`,
        line,
        reason === '*'
          ? `.select('*') on listings — '*' includes the ~10 KB details jsonb; no .eq/.in on "ListNumber"/"ListingKey" bounds the candidate set`
          : `.select(… ${reason} …) on listings detoasts every candidate row; no .eq/.in on "ListNumber"/"ListingKey" bounds the candidate set`,
      )
    }

    // ── A2 ──
    if (narrowed) return
    for (const call of calls) {
      const isColumnFirst = COLUMN_FIRST_ARG_METHODS.has(call.name)
      const isExpression = EXPRESSION_ARG_METHODS.has(call.name)
      if (!isColumnFirst && !isExpression) continue
      const raw = staticString(call.node.arguments[0], sf)
      if (!raw) continue
      if (!DETAILS_TOKEN_RE.test(raw)) continue
      const line = lineOf(sf, call.node)
      if (hasTsPragma(lines, line)) continue
      addSite(
        'A2 details predicate',
        file,
        `${call.name}:${raw.replace(/\s+/g, '')}`,
        line,
        `.${call.name}('${raw}') on listings — the predicate detoasts every row it EXAMINES (~3.8 ms/row), not just the rows it returns`,
      )
    }
  })

  // ── A3 pass 1: discover column-parameter helpers in this file ──
  const helpers = []
  walk(sf, (node) => {
    if (!isFromToastTable(node, sf)) return
    const fnNode = enclosingScope(node)
    if (!fnNode || ts.isSourceFile(fnNode)) return
    const name = functionName(fnNode)
    if (!name) return
    const { calls } = queryCalls(node)
    const narrowed = isPkNarrowed(calls, sf)
    for (const call of calls) {
      if (call.name !== 'select') continue
      const binding = selectArgParamBinding(call, fnNode)
      if (!binding) continue
      helpers.push({ name, ...binding, narrowed, line: lineOf(sf, fnNode) })
    }
  })
  if (helpers.length) helpersByFile.set(realpathSync(abs), helpers)
}

for (const abs of tsFiles) scanTsFile(abs)

// ── A3 pass 1b: follow re-export barrels ────────────────────────────────────
//
// Nobody imports lib/data/sync/syncWrites directly — every consumer goes
// through the `@/lib/data` barrel, which does `export { … } from
// '@/lib/data/sync/syncWrites'`. A gate that only knows the declaring file sees
// zero call sites and greens out. So build, per file, the set of helper names
// that file EXPORTS, following `export { x } from` and `export * from` to a
// fixpoint (barrels chain).

/** canonical file -> Map(exportedName -> helper) */
const exportsByFile = new Map()
for (const [file, helpers] of helpersByFile) {
  const map = new Map()
  for (const h of helpers) map.set(h.name, h)
  exportsByFile.set(file, map)
}

// Collect the re-export edges ONCE (walking 1,600 ASTs per fixpoint pass would
// dominate the gate's runtime), then iterate the fixpoint over the edge list.
const reExportEdges = []
for (const abs of tsFiles) {
  const entry = parseFile(abs)
  if (!entry) continue
  const self = realpathSync(abs)
  walk(entry.sf, (node) => {
    if (!ts.isExportDeclaration(node)) return
    if (node.isTypeOnly) return
    if (!node.moduleSpecifier || !ts.isStringLiteral(node.moduleSpecifier)) return
    const target = canonicalTarget(node.moduleSpecifier.text, abs)
    if (!target) return
    if (node.exportClause && ts.isNamedExports(node.exportClause)) {
      const names = node.exportClause.elements
        .filter((s) => !s.isTypeOnly)
        .map((s) => ({ local: s.name.text, original: (s.propertyName ?? s.name).text }))
      if (names.length) reExportEdges.push({ self, target, names })
    } else if (!node.exportClause) {
      reExportEdges.push({ self, target, names: null }) // export * from
    }
  })
}

for (let pass = 0; pass < 8; pass++) {
  let changed = false
  for (const edge of reExportEdges) {
    const from = exportsByFile.get(edge.target)
    if (!from || from.size === 0) continue
    const mine = exportsByFile.get(edge.self) ?? new Map()
    const add = (localName, helper) => {
      if (mine.has(localName)) return
      mine.set(localName, helper)
      changed = true
    }
    if (edge.names) {
      for (const { local, original } of edge.names) {
        const helper = from.get(original)
        if (helper) add(local, helper)
      }
    } else {
      for (const [name, helper] of from) add(name, helper)
    }
    if (mine.size) exportsByFile.set(edge.self, mine)
  }
  if (!changed) break
}

// ── A3 pass 2: call sites, resolved through real module resolution ──────────

function argumentForBinding(callNode, binding) {
  const arg = callNode.arguments[binding.paramIndex]
  if (!arg) return null
  if (!binding.property) return arg
  if (!ts.isObjectLiteralExpression(arg)) return null
  for (const prop of arg.properties) {
    if (!ts.isPropertyAssignment(prop)) continue
    const name =
      prop.name && (ts.isIdentifier(prop.name) || ts.isStringLiteral(prop.name))
        ? prop.name.text
        : null
    if (name === binding.property) return prop.initializer
  }
  return null
}

function scanCallSites(abs) {
  const entry = parseFile(abs)
  if (!entry) return
  const { sf, lines } = entry
  const file = rel(abs)

  /** local identifier -> helper record */
  const bound = new Map()
  /** local namespace identifier -> Map(exportedName -> helper) */
  const namespaces = new Map()

  const bindNamed = (localName, originalName, exported) => {
    const helper = exported.get(originalName)
    if (helper) bound.set(localName, helper)
  }

  // Static imports, resolved to their canonical target file.
  walk(sf, (node) => {
    if (!ts.isImportDeclaration(node)) return
    if (!node.moduleSpecifier || !ts.isStringLiteral(node.moduleSpecifier)) return
    const target = canonicalTarget(node.moduleSpecifier.text, abs)
    if (!target) return
    const exported = exportsByFile.get(target)
    if (!exported) return
    const bindings = node.importClause?.namedBindings
    if (bindings && ts.isNamedImports(bindings)) {
      for (const spec of bindings.elements)
        bindNamed(spec.name.text, (spec.propertyName ?? spec.name).text, exported)
    } else if (bindings && ts.isNamespaceImport(bindings)) {
      namespaces.set(bindings.name.text, exported)
    }
  })

  // Dynamic imports — the shape every cron/action in this repo actually uses:
  //   const { selectHistorySyncCandidates } = await import('@/lib/data')
  //   const data = await import('@/lib/data');  data.selectListingsAdmin(...)
  // A gate that only reads static ImportDeclarations sees none of them.
  walk(sf, (node) => {
    if (!ts.isVariableDeclaration(node) || !node.initializer) return
    let init = node.initializer
    if (ts.isAwaitExpression(init)) init = init.expression
    if (!ts.isCallExpression(init) || init.expression.kind !== ts.SyntaxKind.ImportKeyword) return
    const specNode = init.arguments[0]
    if (!specNode || !ts.isStringLiteral(specNode)) return
    const target = canonicalTarget(specNode.text, abs)
    if (!target) return
    const exported = exportsByFile.get(target)
    if (!exported) return
    if (ts.isObjectBindingPattern(node.name)) {
      for (const element of node.name.elements) {
        if (!ts.isIdentifier(element.name)) continue
        const original =
          element.propertyName && ts.isIdentifier(element.propertyName)
            ? element.propertyName.text
            : element.name.text
        bindNamed(element.name.text, original, exported)
      }
    } else if (ts.isIdentifier(node.name)) {
      namespaces.set(node.name.text, exported)
    }
  })

  // Same-file calls.
  const own = helpersByFile.get(realpathSync(abs))
  if (own) for (const h of own) if (!bound.has(h.name)) bound.set(h.name, h)

  if (bound.size === 0 && namespaces.size === 0) return

  walk(sf, (node) => {
    if (!ts.isCallExpression(node)) return
    let callee = null
    let helper = null
    if (ts.isIdentifier(node.expression)) {
      callee = node.expression.text
      helper = bound.get(callee)
    } else if (
      ts.isPropertyAccessExpression(node.expression) &&
      ts.isIdentifier(node.expression.expression)
    ) {
      callee = node.expression.name.text
      const ns = namespaces.get(node.expression.expression.text)
      helper = ns ? ns.get(callee) : bound.get(callee)
    }
    if (!callee || !helper) return
    // A pk-narrowed helper reads ONE row. Passing it 'details' is correct.
    if (helper.narrowed) return
    const arg = argumentForBinding(node, helper)
    if (!arg) return
    const raw = staticString(arg, sf)
    const reason = classifySelectList(raw)
    if (!reason) return
    const line = lineOf(sf, node)
    if (hasTsPragma(lines, line)) return
    addSite(
      'A3 helper columns',
      file,
      `${callee}:${reason}`,
      line,
      `${callee}(…) hands '${reason}' to an un-narrowed .from('listings').select(<columns>) — the helper is safe, the CALL SITE is the read`,
    )
  })
}

for (const abs of tsFiles) scanCallSites(abs)

// ── A4: SQL definitions ─────────────────────────────────────────────────────

/** Strip `--` line comments and `/* *\/` blocks, preserving offsets. */
function stripSqlComments(sql) {
  let out = ''
  let i = 0
  while (i < sql.length) {
    if (sql[i] === '-' && sql[i + 1] === '-') {
      while (i < sql.length && sql[i] !== '\n') {
        out += ' '
        i++
      }
      continue
    }
    if (sql[i] === '/' && sql[i + 1] === '*') {
      while (i < sql.length && !(sql[i] === '*' && sql[i + 1] === '/')) {
        out += sql[i] === '\n' ? '\n' : ' '
        i++
      }
      out += '  '
      i += 2
      continue
    }
    out += sql[i]
    i++
  }
  return out
}

/** A body that actually READS the jsonb payload (not merely names the word). */
const SQL_DETAILS_READ_RE = new RegExp(
  [
    `${TOAST_COLUMN}\\s*->`, //  details->  / details->>
    `${TOAST_COLUMN}\\s*#>`, //  details#>  / details#>>
    `${TOAST_COLUMN}\\s*\\?`, //  details ? 'k'  / ?| / ?&
    `${TOAST_COLUMN}\\s*@>`, //  details @> '{}'
    `jsonb_[a-z_]+\\s*\\(\\s*[a-z_.]*${TOAST_COLUMN}\\b`, // jsonb_array_length(l.details)
    `rr_[a-z_]+\\s*\\(\\s*[a-z_.]*${TOAST_COLUMN}\\b`, // rr_feature_keys(l.details)
  ].join('|'),
  'i',
)

/**
 * Definition statements. A migration that REFRESHes, GRANTs, COMMENTs on, or
 * SELECTs from an existing object never matches — only a statement that
 * (re)defines the object body does.
 */
const SQL_DEFINITION_RE =
  /\bcreate\s+(?:or\s+replace\s+)?(?:materialized\s+view|view|function|procedure)\s+(?:if\s+not\s+exists\s+)?([a-z0-9_."]+)/gi

function scanSqlFile(abs) {
  const file = rel(abs)
  const raw = readFileSync(abs, 'utf8')
  const stripped = stripSqlComments(raw)
  const rawLines = raw.split('\n')
  const lineAt = (offset) => stripped.slice(0, offset).split('\n').length

  SQL_DEFINITION_RE.lastIndex = 0
  const matches = []
  let m
  while ((m = SQL_DEFINITION_RE.exec(stripped)) !== null) {
    matches.push({ index: m.index, name: m[1].replace(/"/g, ''), kind: m[0] })
  }
  for (let i = 0; i < matches.length; i++) {
    const start = matches[i].index
    const end = i + 1 < matches.length ? matches[i + 1].index : stripped.length
    const body = stripped.slice(start, end)
    if (!SQL_DETAILS_READ_RE.test(body)) continue
    const line = lineAt(start)
    // Pragma: on/above the CREATE line, or anywhere in the definition body.
    const here = rawLines[line - 1] ?? ''
    const above = rawLines[line - 2] ?? ''
    const bodyLines = rawLines.slice(line - 1, lineAt(end)).join('\n')
    if (PRAGMA_SQL_RE.test(here) || PRAGMA_SQL_RE.test(above) || PRAGMA_SQL_RE.test(bodyLines))
      continue
    const kind = /materialized\s+view/i.test(matches[i].kind)
      ? 'materialized view'
      : /\bview\b/i.test(matches[i].kind)
        ? 'view'
        : 'function'
    addSite(
      'A4 sql definition',
      file,
      `${kind}:${matches[i].name.toLowerCase()}`,
      line,
      `CREATE ${kind.toUpperCase()} ${matches[i].name} reads listings.${TOAST_COLUMN} — a definition pays the detoast on EVERY refresh/call (the listing_tile_mv 8-day-staleness class), and a blown pg_cron statement_timeout is silent`,
    )
  }
}

for (const abs of sqlFiles) scanSqlFile(abs)

// ── ratchet ─────────────────────────────────────────────────────────────────

const siteKey = (s) => `${s.rule}\u0000${s.file}\u0000${s.key}`

function toCounts(list) {
  const counts = new Map()
  for (const s of list) counts.set(siteKey(s), (counts.get(siteKey(s)) ?? 0) + 1)
  return counts
}

function serialize(list) {
  const grouped = {}
  for (const s of list) {
    grouped[s.rule] ??= {}
    grouped[s.rule][s.file] ??= {}
    grouped[s.rule][s.file][s.key] = (grouped[s.rule][s.file][s.key] ?? 0) + 1
  }
  const sortedRules = {}
  for (const rule of Object.keys(grouped).sort()) {
    sortedRules[rule] = {}
    for (const file of Object.keys(grouped[rule]).sort()) {
      sortedRules[rule][file] = {}
      for (const key of Object.keys(grouped[rule][file]).sort())
        sortedRules[rule][file][key] = grouped[rule][file][key]
    }
  }
  return sortedRules
}

function deserialize(json) {
  const counts = new Map()
  for (const [rule, files] of Object.entries(json?.sites ?? {}))
    for (const [file, keys] of Object.entries(files))
      for (const [key, count] of Object.entries(keys))
        counts.set(`${rule}\u0000${file}\u0000${key}`, count)
  return counts
}

if (WRITE_BASELINE) {
  const payload = {
    _comment:
      'G62 ci:toast-discipline ratchet. Known-remaining listings.details read sites, keyed by { rule, file, normalized-expression } — never line numbers. SHRINK-ONLY: a new key or a higher count fails the build. Regenerate with `npm run ci:toast-discipline:baseline` ONLY after genuinely removing sites. See docs/TOAST_READ_DISCIPLINE.md.',
    generated: new Date().toISOString().slice(0, 10),
    total: sites.length,
    sites: serialize(sites),
  }
  writeFileSync(BASELINE_PATH, `${JSON.stringify(payload, null, 2)}\n`)
  console.log(`Wrote ${rel(BASELINE_PATH)} — ${sites.length} site(s).`)
  process.exit(0)
}

let baselineJson = { sites: {} }
if (existsSync(BASELINE_PATH)) {
  try {
    baselineJson = JSON.parse(readFileSync(BASELINE_PATH, 'utf8'))
  } catch (error) {
    console.error(`[A0 baseline] ${rel(BASELINE_PATH)} does not parse: ${error.message}`)
    process.exit(REPORT ? 0 : 1)
  }
} else {
  console.error(
    `[A0 baseline] missing ${rel(BASELINE_PATH)} — run \`node scripts/check-toast-read-discipline.mjs --write-baseline\`.`,
  )
  process.exit(REPORT ? 0 : 1)
}

const baselineCounts = deserialize(baselineJson)
const currentCounts = toCounts(sites)

const newSites = []
for (const site of sites) {
  const key = siteKey(site)
  const allowed = baselineCounts.get(key) ?? 0
  const seen = currentCounts.get(key) ?? 0
  if (seen > allowed) newSites.push(site)
}
// Only report each over-budget key once, with its excess.
const overBudget = new Map()
for (const site of newSites) {
  const key = siteKey(site)
  if (!overBudget.has(key)) overBudget.set(key, { site, excess: currentCounts.get(key) - (baselineCounts.get(key) ?? 0) })
}

const removed = []
for (const [key, count] of baselineCounts) {
  const seen = currentCounts.get(key) ?? 0
  if (seen < count) {
    const [rule, file, k] = key.split('\u0000')
    removed.push({ rule, file, key: k, gone: count - seen })
  }
}

if (JSON_OUT) {
  console.log(
    JSON.stringify(
      {
        total: sites.length,
        baselineTotal: [...baselineCounts.values()].reduce((a, b) => a + b, 0),
        sites,
        newSites: [...overBudget.values()].map((o) => o.site),
        removed,
      },
      null,
      2,
    ),
  )
  process.exit(REPORT ? 0 : overBudget.size ? 1 : 0)
}

console.log('TOAST read discipline (ci:toast-discipline, G62)')
console.log('===============================================')
console.log(
  `  scanned ${tsFiles.length} TS file(s) in ${TS_ROOTS.join(' + ')}, ${sqlFiles.length} migration(s)`,
)
const byRule = {}
for (const s of sites) byRule[s.rule] = (byRule[s.rule] ?? 0) + 1
for (const rule of Object.keys(byRule).sort()) console.log(`  ${rule.padEnd(22)} ${byRule[rule]}`)
console.log(
  `  total ${sites.length} site(s) · baseline ${[...baselineCounts.values()].reduce((a, b) => a + b, 0)}`,
)

if (removed.length) {
  console.log('')
  console.log(`  ↓ ${removed.length} baselined site(s) are GONE — ratchet them out:`)
  for (const r of removed.slice(0, 20))
    console.log(`      ${r.rule}  ${r.file}  ${r.key}${r.gone > 1 ? ` (x${r.gone})` : ''}`)
  console.log('      npm run ci:toast-discipline:baseline')
}

if (overBudget.size) {
  console.error('')
  console.error(`  ✗ ${overBudget.size} NEW listings.${TOAST_COLUMN} read site(s):`)
  for (const { site, excess } of overBudget.values()) {
    console.error('')
    console.error(`      [${site.rule}] ${site.file}:${site.line}${excess > 1 ? ` (x${excess})` : ''}`)
    console.error(`        ${site.detail}`)
  }
  console.error('')
  console.error('  Fix, do not baseline. The two correct remedies (docs/TOAST_READ_DISCIPLINE.md):')
  console.error('    1. Filter on the trigger-maintained side table (listing_feature_flags /')
  console.error('       listing_remarks_search), extending listing_feature_flags_of() for a new key.')
  console.error('    2. Read a typed column, but ONLY with the whole-table equivalence proof')
  console.error('       (typed_only = 0 AND jsonb_only = 0). Several typed columns disagree with')
  console.error('       the jsonb in both directions — has_virtual_tour, pool_yn.')
  console.error(`    Provably-bounded read? \`// toast-ok: <reason>\` (\`-- toast-ok:\` in SQL). Reason required.`)
  console.error(`\n\x1b[31m✗ ci:toast-discipline: ${overBudget.size} new site(s).\x1b[0m`)
  process.exit(REPORT ? 0 : 1)
}

console.log(`\n✓ No new listings.${TOAST_COLUMN} read sites beyond the ratchet baseline.`)
process.exit(0)
