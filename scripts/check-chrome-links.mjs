#!/usr/bin/env node
/**
 * ci:chrome-links — every chrome href is a CLEAN, INDEXABLE path.
 *
 * WHY THIS EXISTS (visibility audit 2026-09-22, UXLIVE-4 / UXLIVE-8 / EXP-11)
 * The header "Homes" link, the mega-menu "All homes for sale", the mobile
 * dialog and the footer "Search homes" all pointed at /homes-for-sale?view=list,
 * and "Map search" at ?view=map. Both serve `noindex, follow` with a canonical
 * to /homes-for-sale, so the site's strongest link for its money query,
 * repeated on every page, landed on a URL Google is told not to index. The
 * same menus linked /luxury-homes-bend, which 308s (to a noindex query URL).
 * A chrome link is on every page of the site: it must be the destination
 * itself, not a variant and not a hop.
 *
 * WHAT IT ASSERTS, for every internal href the chrome renders:
 *   1. NO QUERY STRING. `?view=` is the founding case; any query on a chrome
 *      door is a filtered/variant URL. A mode of a page (list / split / map) is
 *      client state; a filter that deserves a chrome door gets a path preset
 *      (e.g. /homes-for-sale/bend/luxury). A `#fragment` is fine: it never
 *      reaches the server.
 *   2. NOT A next.config.ts REDIRECT SOURCE. Every unconditional redirects()
 *      rule is matched, `:param`, `:param*` and `:param(regex)` included.
 *   3. NOT A data/legacy-redirects.json SOURCE (middleware 301s those; the
 *      identity rows that map a path to itself are live pages and are skipped).
 *
 * WHAT "THE CHROME" IS
 *   - lib/site-nav.ts, EVALUATED (not grepped): KB_TOP_NAV (group hrefs and
 *     children: the bar and the mega-menus), KB_MENU_GROUPS (the mobile
 *     dialog), KB_FOOTER_COLUMNS (every footer column, clusters flattened with
 *     footerColumnLinks), LEGAL_LINKS, VALUATION_FORM. Evaluating the module
 *     means a computed href (a helper call, a spread constant) is checked too.
 *   - Literal internal hrefs typed into components/site/v3/V3Chrome.tsx and
 *     V3Footer.tsx (today only the wordmark's "/").
 *
 *   node scripts/check-chrome-links.mjs
 */
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import ts from 'typescript'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const NAV = 'lib/site-nav.ts'
const NEXT_CONFIG = 'next.config.ts'
const LEGACY = 'data/legacy-redirects.json'
const CHROME_FILES = ['components/site/v3/V3Chrome.tsx', 'components/site/v3/V3Footer.tsx']

/**
 * `source:` of every UNCONDITIONAL rule inside next.config.ts `redirects()`.
 * Rewrites are skipped (they keep the URL), and a rule with `has`/`missing`
 * only fires for a specific query or header, so it cannot hijack a clean path.
 */
export function redirectSourcesFromNextConfig(text) {
  const sf = ts.createSourceFile(NEXT_CONFIG, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS)
  const out = []
  const visitRules = (node) => {
    if (ts.isObjectLiteralExpression(node)) {
      let source = null
      let isRedirect = false
      let conditional = false
      for (const prop of node.properties) {
        if (!ts.isPropertyAssignment(prop)) continue
        const key = ts.isIdentifier(prop.name) || ts.isStringLiteral(prop.name) ? prop.name.text : null
        if (key === 'source' && (ts.isStringLiteral(prop.initializer) || ts.isNoSubstitutionTemplateLiteral(prop.initializer))) {
          source = prop.initializer.text
        }
        if (key === 'permanent' || key === 'statusCode') isRedirect = true
        if (key === 'has' || key === 'missing') conditional = true
      }
      if (source && isRedirect && !conditional) out.push(source)
    }
    node.forEachChild(visitRules)
  }
  // Only descend into the redirects() method body, so a rewrite that happens
  // to carry a `permanent` key elsewhere can never be read as a redirect.
  const findRedirects = (node) => {
    if (
      (ts.isMethodDeclaration(node) || ts.isPropertyAssignment(node)) &&
      node.name &&
      ts.isIdentifier(node.name) &&
      node.name.text === 'redirects'
    ) {
      node.forEachChild(visitRules)
      return
    }
    node.forEachChild(findRedirects)
  }
  sf.forEachChild(findRedirects)
  return out
}

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/** A path-to-regexp style `source` as an anchored RegExp over a pathname. */
export function sourceToRegExp(source) {
  const segments = source.split('/').filter(Boolean)
  let pattern = '^'
  for (const seg of segments) {
    const param = /^:(\w+)(\((.*)\))?([*+?])?$/.exec(seg)
    if (!param) {
      pattern += `/${escapeRe(seg)}`
      continue
    }
    const inner = param[3] ?? '[^/]+'
    const mod = param[4]
    if (mod === '*') pattern += `(?:/${inner === '[^/]+' ? '.*' : inner})?`
    else if (mod === '+') pattern += `/${inner === '[^/]+' ? '.+' : inner}`
    else if (mod === '?') pattern += `(?:/${inner})?`
    else pattern += `/${inner}`
  }
  if (segments.length === 0) pattern += '/'
  return new RegExp(`${pattern}/?$`)
}

/** Legacy map keys that really redirect (identity rows are live pages). */
export function legacyRedirectSources(map) {
  const out = new Set()
  for (const [source, dest] of Object.entries(map ?? {})) {
    const s = String(source).replace(/\/$/, '').toLowerCase()
    const d = String(dest).replace(/\/$/, '').toLowerCase()
    if (s && s !== d) out.add(s)
  }
  return out
}

