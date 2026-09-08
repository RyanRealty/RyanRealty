#!/usr/bin/env node
/**
 * check-city-route-guard.mjs (ci:city-route-guard) — a route that resolves its
 * city segment through getCityFromSlug must be scoped to Central Oregon.
 *
 * THE DEFECT THIS GATE EXISTS FOR
 * -------------------------------
 * `getCityFromSlug` (app/actions/listings.ts) resolves a URL slug against the
 * STATEWIDE feed: getBrowseCities first, then a geo_snapshot_mv fallback that
 * carries ~362 Oregon cities. Any route that hands it a `[city]` param
 * therefore serves every Oregon city, not the service area.
 *
 * Measured on ryan-realty.com 2026-09-08, before the fix that added this gate:
 *
 *   /open-houses/grants-pass    200, index,follow, self-canonical,
 *                               "Open Houses in Grants Pass, Oregon | Ryan
 *                               Realty — Central Oregon", five real listings
 *   /homes-for-sale/grants-pass 200, the identical hole
 *
 * Out-of-area slugs were 325 of that class's 633 Search Console impressions
 * (grants-pass 161, ashland 96, central-point 40, brookings 19, +4 more).
 * /cities/[slug] had been guarded since W12 and /price-drops/[city] pins
 * dynamicParams=false — the two families that were guarded were guarded by two
 * DIFFERENT mechanisms, which is exactly why the third and fourth were missed.
 *
 * THE PREDICATE — AST, never a grep
 * ---------------------------------
 * IN SCOPE: every `app/**\/page.tsx` that reaches `getCityFromSlug`. Reach is
 * computed symbol-by-symbol, not file-by-file: a module that imports
 * getCityFromSlug only exports "reaching" symbols whose declarations actually
 * touch it (directly, or through another local declaration in the same file).
 * That precision is load-bearing — app/actions/cities.ts imports
 * getCityFromSlug, but only getNeighborhoodBySlug reaches it, so app/page.tsx
 * (which imports getCitiesForIndex from the same module) is correctly OUT of
 * scope. The reverse walk iterates to a fixpoint across app/, lib/ and
 * components/.
 *
 * COVERED — either mechanism clears a route, never a hand-written exemption:
 *
 *   1. THE ALLOWLIST TEST, as a mechanism and not a mention. A file in the
 *      page's own route directory tree (or an `_`-prefixed helper directory on
 *      its ancestor chain) must IMPORT CENTRAL_OREGON_CITY_SLUGS or
 *      SITE_CITY_SLUGS from lib/central-oregon, USE that binding outside the
 *      import, and in the same file REJECT — notFound() / redirect() /
 *      permanentRedirect() — or the page must pin `dynamicParams = false` so
 *      the router itself 404s an unseeded slug (that is how /price-drops/[city]
 *      is guarded). A bare textual mention never counts: the first draft of
 *      this gate passed /open-houses/[city] on the words "SITE_CITY_SLUGS"
 *      inside a comment.
 *   2. A MIDDLEWARE RULE on the route's first PUBLIC path segment. Public,
 *      because /homes-for-sale is served by app/search/[...slug] through a
 *      next.config.ts rewrite — the gate reads the `rewrites()` table (and only
 *      that table, never `redirects()`) so the rule is looked up under the
 *      segment a visitor actually types.
 *
 * A middleware rule counts here (and deliberately does NOT count in
 * ci:streamed-redirect) because the guard IS the middleware rule: the whole
 * point is that app/loading.tsx makes a page-body notFound() ship HTTP 200, so
 * the edge is the only place a wrong-city URL can be turned away with a status.
 *
 * Usage: node scripts/check-city-route-guard.mjs [--report]
 */

