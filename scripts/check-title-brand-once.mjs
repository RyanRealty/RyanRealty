#!/usr/bin/env node
/**
 * check-title-brand-once.mjs — ci:title-brand-once (§6).
 *
 * THE BRAND GOES IN THE SERP TITLE ONCE.
 *
 * app/layout.tsx owns the one place it is added: `title.template` is
 * "%s | Ryan Realty — Central Oregon", and Next appends it to every page title
 * that is not `title: { absolute }`. lib/site/page-metadata.ts exists partly to
 * make that safe — its `cleanTitle` strips a brand a caller (or a DB seoTitle)
 * already baked in, precisely so the template cannot double-brand.
 *
 * A route that hand-builds its Metadata object skips cleanTitle, so a baked
 * brand survives and meets the template's:
 *
 *   /reports/sales/la-pine/last-year
 *     "La Pine: Last Year's Sales | Ryan Realty | Ryan Realty — Central Oregon"
 *   /housing-market/reports/archive/bend
 *     "Bend home sales archive | Ryan Realty | Ryan Realty — Central Oregon"
 *
 * Both shipped live. Prose did not stop them — cleanTitle had existed for
 * months and two routes simply did not call it — so the rule is mechanical
 * (SITE-26).
 *
 * THE RULE. In app/**\/page.tsx and app/**\/layout.tsx, a DOCUMENT-level
 * `title:` may not be a string literal or template containing "Ryan Realty".
 *
 * What is allowed, and why:
 *   - `title:` passed as an argument to `pageMetadata(...)` — that IS the fix.
 *     cleanTitle strips a trailing "<sep> Ryan Realty ..." before the template
 *     runs, so the string in the source is not the string in the document. The
 *     gate therefore checks what reaches Next, not what the author typed.
 *   - `title: { absolute: '... Ryan Realty ...' }` — `absolute` explicitly
 *     opts out of the layout template, so the brand appears exactly once. This
 *     is the escape hatch; use it when a page really must own its whole title.
 *   - `openGraph.title` and `twitter.title` — social cards get no template
 *     appended, so they carry the brand themselves by design.
 *   - `title.default` / `title.template` — the root layout's own declaration of
 *     the suffix. Those keys ARE the mechanism, not a violation of it.
 *
 * RATCHET. The direct-assignment sites that predate this gate are a frozen
 * ledger in scripts/title-brand-once-baseline.json, not an exemption: a file
 * not listed may not double-brand at all, and the list may only shrink. Passing
 * --write-baseline re-records it, which is how a fixed file comes off.
 *
 * MECHANISM. AST (typescript compiler), not grep: the flagged shapes are a
 * `title:` property assignment and a `title` shorthand whose local const holds
 * the branded string — the second is the exact shape both live defects used
 * (`const title = \`...| Ryan Realty\``, then `return { title, ... }`), and a
 * regex over the property name cannot see it.
 *
 * Usage:
 *   node scripts/check-title-brand-once.mjs                  # CI
 *   node scripts/check-title-brand-once.mjs --root DIR       # fixture tree (tests)
 *   node scripts/check-title-brand-once.mjs --json
 *   node scripts/check-title-brand-once.mjs --write-baseline
 */
import { readFileSync, readdirSync, statSync, existsSync, writeFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import ts from 'typescript'

const argv = process.argv.slice(2)
const rootFlag = argv.indexOf('--root')
const ROOT = rootFlag >= 0 ? argv[rootFlag + 1] : process.cwd()
const JSON_OUT = argv.includes('--json')
const WRITE_BASELINE = argv.includes('--write-baseline')
const BASELINE_PATH = join(ROOT, 'scripts/title-brand-once-baseline.json')

const BRAND = 'Ryan Realty'
/** Social cards append no template, so they carry the brand on purpose. */
const SOCIAL_KEYS = new Set(['openGraph', 'twitter'])
/**
 * Builders that run the title through lib/site/page-metadata.ts cleanTitle
 * before Next sees it. Adding a name here asserts that it strips a baked brand;
 * check the function before you do.
 */
const CLEANING_BUILDERS = new Set(['pageMetadata'])
const TARGET_FILES = new Set(['page.tsx', 'page.ts', 'layout.tsx', 'layout.ts'])
const SKIP_DIRS = new Set(['node_modules', '.next', 'api'])

function walk(dir, acc = []) {
  let entries
  try {
    entries = readdirSync(dir)
  } catch {
    return acc
  }
  for (const entry of entries) {
    const full = join(dir, entry)
    let st
    try {
      st = statSync(full)
    } catch {
      continue
    }
    if (st.isDirectory()) {
      if (SKIP_DIRS.has(entry)) continue
      walk(full, acc)
    } else if (TARGET_FILES.has(entry)) {
      acc.push(full)
    }
  }
  return acc
}

/** A string literal or template whose full text carries the brand. */
function brandedText(node) {
  if (!node) return null
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
    return node.text.includes(BRAND) ? node.text : null
  }
  if (ts.isTemplateExpression(node)) {
    const text =
      node.head.text + node.templateSpans.map((span) => span.literal.text).join('')
    return text.includes(BRAND) ? text : null
  }
  // `a + ' | Ryan Realty'` — concatenation is a literal by another name.
  if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.PlusToken) {
    return brandedText(node.left) ?? brandedText(node.right)
  }
  if (ts.isParenthesizedExpression(node)) return brandedText(node.expression)
  return null
}

