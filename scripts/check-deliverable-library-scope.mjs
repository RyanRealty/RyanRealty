#!/usr/bin/env node
/**
 * check-deliverable-library-scope.mjs — ci:deliverable-library-scope (W10.2).
 *
 * The broker content library stores one broker's work product beside another's
 * in a single private bucket. The only thing keeping them apart is that every
 * read is broker-scoped and no caller-supplied string ever becomes an object
 * key. That is a security property, so it gets a gate.
 *
 * This gate was REWRITTEN after an adversarial review defeated v1 three ways:
 *   (b) v1 accepted a guard called on a SYNTHESIZED path while the caller's
 *       path was signed unchecked — it only looked for `if (…guard(…)) return`.
 *   (d) v1's "no list-everything export" test was a bare name regex
 *       (/^list(All|Every)|AllDeliverables/i), so `dumpDeliverables()` and
 *       `signAnyDeliverable(path)` sailed through.
 *   (e) v1 read ONE file, so two unauthenticated server actions taking a
 *       client-supplied brokerSlug were added to app/actions/deliverable-library.ts
 *       and eight gates — including this one — stayed green.
 *
 * So it now asserts, semantically, across the library, the surface, and the
 * (now-removed, but still-constrained-if-reintroduced) action layer:
 *
 * lib/marketing-brain/deliverable-library.ts
 *   1. Every exported function that touches the deliverable bucket (.list /
 *      .createSignedUrl / .upload) declares `brokerSlug` as its FIRST
 *      parameter. Name-independent — a new `dumpDeliverables()` fails.
 *   2. signDeliverableDownload takes PARTS (brokerSlug, actionId, filename) and
 *      never a `path`. This is structural: with no caller path there is nothing
 *      to smuggle a traversal through. It must also build the key itself
 *      (deliverablePath) and short-circuit on pathBelongsToBroker.
 *   3. pathBelongsToBroker DECODES before comparing. A `startsWith(prefix) &&
 *      !includes('..')` check is not enough: Supabase percent-decodes the key
 *      after our check, so `%2e%2e` escaped the prefix and served another
 *      broker's bytes (confirmed HTTP 200 in review).
 *
 * app/admin/(protected)/content-library/page.tsx (the surface — with the action
 * layer gone, this IS the authorization boundary)
 *   4. It calls requireAdminPage(...) and resolves the broker from the SESSION
 *      identity, never from a route/search param.
 *
 * app/actions/deliverable-library.ts (optional — absent today)
 *   5. If reintroduced, every exported server action must call
 *      requireAdminAction in-body and must not accept a broker identifier as a
 *      parameter: a 'use server' export is an independently-invocable POST that
 *      no layout guard covers.
 *
 * AST-based (docs: reference_code_inspecting_gates_use_ast).
 *
 * Exit: 0 = the scoping property holds. 1 = otherwise.
 */
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import ts from 'typescript'

const LIB = 'lib/marketing-brain/deliverable-library.ts'
/**
 * Optional by design. Reads are not allowed to route through server actions
 * (ci:page-action-imports), so the surface calls the library directly and this
 * file does not currently exist — one fewer independently-invocable POST
 * endpoint. If anyone reintroduces it, checks 4 and 5 apply.
 */
const ACTIONS = 'app/actions/deliverable-library.ts'
const PAGE = 'app/admin/(protected)/content-library/page.tsx'
const problems = []

