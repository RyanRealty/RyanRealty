#!/usr/bin/env node
/**
 * Months-of-supply / sold-count grain-trust lock.
 *
 * THE DEFECT THIS EXISTS FOR. market_pulse_live is filled by two writers.
 * refresh_market_pulse() (city + region) counts actives and closes with one
 * identical predicate on public.listings. refresh_community_market_pulse()
 * (neighborhood) takes actives from listing_boundary_xref_mv, a
 * point-in-polygon join, and closes from a TEXT join on
 * neighborhood_subdivisions.subdivision_label = listings."SubdivisionName".
 * A ratio whose numerator and denominator describe different homes is not a
 * statistic. /cities/bend/century-west published "48.0 MONTHS" and a Dataset
 * variable "Months of Supply": 48 against roughly 2.3 on any same-population
 * count; 22 of 28 neighborhood rows read as buyer's markets inside a city
 * reading 3.49.
 *
 * WHY A SELF-CONSISTENCY CHECK CANNOT REPLACE THIS. Those rows were internally
 * consistent. century-west's 16 actives matched the count on screen and its
 * implied 2.0 six-month closes sat under the 3 its own year reported, so both
 * guards inside publishMonthsOfSupply passed it. The contradiction is between
 * the row and the world, and only the writer's attribution shape reveals it.
 *
 * THREE LOCKS:
 *   1. The registry is default-deny and its two sets are disjoint.
 *   2. Any market_pulse_live writer that mixes a spatial inventory source with
 *      an alias text source must have every geo_type it writes listed as
 *      untrusted. This is the root-cause lock: repairing the writer, and only
 *      repairing the writer, lets a grain leave the untrusted list.
 *   3. Every call that publishes months of supply or a sold count declares the
 *      grain it read at. A new surface cannot publish an absorption figure
 *      without saying which population it came from.
 *
 *   node scripts/check-mos-grain-trust.mjs
 */
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import ts from 'typescript'

const checks = []
const src = (p) => readFileSync(p, 'utf8')
const add = (label, ok, detail) => checks.push({ label, ok, detail })

/* -------------------------------------------------------------------------- */
/* 1. Registry integrity                                                       */
/* -------------------------------------------------------------------------- */

const TRUST_MODULE = 'lib/market/geo-grain-trust.ts'
const trust = src(TRUST_MODULE)

function grainList(name) {
  const m = trust.match(new RegExp(`${name}[^=]*=\\s*\\[([^\\]]*)\\]`))
  if (!m) return null
  return [...m[1].matchAll(/'([a-z_]+)'/g)].map((x) => x[1])
}

const trusted = grainList('SOLD_ATTRIBUTION_TRUSTED_GRAINS')
const untrusted = grainList('SOLD_ATTRIBUTION_UNTRUSTED_GRAINS')

add(
  'trust registry declares both grain sets',
  Array.isArray(trusted) && trusted.length > 0 && Array.isArray(untrusted) && untrusted.length > 0,
  `trusted=${trusted} untrusted=${untrusted}`,
)

add(
  'isSoldAttributionTrusted is default-deny (membership in the trusted set only)',
  /export function isSoldAttributionTrusted/.test(trust) &&
    /SOLD_ATTRIBUTION_TRUSTED_GRAINS\.includes\(grain\)/.test(trust) &&
    /if \(!grain\) return false/.test(trust),
)

add(
  'the trusted and untrusted grain sets are disjoint',
  (trusted ?? []).every((g) => !(untrusted ?? []).includes(g)),
)

add(
  'publishMonthsOfSupply refuses an untrusted grain before any other check',
  (() => {
    const mos = src('lib/market/publish-months-of-supply.ts')
    const guard = mos.indexOf('isSoldAttributionTrusted(input.grain)')
    const firstOtherCheck = mos.indexOf('asFinite(input.pulseMos)')
    return guard > -1 && firstOtherCheck > -1 && guard < firstOtherCheck
  })(),
)

add(
  'publishSoldCount refuses an untrusted grain',
  /export function publishSoldCount/.test(trust) &&
    /if \(!isSoldAttributionTrusted\(input\.grain\)\) return null/.test(trust),
)

/* -------------------------------------------------------------------------- */
/* 2. Writer attribution parity — the root cause                               */
/* -------------------------------------------------------------------------- */

/**
 * Relations that can only supply ON-MARKET inventory (no closed sales), and
 * relations that attribute a listing by a subdivision-NAME string rather than
 * by geometry. A writer reading one of each is computing a ratio across two
 * different attribution mechanisms.
 */
const SPATIAL_INVENTORY_SOURCES = ['listing_boundary_xref_mv', 'listing_tile_mv']
const ALIAS_TEXT_SOURCES = ['neighborhood_subdivisions']

const MIGRATIONS_DIR = 'supabase/migrations'
const migrationFiles = readdirSync(MIGRATIONS_DIR)
  .filter((f) => f.endsWith('.sql'))
  .sort()

