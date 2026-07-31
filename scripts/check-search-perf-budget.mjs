#!/usr/bin/env node
/**
 * check-search-perf-budget.mjs — `npm run ci:search-perf-budget`.
 *
 * THE CLASS: the search path had no performance contract of any kind. Nothing
 * stopped a change from removing the ISR revalidate on /search, stripping the
 * resilient cache wrapper off searchListingsAll, raising a fetch timeout to
 * hide a slow query, lifting a row cap past the PostgREST ceiling, or adding an
 * unbounded read to a search DAL file. Each of those is a silent, permanent
 * latency regression that nobody notices until a page is timing out in
 * production.
 *
 * WHY IT DOES NOT TIME ANYTHING: ci:gates runs secret-less and offline. A gate
 * that needs Supabase credentials cannot live there, and a latency assertion
 * run on CI hardware measures the runner, not the code. So this gate is
 * STATIC. The measured numbers live in scripts/search-perf-baseline.json,
 * produced by `npm run perf:search` (scripts/perf-search-measure.mts) against
 * live production data, and this gate enforces the structural invariants that
 * keep those numbers true.
 *
 * SEVEN RULES, each able to fail on its own:
 *
 *   R0 inputs        Baseline parses, every file it names exists, and every
 *                    budgeted path is actually exercised by the measurement
 *                    script. A budget nobody measures is a lie.
 *   R1 headroom      Every budget is a positive integer at least
 *                    `minBudgetHeadroom` times its own measured cold time, and
 *                    carries a `why`. Budgets pinned at the measured edge flap
 *                    on jitter and get deleted, so they are rejected here.
 *   R2 revalidate    Each search page still exports `revalidate` at or below
 *                    the declared ceiling. Losing ISR turns every crawl into a
 *                    live query.
 *   R3 timeouts      Each declared fetch-timeout ceiling still exists and is
 *                    not raised. Raising a timeout hides a regression instead
 *                    of fixing it.
 *   R4 cached reads  Each declared search read is still wrapped in its cache
 *                    wrapper AND still passes a `revalidate` option.
 *   R5 row caps      Each declared row-cap constant still exists and is not
 *                    raised past its ceiling (PostgREST truncates at 1,000
 *                    rows with no error).
 *   R6 bounded reads Every function in the declared search DAL files that
 *                    opens a `.from()` / `.rpc()` read also bounds it
 *                    (`.limit` / `.range` / `.single` / `.maybeSingle` /
 *                    `.in` over a capped chunk / `head: true`), and no literal
 *                    `.limit(N)` exceeds the PostgREST cap.
 *
 * R6 granularity is the enclosing function, deliberately: the search DAL
 * builds queries across several statements (`let query = supabase.from(...)`
 * then `query = query.range(...)`), so a chain-local check would be a pile of
 * false positives. `.in()` counts as a bound because the only `.in()` reads
 * here take a chunk whose size R5 pins (SHAPE_KEY_CHUNK).
 *
 * AST-based (docs: reference_code_inspecting_gates_use_ast) — parses with the
 * TypeScript compiler, never a regex over source.
 *
 * Usage:
 *   node scripts/check-search-perf-budget.mjs           # CI mode, exit 1 on failure
 *   node scripts/check-search-perf-budget.mjs --report  # same output, always exit 0
 */
import { readFileSync, existsSync } from 'node:fs'
import { join, resolve } from 'node:path'
import ts from 'typescript'

const ROOT = resolve(new URL('.', import.meta.url).pathname, '..')
const BASELINE_PATH = join(ROOT, 'scripts/search-perf-baseline.json')
const MEASURE_SCRIPT = 'scripts/perf-search-measure.mts'

const REPORT = process.argv.slice(2).includes('--report')

const problems = []
const fail = (rule, message) => problems.push(`[${rule}] ${message}`)

// ── Source cache + AST helpers ──────────────────────────────────────────────

const sourceCache = new Map()

function parse(relPath) {
  if (sourceCache.has(relPath)) return sourceCache.get(relPath)
  const abs = join(ROOT, relPath)
  if (!existsSync(abs)) {
    sourceCache.set(relPath, null)
    return null
  }
  const text = readFileSync(abs, 'utf8')
  const sf = ts.createSourceFile(
    relPath,
    text,
    ts.ScriptTarget.Latest,
    true,
    relPath.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  )
  sourceCache.set(relPath, sf)
  return sf
}

function walk(node, visit) {
  visit(node)
  node.forEachChild((child) => walk(child, visit))
}

