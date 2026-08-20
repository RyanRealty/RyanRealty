#!/usr/bin/env node
/**
 * check-streamed-redirect.mjs (ci:streamed-redirect) — a page-body redirect()
 * under a streaming boundary cannot emit a Location header.
 *
 * THE DEFECT THIS GATE EXISTS FOR
 * -------------------------------
 * `loading.tsx` opens a React Suspense boundary. When anything above or inside
 * it suspends, React flushes the shell — and with it HTTP 200 and the response
 * headers — before the page component finishes. A `redirect()` /
 * `permanentRedirect()` thrown afterwards can no longer write `Location`. Next
 * degrades it to an RSC flight instruction: a browser running JS completes the
 * hop, and a crawler (or any no-JS client) gets a 200 carrying the layout
 * chrome, no <h1>, and whatever <title> generateMetadata produced.
 * `app/loading.tsx` wraps EVERY route here, so this is not an edge case.
 *
 * Measured on ryan-realty.com 2026-08-19 (browser UA, redirect:manual), before
 * the fix that added this gate:
 *
 *   /communities/bend-broken-top         200, Location: null, 0 <h1>, "index, follow"
 *   /communities/bend-tetherow           200, Location: null, 0 <h1>, "index, follow"
 *   /communities/sunriver-river-village  200, Location: null, 0 <h1>, "index, follow"
 *   /housing-market/reports/city/Bend    200, Location: null, 0 <h1>, "noindex, follow"
 *   /listing/by-key/2020022814030864405… 200, Location: null, 0 <h1>
 *   /dashboard/saved                     200, Location: null, 0 <h1>, "index, follow"
 *
 * Sweeping the 104 registry-derived compound community slugs (each community's
 * own city x its label + subdivision_aliases): 91 served that shell while
 * publishing a "<Community> Homes for Sale | <City>, OR" <title> over an empty
 * body, all 91 robots "index, follow", 0 emitting a 3xx. A wider sweep that also
 * crosses in wrong-city variants counted 120.
 *
 * THE PREDICATE — AST over app/, never a grep
 * -------------------------------------------
 * A page is in the class when ALL THREE hold:
 *
 *   1. Its default-exported component reaches `redirect()` /
 *      `permanentRedirect()` (imported from `next/navigation`) on the render
 *      path — directly, or through a same-file helper it calls. A default
 *      re-exported from another page file is followed.
 *   2. A `loading.tsx` exists in the page's own segment or ANY ancestor segment
 *      under `app/` (app/loading.tsx counts — it wraps every route).
 *   3. Something suspends before the throw: the page component is `async` or
 *      contains an `await`, OR any `layout.tsx` from `app/` down to the page's
 *      segment is async. (/dashboard/* was the second case — synchronous pages
 *      under app/dashboard/layout.tsx, which awaits getSession().)
 *
 * Condition 3 is what makes this a mechanism check and not a ban on the word
 * "redirect": a page-body redirect with nothing suspending in front of it still
 * emits a real 3xx.
 *
 * COVERED — exactly one thing clears a finding
 * --------------------------------------------
 * An UNCONDITIONAL `next.config.ts` `redirects()` rule whose `source` matches the
 * route. That rule fires before the route is ever resolved, so the page body is
 * unreachable. A rule carrying `has`/`missing` is conditional and does not count.
 * There is no hand-written exemption list.
 *
 * MIDDLEWARE OWNERSHIP IS DELIBERATELY NOT COVERAGE. A middleware resolver
 * returns null for most inputs, so the page stays reachable and its redirect
 * still cannot set a status. Treating it as coverage made this gate pass on the
 * real pre-fix app/communities/[slug]/page.tsx — a gate that cannot fail on the
 * bug it was written for. The PRE_RENDER_HOPS registry is used the other way
 * round: a route listed there that ALSO redirects from its page body is a
 * failure, and the gate asserts middleware.ts imports and calls
 * resolvePreRenderHop so the registry cannot be a claim instead of a mechanism.
 *
 * BASELINE — auth guards, shrink-only
 * -----------------------------------
 * scripts/streamed-redirect-baseline.json carries the auth-redirect population
 * (/admin, /account, /dashboard, /team/[slug]/edit) that this change did not
 * take on: eliminating it means validating the session in middleware, which is
 * a production-risk change to broker access and needs its own unit. Every
 * baselined route must sit under one of those prefixes, so a public route can
 * never be parked there. A finding outside the baseline fails. A baseline entry
 * that no longer fires fails too — the count may only shrink.
 *
 * PROVING BOTH DIRECTIONS
 *   node scripts/check-streamed-redirect.mjs             -> exit 0 today; the
 *       self-test below runs on EVERY invocation, so the gate cannot go green
 *       while its own negative cases have stopped firing.
 *   node scripts/check-streamed-redirect.mjs --self-test -> rebuilds the pre-fix
 *       app/communities/[slug] shape in a temp tree and asserts the predicate
 *       FIRES on it; asserts it goes silent when the await is removed, when the
 *       loading.tsx is removed, and fires again on a sync page under an async
 *       ancestor layout (the /dashboard/* shape).
 *   node scripts/check-streamed-redirect.mjs --list      -> findings as JSON
 */

