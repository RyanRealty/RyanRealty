#!/usr/bin/env node
/**
 * check-stat-source.mjs — ci:stat-source (§0).
 *
 * Matt, 2026-08-17: "There is only one source of statistics that come out of
 * our site onto any public-facing surface, and that's always through this
 * engine."
 *
 * A MACRO statistic is a measurement of the world outside our own data — the
 * 30-yr mortgage rate, the 10Y treasury, a property-tax rate, a hazard
 * insurance rate, an appreciation rate. Nobody in this repo controls those
 * numbers, which is the whole problem: the moment one is typed into a source
 * file it starts rotting, silently, with no error and no test failure. A
 * scenario input is NOT a macro statistic — 20% down, a 30-year term, 3.5%
 * FHA — those are the reader's choice, they do not go stale, and this gate
 * leaves them alone.
 *
 * The engine is the ONE path a macro number may travel:
 *
 *   FRED / Freddie PMMS  →  lib/stats/fred.ts (the one HTTP client;
 *                            market-national-series.ts routes through it)
 *     →  /api/cron/market-history-snapshot (Mondays 13:00 UTC)
 *     →  public.market_history_weekly       (dated, carries `source`)
 *     →  getMarketHistoryWeekly()           (DAL)
 *     →  getCalculatorDefaults()            (lib/data/config.ts — the read)
 *     →  a public surface, as a prop or a parameter
 *
 * and in the database plane, the same series through
 * `public.get_current_mortgage_rate()` (migration 20260817190000).
 *
 * FOUR REAL DEFECTS MOTIVATE THE CHECKS BELOW. None of them failed anything.
 *
 *   1. `const rate = 0.065` in lib/listing-mapper.ts drove the PITI figure
 *      written onto ~7,581 live ACTIVE listing rows (the count as recorded in
 *      lib/listing-mapper.test.ts; the trigger fix repriced 7,561).
 *   2. `const DEFAULT_RATE = 6.5` in components/listing/PaymentCalculator.tsx —
 *      a client component, so the number is typed into the bundle a visitor
 *      downloads and no server read can correct it.
 *   3. `app_config.mortgage_rate`, hand-entered 2026-04-14, still 6.5% on
 *      2026-08-17 while the ingested series carried 6.67% for that week. The
 *      live figure was already in our database. Nothing public read it. On a
 *      $600K home at 20% down that understated the payment by $54/month, and
 *      the gap widened every week nobody remembered to retype the row.
 *   4. check-market-formula.mjs walks app/ lib/ components/ ON DISK, so it
 *      cannot see a figure a cron generated into a table — and the same
 *      blindness let `compute_listing_derived_fields()`, a TRIGGER, hold
 *      `monthly_rate numeric := 0.065 / 12` and silently overwrite a
 *      7,561-row repricing backfill inside the same statement. A gate that
 *      reads only TypeScript cannot see the writer that actually won.
 *
 * ── CHECK 0 · the detector proves itself before it scans ────────────────────
 * Runs first, always, on in-memory fixtures. The FIRST version of this gate
 * shipped a detector that `ts.forEachChild` walked straight into TypeNodes
 * with, so `const DEFAULT_RATE = 6.5 as const` read as "reads an input" (the
 * identifier `const` inside the type reference) and passed. Four characters
 * turned the rule off and the scan still printed a confident green. A gate
 * whose detector is unproven is worse than no gate: it looks like coverage.
 * So the bypasses are fixtures, and a detector that stops flagging one fails
 * the build before a single repo file is opened.
 *
 * ── CHECK 1 · no macro constant inside a compounding model ──────────────────
 * Scope is not "every file" — it is the files that actually run a compounding
 * or amortization computation (`Math.pow(1 + r, n)`, `(1 + r) ** n`,
 * `monthlyPI`, a `piti` binding). That is a precise, self-maintaining
 * definition of "surface that publishes a macro figure": you cannot compute a
 * monthly payment or a future value without a rate, so every such module is
 * either fed by the engine or is inventing a number. Scoping this way is what
 * keeps the gate from crying wolf on `bounceRate` and `conversionRate` — a
 * gate that cries wolf gets loosened until it stops biting at all.
 *
 * Inside those modules a binding is a violation when its NAME names a macro
 * series AND its initializer produces a number without reading any input:
 * literals, `process.env`, and type assertions over them. `const monthlyRate =
 * annualRatePct / 100 / 12` reads a parameter, so it is clean; `const
 * DEFAULT_RATE = 6.5` is not, and neither is any of `6.5 as const`,
 * `6.5 as Rate`, `6.5 satisfies number`, `<number>6.5`, `Number('6.5')`,
 * `parseFloat('6.5')`. An env var counts as hardcoded on purpose:
 * `NEXT_PUBLIC_DEFAULT_MORTGAGE_RATE` is hand-typed by a human with no writer
 * behind it, exactly like the app_config row in defect 3, and being inlined at
 * build time it is even more frozen.
 *
 * CHECK 1b catches the same constant with the name filed off:
 * `listPrice * 0.0035` (hazard insurance) and `listPrice * 0.012` (property
 * tax) are macro rates with no binding to name them. A small literal scaling a
 * price/loan/rent identifier is a rate whatever it is called. Standard
 * financing fractions (0.2, 0.8, 0.035 …) are excluded — those are scenario
 * inputs, not measurements.
 *
 * ── CHECK 2 · the macro read has exactly one owner, in BOTH planes ──────────
 * getCalculatorDefaults in lib/data/config.ts is the chokepoint. It must
 * resolve the 30-yr rate from the ingested series, and no other module may
 * read the `app_config.mortgage_rate` key. Without this pin the 2026-08-17 fix
 * reverts the first time someone "simplifies" that function back to a single
 * app_config read, and defect 3 returns with every gate green.
 *
 * CHECK 2c extends that to SQL, because defect 4 says a TypeScript-only scan
 * is looking at the wrong writer. `supabase/migrations/**.sql` is this repo's
 * only on-disk record of what the database runs, and it is append-only: the
 * LAST `CREATE [OR REPLACE] FUNCTION f` in migration order (minus any later
 * DROP) is f's live definition. This check reads that live definition — not
 * every historical one — and fails when it reads the writer-less app_config
 * key or declares its own macro rate constant. Fixing a row here means
 * shipping a NEW migration that repoints the routine at
 * `get_current_mortgage_rate()`; the superseding definition removes the row
 * from the scan by itself.
 *
 * Stated limit: a routine applied straight to the database (dashboard SQL
 * editor, MCP) and never written down as a migration is invisible here, and
 * `docs/DATABASE_SCHEMA_SNAPSHOT.md` carries columns, not routine bodies. No
 * on-disk gate can close that; see "WHY FRESHNESS IS NOT A GATE".
 *
 * ── CHECK 3 · one door in from a data provider ──────────────────────────────
 * The macro provider endpoints belong to lib/stats/fred.ts alone.
 * A second inline fetch anywhere else is a second source of statistics by
 * definition, even when it hits the same provider — two call sites means two
 * parse paths, two failure modes, and two numbers.
 * Limit, stated plainly: this can only pin the providers we already use. A
 * brand-new host is invisible to it. CHECK 1 is what covers that case, because
 * whatever the number's origin it still has to land in a binding to be used.
 *
 * ── WHY FRESHNESS IS NOT A GATE ─────────────────────────────────────────────
 * "The series stopped updating" is the defect-3 failure, and no check here can
 * ever see it. This gate reads the repo on disk; the static ci:gates chain runs
 * without Supabase credentials on purpose (see KNOWN_UNWIRED in
 * check-gates-wired.mjs). A last-updated timestamp lives in a table. An admin
 * page is worse than useless for it — it complains only when somebody opens it,
 * and the whole defect is that from April to August nobody looked. So the
 * freshness half is a WATCHDOG on a schedule: evalMacroSeries in
 * lib/pipeline-heartbeat.ts, read by /api/cron/loop-health-check (daily
 * 12:30 UTC), which emails Matt one consolidated alert when a pipeline goes
 * dark. Same mechanism that already watches market_stats_cache.
 *
 * THE LEDGER IS FROZEN, NOT AN EXEMPTION — scripts/stat-source-baseline.json.
 * A file not listed may not hardcode a macro constant at all, and a listed file
 * may not grow. The count only shrinks; a file that reaches zero comes off the
 * list, and a listed file that improved without lowering its row fails as a
 * stale row.
 *
 * `--write` exists because this gate lands onto a tree that keeps moving: a
 * rebase can bring in someone else's fix that empties a row, and the ratchet
 * then correctly fails until the row is lowered. `--write` is the one command
 * that re-syncs it, and it is deliberately incapable of the opposite move: it
 * only LOWERS counts and drops cleared rows, and it REFUSES to add a file or
 * raise a count. New debt cannot be laundered into the baseline; it has to be
 * fixed, or added by hand with a reason a reviewer reads.
 *
 * Usage:
 *   node scripts/check-stat-source.mjs
 *   node scripts/check-stat-source.mjs --detector   # fixtures only, no scan
 *   node scripts/check-stat-source.mjs --write      # shrink-only ledger re-sync
 */