/** Split a migration into `CREATE ... FUNCTION name ... $function$ body $function$` units. */
function pulseWriters(sqlText, file) {
  const out = []
  const re = /CREATE\s+OR\s+REPLACE\s+FUNCTION\s+(?:public\.)?([a-z0-9_]+)\s*\(/gi
  let m
  while ((m = re.exec(sqlText))) {
    const name = m[1]
    const rest = sqlText.slice(m.index)
    // Function body ends at the next CREATE OR REPLACE FUNCTION, or EOF.
    const nextIdx = rest.slice(1).search(/CREATE\s+OR\s+REPLACE\s+FUNCTION/i)
    const body = nextIdx === -1 ? rest : rest.slice(0, nextIdx + 1)
    if (!/INSERT\s+INTO\s+public\.market_pulse_live/i.test(body)) continue
    out.push({ file, name, body })
  }
  return out
}

const writers = []
for (const f of migrationFiles) {
  writers.push(...pulseWriters(src(join(MIGRATIONS_DIR, f)), f))
}

// Latest definition wins — a later migration replaces an earlier one.
const latestWriter = new Map()
for (const w of writers) latestWriter.set(w.name, w)

add(
  'found the market_pulse_live writers in the migrations',
  latestWriter.size >= 2,
  `writers=${[...latestWriter.keys()].join(', ')}`,
)

for (const [name, w] of latestWriter) {
  const usesSpatial = SPATIAL_INVENTORY_SOURCES.filter((r) =>
    new RegExp(`(FROM|JOIN)\\s+public\\.${r}\\b`, 'i').test(w.body),
  )
  const usesAlias = ALIAS_TEXT_SOURCES.filter((r) =>
    new RegExp(`(FROM|JOIN)\\s+public\\.${r}\\b`, 'i').test(w.body),
  )
  const mixes = usesSpatial.length > 0 && usesAlias.length > 0
  if (!mixes) continue

  // Every geo_type string this writer stamps onto a row it inserts.
  const written = new Set(
    [...w.body.matchAll(/'(region|city|neighborhood|subdivision|zip|community)'\s*(?:,|\n)/g)].map(
      (x) => x[1],
    ),
  )
  // Narrow to the ones it actually writes as geo_type, not just filters on.
  const geoTypes = [...written].filter((g) =>
    new RegExp(`geo_type\\s*=\\s*'${g}'|'${g}'\\s*,\\s*\\n?\\s*m\\.geo_slug|geo_type\\s*,`, 'i').test(
      w.body,
    ) || new RegExp(`'${g}',`, 'i').test(w.body),
  )

  for (const g of geoTypes) {
    add(
      `${name} mixes ${usesSpatial.join('+')} with ${usesAlias.join('+')}, so grain '${g}' must be untrusted`,
      (untrusted ?? []).includes(g),
      `add '${g}' to SOLD_ATTRIBUTION_UNTRUSTED_GRAINS in ${TRUST_MODULE}, or repair the writer so both sides of the ratio read one source`,
    )
  }
}

/* -------------------------------------------------------------------------- */
/* 3. Call sites declare their grain (AST)                                     */
/* -------------------------------------------------------------------------- */

const GRAIN_REQUIRED_CALLS = new Set([
  'publishMonthsOfSupply',
  'publishSoldCount',
])

function walkSourceFiles(dir, acc = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue
    const p = join(dir, entry.name)
    if (entry.isDirectory()) walkSourceFiles(p, acc)
    else if (/\.tsx?$/.test(entry.name) && !/\.d\.ts$/.test(entry.name)) acc.push(p)
  }
  return acc
}

const roots = ['app', 'lib', 'components'].flatMap((d) => walkSourceFiles(d))
const missingGrain = []

function objectHasGrain(node) {
  if (!node) return false
  if (ts.isObjectLiteralExpression(node)) {
    for (const prop of node.properties) {
      // A spread may carry the grain (e.g. `...cityFaqInput`); accept it only
      // when a literal `grain:` is ALSO present, which every call site does.
      if (
        (ts.isPropertyAssignment(prop) || ts.isShorthandPropertyAssignment(prop)) &&
        prop.name &&
        prop.name.getText() === 'grain'
      ) {
        return true
      }
    }
    return false
  }
  // A variable / conditional passed by reference — its type is MarketFaqInput,
  // which makes grain mandatory at the type level. Accept.
  return true
}

for (const file of roots) {
  const text = src(file)
  if (!/publishMonthsOfSupply\(|publishSoldCount\(|buildMarketFaq\(/.test(text)) continue
  const sf = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)

  const visit = (node) => {
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression)) {
      const fn = node.expression.text
      if (GRAIN_REQUIRED_CALLS.has(fn)) {
        const arg = node.arguments[0]
        if (!objectHasGrain(arg)) {
          missingGrain.push(
            `${file}:${sf.getLineAndCharacterOfPosition(node.getStart()).line + 1} ${fn}() has no grain`,
          )
        }
      }
      if (fn === 'buildMarketFaq') {
        const arg = node.arguments[1]
        if (!objectHasGrain(arg)) {
          missingGrain.push(
            `${file}:${sf.getLineAndCharacterOfPosition(node.getStart()).line + 1} buildMarketFaq() input has no grain`,
          )
        }
      }
    }
    ts.forEachChild(node, visit)
  }
  ts.forEachChild(sf, visit)
}

add(
  'every months-of-supply / sold-count publish declares the grain it read at',
  missingGrain.length === 0,
  missingGrain.join('\n      '),
)

add(
  'MarketFaqInput makes grain required, so tsc catches a new surface too',
  /grain: MarketGrain\b/.test(src('lib/site/market-faq.ts')),
)

add(
  'the 12-month absorption fallbacks are gated on grain trust, not only on a null pulse figure',
  /isSoldAttributionTrusted\(geoType\)/.test(src('lib/cma/market.ts')) &&
    /isSoldAttributionTrusted\(geoType\)/.test(src('lib/data/crm/getMarketReportData.ts')),
)

/* -------------------------------------------------------------------------- */

const failed = checks.filter((c) => !c.ok)
for (const c of checks) {
  console.log(`${c.ok ? 'ok' : 'FAIL'}  ${c.label}`)
  if (!c.ok && c.detail) console.log(`      ${c.detail}`)
}
if (failed.length) {
  console.error(`\nmos-grain-trust: ${failed.length} check(s) failed`)
  process.exit(1)
}
console.log(`\nmos-grain-trust: ${checks.length}/${checks.length}`)
