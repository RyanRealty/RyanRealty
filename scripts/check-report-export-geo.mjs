#!/usr/bin/env node
/**
 * check-report-export-geo.mjs — ci:report-export-geo (§0 + W8.1).
 *
 * `/api/reports/export` is public, unauthenticated, and stamps the brokerage's
 * name on a PDF or workbook. Two defects lived in it, both of the same shape:
 * a figure whose SCOPE was not what its LABEL said.
 *
 *   D2 — THE CITY DID NOT SCOPE THE DOCUMENT. `?subdivision=` was validated by
 *   nothing and resolved to a BARE cache slug, and `market_stats_cache` keys
 *   communities with no city anywhere in the key (verified live 2026-07-24:
 *   101 subdivision rows + 4,987 neighborhood rows, zero city-qualified). So
 *   `?city=Madras&subdivision=Tetherow` returned a branded workbook headed
 *   "Tetherow, Madras" carrying Bend's Tetherow numbers.
 *
 *   D5 — THE EXPORT AND THE PAGE DISAGREED. For a registered community the
 *   export read geo_type='subdivision' (literal SubdivisionName equality) while
 *   /communities/<slug> reads geo_type='neighborhood' (the alias-aware
 *   aggregate). Same community, same window, different numbers — verified live
 *   2026-07-24 for YTD 2026-01-01..2026-07-24: Tetherow 9 sold / $2,600,000 vs
 *   18 sold / $1,414,000; Black Butte Ranch 0 vs 17; Sunriver 0 vs 43. An
 *   exported document may not contradict the page it was exported from — that
 *   is the whole point of W8.1's one generation path.
 *
 *   D3 — THREE WINDOWS, ONE UNLABELED BLOCK. The chosen closed-sale period, the
 *   trailing-12-month count, and the live inventory snapshot were emitted as a
 *   single flat key/value list under one period header, so a Terrebonne export
 *   printed "Months of Supply: 21" beneath a header reading "Last 30 days".
 *
 * HOW THIS GATE CHECKS. It EXECUTES the pure modules against fixtures — the
 * real slugify, the real registry file, the real builder — rather than grepping
 * for reassuring identifiers, then AST-checks that the route is still wired to
 * them. A gate that only greps passes a route that imports the resolver and
 * ignores its answer.
 *
 * Exit 0 = a community can only be exported under the city the registry places
 * it in, from the same cache row the community page renders, with every figure
 * inside a block that names its window.
 */
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import ts from 'typescript'

const ROOT = process.cwd()
const ROUTE = 'app/api/reports/export/route.ts'
const PDF = 'lib/pdf/report-pdf.tsx'
const GEO_MODULE = 'lib/market/report-geo.ts'
const DOC_MODULE = 'lib/market/report-document.ts'
const SLUG_MODULE = 'lib/slug.ts'
const REGISTRY = 'data/resort-communities.json'

const problems = []

// ──────────────────────────────────────────────────────────────────────────
// A tiny CommonJS loader for the pure modules, so the fixtures below run the
// REAL implementations (real slugify, real registry) instead of a re-typed
// copy that could drift from what ships.
// ──────────────────────────────────────────────────────────────────────────
const loaded = new Map()

function loadTs(rel) {
  if (loaded.has(rel)) return loaded.get(rel)
  const abs = join(ROOT, rel)
  if (!existsSync(abs)) throw new Error(`${rel} not found`)
  const js = ts.transpileModule(readFileSync(abs, 'utf8'), {
    // esModuleInterop so the registry's `import x from '….json'` resolves the
    // same way Next resolves it, rather than landing on an undefined `.default`.
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
    },
    fileName: rel,
  }).outputText

  const exports = {}
  const require_ = (spec) => {
    if (spec === '@/lib/slug') return loadTs(SLUG_MODULE)
    if (spec === '@/data/resort-communities.json') return JSON.parse(readFileSync(join(ROOT, REGISTRY), 'utf8'))
    // Type-only imports are erased by the transpiler; anything else reaching
    // here means the module gained a real runtime dependency and this loader
    // must learn about it rather than silently hand back a stub.
    throw new Error(`${rel} requires '${spec}', which this gate's loader does not provide`)
  }
  loaded.set(rel, exports)
  new Function('exports', 'require', 'module', js)(exports, require_, { exports })
  return exports
}

