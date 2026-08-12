#!/usr/bin/env node
/**
 * check-public-v3.mjs — the functional gate for the public v3 barrel (P7, 2026-08-11).
 *
 * components/site/v3/** is exempt from the raw-primitive-element rule in
 * scripts/lint-design-tokens.js, because a primitive library's job IS to own the raw
 * button, input, and label that every other file is then forbidden to hand-roll. This
 * gate is what replaces that enforcement. Without it the exemption would be a hole.
 *
 * Rules:
 *   1. NO FOREIGN REGISTER — nothing under components/site/v3/ may import from
 *      components/site/kb, the flat legacy files at components/site/*.tsx,
 *      components/site/primitives, components/site/explore, or components/ui. The
 *      barrel is standalone: one import from any of those puts two design languages
 *      on one page, which is the defect this rebuild exists to end.
 *   2. NO RAW COLOR — outside tokens.css, no hex literals and no rgb()/hsl()/oklch()
 *      literals under components/site/v3/. Color reaches a primitive only through
 *      var(--v3-*).
 *   3. NO FORMATTING INSIDE A PRIMITIVE — no toLocaleDateString, no toLocaleString with
 *      a currency style, and no `new Intl.NumberFormat` in the barrel. Figures arrive
 *      preformatted so the number on screen is the number the caller's source trace
 *      covers (CLAUDE.md section 0), and dates go through lib/format/date.
 *   4. BARREL COMPLETENESS — every component file under components/site/v3/ is exported
 *      from index.ts. An unexported primitive is invisible to a migration, which is how
 *      a page ends up hand-rolling the thing that already exists.
 *
 * Detection is by AST (the TypeScript compiler), never by text matching, so a rule
 * cannot fire on its own explanatory comment.
 */
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs'
import { join, relative, basename } from 'node:path'
import ts from 'typescript'

const ROOT = process.cwd()
const DIR = join(ROOT, 'components/site/v3')
const INDEX = join(DIR, 'index.ts')

const FORBIDDEN_IMPORT = [
  { test: (s) => s.includes('components/site/kb'), name: 'the KB register' },
  { test: (s) => s.includes('components/site/primitives'), name: 'components/site/primitives' },
  { test: (s) => s.includes('components/site/explore'), name: 'components/site/explore' },
  { test: (s) => s.includes('components/ui'), name: 'components/ui (the admin/shadcn register)' },
  {
    test: (s) => /^@\/components\/site\/[A-Za-z0-9_-]+$/.test(s),
    name: 'the flat legacy components/site register',
  },
]

const failures = []

function tsxFiles(dir, out = []) {
  if (!existsSync(dir)) return out
  for (const name of readdirSync(dir)) {
    const full = join(dir, name)
    if (statSync(full).isDirectory()) tsxFiles(full, out)
    else if (name.endsWith('.tsx') || name.endsWith('.ts')) out.push(full)
  }
  return out
}

if (!existsSync(DIR)) {
  console.log('public-v3 gate: components/site/v3 does not exist yet, nothing to check.')
  process.exit(0)
}

const files = tsxFiles(DIR)
const componentFiles = files.filter(
  (f) => basename(f).startsWith('V3') && f.endsWith('.tsx') && !f.endsWith('.test.tsx'),
)

for (const file of files) {
  const rel = relative(ROOT, file)
  const src = readFileSync(file, 'utf8')
  const sf = ts.createSourceFile(file, src, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)

  // Rule 1 — imports, read from the AST's module specifiers only.
  const visit = (node) => {
    if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
      const spec = node.moduleSpecifier.text
      for (const f of FORBIDDEN_IMPORT) {
        if (f.test(spec)) {
          failures.push(`${rel}: imports ${f.name} (${spec}). The barrel is standalone.`)
        }
      }
    }
    // Rule 3 — formatting calls, by call expression, not by text.
    if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)) {
      const method = node.expression.name.text
      if (method === 'toLocaleDateString' || method === 'toLocaleTimeString') {
        failures.push(`${rel}: ${method}() inside a primitive. Dates arrive preformatted (lib/format/date).`)
      }
      if (method === 'toLocaleString') {
        const arg = node.arguments[1]
        const looksCurrency = arg && ts.isObjectLiteralExpression(arg) &&
          arg.properties.some((p) => p.name && ts.isIdentifier(p.name) && p.name.text === 'style')
        if (looksCurrency) {
          failures.push(`${rel}: currency formatting inside a primitive. Figures arrive preformatted.`)
        }
      }
    }
    if (
      ts.isNewExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      node.expression.name.text === 'NumberFormat'
    ) {
      failures.push(`${rel}: Intl.NumberFormat inside a primitive. Figures arrive preformatted.`)
    }
    ts.forEachChild(node, visit)
  }
  visit(sf)
}

// Rule 2 — raw color in the barrel's CSS, tokens.css excepted.
for (const name of readdirSync(DIR)) {
  if (!name.endsWith('.css') || name === 'tokens.css') continue
  const rel = relative(ROOT, join(DIR, name))
  const css = readFileSync(join(DIR, name), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')
  const hex = css.match(/#[0-9a-fA-F]{3,8}\b/g)
  const fn = css.match(/\b(?:rgba?|hsla?|oklch)\(/g)
  if (hex) failures.push(`${rel}: raw hex ${[...new Set(hex)].join(', ')}. Color comes from var(--v3-*).`)
  if (fn) failures.push(`${rel}: raw color function ${[...new Set(fn)].join(', ')}. Color comes from var(--v3-*).`)
}

// Rule 4 — barrel completeness.
if (existsSync(INDEX)) {
  const index = readFileSync(INDEX, 'utf8')
  for (const file of componentFiles) {
    const stem = basename(file).replace(/\.tsx$/, '')
    if (!index.includes(`./${stem}`)) {
      failures.push(`${relative(ROOT, file)}: not exported from components/site/v3/index.ts.`)
    }
  }
} else {
  failures.push('components/site/v3/index.ts is missing. The barrel needs one entry point.')
}

console.log('public-v3 barrel gate (ci:public-v3)')
console.log('====================================')
console.log(`${files.length} files scanned, ${componentFiles.length} primitives.`)
if (failures.length) {
  console.log(`\n${failures.length} violation(s):`)
  for (const f of failures) console.log(`  - ${f}`)
  console.log(
    '\nThe barrel is the pressure valve: add a primitive or a prop here, never reach into another register.',
  )
  process.exit(1)
}
console.log('OK - barrel is standalone, token-pure, format-free, and fully exported.')
