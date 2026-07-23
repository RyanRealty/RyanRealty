#!/usr/bin/env node
/**
 * check-bulk-approval-wired.mjs — ci:bulk-approval-wired (W10.4).
 *
 * Bulk approve / bulk reject in the approval queue is a real end-to-end path:
 *   producer  app/api/admin/approval-queue/bulk-action/route.ts
 *   consumer  app/admin/(protected)/approval-queue/page.tsx (provider + bar)
 *             + _components/ActionCard.tsx (per-row checkbox)
 *             + _components/BulkSelection.tsx (the client feature)
 *
 * The single highest-risk property is AUTHZ: a bulk endpoint that mass-approves
 * marketing-brain content for public auto-publish WITHOUT the superuser
 * 'approvals.act' gate would let a broker publish at scale (the exact HIGH-audit
 * risk the single route calls out). This gate FAILS if:
 *   1. the bulk route drops the requireAdminRoute('approvals.act') call, or
 *   2. either mutation isn't status-scoped (.in('status', ...)) so a stale id
 *      could re-flip an already-approved/killed row, or
 *   3. the UI surfaces unwire (page drops the provider/bar, or the card drops
 *      the checkbox) — a correct endpoint nobody can reach guards nothing.
 *
 * AST-based (docs: reference_code_inspecting_gates_use_ast): parses each file with
 * the TypeScript compiler and matches real CallExpressions / references — a comment
 * or string mention cannot satisfy it.
 *
 * Exit: 0 = fully wired + guarded, 1 = a link dropped.
 */
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import ts from 'typescript'

const problems = []

