#!/usr/bin/env node
/**
 * check-analytics-registry.mjs — `ci:analytics-registry`.
 *
 * Matt 2026-10-14: "any time we do any SEO, analytics or tracking work, it is
 * always looked at and done properly ... it references stuff so that we're not
 * doing one-offs and we're not recreating stuff."
 *
 * WHY A GATE. Prose did not hold. On 2026-10-14 the repo had two GA4 Admin
 * scripts with different "locked" configs (scripts/ga4-admin.mjs and
 * scripts/ga4-admin-setup.mjs), four underscore one-off Search Console scripts,
 * and audits written in session scratchpads that never reached the repo. Each
 * session started from zero because nothing forced it to find what existed.
 *
 * THE RULE. docs/analytics/README.md is the one source of truth, and its
 * "Registry" section names every file that touches GA4, Search Console or Tag
 * Manager. This gate fails when a file:
 *   1. sends to GA4 from the server (`fireGa4Event(` or the Measurement Protocol URL),
 *   2. calls the GA4 Data / Admin, Search Console or Tag Manager APIs, or
 *   3. lives in lib/analytics/ (non-test)
 * and its repo path is not written in docs/analytics/README.md.
 *
 * Registering a file means reading the README first, which is the point: the
 * new file either extends a listed one or says in the registry why it exists.
 * A deleted file needs no change here; a stale README row is caught by rule 4:
 *   4. every path in the Registry table exists.
 *
 * Exported `findViolations({ files, readme, exists })` is unit-tested in
 * scripts/__tests__/check-analytics-registry.test.mjs.
 */
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

export const README = 'docs/analytics/README.md'
const ROOTS = ['app', 'lib', 'components', 'scripts']
const EXT = /\.(ts|tsx|mjs|js|cjs)$/
const SKIP_DIR = new Set(['node_modules', '.next', '__tests__', 'out', 'fixtures'])
const SELF = 'scripts/check-analytics-registry.mjs'

/** What makes a file an analytics surface, with the reason the gate prints. */
export const SURFACE_PATTERNS = [
  { re: /\bfireGa4Event\s*\(/, why: 'sends a server event to GA4 (fireGa4Event)' },
  { re: /google-analytics\.com\/(debug\/)?mp\/collect/, why: 'posts to the GA4 Measurement Protocol' },
  { re: /\bgoogle\.(analyticsdata|analyticsadmin|searchconsole|webmasters|tagmanager)\s*\(/, why: 'calls a Google analytics API (googleapis)' },
  { re: /\b(BetaAnalyticsDataClient|AnalyticsAdminServiceClient)\b/, why: 'calls a Google analytics API (client library)' },
  { re: /(analyticsdata|analyticsadmin|searchconsole|tagmanager)\.googleapis\.com|googleapis\.com\/(webmasters|analytics)\//, why: 'calls a Google analytics API (REST)' },
  { re: /googleapis\.com\/auth\/(analytics|webmasters|tagmanager)/, why: 'requests a Google Analytics / Search Console / Tag Manager OAuth scope' },
]

function isTest(path) {
  return /\.test\.|\.spec\./.test(path)
}

/** Every repo path the README mentions: `path` in backticks or a bare path. */
export function readmePaths(readme) {
  const out = new Set()
  for (const m of readme.matchAll(/(?:^|[\s`(|])((?:app|lib|components|scripts|docs)\/[A-Za-z0-9_.\-/[\]()]+\.[a-z]{2,4})/gm)) out.add(m[1])
  return out
}

/** Paths listed in the README's Registry section (between "## Registry" and the next "## "). */
export function registryPaths(readme) {
  const start = readme.indexOf('\n## Registry')
  if (start < 0) return new Set()
  const rest = readme.slice(start + 1)
  const next = rest.indexOf('\n## ', 3)
  return readmePaths(next < 0 ? rest : rest.slice(0, next))
}

export function findViolations({ files, readme, exists }) {
  const violations = []
  if (readme == null) {
    violations.push(`${README} is missing. It is the single source of truth for analytics, SEO measurement and tracking.`)
    return violations
  }
  if (!/\n## Registry/.test(readme)) violations.push(`${README} has no "## Registry" section.`)
  const named = readmePaths(readme)
  for (const { path, src } of files) {
    if (path === SELF || isTest(path)) continue
    const inLibAnalytics = path.startsWith('lib/analytics/')
    const hit = SURFACE_PATTERNS.find((p) => p.re.test(src))
    if (!hit && !inLibAnalytics) continue
    if (named.has(path)) continue
    violations.push(`${path} ${hit ? hit.why : 'is an analytics module (lib/analytics/)'} but is not in ${README}. Read the README first: extend a registered file, or add this one to the Registry with why it exists.`)
  }
  for (const p of registryPaths(readme)) {
    if (!exists(p)) violations.push(`${README} Registry lists ${p}, which does not exist. Remove the row or fix the path.`)
  }
  return violations
}

function walk(dir, out) {
  let entries
  try {
    entries = readdirSync(dir)
  } catch {
    return
  }
  for (const name of entries) {
    if (SKIP_DIR.has(name)) continue
    const full = join(dir, name)
    let st
    try {
      st = statSync(full)
    } catch {
      continue
    }
    if (st.isDirectory()) walk(full, out)
    else if (EXT.test(name)) out.push(full)
  }
}

function main() {
  const root = process.cwd()
  const paths = []
  for (const r of ROOTS) walk(join(root, r), paths)
  const files = paths.map((full) => ({ path: relative(root, full).split(sep).join('/'), src: readFileSync(full, 'utf8') }))
  const readme = existsSync(join(root, README)) ? readFileSync(join(root, README), 'utf8') : null
  const violations = findViolations({ files, readme, exists: (p) => existsSync(join(root, p)) })
  if (violations.length) {
    console.error('Analytics registry gate FAILED (ci:analytics-registry)\n')
    for (const v of violations) console.error(`  - ${v}`)
    console.error(`\nOne source of truth: ${README} (Matt 2026-10-14). No one-off analytics code.`)
    process.exit(1)
  }
  console.log(`Analytics registry gate passed — every GA4 / Search Console / Tag Manager surface is registered in ${README}.`)
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main()
