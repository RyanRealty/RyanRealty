#!/usr/bin/env node
/**
 * check-voice-send-paths.mjs — ci:voice-send-paths (W11.2).
 *
 * docs/plans/PROGRAM_2026-07-21/COMPLETION-LEDGER.json row W11.2: "One shared
 * voice-check function on every send path (blog, CMA/BPO prose, social
 * captions, sequence templates) + a ratchet gate on unchecked send paths."
 *
 * lib/voice/check.ts (checkBrandVoice) is the one shared runtime scanner.
 * Five send paths are required to call it (directly, or — for CRM sequence
 * templates — via checkTemplateVoice, which itself now delegates to
 * checkBrandVoice; see lib/crm/templateVoiceCheck.ts) AND to actually GATE
 * the send on the result, not just call it and ignore the answer:
 *
 *   - app/actions/blog.ts           saveBlogPost      (checkBrandVoice)
 *   - lib/cma/build.ts              buildCma          (checkBrandVoice)
 *   - lib/bpo/build.ts              buildBpo          (checkBrandVoice)
 *   - app/api/social/publish/route.ts resolveCaption  (checkBrandVoice)
 *   - lib/crm/templateValidation.ts validateTemplateInput (checkTemplateVoice)
 *
 * A bare `checkBrandVoice(...)` mention (in a comment, or a call whose result
 * is discarded) is not enough — this gate FAILS a path unless BOTH:
 *   (a) the check is called and its result bound to a `const`, AND
 *   (b) that bound identifier is tested in an `if (!<result>.ok)` guard whose
 *       body contains a ReturnStatement or a ThrowStatement — i.e. the guard
 *       actually stops the send, it doesn't just log and fall through.
 *
 * AST-based (docs: reference_code_inspecting_gates_use_ast) — parses each
 * file with the TypeScript compiler so a comment or string mention of the
 * function name can never satisfy the check, only a real bound-and-gating
 * call site can. This is the ratchet: adding a NEW send path to SEND_PATHS
 * below is how the class stays closed as new content surfaces are built —
 * see the same pattern in scripts/check-newsletter-voice-paths.mjs (G-NL-4).
 *
 * Usage:
 *   node scripts/check-voice-send-paths.mjs
 *
 * Exit: 0 = every path calls the check AND is gated by it, 1 = a path is
 * missing the call, or calls it without gating the send.
 */
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import ts from 'typescript'

const ROOT = process.cwd()

const SEND_PATHS = [
  { label: 'blog publish', file: 'app/actions/blog.ts', fn: 'checkBrandVoice' },
  { label: 'CMA prose', file: 'lib/cma/build.ts', fn: 'checkBrandVoice' },
  { label: 'BPO prose', file: 'lib/bpo/build.ts', fn: 'checkBrandVoice' },
  { label: 'social caption', file: 'app/api/social/publish/route.ts', fn: 'checkBrandVoice' },
  { label: 'CRM sequence template save', file: 'lib/crm/templateValidation.ts', fn: 'checkTemplateVoice' },
]

const problems = []

function parse(rel) {
  const p = join(ROOT, rel)
  if (!existsSync(p)) return null
  const scriptKind = rel.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS
  return ts.createSourceFile(rel, readFileSync(p, 'utf8'), ts.ScriptTarget.Latest, true, scriptKind)
}

function unwrapParens(node) {
  let n = node
  while (n && ts.isParenthesizedExpression(n)) n = n.expression
  return n
}

/** True if `node` is `<name>.ok` (a PropertyAccessExpression on the given identifier). */
function isDotOk(node, name) {
  return (
    ts.isPropertyAccessExpression(node) &&
    node.name.text === 'ok' &&
    ts.isIdentifier(node.expression) &&
    node.expression.text === name
  )
}

/**
 * Every `const X = fn(...)` binding name in the file, for the given function
 * name. Only `const` bindings count (a `let`/`var` is not "bound" in the
 * sense this gate requires — the spec is explicit: CALLED-AND-BOUND to a
 * const). Matches both a bare identifier callee (`fn(...)`) and a
 * property-access callee (`ns.fn(...)`), so a namespaced import still counts.
 */
function boundCallNames(sf, fnName) {
  const names = []
  const visit = (node) => {
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.initializer &&
      ts.isCallExpression(node.initializer) &&
      node.parent &&
      ts.isVariableDeclarationList(node.parent) &&
      (node.parent.flags & ts.NodeFlags.Const) !== 0
    ) {
      const callee = node.initializer.expression
      const calleeName = ts.isIdentifier(callee)
        ? callee.text
        : ts.isPropertyAccessExpression(callee)
          ? callee.name.text
          : null
      if (calleeName === fnName) names.push(node.name.text)
    }
    ts.forEachChild(node, visit)
  }
  visit(sf)
  return names
}

/** True if the node subtree contains a ReturnStatement or ThrowStatement anywhere. */
function subtreeHasReturnOrThrow(node) {
  let found = false
  const visit = (n) => {
    if (found) return
    if (ts.isReturnStatement(n) || ts.isThrowStatement(n)) {
      found = true
      return
    }
    ts.forEachChild(n, visit)
  }
  visit(node)
  return found
}

/**
 * True if the file contains an `if (!<name>.ok)` (or the parenthesized
 * variant `if (!(name.ok))`) whose then-branch contains a return or a throw
 * — i.e. the guard actually stops the send rather than merely observing it.
 */
function isGatedByIfNotOk(sf, name) {
  let gated = false
  const visit = (node) => {
    if (gated) return
    if (ts.isIfStatement(node)) {
      const cond = unwrapParens(node.expression)
      if (
        ts.isPrefixUnaryExpression(cond) &&
        cond.operator === ts.SyntaxKind.ExclamationToken &&
        isDotOk(unwrapParens(cond.operand), name)
      ) {
        if (subtreeHasReturnOrThrow(node.thenStatement)) gated = true
      }
    }
    if (!gated) ts.forEachChild(node, visit)
  }
  visit(sf)
  return gated
}

console.log('Voice-check send-path wiring gate (ci:voice-send-paths)')
console.log('=========================================================')

const results = []

for (const { label, file, fn } of SEND_PATHS) {
  const sf = parse(file)
  if (!sf) {
    problems.push(`${label} (${file}): file not found`)
    results.push({ label, file, ok: false })
    continue
  }

  const names = boundCallNames(sf, fn)
  if (names.length === 0) {
    problems.push(
      `${label} (${file}): ${fn}(...) is never called and bound to a const — this send path is not voice-checked.`,
    )
    results.push({ label, file, ok: false })
    continue
  }

  const gatedName = names.find((n) => isGatedByIfNotOk(sf, n))
  if (!gatedName) {
    problems.push(
      `${label} (${file}): ${fn}(...) is called (bound to ${names.map((n) => `\`${n}\``).join(', ')}) but its result is never used in an \`if (!<result>.ok)\` guard whose body returns or throws — the check runs but does not gate the send.`,
    )
    results.push({ label, file, ok: false })
    continue
  }

  results.push({ label, file, ok: true })
}

for (const r of results) {
  console.log(`${r.ok ? '✓' : '✗'} ${r.label} (${r.file})`)
}

if (problems.length) {
  console.error(`\nci:voice-send-paths found ${problems.length} problem(s):`)
  for (const p of problems) console.error(`  ✗ ${p}`)
  console.error(`\n\x1b[31m✗ ci:voice-send-paths FAILED.\x1b[0m`)
  process.exit(1)
}

console.log(`\n✓ ci:voice-send-paths: all ${SEND_PATHS.length} send path(s) call the shared voice check and gate on it.`)
process.exit(0)