import { readFileSync, existsSync, readdirSync, statSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { join, dirname, relative, sep } from 'node:path'
import { tmpdir } from 'node:os'
import ts from 'typescript'

const REPO = process.cwd()
const APP_DIR = join(REPO, 'app')
const HOPS_MODULE = join(REPO, 'lib/routing/pre-render-hops.ts')
const MIDDLEWARE = join(REPO, 'middleware.ts')
const NEXT_CONFIG = join(REPO, 'next.config.ts')
const BASELINE_FILE = join(REPO, 'scripts/streamed-redirect-baseline.json')

/**
 * The only prefixes a baseline entry may live under. Auth redirects need a
 * session read, which today only the page/layout can do.
 */
const BASELINE_ALLOWED_PREFIXES = ['/admin', '/account', '/dashboard', '/team/[slug]/edit']

const REDIRECT_FNS = new Set(['redirect', 'permanentRedirect'])

// ─── AST helpers ─────────────────────────────────────────────────────────────

function parseFile(file) {
  const src = readFileSync(file, 'utf8')
  return ts.createSourceFile(file, src, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
}

function findPages(appDir) {
  const out = []
  const walk = (dir) => {
    let entries
    try {
      entries = readdirSync(dir, { withFileTypes: true })
    } catch {
      return
    }
    for (const e of entries) {
      const p = join(dir, e.name)
      if (e.isDirectory()) {
        if (e.name === 'node_modules' || e.name === '.next') continue
        walk(p)
      } else if (e.isFile() && /^page\.(tsx|ts|jsx|js)$/.test(e.name)) {
        out.push(p)
      }
    }
  }
  walk(appDir)
  return out.sort()
}

/** Local names bound to redirect()/permanentRedirect() from 'next/navigation'. */
function redirectImportNames(sf) {
  const names = new Set()
  sf.forEachChild((node) => {
    if (!ts.isImportDeclaration(node)) return
    const spec = node.moduleSpecifier
    if (!ts.isStringLiteral(spec) || spec.text !== 'next/navigation') return
    const bindings = node.importClause?.namedBindings
    if (!bindings || !ts.isNamedImports(bindings)) return
    for (const el of bindings.elements) {
      const original = (el.propertyName ?? el.name).text
      if (REDIRECT_FNS.has(original)) names.add(el.name.text)
    }
  })
  return names
}

function defaultExportedFunction(sf) {
  let target = null
  let aliasName = null
  sf.forEachChild((node) => {
    if (ts.isFunctionDeclaration(node) && node.modifiers?.some((m) => m.kind === ts.SyntaxKind.DefaultKeyword)) {
      target = node
    } else if (ts.isExportAssignment(node) && !node.isExportEquals) {
      const expr = node.expression
      if (ts.isFunctionExpression(expr) || ts.isArrowFunction(expr)) target = expr
      else if (ts.isIdentifier(expr)) aliasName = expr.text
    }
  })
  if (target) return target
  if (!aliasName) return null
  let resolved = null
  sf.forEachChild((node) => {
    if (ts.isFunctionDeclaration(node) && node.name?.text === aliasName) resolved = node
    else if (ts.isVariableStatement(node)) {
      for (const d of node.declarationList.declarations) {
        if (
          ts.isIdentifier(d.name) &&
          d.name.text === aliasName &&
          d.initializer &&
          (ts.isFunctionExpression(d.initializer) || ts.isArrowFunction(d.initializer))
        ) {
          resolved = d.initializer
        }
      }
    }
  })
  return resolved
}

function localFunctions(sf) {
  const map = new Map()
  sf.forEachChild((node) => {
    if (ts.isFunctionDeclaration(node) && node.name) map.set(node.name.text, node)
    else if (ts.isVariableStatement(node)) {
      for (const d of node.declarationList.declarations) {
        if (
          ts.isIdentifier(d.name) &&
          d.initializer &&
          (ts.isFunctionExpression(d.initializer) || ts.isArrowFunction(d.initializer))
        ) {
          map.set(d.name.text, d.initializer)
        }
      }
    }
  })
  return map
}

const isAsyncFn = (fn) => Boolean(fn.modifiers?.some((m) => m.kind === ts.SyntaxKind.AsyncKeyword))

function hasAwait(fn) {
  let seen = false
  const walk = (n) => {
    if (seen) return
    if (ts.isAwaitExpression(n)) {
      seen = true
      return
    }
    n.forEachChild(walk)
  }
  if (fn.body) walk(fn.body)
  return seen
}

/** redirect() calls on the component's render path, with await ordering. */
function redirectCalls(sf, fn, redirectNames, locals) {
  const awaits = []
  const hits = []
  const visitedHelpers = new Set()

  const collect = (node, helperName) => {
    if (ts.isAwaitExpression(node) && !helperName) awaits.push(node.getStart(sf))
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression)) {
      const name = node.expression.text
      if (redirectNames.has(name)) {
        hits.push({
          pos: node.getStart(sf),
          line: sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1,
          name,
          helperName,
        })
      } else if (!helperName && locals.has(name) && !visitedHelpers.has(name)) {
        visitedHelpers.add(name)
        const helper = locals.get(name)
        if (helper.body) {
          const walk = (n) => {
            collect(n, name)
          }
          helper.body.forEachChild(walk)
        }
      }
    }
    node.forEachChild((c) => collect(c, helperName))
  }
  if (fn.body) fn.body.forEachChild((n) => collect(n, null))

  const firstAwait = awaits.length ? Math.min(...awaits) : Infinity
  const componentAsync = isAsyncFn(fn)
  return hits.map((h) => ({ ...h, afterAwait: componentAsync || h.pos > firstAwait }))
}

