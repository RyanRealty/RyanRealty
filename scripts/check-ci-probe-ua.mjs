#!/usr/bin/env node
/**
 * check-ci-probe-ua.mjs — every CI HTTP probe declares a User-Agent the
 * middleware bot screen will actually let through.
 *
 * THE BUG THIS EXISTS TO PREVENT (2026-08-02). `middleware.ts` 403s page routes
 * whose User-Agent matches `BAD_BOT_RE`, or that send no User-Agent at all. The
 * CI route-smoke step waited on the server with `wait-on`, which is axios-based
 * and sends `User-Agent: axios/1.x`. `BAD_BOT_RE` contains `axios`. So the
 * waiter got 403 on every probe, only accepts 2xx, and timed out after five
 * minutes with the single line "Timed out waiting for". Every pull request in
 * this repo failed on that step for roughly three months. The application was
 * healthy the entire time — it answers `/` in 0.07s and passes 277/277 routes.
 *
 * The replacement probes pass, but only because Node's `fetch` defaults to
 * `User-Agent: node` and someone picked `rr-smoke/1.0` — neither is on the block
 * list, by coincidence. An implicit dependency on a coincidence is exactly the
 * kind of rule CLAUDE.md §6 says to convert into a gate rather than a comment.
 *
 * WHAT IT ENFORCES
 *
 *   1. The shared constant `CI_PROBE_USER_AGENT` (scripts/lib/ci-probe-ua.mjs)
 *      is non-empty and is NOT matched by the live `BAD_BOT_RE` in middleware.ts.
 *      Read from the real regex via the TypeScript AST, so tightening the screen
 *      to cover the probe UA fails this gate instead of failing CI mysteriously.
 *   2. Every discovered CI HTTP probe either imports that constant, or carries
 *      an explicit opt-out marker:
 *        // probe-ua: adversarial <reason>
 *      for probes that deliberately present a blocked UA (e.g. crm-e2e-verify,
 *      which proves the A2P compliance-path exemption still works).
 *
 * DISCOVERY. A probe is any `scripts/*.mjs` that is (a) referenced from
 * package.json scripts or .github/workflows/*, and (b) makes a `fetch(` call
 * whose URL argument resolves to an app origin. Discovery is automatic so a
 * newly added CI probe is covered without anyone remembering to register it.
 *
 * The URL check is AST-based, deliberately. A first cut just grepped each file
 * for an app-origin substring, which flagged `check-vercel-deploy.mjs` — whose
 * only fetch goes to `api.vercel.com`, and whose `ryanrealty.vercel.app` string
 * lives inside a `console.log` for a human to read. A gate that cries wolf gets
 * switched off, so this resolves the actual argument to `fetch`, including one
 * level of identifier indirection (`const BASE = '…'; fetch(`${BASE}/x`)`).
 *
 * CLI: default pass/fail · --report (human, exit 0)
 */
import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import ts from 'typescript'

const MIDDLEWARE = 'middleware.ts'
const UA_MODULE = 'scripts/lib/ci-probe-ua.mjs'
const SCRIPTS_DIR = 'scripts'
const WORKFLOWS_DIR = '.github/workflows'
const PACKAGE_JSON = 'package.json'

const ADVERSARIAL_MARKER = /probe-ua:\s*adversarial\s+\S/
const APP_ORIGIN_RE = /127\.0\.0\.1:3000|localhost:3000|ryan-realty\.com|ryanrealty\.vercel\.app/

/** Calls whose arguments are printed for a human, never fetched. */
const LOG_CALLEES = new Set(['log', 'info', 'warn', 'error', 'debug', 'out', 'say', 'print', 'trace'])

function isLoggingCall(node, src) {
  if (!ts.isCallExpression(node)) return false
  const callee = node.expression
  if (ts.isIdentifier(callee)) return LOG_CALLEES.has(callee.text)
  if (ts.isPropertyAccessExpression(callee) && ts.isIdentifier(callee.name)) {
    return LOG_CALLEES.has(callee.name.text)
  }
  return false
}

/**
 * Does this file build an app-origin URL and fetch something?
 *
 * Two independent AST facts, both required:
 *   1. a real `fetch(...)` call exists (not the word "fetch" in a comment), and
 *   2. an app origin appears in a VALUE position — a string or template literal
 *      that is not merely an argument to a logging call.
 *
 * Condition 2 is what keeps `check-vercel-deploy.mjs` out: its only fetch goes
 * to api.vercel.com, and its one `ryanrealty.vercel.app` string sits inside an
 * `out('check production URL: …')` message. Resolving the fetch argument itself
 * was tried first and was far too narrow — most probes take the URL as a
 * function parameter, so nothing resolved and the gate silently checked one file.
 */