/** Split an internal href into path and query. Fragments never hit the server. */
function splitHref(href) {
  const noHash = href.split('#')[0] ?? ''
  const q = noHash.indexOf('?')
  return q === -1 ? { path: noHash, query: '' } : { path: noHash.slice(0, q), query: noHash.slice(q + 1) }
}

/**
 * Every problem with a set of chrome hrefs. `links` is [{ href, where }].
 * Non-internal hrefs (tel:, mailto:, https://, protocol-relative) are out of
 * scope: they are not pages on this site.
 */
export function chromeHrefProblems(links, { redirectSources = [], legacySources = new Set() } = {}) {
  const compiled = redirectSources.map((source) => ({ source, re: sourceToRegExp(source) }))
  const problems = []
  for (const { href, where } of links) {
    if (typeof href !== 'string' || !href.startsWith('/') || href.startsWith('//')) continue
    const { path, query } = splitHref(href)
    if (query) {
      const view = /(^|&)view=/.test(query)
      problems.push(
        `${where}: "${href}" carries a query string${view ? ' (?view= is a noindex variant, UXLIVE-4)' : ''}. ` +
          'Link the clean path; a mode of a page is client state, a filter worth a door gets a path preset.',
      )
    }
    const hit = compiled.find(({ re }) => re.test(path))
    if (hit) {
      problems.push(
        `${where}: "${href}" is a next.config.ts redirect source ('${hit.source}'). Link its destination directly; keep the redirect for inbound links.`,
      )
    }
    const norm = path.replace(/\/$/, '').toLowerCase() || '/'
    if (legacySources.has(norm)) {
      problems.push(
        `${where}: "${href}" is a data/legacy-redirects.json source (middleware 301s it). Link its destination directly.`,
      )
    }
  }
  return problems
}

/** Literal internal hrefs typed into a chrome component's source. */
export function literalHrefs(text, where) {
  const out = []
  const re = /href(?:=\{?|:\s*)(['"`])(\/[^'"`$]*)\1/g
  let m
  while ((m = re.exec(text)) !== null) out.push({ href: m[2], where })
  return out
}

/** Evaluate lib/site-nav.ts (tsx, with the @/ alias) and collect every chrome href. */
async function loadNavLinks() {
  const { register: registerCjs } = await import('tsx/cjs/api')
  const { register: registerEsm } = await import('tsx/esm/api')
  registerCjs()
  registerEsm()
  const mod = await import(pathToFileURL(join(ROOT, NAV)).href)
  const nav = mod.KB_TOP_NAV ? mod : mod.default
  const links = []
  for (const g of nav.KB_TOP_NAV ?? []) {
    links.push({ href: g.href, where: `KB_TOP_NAV ${g.label}` })
    for (const c of g.children ?? []) links.push({ href: c.href, where: `KB_TOP_NAV ${g.label} > ${c.label}` })
  }
  for (const g of nav.KB_MENU_GROUPS ?? []) {
    for (const l of g.links ?? []) links.push({ href: l.href, where: `KB_MENU_GROUPS ${g.title} > ${l.label}` })
  }
  for (const col of nav.KB_FOOTER_COLUMNS ?? []) {
    for (const l of nav.footerColumnLinks(col)) links.push({ href: l.href, where: `KB_FOOTER_COLUMNS ${col.heading} > ${l.label}` })
  }
  for (const l of nav.LEGAL_LINKS ?? []) links.push({ href: l.href, where: `LEGAL_LINKS > ${l.label}` })
  if (nav.VALUATION_FORM) links.push({ href: nav.VALUATION_FORM.href, where: 'VALUATION_FORM' })
  return links
}

async function main() {
  const navLinks = await loadNavLinks()
  // A projection that silently evaluated to nothing would pass every rule.
  if (navLinks.length < 20) {
    console.error(`✗ chrome-links: only ${navLinks.length} hrefs read from ${NAV}; the projections did not load.`)
    process.exit(1)
  }
  const literal = CHROME_FILES.filter((f) => existsSync(join(ROOT, f))).flatMap((f) =>
    literalHrefs(readFileSync(join(ROOT, f), 'utf8'), f),
  )
  const redirectSources = redirectSourcesFromNextConfig(readFileSync(join(ROOT, NEXT_CONFIG), 'utf8'))
  if (redirectSources.length < 10) {
    console.error(`✗ chrome-links: only ${redirectSources.length} redirect sources parsed from ${NEXT_CONFIG}; the parser is broken.`)
    process.exit(1)
  }
  const legacySources = legacyRedirectSources(JSON.parse(readFileSync(join(ROOT, LEGACY), 'utf8')))
  const links = [...navLinks, ...literal]
  const problems = chromeHrefProblems(links, { redirectSources, legacySources })
  if (problems.length > 0) {
    console.error(`✗ chrome-links: ${problems.length} chrome href(s) are not clean, indexable paths:`)
    for (const p of problems) console.error(`  - ${p}`)
    console.error('\nSee scripts/check-chrome-links.mjs (UXLIVE-4 / UXLIVE-8, visibility audit 2026-09-22).')
    process.exit(1)
  }
  const unique = new Set(links.map((l) => l.href)).size
  console.log(
    `✓ chrome-links: ${links.length} chrome hrefs (${unique} unique) are clean paths — no query, ` +
      `none of ${redirectSources.length} next.config redirect sources, none of ${legacySources.size} legacy redirects.`,
  )
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch((err) => {
    console.error(`✗ chrome-links: ${err?.stack ?? err}`)
    process.exit(1)
  })
}