function loadingBoundaries(pageFile, appDir) {
  const found = []
  let dir = dirname(pageFile)
  for (;;) {
    for (const ext of ['tsx', 'ts', 'jsx', 'js']) {
      const f = join(dir, `loading.${ext}`)
      if (existsSync(f)) {
        found.push(relative(REPO, f))
        break
      }
    }
    if (dir === appDir) break
    const parent = dirname(dir)
    if (parent === dir) break
    dir = parent
  }
  return found
}

function asyncLayouts(pageFile, appDir) {
  const chain = []
  let dir = dirname(pageFile)
  for (;;) {
    chain.push(dir)
    if (dir === appDir) break
    const parent = dirname(dir)
    if (parent === dir) break
    dir = parent
  }
  const found = []
  for (const d of chain) {
    for (const ext of ['tsx', 'ts', 'jsx', 'js']) {
      const f = join(d, `layout.${ext}`)
      if (!existsSync(f)) continue
      const sf = parseFile(f)
      const fn = defaultExportedFunction(sf)
      if (fn && (isAsyncFn(fn) || hasAwait(fn))) found.push(relative(REPO, f))
      break
    }
  }
  return found
}

/** `export { default } from '<module>'` — follow it. */
function reExportedDefaultFrom(sf, file) {
  let target = null
  sf.forEachChild((node) => {
    if (!ts.isExportDeclaration(node) || !node.moduleSpecifier) return
    if (!ts.isStringLiteral(node.moduleSpecifier)) return
    const clause = node.exportClause
    if (!clause || !ts.isNamedExports(clause)) return
    if (!clause.elements.some((el) => (el.propertyName ?? el.name).text === 'default')) return
    const spec = node.moduleSpecifier.text
    const base = spec.startsWith('@/') ? join(REPO, spec.slice(2)) : join(dirname(file), spec)
    for (const ext of ['.tsx', '.ts', '.jsx', '.js']) {
      if (existsSync(base + ext)) {
        target = base + ext
        break
      }
    }
  })
  return target
}

