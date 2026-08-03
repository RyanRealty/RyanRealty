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
import { execFileSync } from 'node:child_process'
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

    // LOSSY TRUNCATION (round 4, demonstrated): safeSegment used to .slice(0,120),
    // so two different long filenames produced ONE key and the upsert destroyed
    // the first deliverable. segmentsAreSafe could not see it — comparing
    // safeSegment(p) to an already-truncated p tests idempotence, not fidelity.
    ['over-long segment refused', buildDeliverablePath('a', 'b', 'y'.repeat(125)), null],
    ['121-char + suffix refused', buildDeliverablePath('a', 'b', 'x'.repeat(121) + '-A.mp4'), null],
    ['exactly 120 still allowed', buildDeliverablePath('a', 'b', 'z'.repeat(120)), 'a/b/' + 'z'.repeat(120)],
    ['long action id refused', buildDeliverablePath('a', 'c'.repeat(130), 'f.json'), null],
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

    // The guard must be THE one the gate executes — the same file, imported
    // under its own name, never shadowed. Round 5 defeated a regex version three
    // ways: an aliased import (`buildDeliverablePath as bdp`), a module-scope
    // `const buildDeliverablePath = () => ...` shadow (the old check matched
    // only `function`), and a sibling specifier ending in `deliverable-path`
    // (e.g. `_shim/deliverable-path`) that the loose regex accepted while the
    // fixtures still ran the real file. All three are ordinary-looking refactors
    // that leave the download path unguarded. So this is done with the TS
    // module resolver and full binding analysis, per
    // reference_code_inspecting_gates_use_ast.
    const REQUIRED_IMPORTS = ['pathBelongsToBroker', 'buildDeliverablePath', 'safeSegment']
    const CANON = join(process.cwd(), PURE).replace(/\.ts$/, '')
    const compilerOptions = {
      baseUrl: process.cwd(),
      paths: { '@/*': ['*'] },
      moduleResolution: ts.ModuleResolutionKind.Bundler ?? ts.ModuleResolutionKind.NodeNext,
    }
    /** name -> the resolved absolute module (no ext) it was imported from, and whether aliased. */
    const importedFrom = new Map()
    const collectImports = (node) => {
      if (
        ts.isImportDeclaration(node) &&
        node.importClause?.namedBindings &&
        ts.isNamedImports(node.importClause.namedBindings) &&
        ts.isStringLiteralLike(node.moduleSpecifier)
      ) {
        const spec = node.moduleSpecifier.text
        const resolved = ts.resolveModuleName(spec, join(process.cwd(), LIB), compilerOptions, ts.sys)
        const file = resolved.resolvedModule?.resolvedFileName?.replace(/\.tsx?$/, '') ?? null
        for (const el of node.importClause.namedBindings.elements) {
          const local = el.name.text
          const original = el.propertyName?.text ?? local // propertyName set => aliased
          importedFrom.set(local, { file, spec, original, aliased: Boolean(el.propertyName) })
        }
      }
      ts.forEachChild(node, collectImports)
    }
    collectImports(lib)

    for (const name of REQUIRED_IMPORTS) {
      const imp = importedFrom.get(name)
      if (!imp) {
        problems.push(
          `${LIB}: does not import ${name} from deliverable-path. The gate executes THAT module's fixtures — a local copy would be unguarded and unverified.`,
        )
        continue
      }
      if (imp.aliased || imp.original !== name) {
        problems.push(
          `${LIB}: imports ${name} under an alias. Aliasing lets a local binding of the real name shadow the guard; import it under its own name.`,
        )
      }
      if (imp.file !== CANON) {
        problems.push(
          `${LIB}: imports ${name} from '${imp.spec}' which resolves to ${imp.file ?? 'nothing'}, not the canonical ${PURE}. The gate's 28 fixtures run the canonical file; a look-alike would be verified-but-unused.`,
        )
      }
    }
    // No LOCAL binding of any of the three names — const/let/var/arrow/function
    // all shadow the import. (v2 checked only `function`.)
    const walkLocalDecls = (node) => {
      if (
        (ts.isFunctionDeclaration(node) || ts.isVariableDeclaration(node)) &&
        node.name &&
        ts.isIdentifier(node.name) &&
        REQUIRED_IMPORTS.includes(node.name.text)
      ) {
        problems.push(
          `${LIB}: declares a local \`${node.name.text}\` that shadows the imported guard. There must be exactly one implementation, in deliverable-path.ts — the file the gate runs.`,
        )
      }
      ts.forEachChild(node, walkLocalDecls)
    }
    walkLocalDecls(lib)

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

  // B1 (round 4): the old check was two src.includes greps against ONE hardcoded
  // page path, so `const brokerSlug = sp.broker ?? broker?.slug` satisfied both
  // while letting ?broker=paul-stevenson render another broker's library — and a
  // SECOND page importing the library was invisible entirely. Now every consumer
  // under app/ is found and its broker argument is traced to a session binding.
  const CONSUMER_FNS = ['listBrokerDeliverables', 'signDeliverableDownload']
  const SESSION_SOURCES = ['getBrokerSelfRecordByEmail', 'getCurrentBrokerForSelfService']
  const REQUEST_SOURCES = ['searchParams', 'params', 'headers', 'cookies', 'request', 'req']

  let consumerFiles = []
  try {
    consumerFiles = execFileSync(
      'grep',
      ['-rl', '--include=*.ts', '--include=*.tsx', '-e', 'marketing-brain/deliverable-library', 'app'],
      { cwd: process.cwd(), encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] },
    )
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean)
  } catch (err) {
    // grep exits 1 for "no matches" — that is a legitimate empty result. Any
    // other failure is OUR bug, and must not masquerade as a finding: a bare
    // catch here previously swallowed a ReferenceError and reported
    // "no surface imports the deliverable library", which was false.
    if (err?.status !== 1) {
      problems.push(`ci:deliverable-library-scope: consumer scan failed to run — ${String(err?.message ?? err).slice(0, 200)}`)
    }
    consumerFiles = []
  }
  if (!consumerFiles.length) {
    problems.push('app/: no surface imports the deliverable library — the feature is unreachable.')
  }

  for (const rel of consumerFiles) {
    const sf = parse(rel)
    if (!sf) continue
    const src = sf.getFullText()

    // Only READ surfaces need the admin capability gate. The two producer
    // runners import the WRITE path (persistDeliverable) and authenticate on
    // their own terms — requireCronAuth for the cron, getAdminRoleForEmail for
    // the one-shot route — so demanding requireAdminPage of them is wrong.
    const isReadConsumer = CONSUMER_FNS.some((fn) => new RegExp(`\\b${fn}\\s*\\(`).test(src))
    if (isReadConsumer && !/requireAdminPage\s*\(|requireAdminAction\s*\(/.test(src)) {
      problems.push(`${rel}: reads the deliverable library without requireAdminPage/requireAdminAction — the surface would be open.`)
    }

    // Map local bindings -> their initializer text, so a broker argument can be traced.
    const initByName = new Map()
    const collect = (n) => {
      if (ts.isVariableDeclaration(n) && ts.isIdentifier(n.name) && n.initializer) {
        initByName.set(n.name.text, n.initializer.getText())
      }
      ts.forEachChild(n, collect)
    }
    collect(sf)

    const walk = (n) => {
      if (ts.isCallExpression(n) && ts.isIdentifier(n.expression) && CONSUMER_FNS.includes(n.expression.text)) {
        const arg0 = n.arguments[0]
        const line = sf.getLineAndCharacterOfPosition(n.getStart()).line + 1
        if (!arg0) {
          problems.push(`${rel}:${line}: ${n.expression.text}() called with no broker.`)
        } else {
          // Resolve the binding TRANSITIVELY. One hop is not enough: the real
          // page goes brokerSlug -> `broker?.slug ?? null` -> broker ->
          // `getBrokerSelfRecordByEmail(ctx.email)`, so a single-hop check
          // reported a false positive on correct code.
          const argText = arg0.getText()
          const seen = new Set()
          const parts = []
          const expand = (text, depth) => {
            if (!text || depth > 6) return
            parts.push(text)
            for (const id of text.match(/[A-Za-z_$][\w$]*/g) ?? []) {
              if (seen.has(id)) continue
              seen.add(id)
              const init = initByName.get(id)
              if (init) expand(init, depth + 1)
            }
          }
          expand(argText, 0)
          const chain = parts.join(' ')
          const fromSession = SESSION_SOURCES.some((srcName) => chain.includes(srcName))
          const fromRequest = REQUEST_SOURCES.some((r) => new RegExp(`\\b${r}\\b`).test(chain))
          // B3 (round 5): `broker?.slug ?? 'paul-stevenson'` keeps fromSession
          // true (the chain still names getBrokerSelfRecordByEmail) yet silently
          // resolves to a hardcoded OTHER broker for any admin not linked to a
          // broker record. A broker-slug-shaped string literal anywhere in the
          // traced value is the `?? fallback` refactor this check exists to
          // police — reject it. (A literal 'null'/'undefined' fallback is fine;
          // those are not a broker.)
          const literalBroker = /['"][a-z]+(?:-[a-z]+)+['"]/.exec(chain)
          if (literalBroker) {
            problems.push(
              `${rel}:${line}: the broker passed to ${n.expression.text}() can resolve to the string literal ${literalBroker[0]} (a fallback like \`?? 'paul-stevenson'\`). That silently reads another broker's library; resolve only from the session.`,
            )
          }
          if (!fromSession) {
            problems.push(
              `${rel}:${line}: the broker passed to ${n.expression.text}() does not trace to a session lookup (${SESSION_SOURCES.join(' / ')}). Whose library is this reading?`,
            )
          }
          if (fromRequest) {
            problems.push(
              `${rel}:${line}: the broker passed to ${n.expression.text}() derives from request input (searchParams/params/headers/cookies). A caller could then name ANY broker — e.g. ?broker=paul-stevenson.`,
            )
          }
        }
      }
      ts.forEachChild(n, walk)
    }
    walk(sf)
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

  // (B2, round 4) the LIBRARY's own resolver was never checked, so
  // resolveBrokerSlugForAction could be reduced to `return FALLBACK_BROKER_SLUG`
  // — restoring the round-3 defect verbatim — with the gate green.
  {
    const p = join(process.cwd(), LIB)
    if (existsSync(p)) {
      const raw = readFileSync(p, 'utf8')
      const code = raw.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
      if (!/resolve_deliverable_broker_slug/.test(code)) {
        problems.push(
          `${LIB}: resolveBrokerSlugForAction does not call the shared SQL resolver. A local re-implementation is how the app and the render worker came to disagree about who owns a deliverable.`,
        )
      }
      if (/assigned_approver/.test(code)) {
        problems.push(
          `${LIB}: reads assigned_approver directly. It is 'matt' on every live row, so this collapses every deliverable onto the principal broker.`,
        )
      }
    }
  }

  // (B4-spawn, round 5) the render worker must invoke node via process.execPath,
  // never bare 'node'. It runs from a launchd plist whose PATH has no node, so
  // spawnSync('node', ...) ENOENT'd every cycle for ~6 weeks and no rendered
  // artifact ever reached the library. This is the only automated signal that
  // the visual half of W10.2 can actually run.
  {
    const wp = join(process.cwd(), 'scripts/render-worker.mjs')
    if (existsSync(wp)) {
      const wt = readFileSync(wp, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
      if (/spawnSync\s*\(\s*['"]node['"]/.test(wt)) {
        problems.push(
          "scripts/render-worker.mjs: spawnSync('node', ...) — under launchd's PATH there is no node, so this ENOENTs and no rendered deliverable is ever archived. Use process.execPath.",
        )
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
    // the brokerSlug handed to the persist call must be a BINDING produced by
    // the shared resolver, not a string literal. `await resolveBrokerSlugForAction(id)`
    // followed by `brokerSlug: 'matthew-ryan'` satisfied a presence-of-call check
    // while misfiling every deliverable.
    const literalOwner = /brokerSlug:\s*['"][a-z-]+['"]/.exec(code)
    if (literalOwner) {
      problems.push(
        `${rel}: passes a literal broker (${literalOwner[0]}) to the persist call. Ownership must come from the shared resolver binding, or every deliverable files under one broker.`,
      )
    }
    // A runner may satisfy the contract THROUGH the module it delegates to.
    //
    // WHY (2026-08-02): runProducerRow was extracted from the cron route into
    // lib/marketing-brain/run-producer-core.ts so the one-shot admin trigger
    // could share it. The admin route is now a dispatch envelope that calls
    // runProducerRow, and the core does the persist + ownership resolution
    // (lines 293-294). Reading only the route's own text, this gate reported
    // both contract breaches — with the behaviour fully intact. Following one
    // level of local delegation keeps the contract enforced where it actually
    // executes, instead of forcing the calls to be duplicated back into every
    // caller purely to satisfy a text search.
    //
    // Only the PRESENCE checks look through the delegate. The literal-owner and
    // assigned_approver checks stay scoped to the runner's own code, so a
    // delegate cannot launder a hardcoded broker in the caller.
    const delegated = [...code.matchAll(/from\s+['"]@\/(lib\/[^'"]+)['"]/g)]
      .map((m) => join(process.cwd(), `${m[1]}.ts`))
      .filter((f) => existsSync(f))
      .map((f) => readFileSync(f, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, ''))
      .join('\n')
    const effective = `${code}\n${delegated}`

    if (!new RegExp(`\\b${fnName}\\s*\\(`).test(effective)) {
      problems.push(
        `${rel}: never calls ${fnName}(...), directly or through a module it delegates to. This runner finishes producers, so its output would never reach any broker's library — exactly the regression that left the bucket empty.`,
      )
    }
    // Ownership must come from the ONE shared resolver: either the SQL function
    // directly (the .mjs worker cannot import TypeScript) or the exported
    // wrapper around it. What is banned is a third, local reading of
    // assigned_approver — that is what misfiled every non-Matt deliverable.
    const usesSharedResolver =
      /resolve_deliverable_broker_slug/.test(effective) ||
      /resolveBrokerSlugForAction\s*\(/.test(effective)
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