import { readFileSync, readdirSync, writeFileSync } from 'node:fs'
import ts from 'typescript'
import { walkFiles } from './lib/walk.mjs'

const DETECTOR_ONLY = process.argv.includes('--detector')
const WRITE = process.argv.includes('--write')

/* ════════════════════════════ the detector ════════════════════════════════ */

/**
 * A module that runs a compounding / amortization computation. Matched against
 * CODE, not prose — `Math.pow(1 + <ident>` and `(1 + <ident>) **` are the two
 * shapes of the amortization and future-value formulas, and the named helpers
 * cover the modules that factored the formula out. A file that merely mentions
 * "PITI" in a comment is not in scope; lib/data/listings/searchListingsAll.ts
 * is exactly that file.
 */
const COMPOUNDING_MODEL =
  /Math\.pow\s*\(\s*1\s*\+\s*[A-Za-z_$]|\(\s*1\s*\+\s*[A-Za-z_$][\w$.]*\s*\)\s*\*\*|\bmonthlyPI\s*\(|\bmonthlyPandI\b|\bmonthlyPrincipalAndInterest\s*\(|\bpitia?\s*[:=][^=]/

/**
 * Words that name a macro MEASUREMENT. Split an identifier on camelCase and
 * underscores; if any word lands here the binding is describing something the
 * outside world decides.
 */
const MACRO_WORDS = new Set([
  'rate', 'rates', 'apr',
  'mortgage', 'interest', 'treasury', 'pmi',
  'tax', 'taxes',
  'insurance', 'hazard',
  'appreciation', 'inflation', 'hpi',
])

/**
 * Words that make a "rate" OURS rather than the world's. A conversion rate, a
 * bounce rate, a fill rate are measurements this shop produces and can
 * reproduce at will; they do not rot, and they are not what §0 is about. The
 * scope rule (compounding models only) already makes these nearly impossible
 * to hit, but the distinction is the rule itself, so it is written down rather
 * than left to luck.
 */
const OUR_OWN_MEASUREMENT = new Set([
  'bounce', 'conversion', 'click', 'clickthrough', 'ctr',
  'open', 'reply', 'response', 'success', 'failure', 'error',
  'sample', 'refresh', 'poll', 'frame', 'engagement',
  'churn', 'retention', 'fill', 'delivery', 'completion', 'win',
])

/** "DEFAULT_RATE_PCT" -> [default, rate, pct]; "insuranceRatePct" -> [insurance, rate, pct]. */
function words(identifier) {
  return identifier
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_$]+/g, ' ')
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
}

function namesAMacroSeries(identifier) {
  const w = words(identifier)
  if (w.some((x) => OUR_OWN_MEASUREMENT.has(x))) return false
  return w.some((x) => MACRO_WORDS.has(x))
}

/**
 * Peel the wrappers that carry a value through unchanged. THIS IS THE FIX FOR
 * THE FOUR-CHARACTER BYPASS: `6.5 as const` is an AsExpression whose type node
 * contains the identifier `const`, so a naive `ts.forEachChild` walk sees an
 * identifier, concludes the expression "reads an input", and waves the
 * constant through. Every assertion form does it — `as const`, `as Rate`,
 * `satisfies number`, `<number>6.5` — and so does a non-null `!`.
 */
function stripAssertions(node) {
  let n = node
  for (;;) {
    if (ts.isAsExpression(n) || ts.isSatisfiesExpression?.(n) || ts.isTypeAssertionExpression?.(n)) {
      n = n.expression
      continue
    }
    if (ts.isNonNullExpression(n) || ts.isParenthesizedExpression(n)) {
      n = n.expression
      continue
    }
    return n
  }
}

/** `Number('6.5')`, `parseFloat('6.5')`, `parseInt('7', 10)` — a constant wearing quotes. */
const NUMERIC_COERCION = /^(Number|parseFloat|parseInt|globalThis\.(Number|parseFloat|parseInt))$/

/**
 * True when the expression produces a number out of thin air — numeric
 * literals, `process.env`, and operators only. The moment it reads a
 * parameter, a prop, an import, or a DAL call, the value is coming from
 * somewhere and this gate has no opinion about it.
 *
 * `process.env.X` is deliberately treated as thin air: it is a human-typed
 * constant with no writer, inlined at build time for NEXT_PUBLIC_*, and it is
 * the same defect class as the hand-maintained app_config row.
 */
export function isSelfContainedNumber(expr) {
  let sawNumber = false
  let sawInput = false

  const visit = (raw) => {
    if (sawInput) return
    const n = stripAssertions(raw)
    // A type never produces a value. Never descend into one — that descent IS
    // the `as const` bypass this gate shipped with and had to be rebuilt for.
    if (ts.isTypeNode(n)) return

    if (ts.isNumericLiteral(n)) {
      sawNumber = true
      return
    }
    // `'6.5'` / `` `6.5` `` — the same constant wearing quotes.
    if (
      (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)) &&
      n.text.trim() !== '' &&
      Number.isFinite(Number(n.text))
    ) {
      sawNumber = true
      return
    }
    // `process.env.FOO` / `process.env?.FOO` — a hand-typed constant, not an input.
    if (
      (ts.isPropertyAccessExpression(n) || ts.isElementAccessExpression(n)) &&
      /^process\s*\.?\??\s*\.?\s*env\b/.test(n.getText().replace(/\s+/g, ' '))
    ) {
      return
    }
    if (ts.isIdentifier(n)) {
      // Bare identifiers that are not part of a process.env / coercion path are inputs.
      if (
        n.text !== 'process' &&
        n.text !== 'env' &&
        n.text !== 'globalThis' &&
        n.text !== 'undefined' &&
        !NUMERIC_COERCION.test(n.text)
      ) {
        sawInput = true
      }
      return
    }
    if (ts.isCallExpression(n) && !NUMERIC_COERCION.test(stripAssertions(n.expression).getText())) {
      sawInput = true
      return
    }
    ts.forEachChild(n, visit)
  }
  visit(expr)
  return sawNumber && !sawInput
}