/** URL route for a page file: route groups and parallel slots dropped. */
function routeFor(pageFile, appDir) {
  const rel = relative(appDir, dirname(pageFile))
  if (!rel || rel === '.') return '/'
  const parts = rel
    .split(sep)
    .filter((p) => !(p.startsWith('(') && p.endsWith(')')) && !p.startsWith('@'))
  return '/' + parts.join('/')
}

export function scanApp(appDir) {
  const findings = []
  for (const pageFile of findPages(appDir)) {
    let sourceFile = pageFile
    let sf = parseFile(pageFile)
    const forwarded = reExportedDefaultFrom(sf, pageFile)
    if (forwarded) {
      sourceFile = forwarded
      sf = parseFile(forwarded)
    }
    const redirectNames = redirectImportNames(sf)
    if (redirectNames.size === 0) continue
    const fn = defaultExportedFunction(sf)
    if (!fn) continue
    const hits = redirectCalls(sf, fn, redirectNames, localFunctions(sf))
    if (hits.length === 0) continue

    const boundaries = loadingBoundaries(pageFile, appDir)
    if (boundaries.length === 0) continue

    const layouts = asyncLayouts(pageFile, appDir)
    const componentSuspends = isAsyncFn(fn) || hasAwait(fn)
    if (!componentSuspends && layouts.length === 0) continue

    findings.push({
      route: routeFor(pageFile, appDir),
      page: relative(REPO, pageFile),
      via: sourceFile === pageFile ? null : relative(REPO, sourceFile),
      calls: hits.map((h) => `${h.name}() line ${h.line}${h.helperName ? ` (via ${h.helperName}())` : ''}`),
      boundary: boundaries[0],
      suspends: componentSuspends ? 'page component is async / awaits' : `async ancestor layout ${layouts[0]}`,
    })
  }
  return findings.sort((a, b) => a.route.localeCompare(b.route))
}

// ─── coverage: hops that already happen above the render ─────────────────────

/** `source:` string literals inside next.config.ts redirects(). */
function nextConfigRedirectSources() {
  if (!existsSync(NEXT_CONFIG)) return new Set()
  const sf = parseFile(NEXT_CONFIG)
  const sources = new Set()
  const walk = (node) => {
    if (ts.isObjectLiteralExpression(node)) {
      let source = null
      let conditional = false
      let isRedirect = false
      for (const prop of node.properties) {
        if (!ts.isPropertyAssignment(prop) || !ts.isIdentifier(prop.name)) continue
        const key = prop.name.text
        if (key === 'source' && (ts.isStringLiteral(prop.initializer) || ts.isNoSubstitutionTemplateLiteral(prop.initializer))) {
          source = prop.initializer.text
        }
        // `has` / `missing` make a rule conditional: it does not always fire, so
        // it cannot prove the page body is unreachable.
        if (key === 'has' || key === 'missing') conditional = true
        // `permanent` is only on redirects(); a rewrite still renders the page.
        if (key === 'permanent') isRedirect = true
      }
      if (source && isRedirect && !conditional) sources.add(source)
    }
    node.forEachChild(walk)
  }
  sf.forEachChild(walk)
  return sources
}

