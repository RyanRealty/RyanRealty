#!/usr/bin/env node
/**
 * check-site-origin.mjs — ci:site-origin (G81).
 *
 * Matt 2026-10-07: "why were we using ryanrealty.vercel.app, I don't ever want
 * to do that again, all coding agents need to know this."
 *
 * The canonical public origin is https://ryan-realty.com. Production's
 * NEXT_PUBLIC_SITE_URL was the Vercel alias, and 90 files read it directly,
 * so canonicals, metadataBase, sitemaps, JSON-LD, email links, CRM lead
 * sources, CAPI event URLs, ad links and PDF asset URLs all went out on the
 * alias. lib/site-origin.ts is now the ONE reader of that variable: siteOrigin()
 * folds every production host (apex, www, the alias) to the canonical origin
 * and keeps a preview or local host.
 *
 * Rules (app/, lib/, components/, middleware.ts; tests excluded):
 *   R1  No read of NEXT_PUBLIC_SITE_URL outside lib/site-origin.ts: no
 *       `process.env.NEXT_PUBLIC_SITE_URL`, `process.env?.…`, `process.env['…']`,
 *       `env().NEXT_PUBLIC_SITE_URL`, or `{ NEXT_PUBLIC_SITE_URL } = …`.
 *       Use siteOrigin() / siteHost() / siteUrl() / configuredSiteOrigin().
 *   R2  No read of a Vercel host variable (VERCEL_URL, VERCEL_BRANCH_URL,
 *       VERCEL_PROJECT_PRODUCTION_URL and their NEXT_PUBLIC_ twins). Each is a
 *       *.vercel.app host. Only the server-to-server self-calls in ALLOWLIST
 *       may use one, never for an outward URL.
 *   R3  lib/site-origin.ts still maps the alias to https://ryan-realty.com.
 *   R4  Every ALLOWLIST entry still matches a read (stale entries fail, so the
 *       list only shrinks).
 *   R5  No string literal, template piece or JSX text holding the alias host
 *       (`ryanrealty` + `.vercel.app`) in app/, lib/, components/, scripts/ or
 *       a root middleware file, tests excluded. The only exceptions are lines
 *       that CLASSIFY an incoming host (middleware's redirect set, visitor
 *       tracking, a GA4 hostname filter) or map it away (lib/site-origin.ts),
 *       each marked `staging-host-ok` with a reason on the literal's line or
 *       the line directly above it (the ci:no-staging-host convention).
 *
 * Parsed with the TypeScript compiler, so comments and prose never trip it.
 * ci:no-staging-host is the companion for any *.vercel.app URL literal and for
 * public/*.html; the live HTML is checked by deploy:verify
 * (scripts/check-vercel-deploy.mjs).
 *
 * Usage: node scripts/check-site-origin.mjs [--root <dir>]
 */
