#!/usr/bin/env node
/**
 * check-google-deadline.mjs (ci:google-deadline) — G82
 *
 * Every Google API call from runtime code has a deadline. google-auth-library
 * gives a service-account JWT's token POST no timeout of its own, and a
 * googleapis request has none unless its client is built with one, so a
 * stalled Google endpoint held a cron or a page render until the platform
 * killed it. Fixing the clients by hand missed two (lib/data/brokers/
 * workspace-sync.ts and lib/crawl-probe/gsc.ts, code review 2026-09-25), so
 * the rule is mechanical:
 *
 *   R1  every `new <x>.JWT(...)` / `new JWT(...)` under app/ or lib/ takes
 *       `withAuthDeadline({ ... })` (lib/google-deadline.ts) as its argument.
 *   R2  in a file that loads googleapis (static or dynamic import), every
 *       client built from an options object carrying `version` also sets
 *       `timeout` in that object.
 *   R3  the helper still exists and still sets transporterOptions.timeout, and
 *       the scan found at least one JWT and one client: a scan that finds
 *       nothing is broken, not clean.
 *
 * AST, never regex: a comment or a string cannot trip it. Out of scope:
 * scripts/ (one-off local tools), tests.
 *
 * Usage: node scripts/check-google-deadline.mjs [--json]
 * Break-tests: scripts/__tests__/check-google-deadline.test.mjs
 */
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

export const HELPER = 'lib/google-deadline.ts'
const HELPER_NAME = 'withAuthDeadline'
const SOURCE_EXT = /\.(ts|tsx|js|jsx|mjs|cjs)$/
const OUT_OF_SCOPE = [/\.d\.ts$/, /(^|\/)__tests__\//, /\.(test|spec)\.[cm]?[jt]sx?$/]

function isGoogleapis(node) {
  return Boolean(node && ts.isStringLiteralLike(node) && (node.text === 'googleapis' || node.text.startsWith('googleapis/')))
}

function propertyNames(obj) {
  const names = new Set()
  for (const p of obj.properties) {
    if ((ts.isPropertyAssignment(p) || ts.isShorthandPropertyAssignment(p)) && p.name && ts.isIdentifier(p.name)) {
      names.add(p.name.text)
    }
  }
  return names
}

/** { violations, jwts, clients } for one file's source. */
export function scanSource(rel, text) {
  const out = { violations: [], jwts: 0, clients: 0 }
  if (!text.includes('JWT') && !text.includes('googleapis')) return out
  const sf = ts.createSourceFile(rel, text, ts.ScriptTarget.Latest, true, rel.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS)
  const at = (node) => `${rel}:${sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1}`

  let loadsGoogleapis = false
  const versionObjects = []
  const visit = (node) => {
    if (ts.isImportDeclaration(node) && isGoogleapis(node.moduleSpecifier)) loadsGoogleapis = true
    if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword && isGoogleapis(node.arguments[0])) {
      loadsGoogleapis = true
    }
    if (ts.isNewExpression(node)) {
      const callee = node.expression
      const isJwt =
        (ts.isIdentifier(callee) && callee.text === 'JWT') ||
        (ts.isPropertyAccessExpression(callee) && callee.name.text === 'JWT')
      if (isJwt) {
        out.jwts++
        const arg = node.arguments?.[0]
        const wrapped = arg && ts.isCallExpression(arg) && ts.isIdentifier(arg.expression) && arg.expression.text === HELPER_NAME
        if (!wrapped) {
          out.violations.push(
            `${at(node)} R1: builds a JWT without ${HELPER_NAME}(...), so its token POST has no timeout`,
          )
        }
      }
    }
    if (ts.isCallExpression(node) && node.arguments.length === 1 && ts.isObjectLiteralExpression(node.arguments[0])) {
      const names = propertyNames(node.arguments[0])
      if (names.has('version')) versionObjects.push({ node, names })
    }
    ts.forEachChild(node, visit)
  }
  visit(sf)

  if (loadsGoogleapis) {
    for (const { node, names } of versionObjects) {
      out.clients++
      if (!names.has('timeout')) {
        out.violations.push(`${at(node)} R2: builds a Google API client with no timeout, so a stalled request never fails`)
      }
    }
  }
  return out
}

/** R3 (first half): the helper exists and still sets the transporter timeout. */
export function checkHelper(text) {
  if (text == null) return [`${HELPER} is missing: it holds ${HELPER_NAME}, the one way to build a JWT`]
  const problems = []
  if (!new RegExp(`export function ${HELPER_NAME}\\b`).test(text)) problems.push(`${HELPER} no longer exports ${HELPER_NAME}`)
  if (!/transporterOptions:\s*\{\s*timeout:\s*GOOGLE_AUTH_TIMEOUT_MS\s*\}/.test(text)) {
    problems.push(`${HELPER}: ${HELPER_NAME} no longer sets transporterOptions: { timeout: GOOGLE_AUTH_TIMEOUT_MS }`)
  }
  return problems
}

export function inScope(rel) {
  return /^(app|lib)\//.test(rel) && SOURCE_EXT.test(rel) && !OUT_OF_SCOPE.some((re) => re.test(rel))
}

/** Full audit of a tree, given its file list (repo-relative, forward slashes). */
export function audit(root, files) {
  const violations = []
  let jwts = 0
  let clients = 0
  for (const rel of files) {
    if (!inScope(rel)) continue
    const full = join(root, rel)
    if (!existsSync(full)) continue
    const r = scanSource(rel, readFileSync(full, 'utf8'))
    violations.push(...r.violations)
    jwts += r.jwts
    clients += r.clients
  }
  const helperPath = join(root, HELPER)
  violations.push(...checkHelper(existsSync(helperPath) ? readFileSync(helperPath, 'utf8') : null))
  if (jwts === 0) violations.push('R3: found no JWT under app/ or lib/: the scan is broken, not clean')
  if (clients === 0) violations.push('R3: found no Google API client under app/ or lib/: the scan is broken, not clean')
  return { violations, jwts, clients }
}

export function listFiles(root) {
  const out = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '-z'], {
    cwd: root,
    encoding: 'utf8',
    maxBuffer: 256 * 1024 * 1024,
  })
  return [...new Set(out.split('\0').filter(Boolean))]
}

function main() {
  const root = join(dirname(fileURLToPath(import.meta.url)), '..')
  const args = new Set(process.argv.slice(2))
  const { violations, jwts, clients } = audit(root, listFiles(root))
  if (args.has('--json')) {
    console.log(JSON.stringify({ ok: violations.length === 0, jwts, clients, violations }, null, 2))
  } else if (violations.length === 0) {
    console.log(`ci:google-deadline: OK. ${jwts} JWT(s) built through ${HELPER_NAME}, ${clients} Google API client(s) with a timeout.`)
  } else {
    console.error(`ci:google-deadline: ${violations.length} problem(s)`)
    for (const v of violations) console.error(`  - ${v}`)
    console.error(
      `\nBuild a service-account JWT as new google.auth.JWT(${HELPER_NAME}({ ... })) from '@/lib/google-deadline', and give every googleapis client a timeout.`,
    )
  }
  process.exit(violations.length === 0 ? 0 : 1)
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main()
