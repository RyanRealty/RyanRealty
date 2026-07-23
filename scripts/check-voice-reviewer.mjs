#!/usr/bin/env node
/**
 * check-voice-reviewer.mjs — ci:voice-reviewer (W11.3).
 *
 * docs/plans/PROGRAM_2026-07-21/COMPLETION-LEDGER.json row W11.3: "Orwell
 * reviewer — advisory LLM pass on long-form (violations list + rewrite,
 * facts unchanged), non-blocking."
 *
 * lib/voice/reviewer.ts (reviewProse) is advisory ONLY — it never gates a
 * send/build the way lib/voice/check.ts (checkBrandVoice, W11.2) does. What
 * makes it safe to ship anyway is the §0 fact-preservation guard
 * (factsPreserved): reviewProse must actually CALL it before trusting any
 * LLM-authored rewrite. This gate makes that mechanism, and the wiring at
 * the two builder surfaces, un-droppable:
 *
 *   (a) lib/voice/reviewer.ts exports `factsPreserved`, AND `reviewProse`'s
 *       own function body contains a call to `factsPreserved(...)` — not
 *       just a mention in a comment, an ACTUAL call inside the function.
 *   (b) lib/cma/build.ts and lib/bpo/build.ts each call `reviewProse(...)`
 *       somewhere in the file — the advisory pass runs on every build, even
 *       though (unlike checkBrandVoice) it never gates the outcome.
 *
 * AST-based (docs: reference_code_inspecting_gates_use_ast) — parses each
 * file with the TypeScript compiler so a comment or string mention of a
 * function name can never satisfy the check, only a real call site can.
 *
 * Usage:
 *   node scripts/check-voice-reviewer.mjs
 *
 * Exit: 0 = the fact-guard is applied inside reviewProse AND both wired
 * surfaces call reviewProse. 1 = either is missing.
 */
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import ts from 'typescript'

const ROOT = process.cwd()

const REVIEWER_FILE = 'lib/voice/reviewer.ts'
const WIRED_SURFACES = [
  { label: 'CMA build', file: 'lib/cma/build.ts' },
  { label: 'BPO build', file: 'lib/bpo/build.ts' },
]

const problems = []

function parse(rel) {
  const p = join(ROOT, rel)
  if (!existsSync(p)) return null
  const scriptKind = rel.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS
  return ts.createSourceFile(rel, readFileSync(p, 'utf8'), ts.ScriptTarget.Latest, true, scriptKind)
}

/** True if `node` (a CallExpression) invokes a function named `name`, either
 *  as a bare identifier (`name(...)`) or a namespaced property access (`ns.name(...)`). */
function callInvokes(node, name) {
  if (!ts.isCallExpression(node)) return false
  const callee = node.expression
  if (ts.isIdentifier(callee)) return callee.text === name
  if (ts.isPropertyAccessExpression(callee)) return callee.name.text === name
  return false
}

/** Find every top-level exported function/const-arrow-function declaration
 *  named `name` in the source file. Returns their body nodes (Block | Expression). */
function findExportedFunctionBodies(sf, name) {
  const bodies = []

  const isExported = (modifiers) =>
    !!modifiers && modifiers.some((m) => m.kind === ts.SyntaxKind.ExportKeyword)

  const visit = (node) => {
    // export function name(...) { ... }  /  export async function name(...) { ... }
    if (ts.isFunctionDeclaration(node) && node.name?.text === name && isExported(node.modifiers) && node.body) {
      bodies.push(node.body)
    }
    // export const name = (...) => { ... }  /  export const name = async (...) => { ... }
    if (
      ts.isVariableStatement(node) &&
      isExported(node.modifiers) &&
      node.declarationList.declarations.some((d) => ts.isIdentifier(d.name) && d.name.text === name)
    ) {
      for (const decl of node.declarationList.declarations) {
        if (
          ts.isIdentifier(decl.name) &&
          decl.name.text === name &&
          decl.initializer &&
          (ts.isArrowFunction(decl.initializer) || ts.isFunctionExpression(decl.initializer))
        ) {
          bodies.push(decl.initializer.body)
        }
      }
    }
    ts.forEachChild(node, visit)
  }
  visit(sf)
  return bodies
}

/** True if `node`'s subtree contains an exported declaration named `name`
 *  (function or const), regardless of whether it has a body we can inspect. */
function hasExportedDeclaration(sf, name) {
  let found = false
  const isExported = (modifiers) => !!modifiers && modifiers.some((m) => m.kind === ts.SyntaxKind.ExportKeyword)
  const visit = (node) => {
    if (found) return
    if (ts.isFunctionDeclaration(node) && node.name?.text === name && isExported(node.modifiers)) {
      found = true
      return
    }
    if (
      ts.isVariableStatement(node) &&
      isExported(node.modifiers) &&
      node.declarationList.declarations.some((d) => ts.isIdentifier(d.name) && d.name.text === name)
    ) {
      found = true
      return
    }
    ts.forEachChild(node, visit)
  }
  visit(sf)
  return found
}

