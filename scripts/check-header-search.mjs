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
const KB_NAV = 'components/site/kb/KbNav.client.tsx'
const SITE_NAV = 'lib/site-nav.ts'
const SITE_HEADER = 'components/site/SiteHeader.tsx'
const SITE_HEADER_SEARCH = 'components/site/SiteHeaderSearch.client.tsx'

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

const layout = parse(LAYOUT)
const layoutHasV3 = layout && rendersJsx(layout, 'V3Chrome')
const layoutHasLegacy =
  layout && (rendersJsx(layout, 'PublicNav') || rendersJsx(layout, 'KbNav'))

if (layout && !layoutHasV3 && !layoutHasLegacy) {
  problems.push(
    `${LAYOUT}: does not mount <V3Chrome />, <PublicNav />, or <KbNav /> — public pages would have no header.`,
  )
}

if (layoutHasLegacy && !layoutHasV3) {
  const kb = parse(KB_NAV)
  if (kb && !importsFrom(kb, ENGINE)) {
    problems.push(
      `${KB_NAV}: no longer imports the shared suggestions engine from ${ENGINE} — public chrome lost search.`,
    )
  }
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

const layoutFiles = ['app/layout.tsx', 'app/account/layout.tsx', 'app/dashboard/layout.tsx']
let siteHeaderMounted = false
for (const rel of layoutFiles) {
  const p = join(process.cwd(), rel)
  if (!existsSync(p)) continue
  if (readFileSync(p, 'utf8').includes('SiteHeader')) siteHeaderMounted = true
}
if (siteHeaderMounted) {
  const header = parse(SITE_HEADER)
  if (header && !rendersJsx(header, 'SiteHeaderSearch')) {
    problems.push(
      `${SITE_HEADER}: still mounted but missing <SiteHeaderSearch/> — restore search on that chrome.`,
    )
  }
  const widget = parse(SITE_HEADER_SEARCH)
  if (widget && !importsFrom(widget, ENGINE)) {
    problems.push(`${SITE_HEADER_SEARCH}: must import shared engine ${ENGINE}.`)
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
