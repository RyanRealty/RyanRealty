#!/usr/bin/env node
/**
 * check-subdivision-stats-integrity.mjs — ci:subdivision-stats-integrity (W2.1/W2.4).
 *
 * The subdivision stats producer→consumer has three §0 invariants a code change
 * could silently break, reintroducing the exact hazards this feature fixed. The
 * live-DB int test (subdivision-stats.int.test.ts) proves the NUMBERS trace, but
 * it skips without DB creds — so this STATIC gate (in ci:gates) guards the WIRING
 * that keeps those numbers correct, and bites in a secret-less CI:
 *
 *   1. CITY SCOPING (anti-collision). The producer function must scope by BOTH
 *      "City" AND "SubdivisionName" — never name-only. Name-only merges same-named
 *      subdivisions across cities (Summerfield exists in Medford AND Redmond).
 *   2. WRITE-KEY == READ-KEY. The writer must key the cache row on slugify(alias),
 *      the exact string /subdivisions/[slug] passes to getMarketStats, and must
 *      pass the exact City + SubdivisionName for scoping.
 *   3. CONSUMER PERIOD. The subdivision page must read periodType 'ytd' — the
 *      stable period the writer populates (default rolling_90d is unpopulated and
 *      too thin per ODS).
 *
 * Three more were added 2026-08-12 after a verifier found each of them shipped on
 * the live page. All three are the same class: a value that lives in one file and
 * is RESTATED in another, where the copy is what the public reads.
 *
 *   5. THE YEAR DOOR OPENS THE YEAR IT NAMES. The sales-history Ledger links each
 *      closed year to /housing-market/history?year=<year>, and that page CLAMPS the
 *      parameter (Math.min(2030, Math.max(1998, …))). A 1997 row therefore opened
 *      1998 aggregates while the section's note promised the row's own year — and
 *      7,553 closings across 497 plats predate 1998. The route now splits those
 *      years out in _v3/history-door.ts, and this gate pins its two constants to
 *      the clamp the destination actually applies, so the range cannot drift.
 *   6. THE PARENT CLOSINGS FIGURE IS GUARDED. getMarketPulse maps a NULL
 *      sold_count_30d to the number 0, so an unguarded push publishes a 0 the page
 *      cannot tell from a real one, under a trace calling it live-MLS closings.
 *      The sibling figures were guarded; this one was not.
 *   7. THE SCHOOL THRESHOLD PROSE IS BUILT FROM THE DAL CONSTANTS. The public
 *      sentence states the claim rule getSubdivisionSchools applies. Spelling the
 *      values in prose lets the page assert a threshold the DAL abandoned.
 *
 * AST-based per docs (never regex a call site). Exit 0 = all invariants hold.
 */
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import ts from 'typescript'

const ROOT = process.cwd()
const problems = []

const MIGRATION = join(ROOT, 'supabase/migrations/20260724030000_compute_subdivision_period_stats.sql')
const WRITER = join(ROOT, 'lib/data/market/subdivisionStatsWrites.ts')
const PAGE = join(ROOT, 'app/subdivisions/[slug]/page.tsx')
const DOOR = join(ROOT, 'app/subdivisions/[slug]/_v3/history-door.ts')
const LEDGER = join(ROOT, 'app/subdivisions/[slug]/SubdivisionSalesHistory.tsx')
const FIGURES = join(ROOT, 'app/subdivisions/[slug]/_v3/subdivision-figures.ts')
const SCHOOLS_SECTION = join(ROOT, 'app/subdivisions/[slug]/SubdivisionSchools.tsx')
const EXPLORER = join(ROOT, 'app/housing-market/history/page.tsx')
const SCHOOLS_DAL = join(ROOT, 'lib/data/subdivisions/getSubdivisionSchools.ts')

