#!/usr/bin/env node
/**
 * check-no-public-em-dash.mjs — ci:no-public-em-dash (SITE-145).
 *
 * Matt lock 2026-09-20: NEVER use em dashes (U+2014) in Ryan Realty public
 * site copy, headers, or captions. Prefer colon, period, comma, or rewrite.
 * Plain ` -- ` used as a dash is the same refuse.
 *
 * Scope: public new-construction + home/search string literals, including
 * the "Central Oregon right now" pulse in app/_v3/home-pulse.ts. Comments
 * in other files, markdown docs, *.test.* files, console.* logs, and
 * `new Error(...)` text are out of scope. home-pulse.ts must also stay
 * U+2014-free in comments (SITE-145 Cos widen).
 *
 * Usage:
 *   node scripts/check-no-public-em-dash.mjs
 */
import { existsSync, readFileSync, statSync } from 'node:fs'
import { relative } from 'node:path'
import ts from 'typescript'
import { walkFiles } from './lib/walk.mjs'

const EM = '\u2014'
const DOUBLE_HYPHEN_DASH = / -- /

const ROOTS = [
  'lib/site/bend-new-construction.ts',
  'app/new-construction',
  'app/page.tsx',
  'app/search',
  'app/_v3',
  'app/_v3/home-pulse.ts',
]

const SKIP_TEST = /\.(test|spec)\.(ts|tsx)$/
/** Cos SITE-145 widen: this pulse module may not hide U+2014 in comments. */
const WHOLE_FILE_CLEAN = ['app/_v3/home-pulse.ts']

function collectFiles() {
  const files = []
  for (const root of ROOTS) {
    if (!existsSync(root)) continue
    if (statSync(root).isDirectory()) {
      files.push(...walkFiles(root))
    } else {
      files.push(root)
    }
  }
  return [...new Set(files)]
    .filter((file) => !SKIP_TEST.test(file))
    .sort()
}

/**
 * @param {string} text
 * @param {number} pos
 * @param {ts.SourceFile} source
 * @param {string} rel
 * @param {string[]} fails
 */
function checkText(text, pos, source, rel, fails) {
  if (!text) return
  const { line } = source.getLineAndCharacterOfPosition(pos)
  const loc = `${rel}:${line + 1}`
  if (text.includes(EM)) {
    fails.push(`${loc}: U+2014 em dash in public copy. Prefer colon, period, comma, or rewrite.`)
  }
  if (DOUBLE_HYPHEN_DASH.test(text)) {
    fails.push(`${loc}: \` -- \` used as a dash in public copy. Prefer colon, period, comma, or rewrite.`)
  }
}

function isConsoleCallee(expr) {
  return ts.isPropertyAccessExpression(expr) && ts.isIdentifier(expr.expression) && expr.expression.text === 'console'
}

function isErrorCtor(expr) {
  return ts.isIdentifier(expr) && expr.text === 'Error'
}

/** Logs and thrown Error() text are not public site copy. */
function skipPublicCopy(node) {
  if (ts.isCallExpression(node) && isConsoleCallee(node.expression)) return true
  if (ts.isNewExpression(node) && node.expression && isErrorCtor(node.expression)) return true
  if (ts.isCallExpression(node) && isErrorCtor(node.expression)) return true
  return false
}

/**
 * @param {ts.Node} node
 * @param {ts.SourceFile} source
 * @param {string} rel
 * @param {string[]} fails
 */
function visit(node, source, rel, fails) {
  if (skipPublicCopy(node)) return
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
    checkText(node.text, node.getStart(source), source, rel, fails)
  } else if (ts.isTemplateExpression(node)) {
    checkText(node.head.text, node.head.getStart(source), source, rel, fails)
    for (const span of node.templateSpans) {
      checkText(span.literal.text, span.literal.getStart(source), source, rel, fails)
    }
  } else if (ts.isJsxText(node)) {
    checkText(node.getText(source), node.getStart(source), source, rel, fails)
  }
  ts.forEachChild(node, (child) => visit(child, source, rel, fails))
}

const files = collectFiles()
const fails = []

for (const file of files) {
  const code = readFileSync(file, 'utf8')
  const rel = relative(process.cwd(), file)
  const kind = file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS
  const source = ts.createSourceFile(rel, code, ts.ScriptTarget.Latest, true, kind)
  visit(source, source, rel, fails)
}

for (const file of WHOLE_FILE_CLEAN) {
  if (!existsSync(file)) continue
  const code = readFileSync(file, 'utf8')
  if (code.includes(EM)) {
    fails.push(`${file}: U+2014 anywhere in this file, including comments. Rewrite with colon, period, or comma.`)
  }
}

console.log('public em-dash gate (ci:no-public-em-dash)')
console.log('=========================================')
console.log(`Scanned ${files.length} NC/home/search source files`)

if (fails.length === 0) {
  console.log('\nOK: public NC/home string literals have no U+2014 and no ` -- ` dash.')
  process.exit(0)
}

console.log(`\n${fails.length} public em-dash / double-hyphen dash hit(s):`)
for (const fail of fails) console.log(`  ${fail}`)
console.log('\nMatt lock 2026-09-20: never use em dashes in public site copy, headers, or captions.')
process.exit(1)
