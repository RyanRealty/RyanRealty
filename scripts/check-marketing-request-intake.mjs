#!/usr/bin/env node
/**
 * check-marketing-request-intake.mjs — ci:marketing-request-intake (W10.1).
 *
 * The decision: /marketing/request stops being a mailto-only page and becomes a
 * SECOND authenticated intake that writes into the SAME queue as the
 * marketing@ inbox ("two intakes, one queue").
 *
 * Three properties have to hold, or the second intake is decorative or unsafe:
 *   (a) app/marketing/request/actions.ts routes through the SHARED pipeline —
 *       it calls parseInboxEmail(...) AND dispatchParsedEmail(...), the exact
 *       functions lib/marketing-brain/inbox-poll.ts uses. A hand-rolled insert
 *       into marketing_brain_actions would be a SECOND queue, which is the
 *       thing this decision exists to prevent.
 *   (b) the action is AUTH-GUARDED — it calls getSession() and refuses when
 *       there is no session email. An anonymous visitor must not be able to
 *       enqueue work (the page itself stays public, linked from email).
 *   (c) the form actually USES it — RequestBuilder.tsx calls
 *       submitMarketingRequest(...), not just the mailto link.
 *
 * AST-based (docs: reference_code_inspecting_gates_use_ast) — a comment or
 * string mention can never satisfy any of these.
 *
 * Exit: 0 = second intake wired, shared, and guarded. 1 = otherwise.
 */
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import ts from 'typescript'

const ACTION_FILE = 'app/marketing/request/actions.ts'
const FORM_FILE = 'app/marketing/request/RequestBuilder.tsx'
const problems = []

function parse(rel) {
  const p = join(process.cwd(), rel)
  if (!existsSync(p)) {
    problems.push(`${rel}: file not found`)
    return null
  }
  const kind = rel.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS
  return ts.createSourceFile(rel, readFileSync(p, 'utf8'), ts.ScriptTarget.Latest, true, kind)
}

/** True if a real CallExpression to `name` exists (bare or member call). */
function calls(sf, name) {
  let found = false
  const visit = (n) => {
    if (ts.isCallExpression(n)) {
      const c = n.expression
      if (ts.isIdentifier(c) && c.text === name) found = true
      if (ts.isPropertyAccessExpression(c) && c.name.text === name) found = true
    }
    ts.forEachChild(n, visit)
  }
  visit(sf)
  return found
}

/**
 * True if a value derived from `seedFn(...)` actually SHORT-CIRCUITS the
 * function — i.e. there is an `if (<condition referencing it>) { ... return ... }`.
 *
 * Calling the guard and throwing the result away is the evasion this closes: an
 * adversarial review replaced the real check with
 *   `await getSession().catch(() => null); const senderEmail = 'anon@example.com'`
 * and the old "is it called anywhere" assertion still passed while auth was gutted.
 *
 * Tracks the binding assigned from seedFn AND any binding whose initializer
 * references it (so `const email = session?.user?.email` counts as derived).
 */
function guardShortCircuits(sf, seedFn) {
  const derived = new Set()

  const collect = (node) => {
    if (ts.isVariableDeclaration(node) && node.initializer && ts.isIdentifier(node.name)) {
      const initText = node.initializer.getText()
      const seedsFrom =
        new RegExp(`\\b${seedFn}\\s*\\(`).test(initText) ||
        [...derived].some((d) => new RegExp(`\\b${d}\\b`).test(initText))
      if (seedsFrom) derived.add(node.name.text)
    }
    ts.forEachChild(node, collect)
  }
  collect(sf)
  if (derived.size === 0) return false

  let guarded = false
  const visit = (node) => {
    if (ts.isIfStatement(node)) {
      const cond = node.expression.getText()
      const refs = [...derived].some((d) => new RegExp(`\\b${d}\\b`).test(cond))
      if (refs) {
        let returns = false
        const scan = (n) => {
          if (ts.isReturnStatement(n)) returns = true
          ts.forEachChild(n, scan)
        }
        scan(node.thenStatement)
        if (returns) guarded = true
      }
    }
    ts.forEachChild(node, visit)
  }
  visit(sf)
  return guarded
}

/** True if the file inserts directly into marketing_brain_actions (a second queue). */
function insertsIntoActionsDirectly(sf) {
  let found = false
  const visit = (n) => {
    if (
      ts.isCallExpression(n) &&
      ts.isPropertyAccessExpression(n.expression) &&
      n.expression.name.text === 'from'
    ) {
      const a0 = n.arguments[0]
      if (a0 && ts.isStringLiteralLike(a0) && a0.text === 'marketing_brain_actions') found = true
    }
    ts.forEachChild(n, visit)
  }
  visit(sf)
  return found
}

const action = parse(ACTION_FILE)
if (action) {
  // (a) shared pipeline, not a private queue
  for (const fn of ['parseInboxEmail', 'dispatchParsedEmail']) {
    if (!calls(action, fn)) {
      problems.push(
        `${ACTION_FILE}: never calls ${fn}(...) — the form intake must route through the SAME parser+dispatcher the marketing@ inbox uses, or it becomes a second queue.`,
      )
    }
  }
  if (insertsIntoActionsDirectly(action)) {
    problems.push(
      `${ACTION_FILE}: writes to marketing_brain_actions directly — enqueue through dispatchParsedEmail(...) instead so both intakes share one queue writer.`,
    )
  }
  // (b) auth — the session must SHORT-CIRCUIT the write, not merely be fetched.
  if (!calls(action, 'getSession')) {
    problems.push(
      `${ACTION_FILE}: never calls getSession() — a write into the marketing queue must not be anonymous.`,
    )
  } else if (!guardShortCircuits(action, 'getSession')) {
    problems.push(
      `${ACTION_FILE}: calls getSession() but its result never short-circuits the function — add an \`if (!<session value>) return ...\` before any write, or the auth check is decorative.`,
    )
  }

  // (c) authorization — a session alone is not enough. ryan-realty.com has public
  // self-serve signup, so the form must enforce the SAME sender allowlist the
  // email door does, and that result must short-circuit too.
  if (!calls(action, 'isSenderAllowed')) {
    problems.push(
      `${ACTION_FILE}: never calls isSenderAllowed() — any public self-signup account could enqueue real work. Enforce the same allowlist the marketing@ inbox enforces.`,
    )
  } else if (!guardShortCircuits(action, 'isSenderAllowed')) {
    problems.push(
      `${ACTION_FILE}: calls isSenderAllowed() but its result never short-circuits the function — add an \`if (!<decision>.allowed) return ...\` before any write.`,
    )
  }
}

// (c) the form uses it
const form = parse(FORM_FILE)
if (form && !calls(form, 'submitMarketingRequest')) {
  problems.push(
    `${FORM_FILE}: never calls submitMarketingRequest(...) — the page is still mailto-only, so the second intake does not exist.`,
  )
}

console.log('Marketing request second-intake gate (ci:marketing-request-intake)')
console.log('==================================================================')
if (problems.length) {
  for (const p of problems) console.error(`  ✗ ${p}`)
  console.error(`\n\x1b[31m✗ ci:marketing-request-intake: ${problems.length} problem(s).\x1b[0m`)
  process.exit(1)
}
console.log('✓ /marketing/request is an authenticated second intake routing through the shared parser + dispatcher.')
process.exit(0)
