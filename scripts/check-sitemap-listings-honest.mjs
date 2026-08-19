#!/usr/bin/env node
/**
 * check-sitemap-listings-honest.mjs — ci:sitemap-listings-honest
 *
 * /sitemaps/listings.xml must be a first-class read of listing_tile_mv
 * (PUBLIC_ACTIVE_STATUSES, stable listing_key order). It must not be a
 * filter over buildAllUrls: that universe swallows errors into an empty
 * urlset and paged the MV without ORDER BY (7,586 rows / 5,827 unique
 * keys on 2026-08-19).
 *
 * Static AST/source pins — no DB. Exit 0 = wired, 1 = the listings class
 * can go empty or drop live inventory again.
 */
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import ts from 'typescript'

const problems = []

function src(rel) {
  const p = join(process.cwd(), rel)
  if (!existsSync(p)) {
    problems.push(`${rel}: file not found`)
    return ''
  }
  return readFileSync(p, 'utf8')
}

function callsFunction(rel, name) {
  const text = src(rel)
  if (!text) return false
  const sf = ts.createSourceFile(rel, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  let found = false
  const visit = (node) => {
    if (ts.isCallExpression(node)) {
      const callee = node.expression
      if (ts.isIdentifier(callee) && callee.text === name) found = true
      if (ts.isPropertyAccessExpression(callee) && callee.name.text === name) found = true
    }
    ts.forEachChild(node, visit)
  }
  visit(sf)
  return found
}

const classRows = src('lib/sitemap-class-rows.ts')
if (!/cls\s*===\s*['"]listings['"]/.test(classRows) || !/getListingSitemapRows/.test(classRows)) {
  problems.push(
    'lib/sitemap-class-rows.ts: getClassRows must serve listings from getListingSitemapRows, not buildAllUrls',
  )
}
const getClassRowsSrc = classRows.slice(classRows.indexOf('export const getClassRows'))
const listingsIdx = getClassRowsSrc.indexOf("cls === 'listings'")
const universeCallIdx = getClassRowsSrc.indexOf('await buildUniverseOnce')
if (listingsIdx < 0 || universeCallIdx < 0 || listingsIdx > universeCallIdx) {
  problems.push('lib/sitemap-class-rows.ts: listings class must return before await buildUniverseOnce()')
}

const dal = src('lib/data/sitemap/getListingSitemapRows.ts')
if (!dal.includes("from('listing_tile_mv')")) {
  problems.push('lib/data/sitemap/getListingSitemapRows.ts: must read listing_tile_mv')
}
if (!dal.includes('PUBLIC_ACTIVE_STATUSES')) {
  problems.push('lib/data/sitemap/getListingSitemapRows.ts: must filter PUBLIC_ACTIVE_STATUSES')
}
if (!/\.order\(\s*['"]listing_key['"]/.test(dal)) {
  problems.push('lib/data/sitemap/getListingSitemapRows.ts: must .order(listing_key) — unordered pages drop live keys')
}
if (!/throw new Error/.test(dal)) {
  problems.push('lib/data/sitemap/getListingSitemapRows.ts: must throw on a failed MV read (never empty-on-error)')
}

const sitemap = src('app/sitemap.ts')
if (/fetchAllRows\s*(?:<[^>]+>)?\s*\([\s\S]{0,200}['"]listing_tile_mv['"]/.test(sitemap)) {
  problems.push('app/sitemap.ts: must not page listing_tile_mv via fetchAllRows (no ORDER BY)')
}
if (!callsFunction('app/sitemap.ts', 'getListingSitemapRows')) {
  problems.push('app/sitemap.ts: listing URLs must come from getListingSitemapRows()')
}

const classify = src('lib/data/sitemap/classify.ts')
if (!/seg\[1\]\s*===\s*['"]listing['"]/.test(classify) && !/homes-for-sale\/listing/.test(classify)) {
  problems.push('lib/data/sitemap/classify.ts: /homes-for-sale/listing/{id} must classify as listings')
}

const route = src('app/sitemaps/[cls]/route.ts')
if (/catch\s*\([^)]*\)[\s\S]*urlset/.test(route)) {
  problems.push('app/sitemaps/[cls]/route.ts: must not catch and serve an empty urlset')
}

console.log('Sitemap listings honesty gate (ci:sitemap-listings-honest)')
console.log('=========================================================')
if (problems.length) {
  console.error('\nlistings.xml can go empty or drop live inventory:')
  for (const p of problems) console.error(`  ✗ ${p}`)
  console.error(`\n\x1b[31m✗ ci:sitemap-listings-honest: ${problems.length} problem(s).\x1b[0m`)
  process.exit(1)
}
console.log('✓ listings.xml is a first-class ordered listing_tile_mv read, independent of the universe build.')
process.exit(0)