/** Every form that binds a name to a value (mirrors check-days-to-pending-source). */
function bindings(node) {
  if (ts.isPropertyAssignment(node) && node.initializer) {
    const n = ts.isIdentifier(node.name) || ts.isStringLiteral(node.name) ? node.name.text : null
    return n ? [{ name: n, expr: node.initializer, where: node }] : []
  }
  if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer) {
    return [{ name: node.name.text, expr: node.initializer, where: node }]
  }
  // `function f(rate = 6.5)` — a default parameter is a binding like any other.
  if (ts.isParameter(node) && ts.isIdentifier(node.name) && node.initializer) {
    return [{ name: node.name.text, expr: node.initializer, where: node }]
  }
  if (
    ts.isJsxAttribute(node) &&
    ts.isIdentifier(node.name) &&
    node.initializer &&
    ts.isJsxExpression(node.initializer) &&
    node.initializer.expression
  ) {
    return [{ name: node.name.text, expr: node.initializer.expression, where: node }]
  }
  if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.EqualsToken) {
    const l = node.left
    const n = ts.isIdentifier(l)
      ? l.text
      : ts.isPropertyAccessExpression(l) && ts.isIdentifier(l.name)
        ? l.name.text
        : null
    return n ? [{ name: n, expr: node.right, where: node }] : []
  }
  return []
}

