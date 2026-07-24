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

const ROUTE = 'app/api/cron/refresh-market-stats/route.ts'
const problems = []

const p = join(process.cwd(), ROUTE)
if (!existsSync(p)) {
  console.error(`✗ ci:market-city-slug-canon: ${ROUTE} not found — re-point this gate.`)
  process.exit(1)
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
    if (/slugify\s*\(/.test(init) || /replace\([^)]*['"]-['"]/.test(init)) {
      problems.push(`${ROUTE}: citySlugs builds a hyphenated slug — that never matches a multi-word city.`)
    }
  }
  ts.forEachChild(n, walkCity)
}
walkCity(sf)
if (!cityMapChecked) {
  problems.push(`${ROUTE}: no \`citySlugs\` binding found — this gate can no longer see how city slugs are built.`)
}

console.log('Market city-slug canonical form gate (ci:market-city-slug-canon)')
console.log('================================================================')
if (problems.length) {
  for (const pr of problems) console.error(`  ✗ ${pr}`)
  console.error(`\n\x1b[31m✗ ci:market-city-slug-canon: ${problems.length} problem(s).\x1b[0m`)
  process.exit(1)
}
console.log('✓ City stats refresh writes the canonical lower("City") space-form slug.')
process.exit(0)
