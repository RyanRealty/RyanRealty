#!/usr/bin/env node
/**
 * generate-class-prevalence.mjs — per-class prevalence census for every
 * registry multi/boolean search field (plan §5, 2026-07-30).
 *
 * For each field in lib/search/field-registry.ts with kind 'multi' or
 * 'boolean', counts live listings per option value (multi) or per satisfied
 * predicate (boolean), bucketed by MLS property class (listing_search_mv
 * .property_type A/B/C/D; classes E-H and null roll up into "other").
 * Boolean counts mirror the DAL's BOOLEAN_PREDICATES exactly (isTrue /
 * notTrue / eqValue / containsAll / overlapsAny / orExpr / hasView), so the
 * census counts what the filter would actually match, not just a *_yn column.
 * Zoning (text) gets its distinct observed values, capped at the top 200 by
 * total count, so find-a-filter can resolve typed codes like "MUA10".
 *
 * Data path: ONE paged read of just the needed columns over the full MV
 * (~9.7K rows, 1000-row PostgREST pages, anon key from .env.local),
 * aggregated in-process. Read-only; no writes.
 *
 * Output: data/search-metadata/class-prevalence.json — deterministic key
 * order (fields alphabetical; values by total desc, ties by value asc; class
 * counts as a fixed [A,B,C,D] tuple) plus a generatedAt stamp and per-class
 * row totals. Spark AppliesTo per value rides along as `hint` (from
 * data/search-metadata/spark-metadata.snapshot.json via registry-report.json)
 * — a HINT only, per plan §5: validity is decided by observed prevalence.
 *
 * Run: node scripts/generate-class-prevalence.mjs
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const ts = require('typescript')

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const OUT_PATH = path.join(ROOT, 'data/search-metadata/class-prevalence.json')
const CLASSES = ['A', 'B', 'C', 'D']
const PAGE_SIZE = 1000

// ── Load TS modules (registry + predicate tables) without a build step ──────
// Both files are dependency-light: field-registry.ts imports nothing;
// searchPredicates.ts imports only the registry. A tiny transpile-and-eval
// loader keeps this script's source of truth identical to the app's.

const tsModuleCache = new Map()
function loadTsModule(relPath) {
  const abs = path.join(ROOT, relPath)
  if (tsModuleCache.has(abs)) return tsModuleCache.get(abs)
  const src = fs.readFileSync(abs, 'utf8')
  const js = ts.transpileModule(src, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText
  const mod = { exports: {} }
  const shimRequire = (spec) => {
    if (spec === '@/lib/search/field-registry') return loadTsModule('lib/search/field-registry.ts')
    throw new Error(`Unexpected import '${spec}' in ${relPath} — extend the loader shim.`)
  }
  new Function('module', 'exports', 'require', js)(mod, mod.exports, shimRequire)
  tsModuleCache.set(abs, mod.exports)
  return mod.exports
}

const { SEARCH_FIELDS } = loadTsModule('lib/search/field-registry.ts')
const { BOOLEAN_PREDICATES } = loadTsModule('lib/data/listings/searchPredicates.ts')

// ── Env + fetch helpers ─────────────────────────────────────────────────────

function readEnvLocal() {
  const envPath = path.join(ROOT, '.env.local')
  const out = {}
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    if (!line || line.startsWith('#')) continue
    const i = line.indexOf('=')
    if (i > 0) out[line.slice(0, i).trim()] = line.slice(i + 1).trim()
  }
  return out
}

const env = readEnvLocal()
const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL
const ANON_KEY = env.NEXT_PUBLIC_SUPABASE_ANON_KEY
if (!SUPABASE_URL || !ANON_KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local')
  process.exit(1)
}

async function fetchPage(columns, offset) {
  const url = `${SUPABASE_URL}/rest/v1/listing_search_mv?select=${encodeURIComponent(columns.join(','))}&order=listing_key.asc&limit=${PAGE_SIZE}&offset=${offset}`
  const res = await fetch(url, {
    headers: { apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}` },
  })
  if (!res.ok) throw new Error(`PostgREST ${res.status} at offset ${offset}: ${await res.text()}`)
  return res.json()
}

// ── Predicate evaluation (mirrors applySearchFilters' boolean switch) ───────

function parseOrExpr(expr) {
  // Segments look like `col.cs.{"v1","v2"}` or `col.ov.{"v1"}`, comma-joined.
  const segments = []
  const re = /([a-z_]+)\.(cs|ov)\.\{([^}]*)\}/g
  let m
  while ((m = re.exec(expr)) !== null) {
    const values = [...m[3].matchAll(/"([^"]*)"/g)].map((v) => v[1])
    segments.push({ col: m[1], op: m[2], values })
  }
  if (segments.length === 0) throw new Error(`Unparseable orExpr: ${expr}`)
  return segments
}

function cellArray(v) {
  return Array.isArray(v) ? v : []
}

function evalPredicate(predicate, row) {
  switch (predicate.op) {
    case 'isTrue':
      return row[predicate.col] === true
    case 'notTrue':
      return row[predicate.col] !== true
    case 'eqValue':
      return row[predicate.col] === predicate.value
    case 'containsAll':
      return predicate.values.every((v) => cellArray(row[predicate.col]).includes(v))
    case 'overlapsAny':
      return predicate.values.some((v) => cellArray(row[predicate.col]).includes(v))
    case 'orExpr':
      return parseOrExpr(predicate.expr).some((seg) =>
        seg.op === 'cs'
          ? seg.values.every((v) => cellArray(row[seg.col]).includes(v))
          : seg.values.some((v) => cellArray(row[seg.col]).includes(v)),
      )
    case 'hasView': {
      const arr = cellArray(row.view_types)
      if (arr.length === 0) return false
      return !(arr.length === 1 && arr[0] === 'Neighborhood')
    }
    default:
      throw new Error(`Unknown predicate op ${predicate.op}`)
  }
}

// ── Spark AppliesTo hints (design-time metadata, hint only) ─────────────────

function loadHints() {
  const reportPath = path.join(ROOT, 'data/search-metadata/registry-report.json')
  const snapshotPath = path.join(ROOT, 'data/search-metadata/spark-metadata.snapshot.json')
  if (!fs.existsSync(reportPath) || !fs.existsSync(snapshotPath)) return { valueHint: () => null, fieldHint: () => null }
  const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'))
  const snapshot = JSON.parse(fs.readFileSync(snapshotPath, 'utf8'))
  const concepts = snapshot.concepts ?? {}
  const fields = report.fields ?? {}
  const conceptFor = (fieldKey) => {
    const sparkSource = fields[fieldKey]?.sparkSource
    return sparkSource ? (concepts[sparkSource] ?? null) : null
  }
  return {
    valueHint(fieldKey, value) {
      const hint = conceptFor(fieldKey)?.valueClassesHint?.[value]
      return Array.isArray(hint) && hint.length > 0 ? hint : null
    },
    fieldHint(fieldKey) {
      const classes = conceptFor(fieldKey)?.classes
      return Array.isArray(classes) && classes.length > 0 ? classes : null
    },
  }
}

// ── Census ──────────────────────────────────────────────────────────────────

async function main() {
  const multiDefs = SEARCH_FIELDS.filter((f) => f.kind === 'multi')
  const boolDefs = SEARCH_FIELDS.filter((f) => f.kind === 'boolean')

  const columns = new Set(['listing_key', 'property_type', 'zoning'])
  for (const def of multiDefs) columns.add(def.mv)
  for (const def of boolDefs) {
    const predicate = BOOLEAN_PREDICATES[def.key]
    if (!predicate) throw new Error(`No BOOLEAN_PREDICATES entry for '${def.key}'`)
    if (predicate.op === 'orExpr') for (const seg of parseOrExpr(predicate.expr)) columns.add(seg.col)
    else if (predicate.op === 'hasView') columns.add('view_types')
    else columns.add(predicate.col)
  }
  const columnList = [...columns].sort()

  const rowTotals = { A: 0, B: 0, C: 0, D: 0, other: 0, total: 0 }
  // fieldKey -> value -> { A,B,C,D,total }
  const tallies = new Map()
  const bump = (fieldKey, value, cls) => {
    let values = tallies.get(fieldKey)
    if (!values) tallies.set(fieldKey, (values = new Map()))
    let t = values.get(value)
    if (!t) values.set(value, (t = { A: 0, B: 0, C: 0, D: 0, total: 0 }))
    if (cls) t[cls] += 1
    t.total += 1
  }
  // Multi option membership per field for O(1) checks.
  const optionSets = new Map(multiDefs.map((def) => [def.key, new Set(def.options ?? [])]))

  let offset = 0
  let pages = 0
  for (;;) {
    const rows = await fetchPage(columnList, offset)
    pages += 1
    for (const row of rows) {
      const cls = CLASSES.includes(row.property_type) ? row.property_type : null
      rowTotals.total += 1
      if (cls) rowTotals[cls] += 1
      else rowTotals.other += 1

      for (const def of multiDefs) {
        const cell = row[def.mv]
        const observed = def.singleColumnIn
          ? typeof cell === 'string' && cell.trim() !== '' ? [cell.trim()] : []
          : cellArray(cell)
        const optionSet = optionSets.get(def.key)
        const seen = new Set()
        for (const raw of observed) {
          const value = typeof raw === 'string' ? raw.trim() : ''
          if (!value || !optionSet.has(value) || seen.has(value)) continue
          seen.add(value)
          bump(def.key, value, cls)
        }
      }
      for (const def of boolDefs) {
        if (evalPredicate(BOOLEAN_PREDICATES[def.key], row)) bump(def.key, 'true', cls)
      }
      const zone = typeof row.zoning === 'string' ? row.zoning.trim() : ''
      if (zone) bump('zoning', zone, cls)
    }
    if (rows.length < PAGE_SIZE) break
    offset += PAGE_SIZE
  }

  // Ensure every registry option appears, even at zero, so the loader can
  // distinguish "zero in this class" from "not in the vocabulary".
  for (const def of multiDefs) {
    for (const option of def.options ?? []) {
      if (!tallies.get(def.key)?.has(option)) bump0(def.key, option)
    }
  }
  for (const def of boolDefs) {
    if (!tallies.get(def.key)?.has('true')) bump0(def.key, 'true')
  }
  function bump0(fieldKey, value) {
    let values = tallies.get(fieldKey)
    if (!values) tallies.set(fieldKey, (values = new Map()))
    values.set(value, { A: 0, B: 0, C: 0, D: 0, total: 0 })
  }

  const hints = loadHints()

  // Zoning: cap to top 200 by total, ties by value asc.
  const zoningMap = tallies.get('zoning') ?? new Map()
  const zoningTop = [...zoningMap.entries()]
    .sort((a, b) => b[1].total - a[1].total || a[0].localeCompare(b[0]))
    .slice(0, 200)
  tallies.set('zoning', new Map(zoningTop))

  const fieldMeta = new Map(SEARCH_FIELDS.map((f) => [f.key, f]))
  fieldMeta.set('zoning', SEARCH_FIELDS.find((f) => f.key === 'zoning') ?? { key: 'zoning', kind: 'text', mv: 'zoning' })

  const fieldsOut = {}
  for (const fieldKey of [...tallies.keys()].sort()) {
    const def = fieldMeta.get(fieldKey)
    const values = tallies.get(fieldKey)
    const sorted = [...values.entries()].sort(
      (a, b) => b[1].total - a[1].total || a[0].localeCompare(b[0]),
    )
    const valuesOut = {}
    for (const [value, t] of sorted) {
      const hint =
        def.kind === 'boolean' ? hints.fieldHint(fieldKey) : hints.valueHint(fieldKey, value)
      valuesOut[value] = {
        counts: [t.A, t.B, t.C, t.D],
        total: t.total,
        ...(hint ? { hint } : {}),
      }
    }
    fieldsOut[fieldKey] = { kind: def.kind, mv: def.mv, values: valuesOut }
  }

  const artifact = {
    generatedAt: new Date().toISOString(),
    source: 'listing_search_mv, all on-market rows, anon read',
    generator: 'scripts/generate-class-prevalence.mjs',
    classOrder: CLASSES,
    thresholds: {
      note: 'shown when count >= min(SHOWN_MIN_SHARE * classRows, SHOWN_MIN_COUNT) — lib/search/class-prevalence.ts',
      shownMinShare: 0.005,
      shownMinCount: 25,
    },
    rowTotals,
    zoningValueCap: 200,
    fields: fieldsOut,
  }

  fs.writeFileSync(OUT_PATH, JSON.stringify(artifact, null, 1) + '\n')
  const fieldCount = Object.keys(fieldsOut).length
  const valueCount = Object.values(fieldsOut).reduce((n, f) => n + Object.keys(f.values).length, 0)
  console.log(
    `class-prevalence.json written: ${fieldCount} fields, ${valueCount} values, ` +
      `${pages} pages, rows A=${rowTotals.A} B=${rowTotals.B} C=${rowTotals.C} D=${rowTotals.D} other=${rowTotals.other} total=${rowTotals.total}`,
  )
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