/** True if any CallExpression anywhere in `node`'s subtree invokes `name`. */
function subtreeCalls(node, name) {
  let found = false
  const visit = (n) => {
    if (found) return
    if (callInvokes(n, name)) {
      found = true
      return
    }
    ts.forEachChild(n, visit)
  }
  visit(node)
  return found
}

/**
 * True if `body` contains a `rewrite:` property whose value is a
 * ConditionalExpression (a ternary) — i.e. the returned rewrite is GATED on a
 * condition, not shipped unconditionally. This is what stops a present-but-
 * defeated guard (calling factsPreserved but then `rewrite: rawRewrite`,
 * ignoring the result) from passing the gate. The degraded returns use
 * `rewrite: null` (a literal, not a ternary), so they don't satisfy it — the
 * real result path must carry the ternary.
 */
function rewriteIsConditionallyGated(body) {
  let found = false
  const visit = (n) => {
    if (found) return
    if (
      ts.isPropertyAssignment(n) &&
      ((ts.isIdentifier(n.name) && n.name.text === 'rewrite') ||
        (ts.isStringLiteralLike(n.name) && n.name.text === 'rewrite')) &&
      ts.isConditionalExpression(n.initializer)
    ) {
      found = true
      return
    }
    ts.forEachChild(n, visit)
  }
  visit(body)
  return found
}

console.log('Voice reviewer fact-guard + wiring gate (ci:voice-reviewer)')
console.log('=============================================================')

// ---------------------------------------------------------------------------
// (a) lib/voice/reviewer.ts: factsPreserved exported AND called inside reviewProse.
// ---------------------------------------------------------------------------

const reviewerSf = parse(REVIEWER_FILE)
if (!reviewerSf) {
  problems.push(`${REVIEWER_FILE}: file not found`)
} else {
  const exportsFactsPreserved = hasExportedDeclaration(reviewerSf, 'factsPreserved')
  if (!exportsFactsPreserved) {
    problems.push(`${REVIEWER_FILE}: does not export \`factsPreserved\` — the §0 fact-preservation guard must be exported (tests + this gate depend on it).`)
  } else {
    console.log(`✓ ${REVIEWER_FILE} exports factsPreserved`)
  }

  const reviewProseBodies = findExportedFunctionBodies(reviewerSf, 'reviewProse')
  if (reviewProseBodies.length === 0) {
    problems.push(`${REVIEWER_FILE}: does not export a function/const \`reviewProse\` with an inspectable body.`)
  } else {
    const applied = reviewProseBodies.some((body) => subtreeCalls(body, 'factsPreserved'))
    if (!applied) {
      problems.push(
        `${REVIEWER_FILE}: reviewProse(...) never calls factsPreserved(...) in its own body — the fact-guard is defined but not actually applied before a rewrite can ship.`,
      )
    } else {
      console.log(`✓ ${REVIEWER_FILE} reviewProse(...) calls factsPreserved(...) before trusting a rewrite`)
    }

    // §3c: the guard's RESULT must gate the rewrite, not just be called. A
    // present-but-defeated guard (call factsPreserved, then `rewrite: rawRewrite`)
    // otherwise passes — this asserts the returned rewrite is a ternary.
    const gated = reviewProseBodies.some((body) => rewriteIsConditionallyGated(body))
    if (!gated) {
      problems.push(
        `${REVIEWER_FILE}: reviewProse's returned \`rewrite\` is shipped unconditionally — the factsPreserved result must gate it (e.g. \`rewrite: safe ? rawRewrite : null\`), or a fact-mangling rewrite escapes.`,
      )
    } else {
      console.log(`✓ ${REVIEWER_FILE} reviewProse gates the returned rewrite on the guard result`)
    }
  }
}

// ---------------------------------------------------------------------------
// (b) Wired surfaces: lib/cma/build.ts + lib/bpo/build.ts each call reviewProse.
// ---------------------------------------------------------------------------

for (const { label, file } of WIRED_SURFACES) {
  const sf = parse(file)
  if (!sf) {
    problems.push(`${label} (${file}): file not found`)
    continue
  }
  const calls = subtreeCalls(sf, 'reviewProse')
  if (!calls) {
    problems.push(`${label} (${file}): never calls reviewProse(...) — the advisory reviewer is not wired into this build.`)
  } else {
    console.log(`✓ ${label} (${file}) calls reviewProse(...)`)
  }
}

if (problems.length) {
  console.error(`\nci:voice-reviewer found ${problems.length} problem(s):`)
  for (const p of problems) console.error(`  ✗ ${p}`)
  console.error(`\n\x1b[31m✗ ci:voice-reviewer FAILED.\x1b[0m`)
  process.exit(1)
}

console.log('\n✓ ci:voice-reviewer: fact-guard applied inside reviewProse, both wired surfaces call it.')
process.exit(0)