/** Numeric literal value, honoring 1_000 separators. Null when not numeric. */
function numericValue(node) {
  if (!node) return null
  if (ts.isNumericLiteral(node)) return Number(node.text.replace(/_/g, ''))
  if (ts.isPrefixUnaryExpression(node) && node.operator === ts.SyntaxKind.MinusToken) {
    const inner = numericValue(node.operand)
    return inner == null ? null : -inner
  }
  return null
}

/** Every `const <name> = <number>` in the file, at any nesting depth. */
function numericConstants(sf, name) {
  const found = []
  walk(sf, (node) => {
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.name.text === name
    ) {
      const value = numericValue(node.initializer)
      if (value != null) found.push(value)
    }
  })
  return found
}

/** Property-access call name, e.g. `.range(` → 'range'. */
function calleeName(node) {
  if (!ts.isCallExpression(node)) return null
  const expr = node.expression
  if (ts.isPropertyAccessExpression(expr)) return expr.name.text
  if (ts.isIdentifier(expr)) return expr.text
  return null
}

function isFunctionLike(node) {
  return (
    ts.isFunctionDeclaration(node) ||
    ts.isFunctionExpression(node) ||
    ts.isArrowFunction(node) ||
    ts.isMethodDeclaration(node)
  )
}

function lineOf(sf, node) {
  return sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1
}

// ── R0: baseline inputs ─────────────────────────────────────────────────────

if (!existsSync(BASELINE_PATH)) {
  console.error(`[R0 inputs] missing baseline: scripts/search-perf-baseline.json`)
  process.exit(REPORT ? 0 : 1)
}

let baseline
try {
  baseline = JSON.parse(readFileSync(BASELINE_PATH, 'utf8'))
} catch (error) {
  console.error(`[R0 inputs] scripts/search-perf-baseline.json does not parse: ${error.message}`)
  process.exit(REPORT ? 0 : 1)
}

const budgets = Array.isArray(baseline.budgets) ? baseline.budgets : []
const cfg = baseline.static ?? {}

if (budgets.length === 0) fail('R0 inputs', 'baseline declares no budgets')
if (!cfg || typeof cfg !== 'object') fail('R0 inputs', 'baseline declares no `static` block')

const declaredFiles = [
  ...(cfg.pages ?? []),
  ...(cfg.timeoutCeilings ?? []).map((e) => e.file),
  ...(cfg.cachedReads ?? []).map((e) => e.file),
  ...(cfg.rowCaps ?? []).map((e) => e.file),
  ...(cfg.boundedReadFiles ?? []),
]
for (const relPath of new Set(declaredFiles)) {
  if (!existsSync(join(ROOT, relPath))) {
    fail('R0 inputs', `baseline names a file that does not exist: ${relPath}`)
  }
}

if (!existsSync(join(ROOT, MEASURE_SCRIPT))) {
  fail('R0 inputs', `measurement script missing: ${MEASURE_SCRIPT}`)
} else {
  const measureSrc = readFileSync(join(ROOT, MEASURE_SCRIPT), 'utf8')
  for (const budget of budgets) {
    if (!measureSrc.includes(budget.path)) {
      fail(
        'R0 inputs',
        `budget "${budget.path} / ${budget.shape}" is not measured by ${MEASURE_SCRIPT} — a budget nobody measures cannot be refreshed`,
      )
    }
    if (!measureSrc.includes(budget.shape)) {
      fail(
        'R0 inputs',
        `budget shape "${budget.shape}" (${budget.path}) has no matching case in ${MEASURE_SCRIPT}`,
      )
    }
  }
}

// ── R1: budgets carry headroom ──────────────────────────────────────────────

const headroom = Number(cfg.minBudgetHeadroom ?? 0)
if (!(headroom > 1)) {
  fail('R1 headroom', 'static.minBudgetHeadroom must be greater than 1')
}
for (const budget of budgets) {
  const label = `${budget.path} / ${budget.shape}`
  const cold = Number(budget.measuredColdMs)
  const warm = Number(budget.measuredWarmMs)
  const ms = Number(budget.budgetMs)
  if (!Number.isFinite(cold) || cold <= 0) {
    fail('R1 headroom', `${label}: measuredColdMs must be a positive number`)
    continue
  }
  if (!Number.isFinite(warm) || warm <= 0) {
    fail('R1 headroom', `${label}: measuredWarmMs must be a positive number`)
  }
  if (!Number.isInteger(ms) || ms <= 0) {
    fail('R1 headroom', `${label}: budgetMs must be a positive integer`)
    continue
  }
  const required = Math.ceil(cold * headroom)
  if (ms < required) {
    fail(
      'R1 headroom',
      `${label}: budget ${ms}ms sits at the measured edge (cold ${cold}ms). Needs at least ${required}ms (${headroom}x) or it will flap on normal jitter`,
    )
  }
  if (typeof budget.why !== 'string' || budget.why.trim().length < 20) {
    fail('R1 headroom', `${label}: needs a \`why\` explaining what the budget protects`)
  }
}