let geo = null
let doc = null
try {
  geo = loadTs(GEO_MODULE)
  doc = loadTs(DOC_MODULE)
} catch (e) {
  problems.push(`cannot execute the pure report modules: ${e.message}`)
}

// ──────────────────────────────────────────────────────────────────────────
// 1. EXECUTED FIXTURES — city-qualified community resolution.
// ──────────────────────────────────────────────────────────────────────────
if (geo) {
  const registry = JSON.parse(readFileSync(join(ROOT, REGISTRY), 'utf8')).communities
  const cities = [...new Set(registry.map((c) => c.city))]

  // The live defect, verbatim.
  if (geo.resolveReportCommunity('Madras', 'Tetherow') !== null) {
    problems.push(
      `${GEO_MODULE}: resolveReportCommunity('Madras','Tetherow') must be null — that exact pair ` +
        `shipped a workbook titled "Tetherow, Madras" carrying Bend's numbers.`,
    )
  }

  // Every community: resolves under its own city, under NO other.
  for (const c of registry) {
    const own = geo.resolveReportCommunity(c.city, c.label)
    if (!own || own.slug !== c.slug) {
      problems.push(`${GEO_MODULE}: ${c.label} does not resolve under its own registry city ${c.city}`)
    }
    for (const other of cities) {
      if (other === c.city) continue
      if (geo.resolveReportCommunity(other, c.label) !== null) {
        problems.push(`${GEO_MODULE}: ${c.label} resolves under ${other} — the city is not scoping.`)
      }
    }
  }

  // A bare cache slug that the registry does not place is refused, not guessed.
  for (const unplaced of ['Deer Park', 'Whispering Pines', 'Nowhere Estates', '']) {
    if (geo.resolveReportCommunity('Bend', unplaced) !== null) {
      problems.push(
        `${GEO_MODULE}: '${unplaced}' resolved in Bend, but the registry does not place it. ` +
          `Subdivision names collide across cities, so a name-only match cannot be city-scoped.`,
      )
    }
  }
}

// ──────────────────────────────────────────────────────────────────────────
// 2. EXECUTED FIXTURES — every figure sits in a block that names its window.
// ──────────────────────────────────────────────────────────────────────────
if (doc) {
  const facts = {
    period: { label: 'Last 30 days', start: '2026-06-24', end: '2026-07-24' },
    medianSalePrice: 709000,
    soldCount: 2,
    medianDom: 38,
    medianPricePerSqft: 312,
    trailing12: { label: 'Last 12 months', start: '2025-07-24', end: '2026-07-24' },
    sales12mo: 61,
    activeCount: 107,
    monthsOfSupply: 21,
    liveAsOf: '2026-07-24',
    trend: [{ month: '2026-06', soldCount: 6, medianSalePrice: 655000 }],
  }
  const sections = doc.buildSections(facts, null)
  const headingFor = (label) => sections.find((s) => s.rows.some(([k]) => k === label))?.heading

  if (sections.some((s) => !s.heading || !s.heading.trim())) {
    problems.push(`${DOC_MODULE}: a figure block carries no heading — every figure must state its window.`)
  }

  const chosen = headingFor('Sold Count')
  const trailing = headingFor('12 Month Sales')
  const live = headingFor('Months of Supply')

  if (!chosen?.includes('2026-06-24 to 2026-07-24')) {
    problems.push(`${DOC_MODULE}: the chosen-period block does not print the period's own bounds.`)
  }
  if (!trailing?.includes('2025-07-24 to 2026-07-24') || trailing === chosen) {
    problems.push(
      `${DOC_MODULE}: the trailing-12-month count is not labeled with its OWN window ` +
        `(got "${trailing}"). A 12-month count under a 30-day header is the D3 defect.`,
    )
  }
  if (!live || !/live/i.test(live) || live.includes('2026-06-24') || live.includes(facts.period.label)) {
    problems.push(
      `${DOC_MODULE}: months of supply / active listings must be labeled as a LIVE snapshot with ` +
        `its refresh time, never with the chosen period (got "${live}"). Terrebonne shipped ` +
        `"21 months of supply" inside a 6.8-month window.`,
    )
  }
  if (headingFor('Active Listings') !== live) {
    problems.push(`${DOC_MODULE}: active listings and months of supply must share the live block.`)
  }
  // A missing figure is reported as unavailable, never as a zero.
  const blank = doc.buildSections({ ...facts, monthsOfSupply: null, activeCount: null }, null)
  if (blank.flatMap((s) => s.rows.map(([, v]) => v)).includes(0)) {
    problems.push(`${DOC_MODULE}: a missing figure rendered as 0 instead of "${doc.NA}".`)
  }
}