function parse(rel, { required = true } = {}) {
  const p = join(process.cwd(), rel)
  if (!existsSync(p)) {
    if (required) problems.push(`${rel}: not found — the library or its surface was removed.`)
    return null
  }
  return ts.createSourceFile(rel, readFileSync(p, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
}

/** Exported function declarations, name -> node. */
function exportedFns(sf) {
  const out = new Map()
  const walk = (node) => {
    if (
      ts.isFunctionDeclaration(node) &&
      node.name &&
      node.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword)
    ) {
      out.set(node.name.text, node)
    }
    ts.forEachChild(node, walk)
  }
  walk(sf)
  return out
}

const paramNames = (fn) =>
  fn.parameters.map((p) => (ts.isIdentifier(p.name) ? p.name.text : '<destructured>'))

/** Does this function body contain a call whose callee property is `name`? */
function callsMethod(fn, name) {
  let hit = false
  const walk = (n) => {
    if (ts.isCallExpression(n)) {
      const c = n.expression
      if (ts.isPropertyAccessExpression(c) && c.name.text === name) hit = true
      if (ts.isIdentifier(c) && c.text === name) hit = true
    }
    ts.forEachChild(n, walk)
  }
  if (fn.body) walk(fn.body)
  return hit
}

// ---------------------------------------------------------------- lib module
const lib = parse(LIB)
if (lib) {
  const fns = exportedFns(lib)

  // (1) semantic: anything that touches the bucket must name the broker first.
  const BUCKET_OPS = ['list', 'createSignedUrl', 'upload', 'remove', 'download']
  for (const [name, fn] of fns) {
    const touches = BUCKET_OPS.filter((op) => callsMethod(fn, op))
    if (!touches.length) continue
    // persistDeliverable takes an object arg; it is a WRITE and builds its path
    // via deliverablePath, so it is scoped by construction.
    if (name === 'persistDeliverable') {
      if (!callsMethod(fn, 'deliverablePath')) {
        problems.push(`${LIB}: ${name} writes to the bucket without building its key via deliverablePath(...).`)
      }
      continue
    }
    if (paramNames(fn)[0] !== 'brokerSlug') {
      problems.push(
        `${LIB}: ${name}(...) touches the deliverable bucket (.${touches.join('/.')}) but does not take \`brokerSlug\` as its FIRST parameter (got ${paramNames(fn)[0] ?? 'nothing'}). Every bucket read must name whose library it is.`,
      )
    }
  }

  // (2) the download entry point takes PARTS, not a path
  const sign = fns.get('signDeliverableDownload')
  if (!sign) {
    problems.push(`${LIB}: does not export signDeliverableDownload(...).`)
  } else {
    const ps = paramNames(sign)
    const expected = ['brokerSlug', 'actionId', 'filename']
    if (ps.join(',') !== expected.join(',')) {
      problems.push(
        `${LIB}: signDeliverableDownload must take (${expected.join(', ')}) — got (${ps.join(', ')}). Accepting a caller-supplied path is how the percent-encoded traversal got in; the key must be rebuilt server-side.`,
      )
    }
    if (ps.includes('path')) {
      problems.push(`${LIB}: signDeliverableDownload accepts a \`path\` parameter — a caller must never hand us an object key.`)
    }
    if (!callsMethod(sign, 'deliverablePath')) {
      problems.push(`${LIB}: signDeliverableDownload does not build its key with deliverablePath(...).`)
    }
    if (!callsMethod(sign, 'pathBelongsToBroker')) {
      problems.push(`${LIB}: signDeliverableDownload does not call pathBelongsToBroker(...).`)
    } else {
      let shortCircuits = false
      const findGuard = (n) => {
        if (ts.isIfStatement(n) && /pathBelongsToBroker\s*\(/.test(n.expression.getText())) {
          let returns = false
          const scan = (x) => {
            if (ts.isReturnStatement(x)) returns = true
            ts.forEachChild(x, scan)
          }
          scan(n.thenStatement)
          if (returns) shortCircuits = true
        }
        ts.forEachChild(n, findGuard)
      }
      findGuard(sign.body)
      if (!shortCircuits) {
        problems.push(
          `${LIB}: signDeliverableDownload calls pathBelongsToBroker(...) but never returns on it — the guard is decorative.`,
        )
      }
    }
  }

  // (3) the guard decodes before comparing
  const guard = exportedFns(lib).get('pathBelongsToBroker')
  if (!guard) {
    problems.push(`${LIB}: does not export pathBelongsToBroker(...).`)
  } else {
    const body = guard.body?.getText() ?? ''
    if (!body.includes('decodeURIComponent')) {
      problems.push(
        `${LIB}: pathBelongsToBroker does not decode before comparing. Supabase percent-decodes the object key AFTER this check, so \`%2e%2e\` escapes a prefix test and serves another broker's file.`,
      )
    }
    if (!body.includes('deliverablePath')) {
      problems.push(
        `${LIB}: pathBelongsToBroker does not compare against a path rebuilt via deliverablePath(...) — pattern-matching the caller's string is what shipped the traversal.`,
      )
    }
  }
}

// ------------------------------------------------------------------ surface
// With the action layer gone, the page IS the authorization boundary: it must
// gate on a capability and resolve the broker from the session, never from a
// URL parameter.
const page = parse(PAGE)
if (page) {
  const src = page.getFullText()
  if (!src.includes('requireAdminPage(')) {
    problems.push(`${PAGE}: does not call requireAdminPage(...) — the library surface would be open.`)
  }
  // The broker must come from the session identity, not a parameter. Either
  // spelling is acceptable: the DAL email lookup (current) or the self-service
  // helper. What is NOT acceptable is a slug that arrives from the caller.
  const sessionDerived =
    /getBrokerSelfRecordByEmail\s*\(\s*ctx\.email/.test(src) ||
    src.includes('getCurrentBrokerForSelfService(')
  if (!sessionDerived) {
    problems.push(
      `${PAGE}: does not resolve the broker from the session identity (getBrokerSelfRecordByEmail(ctx.email) or getCurrentBrokerForSelfService()) — whose library is it showing?`,
    )
  }
  if (/searchParams|params\s*[:}]/.test(src) && /brokerSlug\s*=\s*(?!.*getCurrentBroker)/.test(src)) {
    problems.push(
      `${PAGE}: appears to take the broker from route/search params. The slug must come from the session only.`,
    )
  }
}

// ------------------------------------------------------------ server actions
const actions = parse(ACTIONS, { required: false })
if (actions) {
  const fns = exportedFns(actions)
  const BROKER_PARAMS = new Set(['brokerslug', 'slug', 'broker', 'brokerid', 'broker_slug'])
  for (const [name, fn] of fns) {
    // (4) in-body authz
    if (!callsMethod(fn, 'requireAdminAction')) {
      problems.push(
        `${ACTIONS}: ${name}(...) does not call requireAdminAction(...) in-body. A 'use server' export compiles to an independently-invocable POST — the (protected) layout redirect never runs on it.`,
      )
    }
    // (5) the broker is session-derived, never a parameter
    for (const p of paramNames(fn)) {
      if (BROKER_PARAMS.has(p.toLowerCase())) {
        problems.push(
          `${ACTIONS}: ${name}(...) takes \`${p}\` as a parameter — a caller could then name ANY broker. Resolve the broker from the session instead.`,
        )
      }
    }
    if (!callsMethod(fn, 'getCurrentBrokerForSelfService')) {
      problems.push(
        `${ACTIONS}: ${name}(...) never resolves the broker from the session (getCurrentBrokerForSelfService).`,
      )
    }
  }
}

console.log('Broker deliverable-library scoping gate (ci:deliverable-library-scope)')
console.log('=====================================================================')
if (problems.length) {
  for (const pr of problems) console.error(`  ✗ ${pr}`)
  console.error(`\n\x1b[31m✗ ci:deliverable-library-scope: ${problems.length} problem(s).\x1b[0m`)
  process.exit(1)
}
console.log('✓ Bucket reads are broker-scoped, downloads rebuild their own key, the')
console.log('  traversal guard decodes, and every server action is authed + session-scoped.')
process.exit(0)