/** `routes: [...]` literals on PRE_RENDER_HOPS entries. */
function middlewareOwnedRoutes() {
  if (!existsSync(HOPS_MODULE)) return { routes: new Set(), wired: false }
  const sf = parseFile(HOPS_MODULE)
  const routes = new Set()
  const walk = (node) => {
    if (
      ts.isPropertyAssignment(node) &&
      ts.isIdentifier(node.name) &&
      node.name.text === 'routes' &&
      ts.isArrayLiteralExpression(node.initializer)
    ) {
      for (const el of node.initializer.elements) {
        if (ts.isStringLiteral(el) || ts.isNoSubstitutionTemplateLiteral(el)) routes.add(el.text)
      }
    }
    node.forEachChild(walk)
  }
  sf.forEachChild(walk)

  // The registry is only a claim unless middleware actually runs it.
  let wired = false
  if (existsSync(MIDDLEWARE)) {
    const mw = parseFile(MIDDLEWARE)
    let imported = false
    let called = false
    const walkMw = (node) => {
      if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
        if (/routing\/pre-render-hops$/.test(node.moduleSpecifier.text)) {
          const b = node.importClause?.namedBindings
          if (b && ts.isNamedImports(b) && b.elements.some((e) => (e.propertyName ?? e.name).text === 'resolvePreRenderHop')) {
            imported = true
          }
        }
      }
      if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === 'resolvePreRenderHop') {
        called = true
      }
      node.forEachChild(walkMw)
    }
    mw.forEachChild(walkMw)
    wired = imported && called
  }
  return { routes, wired }
}

/** app-router route path -> the next.config `source:` shape. */
function routeToConfigSources(route) {
  const shapes = new Set()
  const seg = route
    .split('/')
    .filter(Boolean)
    .map((s) => {
      if (s.startsWith('[...') && s.endsWith(']')) return `:${s.slice(4, -1)}*`
      if (s.startsWith('[[...') && s.endsWith(']]')) return `:${s.slice(5, -2)}*`
      if (s.startsWith('[') && s.endsWith(']')) return `:${s.slice(1, -1)}`
      return s
    })
  shapes.add('/' + seg.join('/'))
  // A `:param*` catch-all rule higher in the tree also covers this route.
  for (let i = seg.length - 1; i >= 1; i--) {
    if (seg[i].startsWith(':')) shapes.add('/' + seg.slice(0, i).concat(`${seg[i]}*`).join('/'))
  }
  return shapes
}

// ─── self-test ───────────────────────────────────────────────────────────────

