#!/usr/bin/env node
// scripts/check-listings-select-columns.mjs
//
// G-listings-columns — every column a supabase-js read names on `listings`
// must be a column `listings` has.
//
// THE BUG CLASS. PostgREST answers a select or filter that names a missing
// column with an error ("column listings.original_list_price does not exist"),
// and a reader that drops the error renders the absence as "nothing here". On
// 2026-09-21 lib/data/listings/attachListingCardExtras.ts selected
// original_list_price (the column is "OriginalListPrice"): every call failed
// for nine days and every listing card went without its extra photos, tour,
// listing office and, on search cards, its price-drop badge, with nothing in
// any log. The same audit found three more reads in lib/data/sync/syncWrites.ts
// naming id, standard_status, list_price and listing_key, none of which
// `listings` has. The quoting gate (G17, check-dal-column-quoting.mjs) only
// catches literal quote characters; a wrong NAME passed it.
//
// THE GATE. The TypeScript AST of every .ts/.tsx under lib/ and app/ (tests
// excluded). For each call chain that starts at `.from('listings')`, every
// string-literal column argument of a chained method (select, eq, neq, gt,
// gte, lt, lte, like, ilike, is, in, contains, containedBy, order, not,
// filter, or) is parsed down to its base column (alias, cast and JSON path
// stripped; embedded resources, `*` and count() skipped) and checked against
// the `listings` section of docs/DATABASE_SCHEMA_SNAPSHOT.md, which G16
// regenerates from the live table. The paging helper's form,
// fetchAllRows(client, 'listings', '<columns>', ...), is checked the same way.
// A column argument that is not a string literal is skipped: the gate reads
// what the code states.
//
// Run: npm run ci:listings-select-columns

import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'
import ts from 'typescript'

const ROOT = resolve('.')
const SNAPSHOT = join(ROOT, 'docs/DATABASE_SCHEMA_SNAPSHOT.md')
const BASELINE = join(ROOT, 'scripts/listings-select-columns-baseline.json')
const SCAN_DIRS = ['lib', 'app']
const TABLE = 'listings'

const COLUMN_METHODS = new Set([
  'select', 'eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'like', 'ilike', 'is', 'in',
  'contains', 'containedBy', 'order', 'not', 'filter', 'or',
])

/** The `listings` columns, from the snapshot section G16 writes. */
export function listingsColumns(md) {
  const lines = md.split('\n')
  const start = lines.findIndex((l) => l.startsWith('### `listings`'))
  if (start < 0) throw new Error('no `listings` section in the schema snapshot')
  const cols = new Set()
  for (let i = start + 1; i < lines.length && !lines[i].startsWith('### '); i += 1) {
    const m = /^\| `"?([A-Za-z_][A-Za-z0-9_]*)"?` \|/.exec(lines[i])
    if (m) cols.add(m[1])
  }
  if (cols.size === 0) throw new Error('the `listings` section of the schema snapshot lists no columns')
  return cols
}

/** Split on commas outside parentheses. */
function splitTop(s) {
  const out = []
  let depth = 0
  let cur = ''
  for (const ch of s) {
    if (ch === '(') depth += 1
    if (ch === ')') depth -= 1
    if (ch === ',' && depth === 0) {
      out.push(cur)
      cur = ''
    } else cur += ch
  }
  out.push(cur)
  return out.map((x) => x.trim()).filter(Boolean)
}

/** Base column of one select item, or null when the item names no column of this table. */
export function selectItemColumn(item) {
  let s = item.trim()
  if (!s || s === '*' || s.includes('(')) return null // embedded resource or count()
  const colon = /^[A-Za-z_][A-Za-z0-9_]*:(?!:)/.exec(s)
  if (colon) s = s.slice(colon[0].length) // alias:
  s = s.split('::')[0] // ::cast
  s = s.split('->')[0] // JSON path
  s = s.trim()
  if (s.startsWith('"') && s.endsWith('"')) return null // G17 owns literal quotes
  return /^[A-Za-z_][A-Za-z0-9_]*$/.test(s) ? s : null
}

/** Base columns of an .or() filter string ("a.eq.1,b.gt.2", nested and()/or() too). */
export function orFilterColumns(s) {
  const out = []
  for (const part of splitTop(s)) {
    const nested = /^(?:not\.)?(?:and|or)\((.*)\)$/.exec(part)
    if (nested) {
      out.push(...orFilterColumns(nested[1]))
      continue
    }
    const m = /^([A-Za-z_][A-Za-z0-9_]*)(?:->>?[^.]*)*\./.exec(part)
    if (m) out.push(m[1])
  }
  return out
}

/** Base column of a filter method's first argument. */
function filterArgColumn(s) {
  const base = s.split('->')[0].trim()
  if (base.startsWith('"')) return null
  return /^[A-Za-z_][A-Za-z0-9_]*$/.test(base) ? base : null
}

