#!/usr/bin/env node
/**
 * check-market-city-slug-canon.mjs — ci:market-city-slug-canon.
 *
 * §0 DATA ACCURACY. public.compute_and_cache_period_stats matches a city by
 * `lower("City") = lower(p_geo_slug)` and STORES the cache row under p_geo_slug
 * verbatim (migration 20260425090000, lines 263 + 719). listings."City" is the
 * display value ("La Pine"), so the geo_slug passed for a city MUST be its
 * lowercased SPACE form ("la pine").
 *
 * slugify("La Pine") = "la-pine" NEVER equals lower("City"), so a multi-word
 * city got a stale/empty cache stub (La Pine, Powell Butte, Crooked River Ranch
 * were all broken; single-word cities matched by coincidence). It also split the
 * cache into two conventions — the in-DB pg_cron writer keys on lower("City")
 * (space), the route keyed on slugify (hyphen) — so the same city carried two
 * rows with different numbers, and which one published depended on the query.
 *
 * This gate keeps the city refresh writer on the canonical space form:
 *   - refresh-market-stats/route.ts must build its city geo_slug list by
 *     lowercasing the city NAME (`.toLowerCase()`), and
 *   - must NOT call slugify() (which reintroduces the hyphen bug).
 *
 * AST-based (docs: reference_code_inspecting_gates_use_ast).
 *
 * Exit: 0 = the city refresh writes canonical space-form slugs. 1 = otherwise.
 */
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import ts from 'typescript'

// BOTH writers that build city geo entries for compute_and_cache_period_stats.
// The fix was first applied to only one; the weekly monthly-recompute cron had
// the identical slugify bug and would have re-created the stale stubs. Every
// writer is checked, so the two lanes cannot diverge again.
const ROUTES = [
  'app/api/cron/refresh-market-stats/route.ts',
  'app/api/cron/refresh-market-stats-monthly-recompute/route.ts',
]
const problems = []

for (const ROUTE of ROUTES) checkRoute(ROUTE)

function checkRoute(ROUTE) {
const p = join(process.cwd(), ROUTE)
if (!existsSync(p)) {
  problems.push(`${ROUTE}: not found — a city stats writer moved; re-point this gate.`)
  return
}
const src = readFileSync(p, 'utf8')
const sf = ts.createSourceFile(ROUTE, src, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS)

// 1. slugify must not appear (importing OR calling it for a city slug is the bug).
let slugifyReferenced = false
const walkSlugify = (n) => {
  if (ts.isIdentifier(n) && n.text === 'slugify') {
    // ignore occurrences inside comments (getText on identifiers never includes
    // comments, so any Identifier node named slugify is real code).
    slugifyReferenced = true
  }
  ts.forEachChild(n, walkSlugify)
}
walkSlugify(sf)
if (slugifyReferenced) {
  problems.push(
    `${ROUTE}: references slugify(). A city geo_slug built with slugify ("la-pine") never matches lower("City") ("la pine"), so the cache row is a stale/empty stub. Lowercase the city NAME instead.`,
  )
}

// 2. the city slug list must be built by lowercasing the city name.
//    Find `citySlugs = MARKET_REPORT_DEFAULT_CITIES.map(...)` and require the
//    callback to use `.toLowerCase()` and not construct a hyphen.
let cityMapChecked = false
const walkCity = (n) => {
  if (
    ts.isVariableDeclaration(n) &&
    ts.isIdentifier(n.name) &&
    n.name.text === 'citySlugs' &&
    n.initializer
  ) {
    cityMapChecked = true
    const init = n.initializer.getText()
    if (!/MARKET_REPORT_DEFAULT_CITIES/.test(init)) {
      problems.push(`${ROUTE}: citySlugs is not derived from MARKET_REPORT_DEFAULT_CITIES.`)
    }
    if (!/toLowerCase\s*\(/.test(init)) {
      problems.push(
        `${ROUTE}: citySlugs does not lowercase the city name (no .toLowerCase()). The RPC matches lower("City") = lower(p_geo_slug), so the geo_slug must be the lowercased space form.`,
      )
    }
    // Assert the produced slug SHAPE, not a method blacklist. City display names
    // contain spaces, not hyphens, so the canonical lowercased form never has a
    // hyphen. Any construct in the initializer that could INTRODUCE one — a '-'
    // string literal (replace(/ /g,'-'), split(' ').join('-')), slugify, or a
    // char-code — is banned. An earlier version blacklisted only `slugify` and
    // `replace(...,'-')` and a review defeated it with replaceAll/split-join.
    if (/['"]-['"]/.test(init)) {
      problems.push(
        `${ROUTE}: citySlugs contains a '-' literal. A hyphen in a city geo_slug never matches a multi-word city (lower("La Pine")="la pine", not "la-pine").`,
      )
    }
    if (/\bslugify\b/.test(init) || /fromCharCode\s*\(\s*45\b/.test(init)) {
      problems.push(`${ROUTE}: citySlugs uses a slug/hyphen-producing helper — the geo_slug must be lower("City") verbatim.`)
    }
    for (const method of ['replace', 'replaceAll', 'split']) {
      if (new RegExp(`\\.${method}\\s*\\(`).test(init)) {
        problems.push(
          `${ROUTE}: citySlugs calls .${method}(...) — string surgery on a city name risks introducing a hyphen or dropping a space. Lowercasing the name is the only transform the RPC accepts.`,
        )
      }
    }
  }
  ts.forEachChild(n, walkCity)
}
walkCity(sf)
if (!cityMapChecked) {
  problems.push(`${ROUTE}: no \`citySlugs\` binding found — this gate can no longer see how city slugs are built.`)
}
} // end checkRoute

console.log('Market city-slug canonical form gate (ci:market-city-slug-canon)')
console.log('================================================================')
if (problems.length) {
  for (const pr of problems) console.error(`  ✗ ${pr}`)
  console.error(`\n\x1b[31m✗ ci:market-city-slug-canon: ${problems.length} problem(s).\x1b[0m`)
  process.exit(1)
}
console.log('✓ City stats refresh writes the canonical lower("City") space-form slug.')
process.exit(0)