/* ───────────────────── CHECK 1b: the unnamed rate ────────────────────────── */

/** The identifier a rate gets multiplied against when it has no name of its own. */
const SCALED_SUBJECT = /price|principal|loan|value|amount|rent|balance/i

/**
 * Scenario fractions a reader chooses: down payment, LTV, FHA minimum, a
 * commission split. They are inputs, not measurements, so they never go stale
 * and this gate does not touch them.
 */
const FINANCING_FRACTIONS = new Set([0.03, 0.035, 0.05, 0.06, 0.1, 0.15, 0.2, 0.25, 0.5, 0.75, 0.8, 0.9, 0.95, 0.97])

const looksLikeARate = (v) => v > 0 && v < 0.25 && !FINANCING_FRACTIONS.has(v)

/**
 * Every macro-constant site in one TS/TSX source. Takes the text rather than a
 * path so the fixtures in CHECK 0 exercise the exact code the scan runs.
 * Returns [] for a module that runs no compounding model — that scoping is
 * what keeps the gate off `bounceRate`.
 */
export function macroSitesIn(rel, src) {
  if (!COMPOUNDING_MODEL.test(src)) return []

  // ScriptKind follows the extension. Parsing a .ts file as TSX turns
  // `<number>6.5` — a legal angle-bracket assertion in .ts — into a JSX
  // element, and the constant inside it disappears from the walk.
  const kind = rel.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS
  const sf = ts.createSourceFile(rel, src, ts.ScriptTarget.Latest, true, kind)
  const lineOf = (n) => sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1
  const sites = []

  const visit = (node) => {
    for (const { name, expr, where } of bindings(node)) {
      if (!namesAMacroSeries(name)) continue
      if (!isSelfContainedNumber(expr)) continue
      sites.push({
        file: rel,
        line: lineOf(where),
        detail: `\`${name}\` is a macro measurement fixed to ${expr.getText().replace(/\s+/g, ' ').slice(0, 48)}`,
      })
    }
    // 1b — the same constant with no name on it.
    if (
      ts.isBinaryExpression(node) &&
      (node.operatorToken.kind === ts.SyntaxKind.AsteriskToken ||
        node.operatorToken.kind === ts.SyntaxKind.SlashToken)
    ) {
      const left = stripAssertions(node.left)
      const right = stripAssertions(node.right)
      for (const [lit, other] of [
        [left, right],
        [right, left],
      ]) {
        if (!ts.isNumericLiteral(lit)) continue
        if (!looksLikeARate(Number(lit.text))) continue
        if (!SCALED_SUBJECT.test(other.getText())) continue
        sites.push({
          file: rel,
          line: lineOf(node),
          detail: `${lit.text} scales \`${other.getText().replace(/\s+/g, ' ').slice(0, 32)}\` — an unnamed rate`,
        })
        break
      }
    }
    ts.forEachChild(node, visit)
  }
  visit(sf)
  return sites
}

/* ═════════════════════════ the SQL detector ═══════════════════════════════ */

const SQL_DIR = 'supabase/migrations'

