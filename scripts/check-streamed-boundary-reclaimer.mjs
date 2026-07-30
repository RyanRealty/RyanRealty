#!/usr/bin/env node
/**
 * check-streamed-boundary-reclaimer.mjs — ci:streamed-boundary-reclaimer.
 *
 * THE DEFECT THIS FREEZES
 *
 * Every route on this site renders inside a Suspense boundary (the root
 * app/loading.tsx plus the per-segment loading.tsx files), so every page takes
 * React's out-of-order streaming path: the shell ships with the skeleton
 * fallback, and the real body arrives later as
 *
 *   <div hidden id="S:0">…the whole page body…</div>
 *   <script>$RC("B:0","S:0")</script>
 *
 * React 19's `$RC` does not swap that container in inline. It queues the pair on
 * the global `$RB` array and defers the reveal to `$RV`, and because `$RT` is
 * only ever set by `$RV` itself, the FIRST reveal on any page load is always
 * scheduled with `requestAnimationFrame`. A tab that never paints — a background
 * tab, a restored-session tab, a headless renderer, an audit crawler running
 * script without a compositor — never gets that frame. `$RV` never runs, the
 * `<div hidden id="S:n">` containers are never reclaimed, and the document ends
 * up holding two complete copies of the page body.
 *
 * Measured before the fix, on a non-painting tab, after load + 4s:
 *   /cities/bend        1,438 orphaned nodes of 3,208  (45%)
 *   /faq                  319 orphaned nodes of   855  (37%)
 *   /listing/220224941    matched the same pattern
 * After: 0 orphaned nodes on all three, `main.kb-root` count back to 1.
 *
 * components/layout/StreamedBoundaryReclaimer.tsx drains the queue when no
 * frame has arrived. It is invisible, has no props, and produces no markup — so
 * nothing about the rendered page tells a future editor it is load-bearing, and
 * a "remove the unused client component from the root layout" cleanup would
 * silently reintroduce a 45%-dead-DOM regression that only reproduces on tabs
 * nobody is looking at. Hence this gate.
 *
 * ASSERTS
 *   1. components/layout/StreamedBoundaryReclaimer.tsx exists, is a client
 *      component ('use client'), and default-exports a component.
 *   2. It actually reads React's `$RB` queue and calls React's `$RV` — the
 *      reclaim mechanism, not just a file with the right name.
 *   3. app/layout.tsx imports it AND renders <StreamedBoundaryReclaimer /> in
 *      the JSX tree (an unrendered import reclaims nothing).
 *   4. It is mounted OUTSIDE any Suspense boundary — i.e. it is not nested in a
 *      <Suspense> element in the root layout. A reclaimer that lives inside the
 *      boundary it is meant to reclaim cannot mount until that boundary
 *      resolves, which is the exact thing that is stuck.
 *
 * AST-based (docs: reference_code_inspecting_gates_use_ast): parsed with the
 * TypeScript compiler and matched against real JSX elements / call expressions,
 * so a comment or a string mention cannot satisfy it.
 *
 * Usage: node scripts/check-streamed-boundary-reclaimer.mjs
 * Exit: 0 = wired, 1 = the reclaim path regressed.
 */
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import ts from 'typescript'

const COMPONENT = 'components/layout/StreamedBoundaryReclaimer.tsx'
const LAYOUT = 'app/layout.tsx'
const NAME = 'StreamedBoundaryReclaimer'

const problems = []

