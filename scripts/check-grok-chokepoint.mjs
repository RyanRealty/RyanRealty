#!/usr/bin/env node
/**
 * check-grok-chokepoint.mjs — every xAI call goes through lib/grok (CLAUDE.md §4).
 *
 * WHY (2026-09-04). `app/api/ai/chat` and `app/api/ai/generate-text` each held
 * their own `process.env.XAI_API_KEY` and their own `fetch('https://api.x.ai/…')`
 * with a hardcoded `grok-2-1212`, so they were invisible to ci:grok-models and
 * to the Studio spend ledger. Nothing in the repo called either one. Both were
 * public POST routes with no auth and a fail-open rate limiter, and a probe with
 * an empty body reached the paid API and came back "AI API error: 400" — an
 * anonymous request on the open internet spending Matt's key.
 *
 * The chokepoint is the fix, so the chokepoint is the gate: outside lib/grok,
 * production code may not name the xAI host or read its key.
 *
 * AST via the TypeScript compiler, never regex (repo convention): a string in a
 * comment or a doc block is not a call, and a regex cannot tell the difference.
 *
 * Usage: node scripts/check-grok-chokepoint.mjs
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import ts from 'typescript'

const ROOT = process.cwd()
const SCAN = ['app', 'lib']
/** The chokepoint itself, plus tests which assert on the host string. */
const ALLOWED_PREFIX = 'lib/grok/'
const XAI_HOST = 'api.x.ai'
const XAI_KEY = 'XAI_API_KEY'

function walk(dir, out = []) {
  let entries
  try {
    entries = readdirSync(join(ROOT, dir))
  } catch {
    return out
  }
  for (const name of entries) {
    const rel = join(dir, name)
    const abs = join(ROOT, rel)
    let st
    try {
      st = statSync(abs)
    } catch {
      continue
    }
    if (st.isDirectory()) {
      if (name === 'node_modules' || name === '.next') continue
      walk(rel, out)
    } else if (/\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name)) {
      out.push(rel)
    }
  }
  return out
}

const failures = []

for (const dir of SCAN) {
  for (const file of walk(dir)) {
    const posix = file.split('\\').join('/')
    if (posix.startsWith(ALLOWED_PREFIX)) continue
    const source = readFileSync(join(ROOT, file), 'utf8')
    // Cheap pre-filter: parsing every file in app/ + lib/ is the slow path.
    if (!source.includes(XAI_HOST) && !source.includes(XAI_KEY)) continue
    const sf = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true)

    const visit = (node) => {
      // A string literal naming the xAI host — a direct call site.
      if (
        (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) &&
        node.text.includes(XAI_HOST)
      ) {
        const { line } = sf.getLineAndCharacterOfPosition(node.getStart(sf))
        failures.push(`${posix}:${line + 1} names ${XAI_HOST} outside ${ALLOWED_PREFIX}`)
      }
      // process.env.XAI_API_KEY — its own credential read.
      if (ts.isPropertyAccessExpression(node) && node.name.text === XAI_KEY) {
        const { line } = sf.getLineAndCharacterOfPosition(node.getStart(sf))
        failures.push(`${posix}:${line + 1} reads ${XAI_KEY} outside ${ALLOWED_PREFIX}`)
      }
      // process.env['XAI_API_KEY']
      if (
        ts.isElementAccessExpression(node) &&
        node.argumentExpression &&
        ts.isStringLiteral(node.argumentExpression) &&
        node.argumentExpression.text === XAI_KEY
      ) {
        const { line } = sf.getLineAndCharacterOfPosition(node.getStart(sf))
        failures.push(`${posix}:${line + 1} reads ${XAI_KEY} outside ${ALLOWED_PREFIX}`)
      }
      ts.forEachChild(node, visit)
    }
    visit(sf)
  }
}

if (failures.length > 0) {
  console.error(`✗ grok-chokepoint: ${failures.length} xAI call site(s) outside ${ALLOWED_PREFIX}:\n`)
  for (const f of failures) console.error(`  • ${f}`)
  console.error(
    `\n  Route it through lib/grok (CLAUDE.md §4). A path with its own key and its own\n` +
      `  host is invisible to ci:grok-models and to the spend ledger, and every one so far\n` +
      `  has ended up unauthenticated.`,
  )
  process.exit(1)
}

console.log(`✓ grok-chokepoint: every xAI call site is inside ${ALLOWED_PREFIX}.`)