import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs'
import { join, dirname, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')

/** The tree under audit. Swapped by the unit tests to point at a fixture. */
let ROOT = REPO_ROOT

const TARGET_SYMBOL = 'getCityFromSlug'
const TARGET_MODULE = 'app/actions/listings.ts'
const ALLOWLIST_IDENTIFIERS = ['CENTRAL_OREGON_CITY_SLUGS', 'SITE_CITY_SLUGS']
const SOURCE_ROOTS = ['app', 'lib', 'components']
const SOURCE_EXTS = ['.ts', '.tsx']

// ─── filesystem ─────────────────────────────────────────────────────────────

function walk(dir, out = []) {
  let entries
  try {
    entries = readdirSync(dir, { withFileTypes: true })
  } catch {
    return out
  }
  for (const entry of entries) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === '.next') continue
      walk(full, out)
    } else if (SOURCE_EXTS.some((ext) => entry.name.endsWith(ext))) {
      out.push(full)
    }
  }
  return out
}

function isFile(p) {
  try {
    return statSync(p).isFile()
  } catch {
    return false
  }
}

/** Resolve an import specifier to a repo-relative source file, or null. */
function resolveSpecifier(spec, fromFile) {
  let base
  if (spec.startsWith('@/')) base = join(ROOT, spec.slice(2))
  else if (spec.startsWith('.')) base = resolve(dirname(fromFile), spec)
  else return null
  for (const ext of SOURCE_EXTS) {
    if (isFile(base + ext)) return base + ext
  }
  for (const ext of SOURCE_EXTS) {
    const idx = join(base, `index${ext}`)
    if (isFile(idx)) return idx
  }
  if (isFile(base) && SOURCE_EXTS.some((e) => base.endsWith(e))) return base
  return null
}

function parse(file, text) {
  return ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
}

// ─── per-file symbol graph ──────────────────────────────────────────────────

/**
 * For one file: its import bindings, its top-level declaration names, and for
 * each declaration the set of identifiers its subtree references.
 */
function analyzeFile(file, text) {
  const sf = parse(file, text)
  /** localName -> { file, imported } */
  const imports = new Map()
  /** declName -> Set(identifier) referenced inside it */
  const declRefs = new Map()
  /** re-exports: `export { a } from './x'` and `export * from './x'` */
  const reExports = []

  for (const stmt of sf.statements) {
    if (ts.isImportDeclaration(stmt) && ts.isStringLiteral(stmt.moduleSpecifier)) {
      const target = resolveSpecifier(stmt.moduleSpecifier.text, file)
      if (!target || !stmt.importClause) continue
      const bindings = stmt.importClause.namedBindings
      if (bindings && ts.isNamedImports(bindings)) {
        for (const el of bindings.elements) {
          imports.set(el.name.text, {
            file: target,
            imported: (el.propertyName ?? el.name).text,
          })
        }
      }
      if (stmt.importClause.name) {
        imports.set(stmt.importClause.name.text, { file: target, imported: 'default' })
      }
      continue
    }
    if (ts.isExportDeclaration(stmt) && stmt.moduleSpecifier && ts.isStringLiteral(stmt.moduleSpecifier)) {
      const target = resolveSpecifier(stmt.moduleSpecifier.text, file)
      if (!target) continue
      if (stmt.exportClause && ts.isNamedExports(stmt.exportClause)) {
        for (const el of stmt.exportClause.elements) {
          reExports.push({ local: el.name.text, file: target, imported: (el.propertyName ?? el.name).text })
        }
      } else {
        reExports.push({ local: '*', file: target, imported: '*' })
      }
    }
  }

  const collect = (node) => {
    const refs = new Set()
    const visit = (n) => {
      if (ts.isIdentifier(n)) refs.add(n.text)
      ts.forEachChild(n, visit)
    }
    ts.forEachChild(node, visit)
    return refs
  }

  for (const stmt of sf.statements) {
    if (ts.isFunctionDeclaration(stmt) && stmt.name) {
      declRefs.set(stmt.name.text, collect(stmt))
    } else if (ts.isVariableStatement(stmt)) {
      for (const decl of stmt.declarationList.declarations) {
        if (ts.isIdentifier(decl.name)) declRefs.set(decl.name.text, collect(decl))
      }
    } else if (ts.isClassDeclaration(stmt) && stmt.name) {
      declRefs.set(stmt.name.text, collect(stmt))
    } else if (ts.isExportAssignment(stmt)) {
      declRefs.set('default', collect(stmt))
    }
  }
  // A default-exported function/class declaration answers to 'default' too.
  for (const stmt of sf.statements) {
    const mods = ts.canHaveModifiers(stmt) ? (ts.getModifiers(stmt) ?? []) : []
    const isDefault = mods.some((m) => m.kind === ts.SyntaxKind.DefaultKeyword)
    if (!isDefault) continue
    if (ts.isFunctionDeclaration(stmt) || ts.isClassDeclaration(stmt)) {
      declRefs.set('default', collect(stmt))
    }
  }

  // ── the allowlist test, as a mechanism ──────────────────────────────────
  // A binding is only an allowlist test when it is IMPORTED from
  // lib/central-oregon and USED outside its import clause. Comments and
  // same-named locals never qualify.
  const centralOregonPath = join(ROOT, 'lib', 'central-oregon.ts')
  const allowlistLocals = new Set()
  for (const [local, spec] of imports) {
    if (spec.file === centralOregonPath && ALLOWLIST_IDENTIFIERS.includes(spec.imported)) {
      allowlistLocals.add(local)
    }
  }
  let usesAllowlist = false
  let hasRejection = false
  let dynamicParamsFalse = false
  const scan = (node) => {
    if (ts.isImportDeclaration(node)) return
    if (ts.isIdentifier(node) && allowlistLocals.has(node.text)) usesAllowlist = true
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression)) {
      const fn = node.expression.text
      if (fn === 'notFound' || fn === 'redirect' || fn === 'permanentRedirect') hasRejection = true
    }
    ts.forEachChild(node, scan)
  }
  ts.forEachChild(sf, scan)
  for (const stmt of sf.statements) {
    if (!ts.isVariableStatement(stmt)) continue
    for (const decl of stmt.declarationList.declarations) {
      if (
        ts.isIdentifier(decl.name) &&
        decl.name.text === 'dynamicParams' &&
        decl.initializer?.kind === ts.SyntaxKind.FalseKeyword
      ) {
        dynamicParamsFalse = true
      }
    }
  }

  return { imports, declRefs, reExports, usesAllowlist, hasRejection, dynamicParamsFalse }
}