import { readFileSync, readdirSync, existsSync, realpathSync } from 'node:fs'
import { join, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

const __filename = fileURLToPath(import.meta.url)

export const HELPER_PATH = 'lib/site-origin.ts'
export const SITE_KEY = 'NEXT_PUBLIC_SITE_URL'
export const VERCEL_HOST_KEYS = [
  'VERCEL_URL',
  'VERCEL_BRANCH_URL',
  'VERCEL_PROJECT_PRODUCTION_URL',
  'NEXT_PUBLIC_VERCEL_URL',
  'NEXT_PUBLIC_VERCEL_BRANCH_URL',
  'NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL',
]
const WATCHED = new Set([SITE_KEY, ...VERCEL_HOST_KEYS])

/** The production alias host, built from parts so this file holds no literal of it (R5). */
export const ALIAS_HOST = ['ryanrealty', 'vercel', 'app'].join('.')
/** The R5 exception marker, shared with ci:no-staging-host. */
export const ALLOW_MARKER = 'staging-host-ok'

/**
 * Justified exceptions, `file::KEY` → reason. Nothing here builds an outward
 * URL. Every other host decision in the codebase goes through lib/site-origin.ts
 * or reads the INCOMING request (auth PKCE base URL in app/actions/auth.ts and
 * app/auth/callback/route.ts, Twilio signature URL in lib/crm/twilio.ts, the
 * Meta OAuth redirect in app/api/meta/oauth-callback/route.ts), which reads no
 * variable and so is outside this gate.
 */
export const ALLOWLIST = new Map([
  [
    'app/api/cron/publisher-sweep/route.ts::VERCEL_URL',
    'server-to-server self-call to /api/social/publish; used only when NEXT_PUBLIC_SITE_URL is unset (configuredSiteOrigin() is null), so a run without the variable hits the running deployment instead of production',
  ],
  [
    'app/api/cron/snapshot-channels/route.ts::VERCEL_URL',
    'server-to-server fan-out to the sibling /api/cron/marketing-snapshot-* routes on the SAME deployment with the cron bearer; never shown to anyone',
  ],
])

const SCAN_DIRS = ['app', 'lib', 'components']
const SCAN_ROOT_FILES = ['middleware.ts', 'proxy.ts', 'instrumentation.ts', 'instrumentation-client.ts']
const SOURCE_RE = /\.(?:[cm]?[jt]sx?)$/
const TEST_RE = /(?:\.(?:test|spec)\.[cm]?[jt]sx?$)|(?:(?:^|\/)__tests__\/)/

export function isScannedPath(rel) {
  const p = rel.split(sep).join('/')
  if (!SOURCE_RE.test(p) || TEST_RE.test(p) || p.endsWith('.d.ts')) return false
  return SCAN_DIRS.some((d) => p.startsWith(`${d}/`)) || SCAN_ROOT_FILES.includes(p)
}

/** R5 also covers scripts/: a CLI that prints, posts or writes a URL is outward too. */
const LITERAL_SCAN_DIRS = [...SCAN_DIRS, 'scripts']

export function isLiteralScannedPath(rel) {
  const p = rel.split(sep).join('/')
  if (!SOURCE_RE.test(p) || TEST_RE.test(p) || p.endsWith('.d.ts')) return false
  return LITERAL_SCAN_DIRS.some((d) => p.startsWith(`${d}/`)) || SCAN_ROOT_FILES.includes(p)
}

function scriptKind(file) {
  if (file.endsWith('.tsx')) return ts.ScriptKind.TSX
  if (file.endsWith('.jsx')) return ts.ScriptKind.JSX
  if (/\.[cm]?js$/.test(file)) return ts.ScriptKind.JS
  return ts.ScriptKind.TS
}

/**
 * Every read of a watched variable in one file: property access
 * (`x.KEY`, `x?.KEY`), element access with a string key (`x['KEY']`), and a
 * destructured binding (`{ KEY } = x`, `{ KEY: alias } = x`).
 * Returns [{ key, line, text }].
 */
export function findReads(filePath, content) {
  const keysPresent = [...WATCHED].filter((k) => content.includes(k))
  if (keysPresent.length === 0) return []
  const sf = ts.createSourceFile(filePath, content, ts.ScriptTarget.Latest, true, scriptKind(filePath))
  const lines = content.split(/\r?\n/)
  const hits = []
  const record = (key, node) => {
    const line = sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1
    hits.push({ key, line, text: (lines[line - 1] ?? '').trim().slice(0, 140) })
  }
  const visit = (node) => {
    if (ts.isPropertyAccessExpression(node) && WATCHED.has(node.name.text)) {
      record(node.name.text, node)
    } else if (
      ts.isElementAccessExpression(node) &&
      node.argumentExpression &&
      (ts.isStringLiteral(node.argumentExpression) || ts.isNoSubstitutionTemplateLiteral(node.argumentExpression)) &&
      WATCHED.has(node.argumentExpression.text)
    ) {
      record(node.argumentExpression.text, node)
    } else if (ts.isBindingElement(node) && ts.isObjectBindingPattern(node.parent)) {
      const prop = node.propertyName ?? node.name
      const key = ts.isIdentifier(prop) || ts.isStringLiteral(prop) ? prop.text : null
      if (key && WATCHED.has(key)) record(key, node)
    }
    ts.forEachChild(node, visit)
  }
  visit(sf)
  return hits
}

/** R1 + R2 for one file, honoring the allowlist. Returns { violations, allowUsed }. */
export function checkFile(rel, content, allowlist = ALLOWLIST) {
  const violations = []
  const allowUsed = new Set()
  if (rel === HELPER_PATH) return { violations, allowUsed }
  for (const hit of findReads(rel, content)) {
    const allowKey = `${rel}::${hit.key}`
    if (allowlist.has(allowKey)) {
      allowUsed.add(allowKey)
      continue
    }
    const rule = hit.key === SITE_KEY ? 'R1' : 'R2'
    violations.push({ rule, file: rel, ...hit })
  }
  return { violations, allowUsed }
}

/**
 * R5: every string literal, template piece and JSX text in one file that holds
 * the alias host, unless the literal's first or last line, or the line directly
 * above it, carries the allow marker. Comments are not tokens, so prose about
 * the alias never trips it; a regex literal (a pattern that MATCHES the alias)
 * is not checked. Returns [{ line, text }].
 */
export function findAliasLiterals(filePath, content) {
  const lower = content.toLowerCase()
  if (!lower.includes(ALIAS_HOST)) return []
  const sf = ts.createSourceFile(filePath, content, ts.ScriptTarget.Latest, true, scriptKind(filePath))
  const lines = content.split(/\r?\n/)
  const hits = []
  const visit = (node) => {
    const isText =
      ts.isStringLiteral(node) ||
      ts.isNoSubstitutionTemplateLiteral(node) ||
      ts.isTemplateHead(node) ||
      ts.isTemplateMiddle(node) ||
      ts.isTemplateTail(node) ||
      ts.isJsxText(node)
    if (isText && node.getText(sf).toLowerCase().includes(ALIAS_HOST)) {
      const first = sf.getLineAndCharacterOfPosition(node.getStart(sf)).line
      const last = sf.getLineAndCharacterOfPosition(node.getEnd()).line
      const marked = [first - 1, first, last].some((i) => i >= 0 && (lines[i] ?? '').includes(ALLOW_MARKER))
      if (!marked && !hits.some((h) => h.line === first + 1)) {
        hits.push({ line: first + 1, text: (lines[first] ?? '').trim().slice(0, 140) })
      }
    }
    ts.forEachChild(node, visit)
  }
  visit(sf)
  return hits
}

/** R3: the helper still exists and still folds the alias into the canonical origin. */
export function checkHelper(content) {
  const problems = []
  if (content == null) return [`${HELPER_PATH} is missing; it is the one reader of ${SITE_KEY}.`]
  if (!/export const CANONICAL_SITE_ORIGIN\s*=\s*['"]https:\/\/ryan-realty\.com['"]/.test(content)) {
    problems.push(`${HELPER_PATH} must export CANONICAL_SITE_ORIGIN = 'https://ryan-realty.com'.`)
  }
  if (!/export function siteOrigin\s*\(/.test(content)) {
    problems.push(`${HELPER_PATH} must export siteOrigin().`)
  }
  const hosts = content.match(/PRODUCTION_HOSTS[^=]*=\s*new Set\(\[([\s\S]*?)\]\)/)
  for (const h of ['ryan-realty.com', 'www.ryan-realty.com', ALIAS_HOST]) {
    if (!hosts || !new RegExp(`['"]${h.replace(/\./g, '\\.')}['"]`).test(hosts[1])) {
      problems.push(`${HELPER_PATH} PRODUCTION_HOSTS must list '${h}' so it resolves to the canonical origin.`)
    }
  }
  if (!new RegExp(`process\\.env\\.${SITE_KEY}`).test(content)) {
    problems.push(`${HELPER_PATH} must read process.env.${SITE_KEY} literally (Next inlines it into client bundles).`)
  }
  return problems
}

function walk(dir, out = []) {
  let entries
  try {
    entries = readdirSync(dir, { withFileTypes: true })
  } catch {
    return out
  }
  for (const e of entries) {
    if (e.name === 'node_modules' || e.name === '.next' || e.name.startsWith('.')) continue
    const p = join(dir, e.name)
    if (e.isDirectory()) walk(p, out)
    else out.push(p)
  }
  return out
}

export function run(root, allowlist = ALLOWLIST) {
  const files = []
  for (const d of LITERAL_SCAN_DIRS) files.push(...walk(join(root, d)))
  for (const f of SCAN_ROOT_FILES) if (existsSync(join(root, f))) files.push(join(root, f))

  const violations = []
  const allowUsed = new Set()
  let scanned = 0
  for (const abs of files) {
    const rel = relative(root, abs).split(sep).join('/')
    const envScan = isScannedPath(rel)
    const literalScan = isLiteralScannedPath(rel)
    if (!envScan && !literalScan) continue
    scanned++
    const content = readFileSync(abs, 'utf8')
    if (envScan) {
      const res = checkFile(rel, content, allowlist)
      violations.push(...res.violations)
      for (const k of res.allowUsed) allowUsed.add(k)
    }
    if (literalScan) {
      for (const hit of findAliasLiterals(rel, content)) violations.push({ rule: 'R5', file: rel, key: ALIAS_HOST, ...hit })
    }
  }
  const helperAbs = join(root, HELPER_PATH)
  const helperProblems = checkHelper(existsSync(helperAbs) ? readFileSync(helperAbs, 'utf8') : null)
  const stale = [...allowlist.keys()].filter((k) => !allowUsed.has(k))
  return { scanned, violations, helperProblems, stale }
}

function main() {
  const rootArg = process.argv.indexOf('--root')
  const root = rootArg > -1 ? resolve(process.argv[rootArg + 1]) : resolve(fileURLToPath(new URL('..', import.meta.url)))
  const { scanned, violations, helperProblems, stale } = run(root)

  console.log('Site-origin gate (ci:site-origin)')
  console.log(`files scanned: ${scanned} · allowlisted exceptions: ${ALLOWLIST.size}`)
  let failed = false
  const reads = violations.filter((v) => v.rule !== 'R5')
  const literals = violations.filter((v) => v.rule === 'R5')
  if (reads.length) {
    failed = true
    console.error(`\n✗ ${reads.length} direct read(s) of a site-host variable:`)
    for (const v of reads) console.error(`  [${v.rule}] ${v.file}:${v.line}  ${v.key}  ${v.text}`)
    console.error(
      `\nThe public origin is https://ryan-realty.com, never ${ALIAS_HOST} (Matt 2026-10-07).` +
        "\nImport from '@/lib/site-origin': siteOrigin() for a URL base, siteHost() for a bare host label," +
        '\nsiteUrl(path) for one absolute URL, configuredSiteOrigin() when unset must not mean production.' +
        '\nA server-to-server self-call that truly needs another host: add it to ALLOWLIST in this file with a reason.',
    )
  }
  if (literals.length) {
    failed = true
    console.error(`\n✗ [R5] ${literals.length} literal(s) of ${ALIAS_HOST}:`)
    for (const v of literals) console.error(`  [R5] ${v.file}:${v.line}  ${v.text}`)
    console.error(
      `\nNever write ${ALIAS_HOST} in code (Matt 2026-10-07). Build the URL on siteOrigin() (lib/site-origin.ts,` +
        '\nscripts/lib/site-origin.mjs for plain-node scripts) or write https://ryan-realty.com.' +
        `\nA line that only CLASSIFIES an incoming host may carry '${ALLOW_MARKER}: <reason>' on it or the line above.`,
    )
  }
  if (helperProblems.length) {
    failed = true
    console.error('\n✗ [R3] the helper no longer holds the rule:')
    for (const p of helperProblems) console.error(`  ${p}`)
  }
  if (stale.length) {
    failed = true
    console.error('\n✗ [R4] stale ALLOWLIST entries (the read is gone; delete the entry):')
    for (const k of stale) console.error(`  ${k}`)
  }
  if (failed) process.exit(1)
  console.log(
    `✓ Every site URL goes through lib/site-origin.ts; no Vercel host variable outside the allowlist; no unmarked ${ALIAS_HOST} literal.`,
  )
}

const invokedDirectly = (() => {
  try {
    return Boolean(process.argv[1]) && realpathSync(resolve(process.argv[1])) === __filename
  } catch {
    return false
  }
})()
if (invokedDirectly) main()
