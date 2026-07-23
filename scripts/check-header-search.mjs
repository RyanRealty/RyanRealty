#!/usr/bin/env node
/**
 * check-header-search.mjs — ci:header-search (W4.1).
 *
 * "Global header search on every page" only holds if BOTH top-level site chromes
 * carry it. The KB-nav chrome (components/site/kb/KbNav.client.tsx) always did;
 * the DEFAULT chrome (components/site/SiteHeader.tsx) did not, so /dashboard,
 * /account, the auth pages, /feed, and the legal pages had no search anywhere in
 * their header. This gate keeps both chromes wired to the ONE shared suggestions
 * engine (components/search/SearchSuggest) so neither can silently lose search.
 *
 * Asserts:
 *   1. SiteHeader.tsx renders <SiteHeaderSearch/> (the default chrome has search).
 *   2. SiteHeaderSearch.client.tsx imports the shared engine from
 *      @/components/search/SearchSuggest (uses the ONE engine, never a copy).
 *   3. KbNav.client.tsx imports the shared engine too.
 *
 * AST-based (docs: reference_code_inspecting_gates_use_ast) — parses with the
 * TypeScript compiler, never a regex over source.
 *
 * Exit: 0 = both chromes carry the shared search engine, 1 = a chrome lost it.
 */
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import ts from 'typescript'

const ENGINE = '@/components/search/SearchSuggest'
const SITE_HEADER = 'components/site/SiteHeader.tsx'
const SITE_HEADER_SEARCH = 'components/site/SiteHeaderSearch.client.tsx'
const KB_NAV = 'components/site/kb/KbNav.client.tsx'
const MOBILE_NAV = 'components/site/MobileNav.tsx'

const problems = []

function parse(rel) {
  const p = join(process.cwd(), rel)
  if (!existsSync(p)) {
    problems.push(`${rel}: file not found`)
    return null
  }
  return ts.createSourceFile(rel, readFileSync(p, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
}

/** Does the source value-import at least one binding from `moduleSpec`? */
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

/** Does the source render a JSX element named `tag` (self-closing or open)? */
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

// 1. SiteHeader renders <SiteHeaderSearch/>.
const header = parse(SITE_HEADER)
if (header && !rendersJsx(header, 'SiteHeaderSearch')) {
  problems.push(
    `${SITE_HEADER}: does not render <SiteHeaderSearch/> — the default chrome (dashboard, account, auth, feed, legal pages) would have NO header search. Render the shared search widget.`,
  )
}

// 2. SiteHeaderSearch uses the shared engine (not a copy).
const widget = parse(SITE_HEADER_SEARCH)
if (widget && !importsFrom(widget, ENGINE)) {
  problems.push(
    `${SITE_HEADER_SEARCH}: does not import the shared suggestions engine from ${ENGINE}. Header search must reuse the ONE engine (useSearchSuggest / SearchSuggestPanel), never a second copy.`,
  )
}

// 3. KbNav chrome uses the shared engine too.
const kb = parse(KB_NAV)
if (kb && !importsFrom(kb, ENGINE)) {
  problems.push(`${KB_NAV}: no longer imports the shared suggestions engine from ${ENGINE} — the KB chrome lost search.`)
}

/** Does the source render a JSX <form> carrying role="search"? */
function hasSearchForm(sf) {
  let found = false
  const attrsOf = (node) => (ts.isJsxSelfClosingElement(node) ? node.attributes : node.attributes)
  const isForm = (node) => {
    const tag = ts.isJsxSelfClosingElement(node) ? node.tagName : node.tagName
    return ts.isIdentifier(tag) && tag.text === 'form'
  }
  const visit = (node) => {
    if ((ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) && isForm(node)) {
      for (const attr of attrsOf(node).properties) {
        if (
          ts.isJsxAttribute(attr) &&
          ts.isIdentifier(attr.name) &&
          attr.name.text === 'role' &&
          attr.initializer &&
          ts.isStringLiteral(attr.initializer) &&
          attr.initializer.text === 'search'
        ) {
          found = true
        }
      }
    }
    ts.forEachChild(node, visit)
  }
  visit(sf)
  return found
}

// 4. The DEFAULT-chrome MOBILE nav carries a header search entry too (the
//    desktop widget is `hidden md:block`, so sub-md pages need their own).
const mobile = parse(MOBILE_NAV)
if (mobile && !hasSearchForm(mobile)) {
  problems.push(
    `${MOBILE_NAV}: no <form role="search"> — the default-chrome mobile header (dashboard, account, auth, feed, legal pages at sub-md) would have NO search. Add a mobile search entry.`,
  )
}

console.log('Global header-search gate (ci:header-search)')
console.log('============================================')
if (problems.length) {
  console.error('\nA site chrome is missing the shared header search:')
  for (const p of problems) console.error(`  ✗ ${p}`)
  console.error(`\n\x1b[31m✗ ci:header-search: ${problems.length} problem(s).\x1b[0m`)
  process.exit(1)
}
console.log('✓ Both site chromes (SiteHeader + KbNav) carry the shared search engine.')
process.exit(0)