function stringArg(node) {
  if (!node) return null
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return node.text
  return null
}

/** Every listings column reference one source file makes, with its line. */
export function scanSource(src, fileName = 'x.ts') {
  const sf = ts.createSourceFile(fileName, src, ts.ScriptTarget.Latest, true, fileName.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS)
  const refs = []
  const add = (node, column, method) => {
    const { line } = sf.getLineAndCharacterOfPosition(node.getStart(sf))
    refs.push({ line: line + 1, column, method })
  }
  const visit = (node) => {
    if (ts.isCallExpression(node)) {
      const callee = node.expression
      // .from('listings') ... the chain above it
      if (ts.isPropertyAccessExpression(callee) && callee.name.text === 'from' && stringArg(node.arguments[0]) === TABLE) {
        let cur = node
        while (cur.parent && ts.isPropertyAccessExpression(cur.parent) && cur.parent.parent && ts.isCallExpression(cur.parent.parent) && cur.parent.parent.expression === cur.parent) {
          const method = cur.parent.name.text
          const call = cur.parent.parent
          const at = cur.parent.name // the method's own line, not the chain's first
          const arg = stringArg(call.arguments[0])
          if (COLUMN_METHODS.has(method) && arg != null) {
            if (method === 'select') for (const item of splitTop(arg)) {
              const c = selectItemColumn(item)
              if (c) add(at, c, method)
            }
            else if (method === 'or') for (const c of orFilterColumns(arg)) add(at, c, method)
            else {
              const c = filterArgColumn(arg)
              if (c) add(at, c, method)
            }
          }
          cur = call
        }
      }
      // fetchAllRows(client, 'listings', '<columns>', ...)
      const name = ts.isIdentifier(callee) ? callee.text : ts.isPropertyAccessExpression(callee) ? callee.name.text : ''
      if (/^fetchAll(Rows)?$/.test(name) && stringArg(node.arguments[1]) === TABLE) {
        const cols = stringArg(node.arguments[2])
        if (cols != null) for (const item of splitTop(cols)) {
          const c = selectItemColumn(item)
          if (c) add(node, c, 'select')
        }
      }
    }
    ts.forEachChild(node, visit)
  }
  visit(sf)
  return refs
}

function walk(dir) {
  const out = []
  for (const entry of readdirSync(dir)) {
    if (entry.startsWith('.') || entry === 'node_modules' || entry === '__tests__') continue
    const full = join(dir, entry)
    const s = statSync(full)
    if (s.isDirectory()) out.push(...walk(full))
    else if (/\.(ts|tsx|mts)$/.test(entry) && !entry.endsWith('.d.ts') && !/\.test\.tsx?$/.test(entry)) out.push(full)
  }
  return out
}

function main() {
  const columns = listingsColumns(readFileSync(SNAPSHOT, 'utf8'))
  const baseline = JSON.parse(readFileSync(BASELINE, 'utf8')).entries ?? {}
  const files = SCAN_DIRS.flatMap((d) => walk(join(ROOT, d)))
  const bad = []
  const held = new Set()
  let checked = 0
  for (const f of files) {
    const src = readFileSync(f, 'utf8')
    if (!src.includes(`'${TABLE}'`) && !src.includes(`"${TABLE}"`)) continue
    for (const r of scanSource(src, f)) {
      checked += 1
      if (columns.has(r.column)) continue
      const key = `${relative(ROOT, f)}|${r.method}|${r.column}`
      if (key in baseline) held.add(key)
      else bad.push({ file: relative(ROOT, f), ...r })
    }
  }
  const stale = Object.keys(baseline).filter((k) => !held.has(k))
  console.log('listings column names (G-listings-columns)')
  console.log(`${columns.size} columns in the snapshot · ${checked} column references checked across ${files.length} files · ${held.size} held in the baseline`)
  if (bad.length === 0 && stale.length === 0) {
    console.log('OK: every column a read names on listings exists, or is held in the baseline with its reason.')
    return 0
  }
  if (bad.length > 0) {
    console.error(`FAIL: ${bad.length} reference(s) to a column listings does not have:`)
    for (const b of bad) console.error(`  ${b.file}:${b.line}  .${b.method}(… ${b.column} …)`)
    console.error('')
    console.error('PostgREST answers these with an error, and a reader that drops it shows nothing. Use the column as')
    console.error('docs/DATABASE_SCHEMA_SNAPSHOT.md names it (mixed case passed bare: OriginalListPrice, ListingKey).')
  }
  if (stale.length > 0) {
    console.error(`FAIL: ${stale.length} baseline entr${stale.length === 1 ? 'y no longer matches' : 'ies no longer match'}; the baseline only shrinks, so delete:`)
    for (const k of stale) console.error(`  ${k}`)
  }
  return 1
}

if (import.meta.url === `file://${process.argv[1]}`) process.exit(main())