function parse(rel) {
  const abs = join(process.cwd(), rel)
  if (!existsSync(abs)) {
    problems.push(`${rel}: file not found`)
    return null
  }
  return ts.createSourceFile(rel, readFileSync(abs, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
}

/** Walk every node in a source file. */
function walk(node, visit) {
  visit(node)
  node.forEachChild((child) => walk(child, visit))
}

/** Text of a JSX tag name (handles <Foo> and <a.b.Foo>). */
function tagName(node) {
  const tag = ts.isJsxSelfClosingElement(node)
    ? node.tagName
    : ts.isJsxOpeningElement(node)
      ? node.tagName
      : null
  return tag ? tag.getText() : null
}

// ── 1 + 2. The component itself ────────────────────────────────────────────
const componentSf = parse(COMPONENT)
if (componentSf) {
  const src = componentSf.getFullText()

  // 'use client' must be the leading directive — this reads window globals.
  const firstStatement = componentSf.statements[0]
  const isUseClient =
    firstStatement &&
    ts.isExpressionStatement(firstStatement) &&
    ts.isStringLiteral(firstStatement.expression) &&
    firstStatement.expression.text === 'use client'
  if (!isUseClient) {
    problems.push(`${COMPONENT}: missing the leading 'use client' directive (it reads window.$RB / window.$RV)`)
  }

  let hasDefaultExport = false
  let readsRB = false
  let callsRV = false

  walk(componentSf, (node) => {
    if (
      (ts.isFunctionDeclaration(node) || ts.isClassDeclaration(node) || ts.isExportAssignment(node)) &&
      (node.modifiers?.some((m) => m.kind === ts.SyntaxKind.DefaultKeyword) || ts.isExportAssignment(node))
    ) {
      hasDefaultExport = true
    }
    // Property access or element access naming React's queue: w.$RB / w['$RB'].
    if (ts.isPropertyAccessExpression(node) && node.name.getText() === '$RB') readsRB = true
    if (ts.isElementAccessExpression(node) && /['"]\$RB['"]/.test(node.argumentExpression.getText())) readsRB = true
    // A real call of React's reveal function.
    if (ts.isCallExpression(node)) {
      const callee = node.expression
      if (ts.isPropertyAccessExpression(callee) && callee.name.getText() === '$RV') callsRV = true
      if (ts.isElementAccessExpression(callee) && /['"]\$RV['"]/.test(callee.argumentExpression.getText())) callsRV = true
      if (ts.isIdentifier(callee) && callee.text === '$RV') callsRV = true
    }
  })

  if (!hasDefaultExport) problems.push(`${COMPONENT}: no default export — the root layout cannot mount it`)
  if (!readsRB) {
    problems.push(
      `${COMPONENT}: never reads React's $RB reveal queue — the reclaim mechanism is gone, streamed <div hidden id="S:n"> containers will strand on non-painting tabs`,
    )
  }
  if (!callsRV) {
    problems.push(
      `${COMPONENT}: never calls React's $RV reveal function — nothing drains the queue, so the duplicate-DOM defect returns`,
    )
  }
  // The whole point is to act when no frame arrives. Require the rAF race so a
  // future edit cannot turn this into an unconditional timer that fights React
  // on visible tabs.
  if (!/requestAnimationFrame/.test(src)) {
    problems.push(
      `${COMPONENT}: no requestAnimationFrame race — it must stand down on any tab that actually paints and let React reveal normally`,
    )
  }
}

// ── 3 + 4. Mounted in the root layout, outside every Suspense boundary ─────
const layoutSf = parse(LAYOUT)
if (layoutSf) {
  let imported = false
  let rendered = false
  let renderedInsideSuspense = false

  walk(layoutSf, (node) => {
    if (ts.isImportDeclaration(node) && node.importClause) {
      const def = node.importClause.name
      if (def && def.text === NAME) imported = true
      const named = node.importClause.namedBindings
      if (named && ts.isNamedImports(named) && named.elements.some((e) => e.name.text === NAME)) imported = true
    }

    if (ts.isJsxSelfClosingElement(node) || ts.isJsxOpeningElement(node)) {
      if (tagName(node) !== NAME) return
      rendered = true
      // Climb to the root looking for an enclosing <Suspense>.
      for (let p = node.parent; p; p = p.parent) {
        if (ts.isJsxElement(p) && tagName(p.openingElement) === 'Suspense') {
          renderedInsideSuspense = true
          break
        }
      }
    }
  })

  if (!imported) problems.push(`${LAYOUT}: does not import ${NAME} from ${COMPONENT}`)
  if (!rendered) {
    problems.push(
      `${LAYOUT}: does not render <${NAME} /> — an unreferenced import reclaims nothing; every page would keep a second full copy of its body on non-painting tabs`,
    )
  }
  if (renderedInsideSuspense) {
    problems.push(
      `${LAYOUT}: <${NAME} /> is nested inside a <Suspense> boundary — it cannot mount until that boundary resolves, which is the exact condition it exists to unstick. Mount it as a direct child of <body>.`,
    )
  }
}

if (problems.length) {
  console.error(`\n✗ streamed-boundary-reclaimer: ${problems.length} problem(s):\n`)
  for (const p of problems) console.error('  • ' + p)
  console.error(
    '\n  Why this gate exists: React 19 defers the first streamed Suspense reveal to\n' +
      '  requestAnimationFrame. Tabs that never paint never fire it, so the\n' +
      '  <div hidden id="S:n"> content container is never reclaimed and the page carries\n' +
      '  two complete copies of its body (measured 45% of all DOM nodes on /cities/bend).\n' +
      '  See components/layout/StreamedBoundaryReclaimer.tsx for the full mechanism.\n',
  )
  process.exit(1)
}

console.log('✓ streamed-boundary-reclaimer: reclaimer is a client component, drains React\'s $RB queue via $RV, and is mounted outside Suspense in app/layout.tsx')
