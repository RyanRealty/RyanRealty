#!/usr/bin/env node
/**
 * check-header-search.mjs — ci:header-search (W4.1 + 2026-08-10 dual-chrome kill).
 *
 * Public chrome is a single surface: PublicNav → KbNav, which must carry the
 * shared SearchSuggest engine. SiteHeader is no longer mounted in app/layout
 * (account/dashboard use their own shells).
 *
 * Asserts:
 *   1. app/layout.tsx mounts <PublicNav /> (or <KbNav />).
 *   2. KbNav.client.tsx imports the shared engine from SearchSuggest.
 *   3. If SiteHeader.tsx still exists and is imported by a live layout, it must
 *      still render SiteHeaderSearch (defensive — currently not in root layout).
 *
 * Exit: 0 = public chrome has search, 1 = search was lost.
 */
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import ts from 'typescript'

const ENGINE = '@/components/search/SearchSuggest'
const LAYOUT = 'app/layout.tsx'
const PUBLIC_NAV = 'components/site/PublicNav.client.tsx'
const KB_NAV = 'components/site/kb/KbNav.client.tsx'
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
if (layout && !rendersJsx(layout, 'PublicNav') && !rendersJsx(layout, 'KbNav')) {
  problems.push(
    `${LAYOUT}: does not mount <PublicNav /> (or <KbNav />) — public pages would have no header search.`,
  )
}

const publicNav = parse(PUBLIC_NAV)
if (publicNav && !importsFrom(publicNav, '@/components/site/kb/KbNav.client') && !rendersJsx(publicNav, 'KbNav')) {
  // PublicNav may import KbNav as named export — check import path loosely via source text
  const src = readFileSync(join(process.cwd(), PUBLIC_NAV), 'utf8')
  if (!src.includes('KbNav')) {
    problems.push(`${PUBLIC_NAV}: does not render KbNav — public header lost.`)
  }
}

const kb = parse(KB_NAV)
if (kb && !importsFrom(kb, ENGINE)) {
  problems.push(
    `${KB_NAV}: no longer imports the shared suggestions engine from ${ENGINE} — public chrome lost search.`,
  )
}

// Defensive: if SiteHeader is still mounted from any app layout, it must keep search.
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
console.log('✓ Public chrome (PublicNav → KbNav) carries the shared search engine.')
process.exit(0)