function selfTestCases() {
  const root = join(tmpdir(), `rr-streamed-redirect-${process.pid}`)
  rmSync(root, { recursive: true, force: true })
  const app = join(root, 'app')
  const seg = join(app, 'communities', '[slug]')
  mkdirSync(seg, { recursive: true })
  const loading = 'export default function L() { return null }\n'
  writeFileSync(join(app, 'loading.tsx'), loading)
  writeFileSync(join(seg, 'loading.tsx'), loading)

  // (a) The exact pre-fix shape of app/communities/[slug]/page.tsx.
  writeFileSync(
    join(seg, 'page.tsx'),
    `import { redirect } from 'next/navigation'
import { getCommunityBySlug } from '@/app/actions/communities'
export default async function CommunityDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const community = await getCommunityBySlug(slug)
  if (!community) return null
  if (slug !== community.canonicalSlug) redirect('/communities/' + community.canonicalSlug)
  return null
}
`,
  )
  const firedBroken = scanApp(app)

  // (b) Same page with the await gone and nothing else changed.
  writeFileSync(
    join(seg, 'page.tsx'),
    `import { redirect } from 'next/navigation'
export default function CommunityDetailPage() {
  redirect('/communities/broken-top')
}
`,
  )
  const firedNoAwait = scanApp(app)

  // (c) Sync page under an async ancestor layout — the /dashboard/* shape.
  writeFileSync(
    join(app, 'communities', 'layout.tsx'),
    `export default async function Layout({ children }: { children: React.ReactNode }) {
  const s = await getSession()
  return <>{s ? children : null}</>
}
declare function getSession(): Promise<unknown>
`,
  )
  const firedAsyncLayout = scanApp(app)

  // (d) redirect() reached through a same-file helper.
  rmSync(join(app, 'communities', 'layout.tsx'))
  writeFileSync(
    join(seg, 'page.tsx'),
    `import { permanentRedirect } from 'next/navigation'
function go(to: string) { permanentRedirect(to) }
export default async function P({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  go('/communities/' + slug)
}
`,
  )
  const firedViaHelper = scanApp(app)

  // (e) A default re-exported from another page file, as
  //     app/housing-market/reports/[slug]/[geoName] did.
  const seg2 = join(app, 'housing-market', 'reports', '[slug]', '[geoName]')
  mkdirSync(seg2, { recursive: true })
  writeFileSync(join(seg2, 'page.tsx'), `export { default } from '../../../../communities/[slug]/page'\n`)
  const firedReExport = scanApp(app).filter((f) => f.route.startsWith('/housing-market'))

  // (f) No loading.tsx anywhere: React cannot have flushed, so a real 3xx.
  rmSync(join(seg2, 'page.tsx'))
  rmSync(join(app, 'loading.tsx'))
  rmSync(join(seg, 'loading.tsx'))
  const firedNoBoundary = scanApp(app)

  rmSync(root, { recursive: true, force: true })

  return [
    ['(a) async page + await + loading.tsx           FIRES', firedBroken.length === 1],
    ['(b) same page, no await, no async layout       SILENT', firedNoAwait.length === 0],
    ['(c) sync page under an async ancestor layout   FIRES', firedAsyncLayout.length === 1],
    ['(d) redirect reached via a same-file helper    FIRES', firedViaHelper.length === 1],
    ['(e) default re-exported from another page      FIRES', firedReExport.length === 1],
    ['(f) no loading.tsx anywhere                    SILENT', firedNoBoundary.length === 0],
  ]
}

function selfTest() {
  const cases = selfTestCases()
  console.log('check-streamed-redirect self-test')
  console.log('=================================')
  for (const [name, pass] of cases) console.log(`  ${pass ? 'PASS' : 'FAIL'}  ${name}`)
  if (cases.some(([, pass]) => !pass)) {
    console.error('\nFAILED — a gate that cannot fail is not a gate.')
    process.exit(1)
  }
  console.log('\nOK — the predicate fires on the pre-fix shapes and stays silent without them.')
  process.exit(0)
}

// ─── main ────────────────────────────────────────────────────────────────────

const args = new Set(process.argv.slice(2))
if (args.has('--self-test')) selfTest()

if (!existsSync(APP_DIR) || !statSync(APP_DIR).isDirectory()) {
  console.error('check-streamed-redirect: no app/ directory')
  process.exit(1)
}

const raw = scanApp(APP_DIR)
const configSources = nextConfigRedirectSources()
const { routes: hopRoutes, wired: hopsWired } = middlewareOwnedRoutes()

const fails = []

// The self-test runs on EVERY invocation, not as a separate opt-in script. A
// gate whose negative cases are only exercised when someone remembers to run
// them is prose. ~0.2s in a temp tree.
const selfTestResults = selfTestCases()
for (const [name, pass] of selfTestResults) {
  if (!pass) fails.push(`self-test case failed — the predicate no longer behaves as documented: ${name}`)
}
if (hopRoutes.size > 0 && !hopsWired) {
  fails.push(
    'lib/routing/pre-render-hops.ts declares routes but middleware.ts does not import AND call resolvePreRenderHop — the registry would be a claim, not a mechanism.',
  )
}

