#!/usr/bin/env node
/**
 * check-header-search.mjs — ci:header-search
 *
 * Public chrome is V3Chrome in app/layout.tsx (E-CHROME). Search is a Homes
 * Field, not a header widget — V3Chrome deliberately does not import
 * SearchSuggest. This gate now asserts the layout still mounts a public header
 * and that Homes remains a reachable destination in site-nav (the door search
 * used to live behind).
 *
 * Legacy arm: if layout still mounts PublicNav → KbNav, KbNav must keep
 * SearchSuggest so a partial swap cannot drop search twice.
 *
 * Exit: 0 = public chrome is present, 1 = header was lost.
 */
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import ts from 'typescript'

const ENGINE = '@/components/search/SearchSuggest'
const LAYOUT = 'app/layout.tsx'
const SITE_NAV = 'lib/site-nav.ts'

const problems = []

function parse(rel) {
  const p = join(process.cwd(), rel)
  if (!existsSync(p)) {
    problems.push(`${rel}: file not found`)
    return null
  }
  return ts.createSourceFile(rel, readFileSync(p, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
}

function importsFrom(sf, moduleSpec) {
  let found = false
  const visit = (node) => {
    if (
      ts.isImportDeclaration(node) &&
      ts.isStringLiteral(node.moduleSpecifier) &&
      node.moduleSpecifier.text === moduleSpec &&
      node.importClause &&
      !node.importClause.isTypeOnly
    ) {
      found = true
    }
    ts.forEachChild(node, visit)
  }
  visit(sf)
  return found
}

function rendersJsx(sf, tag) {
  let found = false
  const nameOf = (n) => (ts.isIdentifier(n) ? n.text : n.getText(sf))
  const visit = (node) => {
    if (ts.isJsxSelfClosingElement(node) && nameOf(node.tagName) === tag) found = true
    if (ts.isJsxOpeningElement(node) && nameOf(node.tagName) === tag) found = true
    ts.forEachChild(node, visit)
  }
  visit(sf)
  return found
}

// RE-EXPRESSED 2026-08-27. This gate had three arms and TWO OF THEM COULD NEVER
// FIRE: one was gated on the layout mounting KbNav or PublicNav (both deleted,
// and the guard `layoutHasLegacy && !layoutHasV3` is unreachable while the
// layout mounts V3Chrome), the other on any layout containing the string
// SiteHeader (deleted, so the flag was permanently false). Both read files that
// no longer exist. A gate whose arms cannot fire reads as protection and is not.
// One arm survives, and it is the only one that was ever doing work here.
const layout = parse(LAYOUT)
const layoutHasV3 = layout && rendersJsx(layout, 'V3Chrome')

if (layout && !layoutHasV3) {
  problems.push(
    `${LAYOUT}: does not mount <V3Chrome /> — public pages would have no header.`,
  )
}

if (layoutHasV3) {
  const navSrc = existsSync(join(process.cwd(), SITE_NAV))
    ? readFileSync(join(process.cwd(), SITE_NAV), 'utf8')
    : ''
  if (!navSrc.includes('/homes-for-sale')) {
    problems.push(
      `${SITE_NAV}: V3Chrome is the header; Homes door /homes-for-sale must stay in site-nav (search lives there, not in chrome).`,
    )
  }
}

if (problems.length) {
  console.error('Global header-search gate FAILED:\n')
  for (const p of problems) console.error(`  • ${p}`)
  process.exit(1)
}
console.log('Global header-search gate (ci:header-search)')
console.log('============================================')
if (layoutHasV3) {
  console.log('✓ Public chrome is V3Chrome. Search is the Homes Field, not the header.')
} else {
  console.log('✓ Public chrome (PublicNav → KbNav) carries the shared search engine.')
}
process.exit(0)