const SQL_CREATE = /CREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\s+(?:([a-z_][\w]*)\s*\.\s*)?([a-z_][\w]*)\s*\(/gi
const SQL_DROP = /DROP\s+FUNCTION\s+(?:IF\s+EXISTS\s+)?(?:([a-z_][\w]*)\s*\.\s*)?([a-z_][\w]*)/gi

const qualify = (schema, name) => `${schema ? schema.toLowerCase() : 'public'}.${name.toLowerCase()}`

/**
 * The LIVE definition of every SQL routine this repo records, keyed by
 * qualified name. Migrations are append-only and applied in filename order, so
 * the last CREATE [OR REPLACE] wins and a later DROP removes it — the same
 * resolution Postgres performed when the files were applied. Scanning every
 * historical definition instead would pin migrations that have already been
 * superseded, which cannot be fixed (history is immutable) and would make the
 * check permanently red.
 *
 * @param {{file: string, text: string}[]} migrations  in filename order
 */
export function liveSqlRoutines(migrations) {
  const live = new Map()
  for (const { file, text } of migrations) {
    const events = []
    SQL_CREATE.lastIndex = 0
    for (let m; (m = SQL_CREATE.exec(text)); ) {
      events.push({ at: m.index, kind: 'create', name: qualify(m[1], m[2]) })
    }
    SQL_DROP.lastIndex = 0
    for (let m; (m = SQL_DROP.exec(text)); ) {
      events.push({ at: m.index, kind: 'drop', name: qualify(m[1], m[2]) })
    }
    events.sort((a, b) => a.at - b.at)

    const createStarts = events.filter((e) => e.kind === 'create').map((e) => e.at)
    for (const ev of events) {
      if (ev.kind === 'drop') {
        live.delete(ev.name)
        continue
      }
      // Bound the statement at the next CREATE FUNCTION so a routine without a
      // dollar-quoted body cannot swallow the next routine's body tag.
      const next = createStarts.find((s) => s > ev.at) ?? text.length
      const stmt = text.slice(ev.at, next)
      const tag = stmt.match(/\bAS\s+(\$[A-Za-z_]*\$)/)
      let body = stmt
      if (tag) {
        const open = stmt.indexOf(tag[1]) + tag[1].length
        const close = stmt.indexOf(tag[1], open)
        body = close > -1 ? stmt.slice(open, close) : stmt.slice(open)
      }
      live.set(ev.name, { file, signature: stmt.slice(0, stmt.indexOf('(') + 1).trim(), body })
    }
  }
  return live
}

/** The `app_config` KEY, not the ingested metric `mortgage_rate_30yr`. */
const APP_CONFIG_RATE_KEY = /['"`]mortgage_rate['"`]/

/**
 * A macro rate typed into a routine body: `monthly_rate numeric := 0.065 / 12`
 * (the trigger from defect 4) or `p_rate numeric DEFAULT 0.065`. The name must
 * name a macro series, exactly as in CHECK 1 — a `sample_rate` or a
 * `conversion_rate` is not what this is about.
 */
const SQL_RATE_CONST =
  /\b([a-z_][\w]*)\s+(?:constant\s+)?(?:numeric|decimal|real|double\s+precision)[^;:=]*(?::=|\bDEFAULT\b)\s*([0-9]*\.?[0-9]+)/gi

export function sqlMacroSitesIn(name, body) {
  const sites = []
  if (APP_CONFIG_RATE_KEY.test(body) && /app_config/i.test(body)) {
    sites.push(`${name}() reads the writer-less app_config \`mortgage_rate\` key`)
  }
  SQL_RATE_CONST.lastIndex = 0
  for (let m; (m = SQL_RATE_CONST.exec(body)); ) {
    if (!namesAMacroSeries(m[1])) continue
    sites.push(`${name}() declares \`${m[1]}\` fixed to ${m[2]}`)
  }
  return sites
}

/* ═════════════════════ CHECK 0 · the detector proof ═══════════════════════ */

/**
 * Every row is a bypass that either shipped or is one keystroke away. A
 * detector that stops flagging one of these fails the build here, before the
 * scan, because the failure mode being prevented is a green run over a rule
 * that quietly stopped applying.
 */
const MODEL = 'const pi = principal * Math.pow(1 + monthlyRate, n)\n'
const FIXTURES = [
  // ── must FLAG ──
  ['plain constant', 1, `${MODEL}const DEFAULT_RATE = 6.5`],
  ['as const (the four-character bypass)', 1, `${MODEL}const DEFAULT_RATE = 6.5 as const`],
  ['as NamedType', 1, `${MODEL}type Pct = number\nconst DEFAULT_RATE = 6.5 as Pct`],
  ['satisfies', 1, `${MODEL}const DEFAULT_RATE = 6.5 satisfies number`],
  ['angle-bracket assertion', 1, `${MODEL}const DEFAULT_RATE = <number>6.5`],
  ['non-null assertion', 1, `${MODEL}const DEFAULT_RATE = 6.5!`],
  ['constant wearing quotes', 1, `${MODEL}const mortgageRate = Number('6.5')`],
  ['parseFloat', 1, `${MODEL}const mortgageRate = parseFloat('6.5')`],
  ['env var with a literal floor', 1, `${MODEL}const taxRate = Number(process.env.NEXT_PUBLIC_TAX) || 1.2`],
  ['default parameter', 1, `${MODEL}export function f(insuranceRate = 0.0035) { return insuranceRate }`],
  ['object property', 1, `${MODEL}export const D = { ratePct: 6.875 }`],
  ['unnamed rate scaling a price', 1, `${MODEL}const yearly = listPrice * 0.0035`],
  ['unnamed rate, asserted literal', 1, `${MODEL}const yearly = listPrice * (0.012 as const)`],
  ['JSX prop on a client component', 1, `${MODEL}export const V = () => <Calc mortgageRate={6.5} />`, 'fixture.tsx'],
  // ── must NOT flag ──
  ['rate derived from an input', 0, `${MODEL}const monthlyRate = annualRatePct / 100 / 12`],
  ['rate read from the engine', 0, `${MODEL}const mortgageRate = defaults.mortgageRate`],
  ['rate threaded in as a prop', 0, `${MODEL}export const V = (p: P) => <Calc mortgageRate={p.rate} />`, 'fixture.tsx'],
  ['down payment is a scenario input', 0, `${MODEL}const down = listPrice * 0.2`],
  ['our own measurement, not a world measurement', 0, `${MODEL}const bounceRate = 0.42`],
  ['constant outside any compounding model', 0, 'const DEFAULT_RATE = 6.5'],
]

const SQL_FIXTURES = [
  [
    'live definition supersedes the historical one',
    [
      { file: '1.sql', text: "CREATE FUNCTION public.r() RETURNS numeric AS $$ SELECT value FROM app_config WHERE key = 'mortgage_rate' $$;" },
      { file: '2.sql', text: 'CREATE OR REPLACE FUNCTION public.r() RETURNS numeric AS $$ SELECT public.get_current_mortgage_rate() $$;' },
    ],
    0,
  ],
  [
    'live definition still reads the writer-less key',
    [{ file: '1.sql', text: "CREATE FUNCTION public.r() RETURNS numeric AS $$ SELECT value FROM app_config WHERE key = 'mortgage_rate' $$;" }],
    1,
  ],
  [
    'trigger with a hardcoded rate (defect 4)',
    [{ file: '1.sql', text: 'CREATE FUNCTION public.t() RETURNS trigger AS $fn$ DECLARE monthly_rate numeric := 0.065 / 12; BEGIN RETURN NEW; END; $fn$;' }],
    1,
  ],
  [
    'constant-qualified macro rate is still a macro rate',
    [{ file: '1.sql', text: 'CREATE FUNCTION public.t() RETURNS trigger AS $fn$ DECLARE mortgage_rate constant numeric := 0.065; BEGIN RETURN NEW; END; $fn$;' }],
    1,
  ],
  [
    'dropped routine is not live',
    [
      { file: '1.sql', text: "CREATE FUNCTION public.r() RETURNS numeric AS $$ SELECT value FROM app_config WHERE key = 'mortgage_rate' $$;" },
      { file: '2.sql', text: 'DROP FUNCTION IF EXISTS public.r();' },
    ],
    0,
  ],
]

function proveDetector() {
  const broken = []
  for (const [label, expected, src, file = 'fixture.ts'] of FIXTURES) {
    const got = macroSitesIn(file, src).length
    if ((expected === 0) !== (got === 0)) {
      broken.push(`${label}: expected ${expected ? 'a violation' : 'no violation'}, detector found ${got}`)
    }
  }
  for (const [label, migrations, expected] of SQL_FIXTURES) {
    let got = 0
    for (const [name, def] of liveSqlRoutines(migrations)) got += sqlMacroSitesIn(name, def.body).length
    if ((expected === 0) !== (got === 0)) {
      broken.push(`SQL ${label}: expected ${expected ? 'a violation' : 'no violation'}, detector found ${got}`)
    }
  }
  return broken
}

const detectorBroken = proveDetector()
if (detectorBroken.length) {
  console.error('One-engine statistics gate (ci:stat-source)')
  console.error('==========================================\n')
  console.error('THE DETECTOR IS BROKEN — the scan below would have reported green over a rule that')
  console.error('no longer applies. Fix the detector, not the fixtures.\n')
  for (const b of detectorBroken) console.error(`  ✗ ${b}`)
  process.exit(1)
}
if (DETECTOR_ONLY) {
  console.log(`✓ detector proof: ${FIXTURES.length} TS fixtures + ${SQL_FIXTURES.length} SQL fixtures behave as specified.`)
  process.exit(0)
}

/* ══════════════════════════════ the scan ══════════════════════════════════ */

const SELF = new Set(['scripts/check-stat-source.mjs'])

/** Not public, not shipped: the prototype harness and every test file. */
const isExcluded = (f) =>
  SELF.has(f) ||
  f.startsWith('app/dev/') ||
  /\.test\.tsx?$|\.int\.test\.tsx?$|(^|\/)__tests__\//.test(f)

const sources = [...walkFiles('app'), ...walkFiles('components'), ...walkFiles('lib')]
  .filter((f) => !isExcluded(f))
  .sort()

const ENGINE_FILE = 'lib/data/config.ts'
const SQL_ENGINE_FN = 'public.get_current_mortgage_rate'

/** The official macro-series endpoints (§0 primary sources) this repo ingests. */
const PROVIDER_HOSTS = [
  { host: 'api.stlouisfed.org', label: 'the FRED observations API', owner: 'lib/stats/fred.ts' },
  { host: 'freddiemac.com', label: 'the Freddie Mac PMMS history CSV', owner: 'lib/market-national-series.ts' },
]

/** A host inside a quoted string — a comment naming the provider is not a fetch. */
const quotedHost = (host) => new RegExp(`['"\`][^'"\`\\n]*${host.replace(/\./g, '\\.')}`)

/* ────────────────────────── the frozen ledger ────────────────────────────── */

/**
 * scripts/stat-source-baseline.json holds the pre-existing debt, measured
 * 2026-08-17: TS/TSX modules under `modules`, live SQL routines under
 * `sqlRoutines`, each row `{ allowed, reason }`. The reason is not decoration —
 * it is why the engine cannot serve that figure YET, which is the only thing
 * that tells a later reader whether the row is a bug or a gap.
 *
 * It lives in JSON rather than in this file so `--write` can re-sync it after a
 * rebase without rewriting the gate's own source, the same shape as
 * gates-wired-baseline.json and email-send-gated-baseline.json.
 */
const BASELINE_PATH = 'scripts/stat-source-baseline.json'
const baseline = JSON.parse(readFileSync(BASELINE_PATH, 'utf8'))
const MACRO_CONSTANT_LEDGER = Object.fromEntries(
  Object.entries(baseline.modules ?? {}).map(([k, v]) => [k, v.allowed]),
)
const SQL_CONSTANT_LEDGER = Object.fromEntries(
  Object.entries(baseline.sqlRoutines ?? {}).map(([k, v]) => [k, v.allowed]),
)


/* ───────────────────────── one pass, one read ────────────────────────────── */

const rogueAppConfigReads = []
const providerFailures = []
const macroSites = []
const modelModules = []
let engineSource = null

// ONE read per file, all three checks off the same string, and no array of
// 2819 file contents held at once. The earlier shape read every file three
// times; under `ci:gates` at concurrency 8 (plus whatever else is on the box)
// that was enough for this gate to be killed outright — no stack, no output,
// exit non-zero. A gate that dies under its own runner is a flaky gate.
for (const rel of sources) {
  let src
  try {
    src = readFileSync(rel, 'utf8')
  } catch {
    // A file that vanished between the walk and the read is not a violation.
    continue
  }

  if (rel === ENGINE_FILE) engineSource = src

  // CHECK 2b — nobody but the engine reads the writer-less app_config key.
  if (rel !== ENGINE_FILE && APP_CONFIG_RATE_KEY.test(src)) rogueAppConfigReads.push(rel)

  // CHECK 3 — one door in per provider: each host names its single owner file.
  for (const p of PROVIDER_HOSTS) {
    if (rel !== p.owner && quotedHost(p.host).test(src)) {
      providerFailures.push(
        `${rel} reaches ${p.label} directly. That provider's one door is ${p.owner}, ` +
          `which stamps every row with its source and its vintage. ` +
          `A second call site is a second source of statistics.`,
      )
    }
  }

  // CHECK 1 — only the modules that actually run a compounding model.
  const sites = macroSitesIn(rel, src)
  if (COMPOUNDING_MODEL.test(src)) modelModules.push(rel)
  macroSites.push(...sites)
}

const byFile = new Map()
for (const s of macroSites) {
  if (!byFile.has(s.file)) byFile.set(s.file, [])
  byFile.get(s.file).push(s)
}

const macroFailures = []
for (const [file, sites] of [...byFile.entries()].sort()) {
  const allowed = MACRO_CONSTANT_LEDGER[file] ?? 0
  if (sites.length > allowed) macroFailures.push({ file, sites, allowed })
}
// A ledger row for a file that no longer offends is stale — the count must shrink.
const staleLedgerRows = Object.keys(MACRO_CONSTANT_LEDGER)
  .filter((f) => (byFile.get(f)?.length ?? 0) < (MACRO_CONSTANT_LEDGER[f] ?? 0))
  .sort()

/* ───────────────── CHECK 2c · the database plane ─────────────────────────── */

let migrations = []
try {
  migrations = readdirSync(SQL_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort()
    .map((f) => ({ file: f, text: readFileSync(`${SQL_DIR}/${f}`, 'utf8') }))
} catch {
  /* no migrations dir — reported below as a scan of 0 routines */
}

const routines = liveSqlRoutines(migrations)
const sqlByRoutine = new Map()
for (const [name, def] of routines) {
  if (name === SQL_ENGINE_FN) continue // the SQL-side engine IS the reader
  const sites = sqlMacroSitesIn(name, def.body)
  if (sites.length) sqlByRoutine.set(name, { file: def.file, sites })
}

const sqlFailures = []
for (const [name, { file, sites }] of [...sqlByRoutine.entries()].sort()) {
  const allowed = SQL_CONSTANT_LEDGER[name] ?? 0
  if (sites.length > allowed) sqlFailures.push({ name, file, sites, allowed })
}
const staleSqlLedgerRows = Object.keys(SQL_CONSTANT_LEDGER)
  .filter((n) => (sqlByRoutine.get(n)?.sites.length ?? 0) < (SQL_CONSTANT_LEDGER[n] ?? 0))
  .sort()

/* ──────────────────────── --write · the shrink-only re-sync ──────────────── */

if (WRITE) {
  // The one asymmetry that makes this safe: --write may only move a count DOWN.
  // Anything that would raise a count or introduce a row is refused, printed,
  // and left for a human — a ratchet with a "just re-baseline it" escape hatch
  // is not a ratchet.
  const wouldGrow = [
    ...macroFailures.map((m) => `modules.${m.file}: ledger ${m.allowed} → measured ${m.sites.length}`),
    ...sqlFailures.map((s) => `sqlRoutines.${s.name}: ledger ${s.allowed} → measured ${s.sites.length}`),
  ]
  if (wouldGrow.length) {
    console.error('--write refuses to raise a count or add a row. New macro debt is fixed, not baselined:\n')
    for (const w of wouldGrow) console.error(`  ✗ ${w}`)
    console.error('\n  Take the figure from getCalculatorDefaults() (TS) or get_current_mortgage_rate()')
    console.error('  in a NEW migration (SQL). If it genuinely cannot be served yet, add the row by hand')
    console.error(`  in ${BASELINE_PATH} with a reason that says why.`)
    process.exit(1)
  }

  const next = { ...baseline, modules: {}, sqlRoutines: {} }
  const changes = []
  for (const [file, row] of Object.entries(baseline.modules ?? {})) {
    const measured = byFile.get(file)?.length ?? 0
    if (measured === 0) {
      changes.push(`dropped modules.${file} (was ${row.allowed}, now clean)`)
      continue
    }
    if (measured < row.allowed) changes.push(`lowered modules.${file} ${row.allowed} → ${measured}`)
    next.modules[file] = { ...row, allowed: measured }
  }
  for (const [name, row] of Object.entries(baseline.sqlRoutines ?? {})) {
    const measured = sqlByRoutine.get(name)?.sites.length ?? 0
    if (measured === 0) {
      changes.push(`dropped sqlRoutines.${name} (was ${row.allowed}, now clean)`)
      continue
    }
    if (measured < row.allowed) changes.push(`lowered sqlRoutines.${name} ${row.allowed} → ${measured}`)
    next.sqlRoutines[name] = { ...row, allowed: measured }
  }

  writeFileSync(BASELINE_PATH, JSON.stringify(next, null, 2) + '\n')
  console.log(`${BASELINE_PATH} re-synced.`)
  if (!changes.length) console.log('  no change — the ledger already matches the tree.')
  for (const c of changes) console.log(`  · ${c}`)
  process.exit(0)
}

/* ─────────────────── CHECK 2a · the engine's own shape ───────────────────── */

const engineFailures = []

if (engineSource === null) {
  engineFailures.push(`${ENGINE_FILE} is gone — the macro read has no owner. Restore it or repoint this gate.`)
} else {
  const required = [
    { label: 'exports getCalculatorDefaults', re: /export const getCalculatorDefaults\b/ },
    { label: 'reads the ingested series (getMarketHistoryWeekly)', re: /getMarketHistoryWeekly/ },
    { label: 'names the mortgage_rate_30yr metric', re: /mortgage_rate_30yr/ },
    {
      label: 'prefers the ingested rate over the hand-entered row (`ingestedRate ??`)',
      re: /ingestedRate\s*\?\?/,
    },
  ]
  for (const r of required) {
    if (!r.re.test(engineSource)) {
      engineFailures.push(
        `${ENGINE_FILE} no longer ${r.label}. That is defect 3 returning: app_config.mortgage_rate ` +
          `has no writer, so a surface reading it publishes whatever a human last typed.`,
      )
    }
  }
}

if (!routines.has(SQL_ENGINE_FN)) {
  engineFailures.push(
    `${SQL_ENGINE_FN}() is not defined by any migration. It is the database-side half of the engine — ` +
      `compute_listing_derived_fields() calls it instead of holding its own 0.065. Without it the trigger ` +
      `has nowhere to read a live rate from.`,
  )
}

for (const f of rogueAppConfigReads) {
  engineFailures.push(
    `${f} reads the app_config \`mortgage_rate\` key directly. That row is hand-maintained with no ` +
      `writer — it sat at 6.5% from April to August. Call getCalculatorDefaults() from ${ENGINE_FILE}.`,
  )
}

/* ─────────────────────────────── report ──────────────────────────────────── */

console.log('One-engine statistics gate (ci:stat-source)')
console.log('==========================================')
console.log(
  `  detector proof: ${FIXTURES.length} TS + ${SQL_FIXTURES.length} SQL fixtures\n` +
    `  scanned ${sources.length} source files · ${modelModules.length} run a compounding model\n` +
    `  scanned ${migrations.length} migrations · ${routines.size} live SQL routines`,
)

let failed = false

if (macroFailures.length) {
  failed = true
  console.error('\nMacro constants hardcoded inside a compounding model:')
  for (const m of macroFailures) {
    console.error(`  ✗ ${m.file} — ${m.sites.length} site(s), ledger allows ${m.allowed}`)
    for (const s of m.sites) console.error(`      line ${s.line}: ${s.detail}`)
  }
  console.error(
    '\n  A mortgage, tax, insurance or appreciation rate is a MEASUREMENT — it is wrong the day\n' +
      '  the market moves and nothing fails. Take it from getCalculatorDefaults() in lib/data/config.ts,\n' +
      '  which resolves the 30-yr rate from the ingested weekly series. Client components receive it\n' +
      '  as a prop from a server component; see app/tools/mortgage-calculator/page.tsx.',
  )
}

if (staleLedgerRows.length) {
  failed = true
  console.error('\nStale ledger rows (the file improved — lower the count so it can never regrow):')
  for (const f of staleLedgerRows) {
    console.error(`  ✗ ${f} — ledger says ${MACRO_CONSTANT_LEDGER[f]}, found ${byFile.get(f)?.length ?? 0}`)
  }
  console.error('\n  Re-sync with: node scripts/check-stat-source.mjs --write  (it can only lower a count).')
}

if (sqlFailures.length) {
  failed = true
  console.error('\nMacro constants inside a LIVE SQL routine:')
  for (const s of sqlFailures) {
    console.error(`  ✗ ${s.name} (last defined in ${s.file}) — ${s.sites.length} site(s), ledger allows ${s.allowed}`)
    for (const d of s.sites) console.error(`      ${d}`)
  }
  console.error(
    `\n  A trigger or routine is the writer that WINS: compute_listing_derived_fields() held\n` +
      `  \`monthly_rate numeric := 0.065 / 12\` and silently overwrote a 7,561-row repricing backfill\n` +
      `  inside the same statement. Call ${SQL_ENGINE_FN}() and ship the change as a NEW migration —\n` +
      `  editing an applied one changes nothing in the database.`,
  )
}

if (staleSqlLedgerRows.length) {
  failed = true
  console.error('\nStale SQL ledger rows (the routine improved — lower the count):')
  for (const n of staleSqlLedgerRows) {
    console.error(`  ✗ ${n} — ledger says ${SQL_CONSTANT_LEDGER[n]}, found ${sqlByRoutine.get(n)?.sites.length ?? 0}`)
  }
  console.error('\n  Re-sync with: node scripts/check-stat-source.mjs --write  (it can only lower a count).')
}

if (engineFailures.length) {
  failed = true
  console.error('\nThe macro read no longer has one owner:')
  for (const e of engineFailures) console.error(`  ✗ ${e}`)
}

if (providerFailures.length) {
  failed = true
  console.error('\nA second door in from a data provider:')
  for (const p of providerFailures) console.error(`  ✗ ${p}`)
}

if (failed) {
  console.error('\nFAILED.')
  process.exit(1)
}

const debt = Object.values(MACRO_CONSTANT_LEDGER).reduce((a, n) => a + n, 0)
const sqlDebt = Object.values(SQL_CONSTANT_LEDGER).reduce((a, n) => a + n, 0)
console.log('✓ getCalculatorDefaults is the single macro read, sourced from the ingested weekly series.')
console.log(`✓ ${SQL_ENGINE_FN}() is the database-side read of the same series.`)
console.log(`✓ ${PROVIDER_HOSTS.length} provider endpoint(s), each reachable only from its owner file.`)
console.log(
  `  ${debt} hardcoded macro constant(s) on the frozen TS ledger; ${sqlDebt} on the SQL ledger ` +
    `(${BASELINE_PATH}). Both only shrink.`,
)
console.log('  Freshness of the series itself is watched by evalMacroSeries in lib/pipeline-heartbeat.ts')
console.log('  (/api/cron/loop-health-check, daily 12:30 UTC) — no on-disk gate can see a stale table.')
process.exit(0)