/**
 * Fixpoint: which (file, exportedName) pairs reach getCityFromSlug.
 * Returns Map<file, Set<exportedName>> plus the set of files that name-import
 * the symbol at all (used for the page-level scope test).
 */
function computeReaching(files, analyses) {
  /** file -> Set(symbol) */
  const reaching = new Map()
  const add = (file, name) => {
    let set = reaching.get(file)
    if (!set) reaching.set(file, (set = new Set()))
    if (set.has(name)) return false
    set.add(name)
    return true
  }
  add(join(ROOT, TARGET_MODULE), TARGET_SYMBOL)

  let changed = true
  let rounds = 0
  while (changed && rounds < 25) {
    changed = false
    rounds += 1
    for (const file of files) {
      const a = analyses.get(file)
      if (!a) continue
      // Local names that resolve to a reaching import.
      const reachingLocals = new Set()
      for (const [local, spec] of a.imports) {
        const set = reaching.get(spec.file)
        if (set && set.has(spec.imported)) reachingLocals.add(local)
      }
      // Intra-file propagation: a declaration reaching a reaching local is
      // itself reaching; iterate until this file stops growing.
      let localChanged = true
      while (localChanged) {
        localChanged = false
        for (const [decl, refs] of a.declRefs) {
          if (reachingLocals.has(decl)) continue
          for (const ref of refs) {
            if (reachingLocals.has(ref)) {
              reachingLocals.add(decl)
              localChanged = true
              break
            }
          }
        }
      }
      for (const name of reachingLocals) {
        if (add(file, name)) changed = true
      }
      for (const re of a.reExports) {
        if (re.imported === '*') {
          const set = reaching.get(re.file)
          if (set) for (const n of set) if (add(file, n)) changed = true
        } else {
          const set = reaching.get(re.file)
          if (set && set.has(re.imported) && add(file, re.local)) changed = true
        }
      }
    }
  }
  return reaching
}

// ─── route shape ────────────────────────────────────────────────────────────

