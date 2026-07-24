#!/usr/bin/env node
/**
 * check-deliverable-library-scope.mjs — ci:deliverable-library-scope (W10.2).
 *
 * The broker content library stores one broker's work product beside another's
 * in a single private bucket. The only things keeping them apart are that every
 * read is broker-scoped and that no caller-supplied string ever becomes an
 * object key. Those are security properties, so they get a gate.
 *
 * THIS GATE HAS BEEN DEFEATED TWICE. What each round taught:
 *
 *  Round 1 — v1 matched export NAMES with a regex and read ONE file. An
 *  unscoped `dumpDeliverables()` and two unauthenticated server actions taking
 *  a client-supplied brokerSlug both sailed through.
 *
 *  Round 2 — v2 asserted `body.includes('decodeURIComponent')`. A substring is
 *  not a behavior: making pathBelongsToBroker `return true` with that token
 *  left as dead code kept the gate GREEN, and so did deleting
 *  `parts[0] === slug` — which restores the round-1 cross-broker read exactly
 *  and reads like a redundant condition to anyone refactoring. v2 also walked
 *  only ts.isFunctionDeclaration, so `export const f = async () => {}` — the
 *  idiomatic Next.js spelling — was invisible to every check.
 *
 * So this version does two things v1 and v2 did not:
 *
 *   A. IT RUNS THE CODE. lib/marketing-brain/deliverable-path.ts is pure and
 *      dependency-free precisely so it can be bundled and executed here against
 *      a fixture table. A guard that stops guarding now fails on behavior, no
 *      matter how the source is spelled.
 *   B. Its AST pass sees arrow-function and default exports, not just
 *      function declarations.
 *
 * Structural checks that remain (behavior alone cannot express these):
 *   1. Every export touching the bucket takes `brokerSlug` FIRST.
 *   2. signDeliverableDownload takes PARTS, never a `path`.
 *   3. The surface gates on a capability and resolves the broker from session.
 *   4. Any server action, if reintroduced, is authed and takes no broker param.
 *
 * Exit: 0 = the scoping property holds. 1 = otherwise.
 */
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import ts from 'typescript'
import { loadDeliverablePath } from './lib/deliverable-path-runtime.mjs'

const PURE = 'lib/marketing-brain/deliverable-path.ts'
const LIB = 'lib/marketing-brain/deliverable-library.ts'
const PAGE = 'app/admin/(protected)/content-library/page.tsx'
/** Optional: reads do not route through server actions (ci:page-action-imports). */
const ACTIONS = 'app/actions/deliverable-library.ts'

const problems = []