// ── R2: search pages keep their ISR revalidate ──────────────────────────────

const maxRevalidate = Number(cfg.pageRevalidateMaxSeconds ?? 0)
for (const relPath of cfg.pages ?? []) {
  const sf = parse(relPath)
  if (!sf) continue
  let found = null
  walk(sf, (node) => {
    if (!ts.isVariableStatement(node)) return
    const exported = ts.getCombinedModifierFlags(node.declarationList.declarations[0] ?? node) & ts.ModifierFlags.Export
    if (!exported) return
    for (const decl of node.declarationList.declarations) {
      if (ts.isIdentifier(decl.name) && decl.name.text === 'revalidate') {
        const value = numericValue(decl.initializer)
        if (value != null) found = value
      }
    }
  })
  if (found == null) {
    fail('R2 revalidate', `${relPath} no longer exports a numeric \`revalidate\` — the search page lost ISR`)
  } else if (found > maxRevalidate) {
    fail(
      'R2 revalidate',
      `${relPath} exports revalidate = ${found}s, above the declared ceiling of ${maxRevalidate}s`,
    )
  }
}

// ── R3: fetch-timeout ceilings ──────────────────────────────────────────────

for (const entry of cfg.timeoutCeilings ?? []) {
  const sf = parse(entry.file)
  if (!sf) continue
  const label = `${entry.file} ${entry.name}`
  if (entry.kind === 'constant') {
    const values = numericConstants(sf, entry.name)
    if (values.length === 0) {
      fail('R3 timeouts', `${label}: declared timeout constant is gone`)
    } else if (Math.max(...values) > entry.maxMs) {
      fail(
        'R3 timeouts',
        `${label} = ${Math.max(...values)}ms, above the declared ceiling of ${entry.maxMs}ms. Raising a timeout hides a regression`,
      )
    }
    continue
  }
  if (entry.kind === 'withTimeoutDefault') {
    let defaultMs = null
    walk(sf, (node) => {
      const isNamed =
        (ts.isFunctionDeclaration(node) && node.name?.text === entry.name) ||
        (ts.isVariableDeclaration(node) &&
          ts.isIdentifier(node.name) &&
          node.name.text === entry.name &&
          node.initializer &&
          isFunctionLike(node.initializer))
      if (!isNamed) return
      const fn = ts.isFunctionDeclaration(node) ? node : node.initializer
      for (const param of fn.parameters) {
        const value = numericValue(param.initializer)
        if (value != null) defaultMs = defaultMs == null ? value : Math.max(defaultMs, value)
      }
    })
    if (defaultMs == null) {
      fail('R3 timeouts', `${label}: no numeric default timeout found on \`${entry.name}\` — the guard lost its ceiling`)
    } else if (defaultMs > entry.maxMs) {
      fail(
        'R3 timeouts',
        `${label}: default timeout ${defaultMs}ms is above the declared ceiling of ${entry.maxMs}ms`,
      )
    }
  }
}

// ── R4: search reads stay cached ────────────────────────────────────────────

for (const entry of cfg.cachedReads ?? []) {
  const sf = parse(entry.file)
  if (!sf) continue
  const label = `${entry.file} → ${entry.export}`
  let decl = null
  walk(sf, (node) => {
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.name.text === entry.export
    ) {
      decl = node
    }
  })
  if (!decl) {
    fail('R4 cached reads', `${label}: export not found`)
    continue
  }
  let wrapperCall = null
  walk(decl, (node) => {
    if (calleeName(node) === entry.wrapper) wrapperCall = node
  })
  if (!wrapperCall) {
    fail(
      'R4 cached reads',
      `${label}: no longer wrapped in ${entry.wrapper}() — an uncached search read hits Supabase on every request`,
    )
    continue
  }
  let hasRevalidate = false
  for (const arg of wrapperCall.arguments) {
    if (!ts.isObjectLiteralExpression(arg)) continue
    for (const prop of arg.properties) {
      if (prop.name && ts.isIdentifier(prop.name) && prop.name.text === 'revalidate') hasRevalidate = true
    }
  }
  if (!hasRevalidate) {
    fail('R4 cached reads', `${label}: ${entry.wrapper}() call passes no \`revalidate\` option`)
  }
}

// ── R5: row caps ────────────────────────────────────────────────────────────