/** app/(marketing)/open-houses/[city]/page.tsx -> /open-houses/[city] */
function routePathFor(pageFile) {
  const rel = relative(join(ROOT, 'app'), dirname(pageFile))
  if (rel === '' || rel === '.') return '/'
  const segments = rel
    .split(sep)
    .filter((s) => s && !(s.startsWith('(') && s.endsWith(')')) && !s.startsWith('@'))
  return `/${segments.join('/')}`
}

function firstSegment(pathname) {
  const m = pathname.match(/^\/([^/]+)/)
  return m ? m[1] : ''
}

/** Files whose contents can carry the allowlist test for this page. */
function guardScopeFiles(pageFile) {
  const pageDir = dirname(pageFile)
  const out = new Set(walk(pageDir))
  const appDir = join(ROOT, 'app')
  let dir = dirname(pageDir)
  while (dir.startsWith(appDir) && dir !== appDir) {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.isDirectory() && entry.name.startsWith('_')) {
        for (const f of walk(join(dir, entry.name))) out.add(f)
      } else if (entry.isFile() && SOURCE_EXTS.some((e) => entry.name.endsWith(e))) {
        out.add(join(dir, entry.name))
      }
    }
    dir = dirname(dir)
  }
  return [...out]
}

// ─── middleware + rewrite tables ────────────────────────────────────────────

