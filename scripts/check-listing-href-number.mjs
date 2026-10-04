#!/usr/bin/env node
/**
 * check-listing-href-number.mjs — ci:listing-href-number
 *
 * A listing link built field by field must carry the MLS number.
 *
 * WHY (2026-10-04). listingTileHref falls back to the RETS ListingKey when it
 * gets no listNumber, and the listing canonicalises to the MLS number, so that
 * link 308s. The live crawl found 14 of 400 internal links doing it, all from
 * the closings on /about (app/team/[slug]/_v3/sale-rows.ts built the href from
 * address fields and never passed ListNumber, though the row selected it).
 *
 * The rule is narrow on purpose: a call that passes a whole tile
 * (`listingTileHref(tile)`) inherits the tile's listNumber; a call that spells
 * out an object literal (`listingTileHref({ ... })`) must name `listNumber`
 * (or spread a row with `...`). Tests are exempt, and so is a call carrying
 * `// listing-href-number-ok: <reason>` on its line or the one above, for the
 * caller that genuinely holds only a key.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

const ROOT = new URL('..', import.meta.url).pathname
const ROOTS = ['app', 'lib', 'components']
const SKIP = new Set(['node_modules', '.next', '__tests__'])

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (SKIP.has(name)) continue
    const full = join(dir, name)
    if (statSync(full).isDirectory()) walk(full, out)
    else if (/\.(ts|tsx)$/.test(name) && !/\.test\.|\.spec\./.test(name)) out.push(full)
  }
  return out
}

/** Object-literal arguments of listingTileHref({...}) in `src`, with line numbers. Exported for tests. */
export function literalCalls(src) {
  const calls = []
  const re = /listingTileHref\(\s*\{/g
  let m
  while ((m = re.exec(src))) {
    let depth = 1
    let j = m.index + m[0].length
    while (depth > 0 && j < src.length) {
      if (src[j] === '{') depth += 1
      else if (src[j] === '}') depth -= 1
      j += 1
    }
    const lines = src.slice(0, m.index).split('\n')
    const here = (lines[lines.length - 1] ?? '') + src.slice(m.index, src.indexOf('\n', m.index))
    const above = lines[lines.length - 2] ?? ''
    const pragma = /listing-href-number-ok:\s*\S/.test(here) || /listing-href-number-ok:\s*\S/.test(above)
    calls.push({ line: lines.length, body: src.slice(m.index + m[0].length, j - 1), pragma })
  }
  return calls
}

export function violations(src) {
  return literalCalls(src).filter((c) => !c.pragma && !/\blistNumber\b/.test(c.body) && !/\.\.\./.test(c.body))
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const bad = []
  for (const root of ROOTS) {
    for (const file of walk(join(ROOT, root))) {
      for (const v of violations(readFileSync(file, 'utf8'))) bad.push(`${relative(ROOT, file)}:${v.line}`)
    }
  }
  if (bad.length > 0) {
    console.error('✗ listing-href-number: listingTileHref({ ... }) without listNumber, so the link falls back to the')
    console.error('  RETS key and 308s to the canonical. Pass the row\'s ListNumber / listNumber:')
    for (const b of bad) console.error(`  - ${b}`)
    process.exit(1)
  }
  console.log('✓ listing-href-number: every hand-built listing link carries the MLS number')
}