function parse(rel, { required = true } = {}) {
  const p = join(process.cwd(), rel)
  if (!existsSync(p)) {
    if (required) problems.push(`${rel}: not found — the library or its surface was removed.`)
    return null
  }
  return ts.createSourceFile(rel, readFileSync(p, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
}

/**
 * Exported functions by name — declarations, exported arrow/function consts,
 * and default exports. v2 saw only the first kind, which is how three evasions
 * walked past it.
 */
function exportedFns(sf) {
  const out = new Map()
  const isExported = (node) => node.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword)
  const walk = (node) => {
    if (ts.isFunctionDeclaration(node) && node.name && isExported(node)) {
      out.set(node.name.text, node)
    }
    if (ts.isVariableStatement(node) && isExported(node)) {
      for (const decl of node.declarationList.declarations) {
        const init = decl.initializer
        if (init && (ts.isArrowFunction(init) || ts.isFunctionExpression(init)) && ts.isIdentifier(decl.name)) {
          out.set(decl.name.text, init)
        }
      }
    }
    ts.forEachChild(node, walk)
  }
  walk(sf)
  return out
}

const paramNames = (fn) =>
  fn.parameters.map((p) => (ts.isIdentifier(p.name) ? p.name.text : '<destructured>'))

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

// ══════════════════════════════════ A. BEHAVIOR ══════════════════════════════
// Bundle the pure module and actually run it. This is the check a neutered
// guard cannot talk its way past.
async function checkBehavior() {
  const loaded = await loadDeliverablePath(process.cwd())
  if (!loaded.ok) {
    problems.push(`${PURE}: could not be executed for behavioral checks — ${loaded.error}`)
    return
  }
  const mod = loaded.mod
  const { safeSegment, buildDeliverablePath, pathBelongsToBroker } = mod
  const S = (v) => JSON.stringify(v)

  const cases = [
    // traversal must not survive sanitization
    ['safeSegment("..")', safeSegment('..'), ''],
    ['safeSegment(".")', safeSegment('.'), ''],
    ['safeSegment("...")', safeSegment('...'), ''],
    // a segment with no usable characters must not silently collapse
    ['safeSegment("!!!")', safeSegment('!!!'), ''],
    // ordinary values still work (a gate that breaks the feature is no good)
    ['safeSegment("Matthew-Ryan")', safeSegment('Matthew-Ryan'), 'matthew-ryan'],
    ['safeSegment("report.v2.json")', safeSegment('report.v2.json'), 'report.v2.json'],

    // path construction refuses unrepresentable segments
    ['buildDeliverablePath(a,..,f)', buildDeliverablePath('a', '..', 'f'), null],
    ['buildDeliverablePath(a,b,..)', buildDeliverablePath('a', 'b', '..'), null],
    ['buildDeliverablePath(!!!,b,f)', buildDeliverablePath('!!!', 'b', 'f'), null],
    ['buildDeliverablePath("",b,f)', buildDeliverablePath('', 'b', 'f'), null],
    ['buildDeliverablePath(a,b,f)', buildDeliverablePath('a', 'b', 'f'), 'a/b/f'],

    // ownership: the whole point
    ['owns own canonical key', pathBelongsToBroker('a', 'a/b/f'), true],
    ['rejects other broker', pathBelongsToBroker('a', 'b/x/f'), false],
    ['rejects literal traversal', pathBelongsToBroker('a', 'a/../f'), false],
    ['rejects encoded traversal', pathBelongsToBroker('a', 'a/%2e%2e/f'), false],
    ['rejects double-encoded', pathBelongsToBroker('a', 'a/%252e%252e/f'), false],
    ['rejects quad-encoded', pathBelongsToBroker('a', 'a/%25252e%25252e/f'), false],
    ['rejects encoded slash', pathBelongsToBroker('a', 'a%2fb/x/f'), false],
    ['rejects leading slash', pathBelongsToBroker('a', '/a/b/f'), false],
    ['rejects empty slug', pathBelongsToBroker('', 'a/b/f'), false],
    ['rejects garbage slug', pathBelongsToBroker('!!!', 'a/b/f'), false],
    ['rejects 4 segments', pathBelongsToBroker('a', 'a/b/c/f'), false],
    ['rejects 2 segments', pathBelongsToBroker('a', 'a/f'), false],
    ['rejects empty segment', pathBelongsToBroker('a', 'a//f'), false],
    // a slug that is a prefix of another must not collide in either direction
    ['matt !== matthew-ryan', pathBelongsToBroker('matt', 'matthew-ryan/b/f'), false],
    ['matthew-ryan !== matt', pathBelongsToBroker('matthew-ryan', 'matt/b/f'), false],
    // a non-canonical spelling of a key we DO own is still refused
    ['rejects uppercase key', pathBelongsToBroker('a', 'A/B/F'), false],
  ]

  for (const [label, actual, expected] of cases) {
    if (actual !== expected) {
      problems.push(
        `${PURE}: BEHAVIOR — ${label} returned ${S(actual)}, expected ${S(expected)}. The path guard does not do what the library claims.`,
      )
    }
  }
}

// ══════════════════════════════════ B. STRUCTURE ═════════════════════════════
function checkStructure() {
  const lib = parse(LIB)
  if (lib) {
    const fns = exportedFns(lib)
    const BUCKET_OPS = ['list', 'createSignedUrl', 'upload', 'remove', 'download']

    for (const [name, fn] of fns) {
      const touches = BUCKET_OPS.filter((op) => callsMethod(fn, op))
      if (!touches.length) continue
      if (name === 'persistDeliverable') {
        if (!callsMethod(fn, 'buildDeliverablePath') && !callsMethod(fn, 'deliverablePath')) {
          problems.push(`${LIB}: ${name} writes to the bucket without building its key through the path builder.`)
        }
        continue
      }
      if (paramNames(fn)[0] !== 'brokerSlug') {
        problems.push(
          `${LIB}: ${name}(...) touches the deliverable bucket (.${touches.join('/.')}) but does not take \`brokerSlug\` as its FIRST parameter (got ${paramNames(fn)[0] ?? 'nothing'}).`,
        )
      }
    }

    // The guard must be the one the gate actually executes. Calling something
    // *named* pathBelongsToBroker is not enough: a local definition (or a
    // shadow) would leave all 28 fixtures passing against the pure module while
    // the real download path runs unguarded. "Inline the helper, drop the
    // import" is an ordinary refactor, so this is checked structurally.
    const libText = lib.getFullText()
    const importsGuard =
      /import\s*{[^}]*\bpathBelongsToBroker\b[^}]*}\s*from\s*['"][^'"]*deliverable-path['"]/.test(libText)
    if (!importsGuard) {
      problems.push(
        `${LIB}: does not import pathBelongsToBroker from deliverable-path. The gate executes THAT module's fixtures — a local copy would be unguarded and unverified.`,
      )
    }
    const importsBuilder =
      /import\s*{[^}]*\bbuildDeliverablePath\b[^}]*}\s*from\s*['"][^'"]*deliverable-path['"]/.test(libText)
    if (!importsBuilder) {
      problems.push(
        `${LIB}: does not import buildDeliverablePath from deliverable-path — key construction must not be re-implemented locally.`,
      )
    }
    for (const banned of ['pathBelongsToBroker', 'buildDeliverablePath', 'safeSegment']) {
      const declaresOwn = new RegExp(`(^|\\n)\\s*(export\\s+)?function\\s+${banned}\\b`).test(libText)
      if (declaresOwn) {
        problems.push(
          `${LIB}: declares its own ${banned}(...). There must be exactly one implementation, in deliverable-path.ts, because that is the one the gate runs.`,
        )
      }
    }

    const sign = fns.get('signDeliverableDownload')
    if (!sign) {
      problems.push(`${LIB}: does not export signDeliverableDownload(...).`)
    } else {
      const ps = paramNames(sign)
      const expected = ['brokerSlug', 'actionId', 'filename']
      if (ps.join(',') !== expected.join(',')) {
        problems.push(
          `${LIB}: signDeliverableDownload must take (${expected.join(', ')}) — got (${ps.join(', ')}). A caller-supplied path is how the percent-encoded traversal got in.`,
        )
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
            `${LIB}: signDeliverableDownload never returns on pathBelongsToBroker(...) — the guard is decorative.`,
          )
        }
      }
    }
  }

  const page = parse(PAGE)
  if (page) {
    const src = page.getFullText()
    if (!src.includes('requireAdminPage(')) {
      problems.push(`${PAGE}: does not call requireAdminPage(...) — the library surface would be open.`)
    }
    const sessionDerived =
      /getBrokerSelfRecordByEmail\s*\(\s*ctx\.email/.test(src) || src.includes('getCurrentBrokerForSelfService(')
    if (!sessionDerived) {
      problems.push(`${PAGE}: does not resolve the broker from the session identity — whose library is it showing?`)
    }
  }

  const actions = parse(ACTIONS, { required: false })
  if (actions) {
    const fns = exportedFns(actions)
    const BROKER_PARAMS = new Set(['brokerslug', 'slug', 'broker', 'brokerid', 'broker_slug'])
    for (const [name, fn] of fns) {
      if (!callsMethod(fn, 'requireAdminAction')) {
        problems.push(
          `${ACTIONS}: ${name}(...) does not call requireAdminAction(...) in-body. A 'use server' export is an independently-invocable POST.`,
        )
      }
      for (const p of paramNames(fn)) {
        if (BROKER_PARAMS.has(p.toLowerCase())) {
          problems.push(`${ACTIONS}: ${name}(...) takes \`${p}\` as a parameter — a caller could then name ANY broker.`)
        }
      }
    }
  }
}


