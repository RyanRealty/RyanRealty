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
  // (b) auth guard
  if (!calls(action, 'getSession')) {
    problems.push(
      `${ACTION_FILE}: never calls getSession() — a write into the marketing queue must not be anonymous.`,
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