for (const entry of cfg.rowCaps ?? []) {
  const sf = parse(entry.file)
  if (!sf) continue
  const label = `${entry.file} ${entry.name}`
  if (entry.kind === 'constant') {
    const values = numericConstants(sf, entry.name)
    if (values.length === 0) {
      fail('R5 row caps', `${label}: declared row-cap constant is gone`)
    } else if (Math.max(...values) > entry.max) {
      fail('R5 row caps', `${label} = ${Math.max(...values)}, above the declared cap of ${entry.max}`)
    }
    continue
  }
  if (entry.kind === 'zodMax') {
    // `limit: z.number().int().min(1).max(1000)` — find the `.max(N)` inside
    // the schema property named `entry.name`.
    let maxValue = null
    walk(sf, (node) => {
      if (!ts.isPropertyAssignment(node)) return
      const propName = ts.isIdentifier(node.name) || ts.isStringLiteral(node.name) ? node.name.text : null
      if (propName !== entry.name) return
      walk(node.initializer, (inner) => {
        if (calleeName(inner) === 'max') {
          const value = numericValue(inner.arguments[0])
          if (value != null) maxValue = maxValue == null ? value : Math.max(maxValue, value)
        }
      })
    })
    if (maxValue == null) {
      fail('R5 row caps', `${label}: schema property lost its \`.max(N)\` ceiling`)
    } else if (maxValue > entry.max) {
      fail('R5 row caps', `${label}: \`.max(${maxValue})\` is above the declared cap of ${entry.max}`)
    }
  }
}

// ── R6: bounded reads ───────────────────────────────────────────────────────

const BOUNDING_CALLS = new Set(['limit', 'range', 'single', 'maybeSingle', 'in'])
const postgrestMax = Number(cfg.postgrestMaxRows ?? 1000)

function hasHeadTrue(node) {
  let found = false
  walk(node, (inner) => {
    if (!ts.isObjectLiteralExpression(inner)) return
    for (const prop of inner.properties) {
      if (
        ts.isPropertyAssignment(prop) &&
        prop.name &&
        ts.isIdentifier(prop.name) &&
        prop.name.text === 'head' &&
        prop.initializer.kind === ts.SyntaxKind.TrueKeyword
      ) {
        found = true
      }
    }
  })
  return found
}

for (const relPath of cfg.boundedReadFiles ?? []) {
  const sf = parse(relPath)
  if (!sf) continue

  // Literal .limit(N) above the PostgREST cap.
  walk(sf, (node) => {
    if (calleeName(node) !== 'limit') return
    const value = numericValue(node.arguments[0])
    if (value != null && value > postgrestMax) {
      fail(
        'R6 bounded reads',
        `${relPath}:${lineOf(sf, node)} .limit(${value}) exceeds the PostgREST cap of ${postgrestMax} — the response truncates with no error`,
      )
    }
  })

  // Every read root must sit inside a function that bounds it.
  walk(sf, (node) => {
    const name = calleeName(node)
    if (name !== 'from' && name !== 'rpc') return
    let scope = node.parent
    while (scope && !isFunctionLike(scope) && !ts.isSourceFile(scope)) scope = scope.parent
    if (!scope || ts.isSourceFile(scope)) {
      fail(
        'R6 bounded reads',
        `${relPath}:${lineOf(sf, node)} .${name}() read sits at module scope, outside any function that could bound it`,
      )
      return
    }
    let bounded = hasHeadTrue(scope)
    if (!bounded) {
      walk(scope, (inner) => {
        const innerName = calleeName(inner)
        if (innerName && BOUNDING_CALLS.has(innerName)) bounded = true
      })
    }
    if (!bounded) {
      fail(
        'R6 bounded reads',
        `${relPath}:${lineOf(sf, node)} .${name}() read is unbounded — the enclosing function never calls .limit / .range / .single / .maybeSingle / .in and does not use { head: true }`,
      )
    }
  })
}

// ── Report ──────────────────────────────────────────────────────────────────

const budgetCount = budgets.length
const staticRuleCount =
  (cfg.pages?.length ?? 0) +
  (cfg.timeoutCeilings?.length ?? 0) +
  (cfg.cachedReads?.length ?? 0) +
  (cfg.rowCaps?.length ?? 0) +
  (cfg.boundedReadFiles?.length ?? 0)

if (problems.length === 0) {
  console.log(
    `✓ Search perf budget: ${budgetCount} measured budgets documented, ${staticRuleCount} static invariants hold.`,
  )
  process.exit(0)
}

console.error(`\n✗ Search perf budget: ${problems.length} problem(s)\n`)
for (const problem of problems) console.error(`  ${problem}`)
console.error(
  `\nMeasured budgets live in scripts/search-perf-baseline.json. Refresh them with: npm run perf:search -- --json\n`,
)
process.exit(REPORT ? 0 : 1)