// ──────────────────────────────────────────────────────────────────────────
// 3. THE ROUTE IS STILL WIRED TO THEM (AST — a comment must not satisfy this).
// ──────────────────────────────────────────────────────────────────────────
function parse(rel) {
  const abs = join(ROOT, rel)
  if (!existsSync(abs)) {
    problems.push(`${rel} not found — ci:report-export-geo cannot verify the export contract.`)
    return null
  }
  const src = readFileSync(abs, 'utf8')
  return { src, sf: ts.createSourceFile(rel, src, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX) }
}

const route = parse(ROUTE)
if (route) {
  let callsResolver = false
  let refusesUnresolved = false
  let buildSectionsCalls = 0
  const subdivisionGeoLines = []

  const line = (n) => route.sf.getLineAndCharacterOfPosition(n.getStart(route.sf)).line + 1
  const visit = (n) => {
    if (ts.isCallExpression(n) && ts.isIdentifier(n.expression)) {
      if (n.expression.text === 'resolveReportCommunity') callsResolver = true
      if (n.expression.text === 'buildSections') buildSectionsCalls++
    }
    // A `geoType: 'subdivision'` anywhere in this route means the export is back
    // on the literal-name row the community page does not use.
    if (
      ts.isPropertyAssignment(n) &&
      ts.isIdentifier(n.name) &&
      n.name.text === 'geoType' &&
      ts.isStringLiteral(n.initializer) &&
      n.initializer.text === 'subdivision'
    ) {
      subdivisionGeoLines.push(line(n))
    }
    // The refusal branch: `if (requestedCommunity && !community) return 400`.
    if (ts.isIfStatement(n) && /!\s*community/.test(n.expression.getText(route.sf))) {
      if (/status:\s*400/.test(n.thenStatement.getText(route.sf))) refusesUnresolved = true
    }
    ts.forEachChild(n, visit)
  }
  visit(route.sf)

  if (!callsResolver) {
    problems.push(
      `${ROUTE}: does not call resolveReportCommunity(). A caller-supplied community must be ` +
        `city-qualified against the registry before it reaches the cache.`,
    )
  }
  if (!refusesUnresolved) {
    problems.push(
      `${ROUTE}: no 400 branch on an unresolved community. Falling through to a city-wide report ` +
        `would silently answer a different question than the caller asked.`,
    )
  }
  for (const l of subdivisionGeoLines) {
    problems.push(
      `${ROUTE}:${l} builds a geo with geoType: 'subdivision'. That is literal-SubdivisionName ` +
        `equality; /communities/<slug> reads geo_type='neighborhood' (alias-aware), and the two ` +
        `publish different numbers for the same community over the same window.`,
    )
  }
  if (buildSectionsCalls < 2) {
    problems.push(
      `${ROUTE}: buildSections() is called ${buildSectionsCalls}x — both the PDF and the XLSX must ` +
        `render from the one builder, or the two formats of one document can label figures differently.`,
    )
  }
}

// The PDF contract: no flat metrics bag can come back.
const pdf = parse(PDF)
if (pdf) {
  const visit = (n) => {
    if (ts.isTypeAliasDeclaration(n) && n.name.text === 'ReportPdfData' && ts.isTypeLiteralNode(n.type)) {
      for (const m of n.type.members) {
        if (m.name && ts.isIdentifier(m.name) && m.name.text === 'metrics') {
          problems.push(
            `${PDF}: ReportPdfData.metrics is back. A flat key/value bag has no room to say which ` +
              `window each figure was measured over — use ReportSection[].`,
          )
        }
      }
    }
    ts.forEachChild(n, visit)
  }
  visit(pdf.sf)
}

console.log('Exported market-document contract (ci:report-export-geo)')
console.log('=======================================================')
console.log(`  executed ${GEO_MODULE} + ${DOC_MODULE} against live-defect fixtures`)
if (problems.length) {
  for (const p of problems) console.error(`  ✗ ${p}`)
  console.error(`\n\x1b[31m✗ ci:report-export-geo: ${problems.length} problem(s).\x1b[0m`)
  process.exit(1)
}
console.log('✓ Communities export only under their registry city, from the page\'s own cache row,')
console.log('  with every figure inside a block that names its window.')
process.exit(0)
