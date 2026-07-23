#!/usr/bin/env node
/**
 * check-voice-rewrite-batch.mjs — ci:voice-rewrite-batch (W11.5).
 *
 * scripts/voice-rewrite-batch.ts runs the W11.3 advisory reviewer over stored
 * copy (published blog_posts + crm_templates) and writes a REVIEW ARTIFACT for
 * Matt to approve before any republish. The decision's "reviewed before
 * republish" only holds if the batch NEVER writes back to the content tables —
 * it must produce a suggestion artifact, never mutate the live copy.
 *
 * This gate makes that un-droppable. It asserts scripts/voice-rewrite-batch.ts:
 *   (a) CALLS reviewProse(...) — the reviewer actually runs on the stored copy.
 *   (b) writes a review artifact — a real writeFileSync(...) call.
 *   (c) contains ZERO Supabase mutations — no .update / .upsert / .insert /
 *       .delete anywhere. A read-only tool cannot auto-republish; the instant
 *       someone adds a write-back, this gate goes RED.
 *
 * AST-based (docs: reference_code_inspecting_gates_use_ast): parses with the
 * TypeScript compiler so a comment/string mention can never satisfy or trip it.
 *
 * Exit: 0 = reviewer wired + artifact written + read-only. 1 = otherwise.
 */
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import ts from 'typescript'

const FILE = 'scripts/voice-rewrite-batch.ts'
// Any of these on a Supabase builder is a write vector. `rpc` is included
// because an rpc can invoke a write function — a read-only content batch has no
// reason to call it, so flag it too (closes the .rpc('write_fn') evasion).
const MUTATORS = new Set(['update', 'upsert', 'insert', 'delete', 'rpc'])
const problems = []

const p = join(process.cwd(), FILE)
if (!existsSync(p)) {
  console.error(`✗ ci:voice-rewrite-batch: ${FILE} not found`)
  process.exit(1)
}
const sf = ts.createSourceFile(FILE, readFileSync(p, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TS)

let callsReviewProse = false
let writesArtifact = false
const mutations = []

const recordMutator = (node, name) => {
  const { line } = sf.getLineAndCharacterOfPosition(node.getStart())
  mutations.push({ name, line: line + 1 })
}

const visit = (node) => {
  if (ts.isCallExpression(node)) {
    const callee = node.expression
    // reviewProse(...) / writeFileSync(...) — bare import call OR member call.
    if (ts.isIdentifier(callee)) {
      if (callee.text === 'reviewProse') callsReviewProse = true
      if (callee.text === 'writeFileSync') writesArtifact = true
    }
    if (ts.isPropertyAccessExpression(callee)) {
      const name = callee.name.text
      if (name === 'reviewProse') callsReviewProse = true
      if (name === 'writeFileSync') writesArtifact = true
    }
  }

  // A mutator is flagged on ANY REFERENCE, not just a direct call — this closes
  // the indirection evasions an adversarial review found:
  //   x.update({...})            direct call
  //   const m = x.update.bind(x) aliased reference (never "called" here)
  //   x['update']({...})         computed/bracket access
  if (ts.isPropertyAccessExpression(node) && MUTATORS.has(node.name.text)) {
    recordMutator(node, node.name.text)
  }
  if (
    ts.isElementAccessExpression(node) &&
    node.argumentExpression &&
    ts.isStringLiteralLike(node.argumentExpression) &&
    MUTATORS.has(node.argumentExpression.text)
  ) {
    recordMutator(node, node.argumentExpression.text)
  }

  ts.forEachChild(node, visit)
}
visit(sf)

if (!callsReviewProse) problems.push(`${FILE}: never calls reviewProse(...) — the reviewer is not run over the stored copy.`)
if (!writesArtifact) problems.push(`${FILE}: never calls writeFileSync(...) — no review artifact is produced.`)
for (const m of mutations) {
  problems.push(
    `${FILE}:${m.line}: contains a .${m.name}(...) call — the batch must be READ-ONLY on the content (review before republish). Remove it; the review artifact is the only deliverable.`,
  )
}

console.log('Voice rewrite-batch read-only + reviewer gate (ci:voice-rewrite-batch)')
console.log('=====================================================================')
if (problems.length) {
  for (const pr of problems) console.error(`  ✗ ${pr}`)
  console.error(`\n\x1b[31m✗ ci:voice-rewrite-batch: ${problems.length} problem(s).\x1b[0m`)
  process.exit(1)
}
console.log('✓ voice-rewrite-batch runs reviewProse, writes a review artifact, and never mutates blog_posts/crm_templates.')
process.exit(0)