function parse(rel) {
  const p = join(process.cwd(), rel)
  if (!existsSync(p)) {
    problems.push(`${rel}: file not found`)
    return null
  }
  return ts.createSourceFile(rel, readFileSync(p, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
}

/** True if the file has a CallExpression `fn(...)` whose first arg string === argText (if given). */
function callsWith(sf, fn, argText) {
  let found = false
  const visit = (node) => {
    if (ts.isCallExpression(node)) {
      const callee = node.expression
      const name = ts.isIdentifier(callee)
        ? callee.text
        : ts.isPropertyAccessExpression(callee)
          ? callee.name.text
          : null
      if (name === fn) {
        if (argText == null) found = true
        else {
          const a0 = node.arguments[0]
          if (a0 && ts.isStringLiteralLike(a0) && a0.text === argText) found = true
        }
      }
    }
    ts.forEachChild(node, visit)
  }
  visit(sf)
  return found
}

/**
 * True if the fluent chain that `updateCall` is called on roots at
 * `.from(table)`. Walks DOWN the receiver chain (…service.from(table).update()).
 */
function chainReceiverHasFromTable(updateCall, table) {
  let cur = updateCall.expression.expression // receiver of `.update(...)`
  while (cur) {
    if (ts.isCallExpression(cur)) {
      const callee = cur.expression
      if (ts.isPropertyAccessExpression(callee)) {
        if (callee.name.text === 'from') {
          const a0 = cur.arguments[0]
          if (a0 && ts.isStringLiteralLike(a0) && a0.text === table) return true
        }
        cur = callee.expression
      } else break
    } else if (ts.isPropertyAccessExpression(cur)) {
      cur = cur.expression
    } else break // reached the base identifier
  }
  return false
}

/**
 * True if a `.in('status', ...)` call is chained ABOVE `updateCall` in the SAME
 * fluent chain (…update({...}).in('id', ids).in('status', ...).select()). Walks
 * UP the parent chain of member-call applications.
 */
function chainHasStatusScopeAbove(updateCall) {
  let node = updateCall
  while (
    node.parent &&
    ts.isPropertyAccessExpression(node.parent) &&
    node.parent.expression === node &&
    node.parent.parent &&
    ts.isCallExpression(node.parent.parent) &&
    node.parent.parent.expression === node.parent
  ) {
    const callee = node.parent // the `.foo` applied to `node`
    const call = node.parent.parent // the `.foo(...)` CallExpression
    if (callee.name.text === 'in') {
      const a0 = call.arguments[0]
      if (a0 && ts.isStringLiteralLike(a0) && a0.text === 'status') return true
    }
    node = call
  }
  return false
}

/**
 * Every `marketing_brain_actions.update(...)` branch in the file, each tagged
 * with whether ITS OWN chain carries a `.in('status', ...)` scope. Per-branch
 * (not file-level) so stripping the scope from only ONE mutation is caught.
 */
function updateBranchScopes(sf) {
  const branches = []
  const visit = (node) => {
    if (
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      node.expression.name.text === 'update' &&
      chainReceiverHasFromTable(node, 'marketing_brain_actions')
    ) {
      const { line } = sf.getLineAndCharacterOfPosition(node.getStart())
      branches.push({ line: line + 1, scoped: chainHasStatusScopeAbove(node) })
    }
    ts.forEachChild(node, visit)
  }
  visit(sf)
  return branches
}

/** True if the file references identifier `name` anywhere (import, call, decl). */
function referencesIdentifier(sf, name) {
  let found = false
  const visit = (node) => {
    if (ts.isIdentifier(node) && node.text === name) found = true
    ts.forEachChild(node, visit)
  }
  visit(sf)
  return found
}

/**
 * True if the file RENDERS `<name ...>` as a real JSX element (opening or
 * self-closing). Stricter than referencesIdentifier: an unused import is not
 * enough — the component has to actually be in the tree, or it wires nothing.
 */
function rendersJsx(sf, name) {
  let found = false
  const visit = (node) => {
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
      const tag = node.tagName
      if (ts.isIdentifier(tag) && tag.text === name) found = true
    }
    ts.forEachChild(node, visit)
  }
  visit(sf)
  return found
}

// 1. The bulk route: guarded + status-scoped.
const ROUTE = 'app/api/admin/approval-queue/bulk-action/route.ts'
const route = parse(ROUTE)
if (route) {
  if (!callsWith(route, 'requireAdminRoute', 'approvals.act')) {
    problems.push(
      `${ROUTE}: does not call requireAdminRoute('approvals.act') — bulk approve would run without the superuser publish gate.`,
    )
  }
  const branches = updateBranchScopes(route)
  if (branches.length === 0) {
    problems.push(`${ROUTE}: no marketing_brain_actions.update() branch found — the bulk mutation is missing.`)
  }
  for (const b of branches) {
    if (!b.scoped) {
      problems.push(
        `${ROUTE}: the marketing_brain_actions.update() at line ${b.line} is not status-scoped (.in('status', ...) in its own chain) — a stale id could re-flip an already approved/killed row.`,
      )
    }
  }
}

// 2. The page wires the provider + the bar.
const PAGE = 'app/admin/(protected)/approval-queue/page.tsx'
const page = parse(PAGE)
if (page) {
  for (const id of ['BulkSelectionProvider', 'BulkActionBar']) {
    if (!rendersJsx(page, id)) {
      problems.push(`${PAGE}: does not render <${id}> — the bulk feature is unreachable from the queue.`)
    }
  }
}

// 3. The card wires the per-row checkbox (must be RENDERED, not merely imported).
const CARD = 'app/admin/(protected)/approval-queue/_components/ActionCard.tsx'
const card = parse(CARD)
if (card && !rendersJsx(card, 'BulkSelectCheckbox')) {
  problems.push(`${CARD}: does not render <BulkSelectCheckbox> — rows cannot be selected for a bulk action.`)
}

// 4. The client feature exports all three pieces.
const FEATURE = 'app/admin/(protected)/approval-queue/_components/BulkSelection.tsx'
const feature = parse(FEATURE)
if (feature) {
  for (const id of ['BulkSelectionProvider', 'BulkActionBar', 'BulkSelectCheckbox']) {
    if (!referencesIdentifier(feature, id)) {
      problems.push(`${FEATURE}: missing export ${id}.`)
    }
  }
}

console.log('Bulk approval wiring gate (ci:bulk-approval-wired)')
console.log('=================================================')
if (problems.length) {
  console.error('\nThe bulk approve/reject path is not wired end-to-end:')
  for (const p of problems) console.error(`  ✗ ${p}`)
  console.error(`\n\x1b[31m✗ ci:bulk-approval-wired: ${problems.length} problem(s).\x1b[0m`)
  process.exit(1)
}
console.log('✓ Bulk approve/reject is guarded (approvals.act), status-scoped, and wired producer→consumer.')
process.exit(0)
