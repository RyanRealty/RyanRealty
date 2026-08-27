#!/usr/bin/env node
/**
 * check-identity-stamp.mjs — every link we send must be able to identify who we
 * sent it to (2026-08-26).
 *
 * WHY THIS EXISTS. `attributeSiteLinks(text, brokerSlug, fubPersonId, crmPersonId)`
 * stamps a recipient id onto every ryan-realty.com link in an outbound message, so
 * a click cookies that browser to the contact and backfills their anonymous
 * sessions. It is the single mechanism that turns "Anonymous · Bend" into a name.
 *
 * The 4th argument is optional in TypeScript, and three of the four send paths —
 * the newsletter, the CRM composer, and the sequence engine — omitted it. They
 * passed only `_fuid`, the retired vendor CRM's id. Measured 2026-08-26: only
 * 18,188 of 23,078 contacts have one, so 4,890 people were permanently
 * unidentifiable no matter how many links they clicked. That is everyone created
 * since the CRM cutover — the only segment still growing. Against 79,000 sessions
 * in 90 days, the identity map held 176 rows.
 *
 * Nothing failed. Every send succeeded, every link worked, and the identity simply
 * was not attached. A missing optional argument is invisible in review, which is
 * exactly the kind of rule that belongs in a gate rather than a comment.
 *
 * THE RULE. Every call to `attributeSiteLinks` passes a 4th argument that is not
 * the literal `null`/`undefined`. AST via the TypeScript compiler — repo
 * convention, never regex, so a call split across lines is read correctly.
 *
 * ESCAPE. `// identity-stamp-ok: <reason>` on the line above the call, or on the
 * call's own line. A bare pragma with no reason does NOT suppress.
 */
import { readFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import ts from 'typescript'

const FN = 'attributeSiteLinks'
const PRAGMA = /\/\/\s*identity-stamp-ok:\s*\S+/

function sourceFiles() {
  const out = execFileSync(
    'git',
    ['ls-files', 'app/**/*.ts', 'app/**/*.tsx', 'lib/**/*.ts', 'lib/**/*.tsx', 'scripts/**/*.ts'],
    { encoding: 'utf8' },
  )
  return out.split('\n').filter(Boolean).filter((f) => !/\.test\.tsx?$/.test(f) && !/\.int\.test\./.test(f))
}

function walk(node, fn) {
  fn(node)
  node.forEachChild((c) => walk(c, fn))
}

const violations = []

for (const rel of sourceFiles()) {
  let src
  try {
    src = readFileSync(rel, 'utf8')
  } catch {
    continue
  }
  if (!src.includes(FN)) continue
  // The definition itself, and the doc that explains it, are not call sites.
  if (rel === 'lib/crm/merge.ts') continue

  const sf = ts.createSourceFile(rel, src, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  const lines = src.split('\n')

  walk(sf, (node) => {
    if (!ts.isCallExpression(node)) return
    const callee = node.expression
    const name = ts.isIdentifier(callee)
      ? callee.text
      : ts.isPropertyAccessExpression(callee)
        ? callee.name.text
        : null
    if (name !== FN) return

    const { line } = sf.getLineAndCharacterOfPosition(node.getStart(sf))
    const own = lines[line] ?? ''
    const above = lines[line - 1] ?? ''
    if (PRAGMA.test(own) || PRAGMA.test(above)) return

    const arg = node.arguments[3]
    const missing = arg === undefined
    const isNullLiteral =
      arg !== undefined &&
      (arg.kind === ts.SyntaxKind.NullKeyword ||
        (ts.isIdentifier(arg) && arg.text === 'undefined'))

    if (missing || isNullLiteral) {
      violations.push({
        file: rel,
        line: line + 1,
        why: missing
          ? 'no 4th argument — the recipient cannot be identified from this link'
          : 'the 4th argument is a literal null — pass the crm_people id',
      })
    }
  })
}

console.log('Identity-stamp check (outbound links carry a recipient id)')
console.log('=========================================================')

if (violations.length === 0) {
  console.log(`Every ${FN} call stamps a recipient id.`)
  process.exit(0)
}

for (const v of violations) {
  console.error(`FAIL  ${v.file}:${v.line} — ${v.why}`)
}
console.error('')
console.error(`${violations.length} call(s) send a link nobody can be identified from.`)
console.error(`Pass the crm_people id as the 4th argument to ${FN}(text, brokerSlug, fubPersonId, crmPersonId).`)
console.error("If a call genuinely has no recipient, mark it: // identity-stamp-ok: <reason>")
process.exit(1)