let baseline = []
if (existsSync(BASELINE_FILE)) {
  baseline = JSON.parse(readFileSync(BASELINE_FILE, 'utf8')).routes ?? []
}
const baselineSet = new Set(baseline)
for (const r of baseline) {
  if (!BASELINE_ALLOWED_PREFIXES.some((p) => r === p || r.startsWith(p + '/'))) {
    fails.push(
      `streamed-redirect-baseline.json lists ${r}, which is not under ${BASELINE_ALLOWED_PREFIXES.join(', ')}. Only auth-guarded routes may be baselined.`,
    )
  }
}

const open = []
const covered = []
for (const f of raw) {
  // MIDDLEWARE OWNERSHIP IS NOT COVERAGE. A middleware resolver returns null for
  // most inputs, so the page is still reachable and its redirect still cannot
  // set a status. Listing a route in PRE_RENDER_HOPS while leaving the page-body
  // redirect in place would make this gate unable to fail on the very bug it was
  // written for (app/communities/[slug]). The registry is used in the opposite
  // direction, below: a middleware-owned route MUST have no page-body redirect.
  const shapes = routeToConfigSources(f.route)
  const bySource = [...shapes].find((s) => configSources.has(s))
  if (bySource) {
    covered.push({ ...f, by: `next.config.ts redirects() source '${bySource}'` })
    continue
  }
  open.push(f)
}

// A route whose hop moved to middleware must not keep a second, dead copy in the
// page body — that copy cannot set a status and will drift.
const doubleOwned = raw.filter((f) => hopRoutes.has(f.route))

const unbaselined = open.filter((f) => !baselineSet.has(f.route))
const openRoutes = new Set(open.map((f) => f.route))
const stale = baseline.filter((r) => !openRoutes.has(r))

console.log('streamed-redirect gate (ci:streamed-redirect)')
console.log('=============================================')
console.log(`self-test: ${selfTestResults.filter(([, p]) => p).length}/${selfTestResults.length} predicate cases behave as documented`)
console.log(`pages scanned with a page-body redirect under a streaming boundary: ${raw.length}`)
console.log(`  covered by a hop above the render: ${covered.length}`)
console.log(`  auth-redirect baseline (shrink-only): ${open.length - unbaselined.length}/${baseline.length}`)
console.log(`  unaccounted for: ${unbaselined.length}`)

if (args.has('--list')) {
  console.log(JSON.stringify({ raw, covered, open, unbaselined, stale }, null, 2))
}

if (stale.length) {
  fails.push(
    `baseline entries that no longer fire — remove them (the count may only shrink): ${stale.join(', ')}`,
  )
}

for (const f of doubleOwned) {
  fails.push(
    `${f.route} is listed in PRE_RENDER_HOPS (middleware owns its hop) but ${f.page} still redirects from the page body — that copy is dead and cannot set a status. Delete it.`,
  )
}

for (const f of unbaselined) {
  fails.push(
    `${f.route} redirects from its page body under ${f.boundary} (${f.suspends}); ${f.calls.join(', ')} in ${f.page}${f.via ? ` via ${f.via}` : ''}`,
  )
}

if (fails.length) {
  console.error('')
  for (const x of fails) console.error('  ✗ ' + x)
  console.error(
    '\nA redirect thrown after the shell has flushed cannot set Location: the URL serves 200 with layout chrome and no <h1>.',
  )
  console.error('Move the hop above the render:')
  console.error('  - pure path rewrite         -> next.config.ts redirects()')
  console.error('  - needs a lookup/transform  -> lib/routing/pre-render-hops.ts (run by middleware.ts)')
  console.error('  - needs the database        -> a route.ts handler returning NextResponse.redirect()')
  console.error('Rendering a fallback body is NOT a fix — the URL must emit a real 3xx.')
  process.exit(1)
}

console.log('\nOK — every page-body redirect under a streaming boundary is either superseded by a')
console.log('pre-render hop or inside the tracked auth-redirect baseline.')
process.exit(0)