function propertyName(node) {
  const name = node.name
  if (!name) return null
  if (ts.isIdentifier(name) || ts.isStringLiteral(name)) return name.text
  return null
}

/**
 * True when this node sits inside an `openGraph:` / `twitter:` object, or
 * inside a `pageMetadata(...)` argument. Both mean the literal is not the
 * document title: social cards get no template appended, and pageMetadata runs
 * the string through cleanTitle first.
 */
function exempt(node) {
  for (let p = node.parent; p; p = p.parent) {
    if (ts.isPropertyAssignment(p) && SOCIAL_KEYS.has(propertyName(p) ?? '')) return true
    if (ts.isCallExpression(p)) {
      const callee = p.expression
      const name = ts.isIdentifier(callee)
        ? callee.text
        : ts.isPropertyAccessExpression(callee)
          ? callee.name.text
          : ''
      if (CLEANING_BUILDERS.has(name)) return true
    }
  }
  return false
}

function lineOf(sourceFile, node) {
  return sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1
}

function scanFile(file) {
  const src = readFileSync(file, 'utf8')
  if (!src.includes(BRAND)) return []
  const sourceFile = ts.createSourceFile(file, src, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)

  // Local `const title = <branded>` declarations, so a shorthand `title` in a
  // returned object can be resolved back to its literal.
  const brandedLocals = new Map()
  const violations = []

  const collect = (node) => {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name)) {
      const text = brandedText(node.initializer)
      if (text) brandedLocals.set(node.name.text, { text, node })
    }
    ts.forEachChild(node, collect)
  }
  collect(sourceFile)

  const visit = (node) => {
    if (ts.isPropertyAssignment(node) && propertyName(node) === 'title') {
      if (!exempt(node)) {
        const text = brandedText(node.initializer)
        if (text) {
          violations.push({
            file,
            line: lineOf(sourceFile, node),
            shape: 'title: <branded literal>',
            title: text,
          })
        }
      }
    }
    if (ts.isShorthandPropertyAssignment(node) && node.name.text === 'title') {
      if (!exempt(node)) {
        const local = brandedLocals.get('title')
        if (local) {
          violations.push({
            file,
            line: lineOf(sourceFile, node),
            shape: 'title, (shorthand for a branded local)',
            title: local.text,
          })
        }
      }
    }
    ts.forEachChild(node, visit)
  }
  visit(sourceFile)
  return violations
}

const appDir = join(ROOT, 'app')
if (!existsSync(appDir)) {
  console.log('title-brand-once gate (ci:title-brand-once)')
  console.log('===========================================')
  console.log(`No app/ directory under ${ROOT} — nothing to check.`)
  process.exit(0)
}

const files = walk(appDir)
const violations = files.flatMap(scanFile)
const offendingFiles = [...new Set(violations.map((v) => relative(ROOT, v.file)))].sort()

if (WRITE_BASELINE) {
  writeFileSync(
    BASELINE_PATH,
    JSON.stringify(
      {
        note:
          'Files whose document-level title bakes in "Ryan Realty" while the layout template appends it too. ' +
          'Frozen ledger for ci:title-brand-once — the list may only shrink. Fix by routing the Metadata ' +
          'through pageMetadata(), or by declaring title: { absolute } when the page owns its whole title.',
        files: offendingFiles,
      },
      null,
      2,
    ) + '\n',
  )
  console.log(`Wrote ${offendingFiles.length} file(s) to ${relative(ROOT, BASELINE_PATH)}`)
  process.exit(0)
}

const baseline = new Set(
  existsSync(BASELINE_PATH) ? (JSON.parse(readFileSync(BASELINE_PATH, 'utf8')).files ?? []) : [],
)
const newViolations = violations.filter((v) => !baseline.has(relative(ROOT, v.file)))

if (JSON_OUT) {
  console.log(
    JSON.stringify(
      {
        gate: 'ci:title-brand-once',
        scanned: files.length,
        baseline: [...baseline].sort(),
        violations: newViolations.map((v) => ({ ...v, file: relative(ROOT, v.file) })),
      },
      null,
      2,
    ),
  )
  process.exit(newViolations.length ? 1 : 0)
}

console.log('title-brand-once gate (ci:title-brand-once)')
console.log('===========================================')
console.log(
  `${files.length} app page/layout files scanned · ${violations.length} baked-brand title(s) (baseline ${baseline.size} file(s))`,
)

if (newViolations.length) {
  console.error('')
  console.error('A document title bakes in the brand the layout template already appends:')
  for (const v of newViolations) {
    console.error(`  ✗ ${relative(ROOT, v.file)}:${v.line}  ${v.shape}`)
    console.error(`      "${v.title}"  →  "${v.title} | Ryan Realty — Central Oregon"`)
  }
  console.error('')
  console.error('Fix: build the Metadata through pageMetadata() in lib/site/page-metadata.ts')
  console.error('(its cleanTitle strips the baked brand), or, if the page really must own its')
  console.error('whole title, declare it as `title: { absolute: "..." }` so the layout template')
  console.error('does not apply. openGraph.title and twitter.title are exempt — social cards')
  console.error('get no template and carry the brand themselves.')
  process.exit(1)
}

console.log('OK — every document title carries the brand at most once.')
process.exit(0)