// ══════════════════════ C. DATAFLOW + WIRING (round 3) ═══════════════════════
// Round 3 demonstrated three GREEN evasions that structure alone cannot see:
//   (c) `.list(slug, …)` -> `.list('', …)` — a one-character diff that returns
//       every broker's objects.
//   (d) persistDeliverable calling buildDeliverablePath and DISCARDING the
//       result — the old check asked whether the call happened, not whether its
//       value was used.
//   (B4) commenting out all three persistence call sites left the gate GREEN,
//       so BL-5 ("visual deliverables never reach the library") could regress
//       with no mechanical signal at all.
function checkDataflowAndWiring() {
  const lib = parse(LIB)
  if (lib) {
    const fns = exportedFns(lib)

    // (c) every .list(...) inside a scoped read must pass a BINDING, never a
    // literal, and that binding must derive from the brokerSlug parameter.
    for (const [name, fn] of fns) {
      if (!fn.body) continue
      const params = paramNames(fn)
      const walk = (n) => {
        if (
          ts.isCallExpression(n) &&
          ts.isPropertyAccessExpression(n.expression) &&
          n.expression.name.text === 'list'
        ) {
          const arg0 = n.arguments[0]
          const line = lib.getLineAndCharacterOfPosition(n.getStart()).line + 1
          if (!arg0) {
            problems.push(`${LIB}:${line}: ${name} calls .list() with no prefix — that lists the whole bucket.`)
          } else if (ts.isStringLiteralLike(arg0)) {
            problems.push(
              `${LIB}:${line}: ${name} calls .list('${arg0.text}') with a literal prefix. A read must be scoped to the caller's broker, not a constant — .list('') returns every broker's objects.`,
            )
          } else if (ts.isIdentifier(arg0) || ts.isTemplateExpression(arg0)) {
            const text = arg0.getText()
            if (params.length && !params.some((p) => text.includes(p)) && !/slug/i.test(text)) {
              problems.push(
                `${LIB}:${line}: ${name} lists prefix \`${text}\`, which does not derive from \`${params[0]}\`. Every bucket read must be scoped to the broker the caller named.`,
              )
            }
          }
        }
        ts.forEachChild(n, walk)
      }
      walk(fn.body)
    }

    // (d) persistDeliverable must USE the built path, not merely call the builder.
    const persist = fns.get('persistDeliverable')
    if (persist?.body) {
      const src = persist.body.getText()
      const assigns = /(?:const|let)\s+(\w+)\s*=\s*buildDeliverablePath\s*\(/.exec(src)
      if (!assigns) {
        problems.push(
          `${LIB}: persistDeliverable does not assign buildDeliverablePath(...) to a binding — calling it and discarding the result leaves the key unvalidated.`,
        )
      } else {
        const v = assigns[1]
        const guarded = new RegExp(`if\\s*\\(\\s*!${v}\\s*\\)`).test(src)
        if (!guarded) {
          problems.push(
            `${LIB}: persistDeliverable never checks \`if (!${v})\` — buildDeliverablePath returns null for an unrepresentable segment, and an unchecked null becomes an object at bucket root with no broker prefix.`,
          )
        }
        if (!new RegExp(`upload\\(\\s*${v}\\b`).test(src)) {
          problems.push(
            `${LIB}: persistDeliverable does not upload to \`${v}\` — the validated path must be the one written.`,
          )
        }
      }
    }
  }

  // (B4) every runner that finishes a producer must archive its output.
  const WRITERS = [
    ['app/api/cron/producer-runtime/route.ts', 'persistDeliverable'],
    ['app/api/admin/run-producer/[id]/route.ts', 'persistDeliverable'],
    ['scripts/render-worker.mjs', 'persistRenderedDeliverable'],
  ]
  for (const [rel, fnName] of WRITERS) {
    const p = join(process.cwd(), rel)
    if (!existsSync(p)) {
      problems.push(`${rel}: not found — a producer runner moved; re-point this gate.`)
      continue
    }
    const text = readFileSync(p, 'utf8')
    // strip comments so a commented-out call cannot satisfy the check
    const code = text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
    if (!new RegExp(`\\b${fnName}\\s*\\(`).test(code)) {
      problems.push(
        `${rel}: never calls ${fnName}(...). This runner finishes producers, so its output would never reach any broker's library — exactly the regression that left the bucket empty.`,
      )
    }
    // Ownership must come from the ONE shared resolver: either the SQL function
    // directly (the .mjs worker cannot import TypeScript) or the exported
    // wrapper around it. What is banned is a third, local reading of
    // assigned_approver — that is what misfiled every non-Matt deliverable.
    const usesSharedResolver =
      /resolve_deliverable_broker_slug/.test(code) || /resolveBrokerSlugForAction\s*\(/.test(code)
    if (!usesSharedResolver) {
      problems.push(
        `${rel}: does not resolve ownership through resolve_deliverable_broker_slug (or resolveBrokerSlugForAction). A second implementation of "whose deliverable is this" already sent every non-Matt visual deliverable to the wrong library.`,
      )
    }
    if (/assigned_approver/.test(code)) {
      problems.push(
        `${rel}: reads assigned_approver directly. It is 'matt' on every live row, so this resolves every deliverable to the principal broker. Use the shared resolver.`,
      )
    }
  }
}

await checkBehavior()
checkStructure()
checkDataflowAndWiring()

console.log('Broker deliverable-library scoping gate (ci:deliverable-library-scope)')
console.log('=====================================================================')
if (problems.length) {
  for (const pr of problems) console.error(`  ✗ ${pr}`)
  console.error(`\n\x1b[31m✗ ci:deliverable-library-scope: ${problems.length} problem(s).\x1b[0m`)
  process.exit(1)
}
console.log('✓ Path guard EXECUTED against 28 adversarial fixtures; bucket reads are')
console.log('  broker-scoped; downloads take parts; the surface is authed + session-scoped.')
process.exit(0)