/** First path segments middleware.ts matches with a `/^\/<seg>\/` regex. */
export function middlewareGuardedSegments(middlewareSource) {
  const sf = parse('middleware.ts', middlewareSource)
  const segments = new Set()
  const visit = (node) => {
    if (node.kind === ts.SyntaxKind.RegularExpressionLiteral) {
      const raw = node.getText()
      const m = raw.match(/^\/\^\\\/([A-Za-z0-9-]+)\\\//)
      if (m) segments.add(m[1])
    }
    ts.forEachChild(node, visit)
  }
  ts.forEachChild(sf, visit)
  return segments
}

/**
 * destination first segment -> Set(source first segments), read ONLY from the
 * `rewrites()` member of next.config.ts. redirects() is deliberately excluded:
 * a redirect changes the URL a visitor is on, so it never makes one route
 * answer under another route's public segment, and folding it in here widened
 * /cities coverage onto /area-guides, /lp and friends.
 */
export function rewriteAliasSegments(nextConfigSource) {
  const sf = parse('next.config.ts', nextConfigSource)
  const aliases = new Map()
  let rewritesNode = null
  const findRewrites = (node) => {
    if (rewritesNode) return
    const name =
      (ts.isMethodDeclaration(node) || ts.isPropertyAssignment(node)) && node.name && ts.isIdentifier(node.name)
        ? node.name.text
        : null
    if (name === 'rewrites') {
      rewritesNode = node
      return
    }
    ts.forEachChild(node, findRewrites)
  }
  ts.forEachChild(sf, findRewrites)
  if (!rewritesNode) return aliases
  const visit = (node) => {
    if (ts.isObjectLiteralExpression(node)) {
      let source = null
      let destination = null
      for (const prop of node.properties) {
        if (!ts.isPropertyAssignment(prop) || !prop.name) continue
        const key = ts.isIdentifier(prop.name) || ts.isStringLiteral(prop.name) ? prop.name.text : null
        if (!key) continue
        if (!ts.isStringLiteral(prop.initializer)) continue
        if (key === 'source') source = prop.initializer.text
        if (key === 'destination') destination = prop.initializer.text
      }
      if (source && destination && source.startsWith('/') && destination.startsWith('/')) {
        const src = firstSegment(source)
        const dest = firstSegment(destination)
        if (src && dest && src !== dest && !src.includes(':')) {
          let set = aliases.get(dest)
          if (!set) aliases.set(dest, (set = new Set()))
          set.add(src)
        }
      }
    }
    ts.forEachChild(node, visit)
  }
  ts.forEachChild(rewritesNode, visit)
  return aliases
}

// ─── main ───────────────────────────────────────────────────────────────────

export function auditCityRouteGuards({ root = REPO_ROOT } = {}) {
  ROOT = root
  const files = SOURCE_ROOTS.flatMap((r) => walk(join(root, r)))
  const analyses = new Map()
  const texts = new Map()
  for (const file of files) {
    const text = readFileSync(file, 'utf8')
    texts.set(file, text)
    analyses.set(file, analyzeFile(file, text))
  }
  const reaching = computeReaching(files, analyses)

  const middlewarePath = join(root, 'middleware.ts')
  const middlewareSegments = existsSync(middlewarePath)
    ? middlewareGuardedSegments(readFileSync(middlewarePath, 'utf8'))
    : new Set()
  const nextConfigPath = join(root, 'next.config.ts')
  const aliases = existsSync(nextConfigPath)
    ? rewriteAliasSegments(readFileSync(nextConfigPath, 'utf8'))
    : new Map()

  const findings = []
  const covered = []
  for (const file of files) {
    if (!file.endsWith(`${sep}page.tsx`)) continue
    if (!file.startsWith(join(root, 'app') + sep)) continue
    const a = analyses.get(file)
    if (!a) continue
    const reached = []
    for (const [local, spec] of a.imports) {
      const set = reaching.get(spec.file)
      if (set && set.has(spec.imported)) reached.push(`${local} (${relative(root, spec.file)})`)
    }
    if (reached.length === 0) continue

    const route = routePathFor(file)
    const seg = firstSegment(route)
    const publicSegments = new Set([seg, ...(aliases.get(seg) ?? [])])
    const hasMiddlewareRule = [...publicSegments].some((s) => middlewareSegments.has(s))
    const scoped = guardScopeFiles(file).find((f) => {
      const fa = analyses.get(f) ?? analyzeFile(f, texts.get(f) ?? readFileSync(f, 'utf8'))
      if (!fa.usesAllowlist) return false
      return fa.hasRejection || a.dynamicParamsFalse
    })

    const entry = {
      page: relative(root, file),
      route,
      publicSegments: [...publicSegments],
      reached,
      allowlistFile: scoped ? relative(root, scoped) : null,
      middlewareRule: hasMiddlewareRule,
    }
    if (scoped || hasMiddlewareRule) covered.push(entry)
    else findings.push(entry)
  }
  return { findings, covered, middlewareSegments: [...middlewareSegments].sort() }
}

function main() {
  const report = process.argv.includes('--report')
  const { findings, covered, middlewareSegments } = auditCityRouteGuards()

  if (report) {
    console.log(`ci:city-route-guard — middleware city-segment rules: ${middlewareSegments.join(', ')}`)
    for (const c of covered) {
      const how = c.allowlistFile ? `allowlist in ${c.allowlistFile}` : `middleware rule on /${c.publicSegments.join(' | /')}`
      console.log(`  ok   ${c.route}  (${how})`)
    }
  }

  if (findings.length > 0) {
    console.error('ci:city-route-guard FAILED — a route resolves its city segment through')
    console.error(`${TARGET_SYMBOL} (statewide: ~362 Oregon cities) with no Central Oregon guard.\n`)
    for (const f of findings) {
      console.error(`  ${f.route}   ${f.page}`)
      console.error(`    reaches ${TARGET_SYMBOL} via: ${f.reached.join(', ')}`)
      console.error(`    public segments checked against middleware.ts: ${f.publicSegments.map((s) => `/${s}`).join(', ')}`)
      console.error(`    no ${ALLOWLIST_IDENTIFIERS.join(' / ')} in the route's own tree, and no middleware rule.\n`)
    }
    console.error('Fix ONE of:')
    console.error('  1. Test the slug against CENTRAL_OREGON_CITY_SLUGS in the route (lib/central-oregon).')
    console.error('  2. Add a `/^\\/<segment>\\/([^/]+)\\/?$/` rule to resolveGeoCityRedirect in middleware.ts')
    console.error('     that 308s a non-service-area slug to /oregon/<slug>. The edge is the only place')
    console.error('     a wrong-city URL can be turned away with a status — app/loading.tsx makes a')
    console.error('     page-body notFound() ship HTTP 200.')
    process.exit(1)
  }

  console.log(`ci:city-route-guard — OK (${covered.length} city-slug route${covered.length === 1 ? '' : 's'} guarded)`)
}

if (import.meta.url === `file://${process.argv[1]}`) main()