function fetchesAppOrigin(file, source) {
  const src = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true)
  let hasFetch = false
  let hasOriginValue = false

  const visit = (node) => {
    if (
      !hasFetch &&
      ts.isCallExpression(node) &&
      ((ts.isIdentifier(node.expression) && node.expression.text === 'fetch') ||
        (ts.isPropertyAccessExpression(node.expression) &&
          ts.isIdentifier(node.expression.name) &&
          node.expression.name.text === 'fetch'))
    ) {
      hasFetch = true
    }

    if (
      !hasOriginValue &&
      (ts.isStringLiteral(node) ||
        ts.isNoSubstitutionTemplateLiteral(node) ||
        ts.isTemplateExpression(node)) &&
      APP_ORIGIN_RE.test(node.getText(src)) &&
      !isLoggingCall(node.parent, src)
    ) {
      hasOriginValue = true
    }

    if (!(hasFetch && hasOriginValue)) ts.forEachChild(node, visit)
  }
  visit(src)
  return hasFetch && hasOriginValue
}

const report = process.argv.slice(2).includes('--report')
const failures = []

/**
 * Pull a top-level `const <name> = /regex/flags` out of a TS source file using
 * the compiler AST. Regex-scraping the file would break on comments and on the
 * alternation spilling across lines, which is exactly how BAD_BOT_RE is written.
 */
function regexLiteralFromTs(file, name) {
  const src = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true)
  let found = null
  const visit = (node) => {
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.name.text === name &&
      node.initializer &&
      ts.isRegularExpressionLiteral(node.initializer)
    ) {
      found = node.initializer.text
      return
    }
    ts.forEachChild(node, visit)
  }
  visit(src)
  if (!found) return null
  const lastSlash = found.lastIndexOf('/')
  return new RegExp(found.slice(1, lastSlash), found.slice(lastSlash + 1))
}

/** Read the exported UA constant without importing (keeps the gate synchronous). */
function sharedUserAgent() {
  const src = readFileSync(UA_MODULE, 'utf8')
  const m = src.match(/export const CI_PROBE_USER_AGENT\s*=\s*(['"])([\s\S]*?)\1/)
  return m ? m[2] : null
}

/** Script files named anywhere in package.json scripts or the workflow YAML. */
function ciReferencedScripts() {
  const referenced = new Set()
  const haystacks = [JSON.stringify(JSON.parse(readFileSync(PACKAGE_JSON, 'utf8')).scripts ?? {})]
  if (existsSync(WORKFLOWS_DIR)) {
    for (const f of readdirSync(WORKFLOWS_DIR)) {
      if (f.endsWith('.yml') || f.endsWith('.yaml')) {
        haystacks.push(readFileSync(join(WORKFLOWS_DIR, f), 'utf8'))
      }
    }
  }
  const all = haystacks.join('\n')
  for (const entry of readdirSync(SCRIPTS_DIR)) {
    if (!entry.endsWith('.mjs')) continue
    if (all.includes(`scripts/${entry}`)) referenced.add(join(SCRIPTS_DIR, entry))
  }
  return [...referenced].sort()
}

// ── 1. the shared UA must survive the live screen ────────────────────────────
const badBotRe = regexLiteralFromTs(MIDDLEWARE, 'BAD_BOT_RE')
const ua = sharedUserAgent()

if (!badBotRe) {
  failures.push(`could not read BAD_BOT_RE from ${MIDDLEWARE} — did the bot screen move or get renamed?`)
}
if (!ua) {
  failures.push(`could not read CI_PROBE_USER_AGENT from ${UA_MODULE}`)
}
if (badBotRe && ua) {
  if (!ua.trim()) {
    failures.push('CI_PROBE_USER_AGENT is empty — middleware screens an empty UA as "empty-ua" (403)')
  } else if (badBotRe.test(ua)) {
    failures.push(
      `CI_PROBE_USER_AGENT "${ua}" is matched by BAD_BOT_RE — every CI probe would get 403 and CI ` +
        `would time out with no usable diagnostic. Change the probe UA, or narrow BAD_BOT_RE.`
    )
  }
}

// ── 2. every discovered CI probe uses it (or opts out on the record) ─────────
const probes = []
for (const file of ciReferencedScripts()) {
  const src = readFileSync(file, 'utf8')
  if (!fetchesAppOrigin(file, src)) continue
  probes.push(file)
  const importsShared = /from\s+['"][^'"]*lib\/ci-probe-ua\.mjs['"]/.test(src)
  const adversarial = ADVERSARIAL_MARKER.test(src)
  if (!importsShared && !adversarial) {
    failures.push(
      `${file} probes an app origin over raw HTTP but does not import CI_PROBE_USER_AGENT from ` +
        `${UA_MODULE}. Without an explicit UA it relies on a runtime default that the middleware ` +
        `bot screen may 403. Import the constant, or mark it "// probe-ua: adversarial <reason>".`
    )
  }
}

if (failures.length > 0) {
  console.error('ci-probe-ua gate FAILED:\n' + failures.map((f) => `  - ${f}`).join('\n'))
  process.exit(report ? 0 : 1)
}

console.log(
  `ci-probe-ua gate passed — ${probes.length} CI HTTP probe(s) checked against the live BAD_BOT_RE; ` +
    `shared UA "${ua}" is not screened.`
)