// ── 1. Producer scopes by City AND SubdivisionName (the migration SQL) ──────────
if (!existsSync(MIGRATION)) {
  problems.push(`producer migration missing: ${MIGRATION}`)
} else {
  const sql = readFileSync(MIGRATION, 'utf8')
  // The close-window predicate must carry both scoping columns bound to the params.
  const hasCity = /"City"\s*=\s*p_city/.test(sql)
  const hasName = /"SubdivisionName"\s*=\s*p_subdivision_name/.test(sql)
  if (!hasCity) problems.push('producer does not scope by "City" = p_city (cross-city merge risk)')
  if (!hasName) problems.push('producer does not scope by "SubdivisionName" = p_subdivision_name')
  // No name-only reconstruction (the shared RPC bug): initcap(p_geo_slug) must not be the scope.
  if (/"SubdivisionName"\s*=\s*initcap\s*\(/.test(sql)) {
    problems.push('producer scopes by initcap(p_geo_slug) — the name-only collision bug')
  }
}

// ── AST helpers ─────────────────────────────────────────────────────────────
function parse(file) {
  return ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
}
function findCalls(node, pred, out = []) {
  if (ts.isCallExpression(node) && pred(node)) out.push(node)
  // NB: the callback must return undefined — forEachChild short-circuits on any
  // truthy return, so `(c) => findCalls(...)` (returns the array) would stop after
  // the first child. Use a block body.
  node.forEachChild((c) => {
    findCalls(c, pred, out)
  })
  return out
}
/** keys of the FIRST object-literal argument of a call. */
function objArgKeys(call) {
  const arg = call.arguments.find((a) => ts.isObjectLiteralExpression(a))
  if (!arg) return null
  return arg.properties
    .filter(ts.isPropertyAssignment)
    .map((p) => (ts.isIdentifier(p.name) || ts.isStringLiteral(p.name) ? p.name.text : null))
    .filter(Boolean)
}
/** string value of a named property in the first object-literal arg. */
function objArgProp(call, key) {
  const arg = call.arguments.find((a) => ts.isObjectLiteralExpression(a))
  if (!arg) return null
  const prop = arg.properties.find(
    (p) => ts.isPropertyAssignment(p) && (ts.isIdentifier(p.name) || ts.isStringLiteral(p.name)) && p.name.text === key,
  )
  if (!prop || !ts.isPropertyAssignment(prop)) return null
  return ts.isStringLiteral(prop.initializer) ? prop.initializer.text : '<non-literal>'
}

// ── 2. Writer: .rpc('compute_subdivision_period_stats', {p_geo_slug,p_city,p_subdivision_name,...}) ──
if (!existsSync(WRITER)) {
  problems.push(`writer missing: ${WRITER}`)
} else {
  const src = readFileSync(WRITER, 'utf8')
  const sf = parse(WRITER)
  const rpcCalls = findCalls(sf, (call) => {
    if (!ts.isPropertyAccessExpression(call.expression)) return false
    if (call.expression.name.text !== 'rpc') return false
    const first = call.arguments[0]
    return first && ts.isStringLiteral(first) && first.text === 'compute_subdivision_period_stats'
  })
  if (rpcCalls.length === 0) {
    problems.push('writer does not call .rpc("compute_subdivision_period_stats") — producer unwired')
  } else {
    const keys = objArgKeys(rpcCalls[0]) ?? []
    for (const req of ['p_geo_slug', 'p_city', 'p_subdivision_name', 'p_period_type', 'p_period_start']) {
      if (!keys.includes(req)) problems.push(`writer rpc call is missing the "${req}" argument`)
    }
  }
  // write-key must be slugify(alias) — the writer must call slugify and use it as the geo_slug.
  if (!/p_geo_slug\s*:\s*slug\b/.test(src) || !/const\s+slug\s*=\s*slugify\(/.test(src)) {
    problems.push('writer does not derive p_geo_slug from slugify(alias) — write-key != page read-key')
  }
}

// ── 3. Consumer: subdivision page reads getMarketStats geoType:'subdivision' periodType:'ytd' ──
if (!existsSync(PAGE)) {
  problems.push(`consumer page missing: ${PAGE}`)
} else {
  const sf = parse(PAGE)
  const gmsCalls = findCalls(sf, (call) => ts.isIdentifier(call.expression) && call.expression.text === 'getMarketStats')
  const subCall = gmsCalls.find((c) => objArgProp(c, 'geoType') === 'subdivision')
  if (!subCall) {
    problems.push('subdivision page has no getMarketStats({geoType:"subdivision"}) call')
  } else if (objArgProp(subCall, 'periodType') !== 'ytd') {
    problems.push(`subdivision getMarketStats periodType is "${objArgProp(subCall, 'periodType')}", must be "ytd" (the populated, ODS-safe period)`)
  }

  // ── 4. Schools section (W2.4 MPC parity): the page must fetch the
  //      §0-thresholded schools AND render the section. ──
  const schoolCalls = findCalls(sf, (call) => ts.isIdentifier(call.expression) && call.expression.text === 'getSubdivisionSchools')
  if (schoolCalls.length === 0) {
    problems.push('subdivision page does not call getSubdivisionSchools (W2.4 schools leg unwired)')
  }
  let rendersSchools = false
  ;(function walkJsx(node) {
    if (
      (ts.isJsxSelfClosingElement(node) && node.tagName.getText() === 'SubdivisionSchools') ||
      (ts.isJsxOpeningElement(node) && node.tagName.getText() === 'SubdivisionSchools')
    ) {
      rendersSchools = true
    }
    node.forEachChild((c) => {
      walkJsx(c)
    })
  })(sf)
  if (!rendersSchools) {
    problems.push('subdivision page does not render <SubdivisionSchools> (W2.4 schools section missing)')
  }
}

// ── 5. The year door opens the year it names ───────────────────────────────────
/** First numeric literal passed directly to Math.<fn>(…) anywhere under `node`. */
function mathBound(node, fn) {
  let found = null
  ;(function walk(n) {
    if (
      found === null &&
      ts.isCallExpression(n) &&
      ts.isPropertyAccessExpression(n.expression) &&
      n.expression.expression.getText() === 'Math' &&
      n.expression.name.text === fn
    ) {
      const lit = n.arguments.find((a) => ts.isNumericLiteral(a))
      if (lit) found = Number(lit.text)
    }
    n.forEachChild((c) => {
      walk(c)
    })
  })(node)
  return found
}
/** Numeric value of `export const <name> = <number>` in a parsed source file. */
function exportedNumber(sf, name) {
  let value = null
  ;(function walk(n) {
    if (
      ts.isVariableDeclaration(n) &&
      ts.isIdentifier(n.name) &&
      n.name.text === name &&
      n.initializer &&
      ts.isNumericLiteral(n.initializer)
    ) {
      value = Number(n.initializer.text)
    }
    n.forEachChild((c) => {
      walk(c)
    })
  })(sf)
  return value
}

if (!existsSync(DOOR) || !existsSync(EXPLORER) || !existsSync(LEDGER)) {
  problems.push(`year-door files missing: ${[DOOR, EXPLORER, LEDGER].filter((f) => !existsSync(f)).join(', ')}`)
} else {
  const doorSf = parse(DOOR)
  const routeMin = exportedNumber(doorSf, 'HISTORY_MIN_YEAR')
  const routeMax = exportedNumber(doorSf, 'HISTORY_MAX_YEAR')

  // The destination's own clamp: const year = Math.min(<max>, Math.max(<min>, …)).
  const explorerSf = parse(EXPLORER)
  let yearDecl = null
  ;(function walk(n) {
    if (ts.isVariableDeclaration(n) && ts.isIdentifier(n.name) && n.name.text === 'year' && n.initializer) {
      yearDecl = yearDecl ?? n.initializer
    }
    n.forEachChild((c) => {
      walk(c)
    })
  })(explorerSf)

  if (!yearDecl) {
    problems.push('closed-sales explorer has no `year` declaration — the year-door range cannot be verified')
  } else {
    const clampMin = mathBound(yearDecl, 'max')
    const clampMax = mathBound(yearDecl, 'min')
    if (clampMin === null || clampMax === null) {
      problems.push(
        'closed-sales explorer no longer clamps `year` with Math.max/Math.min — re-verify what years it opens ' +
          'and update app/subdivisions/[slug]/_v3/history-door.ts',
      )
    } else {
      if (routeMin !== clampMin) {
        problems.push(
          `HISTORY_MIN_YEAR is ${routeMin}, the explorer clamps to ${clampMin} — subdivision year rows below ` +
            `${clampMin} would open a different year than the row names`,
        )
      }
      if (routeMax !== clampMax) {
        problems.push(
          `HISTORY_MAX_YEAR is ${routeMax}, the explorer clamps to ${clampMax} — subdivision year rows above ` +
            `${clampMax} would open a different year than the row names`,
        )
      }
    }
  }

  // The Ledger must go through the splitter, never build a year URL of its own.
  const ledgerSrc = readFileSync(LEDGER, 'utf8')
  if (!/\bsplitByExplorerRange\b/.test(ledgerSrc) || !/\bhistoryYearHref\b/.test(ledgerSrc)) {
    problems.push(
      'SubdivisionSalesHistory does not use splitByExplorerRange + historyYearHref — a year row can link ' +
        'outside the range the explorer opens',
    )
  }
  if (/\?year=/.test(ledgerSrc)) {
    problems.push('SubdivisionSalesHistory builds a raw ?year= URL — the door must come from _v3/history-door.ts')
  }
}

// ── 6. The parent closings figure is guarded (NULL sold_count_30d arrives as 0) ──
if (!existsSync(FIGURES)) {
  problems.push(`market-band figures missing: ${FIGURES}`)
} else {
  const sf = parse(FIGURES)
  let guardedPushes = 0
  let unguardedPushes = 0
  ;(function walk(n, guards) {
    let nextGuards = guards
    if (ts.isIfStatement(n) && /closedLast30Days/.test(n.expression.getText())) {
      nextGuards = guards + 1
    }
    if (
      ts.isCallExpression(n) &&
      ts.isPropertyAccessExpression(n.expression) &&
      n.expression.name.text === 'push' &&
      /closedLast30Days/.test(n.getText())
    ) {
      if (nextGuards > 0) guardedPushes += 1
      else unguardedPushes += 1
    }
    n.forEachChild((c) => {
      walk(c, nextGuards)
    })
  })(sf, 0)
  if (unguardedPushes > 0) {
    problems.push(
      'parentPulseFigures pushes closedLast30Days without an enclosing guard — getMarketPulse maps a NULL ' +
        'sold_count_30d to 0, so that figure publishes a zero the page cannot verify (§0 ABSENT IS NOT ZERO)',
    )
  }
  if (guardedPushes === 0 && unguardedPushes === 0) {
    problems.push('no closedLast30Days figure found in _v3/subdivision-figures.ts — re-verify the market band')
  }
}

// ── 7. The school threshold prose is built from the DAL constants ──────────────
if (!existsSync(SCHOOLS_SECTION) || !existsSync(SCHOOLS_DAL)) {
  problems.push(`schools threshold files missing: ${[SCHOOLS_SECTION, SCHOOLS_DAL].filter((f) => !existsSync(f)).join(', ')}`)
} else {
  const src = readFileSync(SCHOOLS_SECTION, 'utf8')
  const body = src.replace(/\/\*[\s\S]*?\*\//g, '') // the docblock may name the rule
  for (const constant of ['SCHOOL_MIN_AGREEMENT', 'SCHOOL_MIN_SAMPLES']) {
    if (!new RegExp(`\\b${constant}\\b`).test(body)) {
      problems.push(
        `SubdivisionSchools does not read ${constant} — the public threshold sentence would restate a value ` +
          'the DAL can change without it',
      )
    }
  }
  const dal = readFileSync(SCHOOLS_DAL, 'utf8')
  const agreement = exportedNumber(parse(SCHOOLS_DAL), 'SCHOOL_MIN_AGREEMENT')
  const samples = exportedNumber(parse(SCHOOLS_DAL), 'SCHOOL_MIN_SAMPLES')
  if (agreement === null || samples === null) {
    problems.push('getSubdivisionSchools no longer exports SCHOOL_MIN_AGREEMENT / SCHOOL_MIN_SAMPLES as numbers')
  } else if (!dal.includes('export const SCHOOL_MIN_SAMPLES')) {
    problems.push('SCHOOL_MIN_SAMPLES is not exported — the section cannot bind its prose to it')
  }
  // Hard-coded restatements of either threshold in the rendered copy.
  const spelled = ['ten', 'eleven', 'twelve', 'seventy']
  for (const word of spelled) {
    if (new RegExp(`at least ${word}\\b`, 'i').test(body)) {
      problems.push(`SubdivisionSchools spells a threshold in prose ("at least ${word}") instead of reading the constant`)
    }
  }
  if (/\b\d{1,3} percent\b/.test(body)) {
    problems.push('SubdivisionSchools hard-codes a percent threshold in prose instead of deriving it from SCHOOL_MIN_AGREEMENT')
  }
}

console.log('Subdivision stats integrity gate (ci:subdivision-stats-integrity)')
console.log('================================================================')
if (problems.length) {
  for (const p of problems) console.error(`  ✗ ${p}`)
  console.error(`\n\x1b[31m✗ ci:subdivision-stats-integrity: ${problems.length} problem(s).\x1b[0m`)
  process.exit(1)
}
console.log('✓ Producer scopes by city+name; write-key = slugify(alias); consumer reads ytd.')
console.log('✓ Year doors match the explorer clamp; closings figure guarded; school prose reads the DAL constants.')
process.exit(0)
