#!/usr/bin/env node
/**
 * check-deliverable-send-chokepoint.mjs — ci:deliverable-send-chokepoint.
 *
 * Admin rebuild spec 03 §6.1 ("Unified Send"): every deliverable a broker puts
 * in front of a contact — CMA, broker price opinion, market report, newsletter,
 * saved-search matches — goes through ONE server action,
 * `app/actions/send-deliverable.ts` → `lib/crm/send-deliverable.ts`, which adds
 * uniform in-body auth, an at-most-once ledger claim, and one error vocabulary
 * on top of the already-guarded send engines.
 *
 * G56 (`ci:governed-send`) guards the layer BELOW this one: nothing may touch a
 * provider rail (Twilio / Gmail DWD / Resend) outside lib/comms. This gate
 * guards the layer ABOVE: no surface may reach a deliverable-send ENGINE
 * without going through the chokepoint, and the chokepoint may not quietly lose
 * its guarantees.
 *
 * Two rules, and the first one has no baseline to hide behind.
 *
 *   RULE A — the chokepoint keeps its guarantees (structural, AST, always on):
 *     A1. lib/crm/send-deliverable.ts exports DELIVERABLE_KINDS,
 *         runSendDeliverable, classifySendError, deliverableIdempotencyKey.
 *     A2. runSendDeliverable calls deps.requireAccess, deps.personExists and
 *         deps.requireScope, and reaches deps.dispatch ONLY from inside the
 *         deps.withIdempotency callback — so auth precedes the ledger, the
 *         ledger precedes the send, and no path skips the claim.
 *     A3. app/actions/send-deliverable.ts binds the REAL guards
 *         (requireCrmAccess / requirePersonInScope / withSendIdempotency) and
 *         its dispatch table has an entry for EVERY DeliverableKind — a new
 *         kind cannot ship without a real send path.
 *
 *   RULE B — nothing bypasses it (ratchet over a per-file baseline):
 *     Any file outside the chokepoint that IMPORTS a deliverable-send engine
 *     (sendCmaForContactAction, sendBpoForContactAction,
 *     sendMarketReportNowAction, sendNewsletterToContactAction,
 *     sendListingMatchesForContactAction) is a bypass site. Counts may only
 *     SHRINK. A new file, or a higher count in an existing one, fails the
 *     build. Imports catch prop-passing (`sendAction={sendBpoForContactAction}`)
 *     that a call-expression scan would miss.
 *
 * Usage:
 *   node scripts/check-deliverable-send-chokepoint.mjs
 *   node scripts/check-deliverable-send-chokepoint.mjs --report
 *   node scripts/check-deliverable-send-chokepoint.mjs --write-baseline
 */
import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from 'node:fs'
import { join, relative, dirname, resolve as resolvePath } from 'node:path'
import ts from 'typescript'

const ROOT = process.cwd()
const CORE = 'lib/crm/send-deliverable.ts'
const ACTION = 'app/actions/send-deliverable.ts'
const BASELINE_PATH = join(ROOT, 'scripts', 'deliverable-send-chokepoint-baseline.json')
const SCAN_DIRS = ['app', 'components', 'lib']

/** module (repo-relative, no extension) → the send engine(s) it defines. */
const ENGINE_MODULES = {
  'app/actions/contact-cma': ['sendCmaForContactAction'],
  'app/actions/contact-bpo': ['sendBpoForContactAction'],
  'app/actions/crm-send-now': ['sendMarketReportNowAction'],
  'app/actions/contact-newsletter': ['sendNewsletterToContactAction'],
  'app/actions/contact-listing-matches': ['sendListingMatchesForContactAction'],
}

/** The chokepoint itself + the modules that DEFINE the engines. */
const ALLOWED = new Set([ACTION, ...Object.keys(ENGINE_MODULES).map((m) => `${m}.ts`)])

const problems = []
const REPORT = process.argv.includes('--report')
const WRITE = process.argv.includes('--write-baseline')

// ── helpers ─────────────────────────────────────────────────────────────────
function parse(rel) {
  const abs = join(ROOT, rel)
  if (!existsSync(abs)) return null
  const src = readFileSync(abs, 'utf8')
  return ts.createSourceFile(rel, src, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
}

function walk(node, fn) {
  fn(node)
  node.forEachChild((c) => walk(c, fn))
}

/** Peel `as const` / `satisfies T` wrappers off an initializer. */
function unwrap(node) {
  let n = node
  while (n && (ts.isAsExpression(n) || ts.isSatisfiesExpression?.(n) || ts.isParenthesizedExpression(n))) {
    n = n.expression
  }
  return n
}

function contains(node, predicate) {
  let found = false
  walk(node, (n) => {
    if (!found && predicate(n)) found = true
  })
  return found
}

/** Every `deps.<name>` property access reachable from `node`. */
function depsAccesses(node) {
  const names = []
  walk(node, (n) => {
    if (
      ts.isPropertyAccessExpression(n) &&
      ts.isIdentifier(n.expression) &&
      n.expression.text === 'deps'
    ) {
      names.push(n.name.text)
    }
  })
  return names
}

// ── RULE A ──────────────────────────────────────────────────────────────────
function ruleA() {
  const core = parse(CORE)
  if (!core) {
    problems.push(`A1 ${CORE} is missing — the deliverable chokepoint does not exist.`)
    return []
  }

  // A1 — the exported surface.
  const exported = new Set()
  let kinds = null
  walk(core, (n) => {
    const mods = ts.canHaveModifiers(n) ? (ts.getModifiers(n) ?? []) : []
    const isExported = mods.some((m) => m.kind === ts.SyntaxKind.ExportKeyword)
    if (ts.isFunctionDeclaration(n) && isExported && n.name) exported.add(n.name.text)
    if (ts.isVariableStatement(n) && n.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword)) {
      for (const d of n.declarationList.declarations) {
        if (ts.isIdentifier(d.name)) exported.add(d.name.text)
      }
    }
    if (ts.isVariableDeclaration(n) && ts.isIdentifier(n.name) && n.name.text === 'DELIVERABLE_KINDS') {
      const arr = unwrap(n.initializer)
      if (arr && ts.isArrayLiteralExpression(arr)) {
        kinds = arr.elements.filter(ts.isStringLiteralLike).map((e) => e.text)
      }
    }
  })
  for (const name of [
    'DELIVERABLE_KINDS',
    'runSendDeliverable',
    'classifySendError',
    'deliverableIdempotencyKey',
  ]) {
    if (!exported.has(name)) problems.push(`A1 ${CORE}: does not export ${name}.`)
  }
  if (!kinds || kinds.length === 0) {
    problems.push(`A1 ${CORE}: DELIVERABLE_KINDS is not a readable array of string literals.`)
    kinds = []
  }

  // A2 — the ORDER of the guarantees inside runSendDeliverable.
  let run = null
  walk(core, (n) => {
    if (ts.isFunctionDeclaration(n) && n.name?.text === 'runSendDeliverable') run = n
  })
  if (!run) {
    problems.push(`A2 ${CORE}: runSendDeliverable is not a function declaration the gate can inspect.`)
  } else {
    const used = new Set(depsAccesses(run))
    for (const dep of ['requireAccess', 'personExists', 'requireScope', 'withIdempotency', 'dispatch']) {
      if (!used.has(dep)) {
        problems.push(
          `A2 ${CORE}: runSendDeliverable never uses deps.${dep} — a guarantee of the chokepoint was dropped.`,
        )
      }
    }
    // deps.dispatch must be reachable ONLY from inside the withIdempotency
    // callback: the ledger claim has to be held before anything sends.
    let claimCall = null
    walk(run, (n) => {
      if (
        ts.isCallExpression(n) &&
        ts.isPropertyAccessExpression(n.expression) &&
        ts.isIdentifier(n.expression.expression) &&
        n.expression.expression.text === 'deps' &&
        n.expression.name.text === 'withIdempotency'
      ) {
        claimCall = n
      }
    })
    if (!claimCall) {
      problems.push(`A2 ${CORE}: runSendDeliverable does not call deps.withIdempotency — sends are not at-most-once.`)
    } else {
      const runArg = claimCall.arguments[1]
      const isDispatch = (n) =>
        ts.isPropertyAccessExpression(n) &&
        ts.isIdentifier(n.expression) &&
        n.expression.text === 'deps' &&
        n.name.text === 'dispatch'
      // The second argument must BE the deferred callback — not an expression
      // that merely CONTAINS one. `deps.withIdempotency(args, (() => { const
      // eager = deps.dispatch[k](…); return async () => eager })())` is
      // lexically "inside the argument" yet fires the send while the argument
      // list is being evaluated, i.e. BEFORE the claim exists. Pinning the
      // argument to a literal function and scoping the search to its BODY is
      // what makes the ordering real. (Found by the gate's own bite test.)
      const isDeferredFn = runArg && (ts.isArrowFunction(runArg) || ts.isFunctionExpression(runArg))
      if (!isDeferredFn) {
        problems.push(
          `A2 ${CORE}: the second argument to deps.withIdempotency must be a literal function so the send is DEFERRED until the claim is held (found ${runArg ? ts.SyntaxKind[runArg.kind] : 'nothing'}).`,
        )
      }
      const claimBody = isDeferredFn ? runArg.body : null
      const insideClaim = claimBody ? contains(claimBody, isDispatch) : false
      if (!insideClaim) {
        problems.push(
          `A2 ${CORE}: deps.dispatch is not reached from inside the deps.withIdempotency callback body — a send could fire without holding the claim.`,
        )
      }
      // …and nowhere else in the function.
      let outside = 0
      walk(run, (n) => {
        if (!isDispatch(n)) return
        const withinClaim = claimBody && n.pos >= claimBody.pos && n.end <= claimBody.end
        if (!withinClaim) outside += 1
      })
      if (outside > 0) {
        problems.push(
          `A2 ${CORE}: deps.dispatch is reached ${outside}× OUTSIDE the idempotency claim callback — every send must be inside it.`,
        )
      }
    }
  }

  // A3 — the real wiring.
  const action = parse(ACTION)
  if (!action) {
    problems.push(`A3 ${ACTION} is missing — the unified send action does not exist.`)
    return kinds
  }
  let dispatchObj = null
  let depsObj = null
  walk(action, (n) => {
    if (!ts.isVariableDeclaration(n) || !ts.isIdentifier(n.name)) return
    const obj = unwrap(n.initializer)
    if (!obj || !ts.isObjectLiteralExpression(obj)) return
    if (n.name.text === 'dispatch') dispatchObj = obj
    if (n.name.text === 'deps') depsObj = obj
  })

  if (!dispatchObj) {
    problems.push(`A3 ${ACTION}: no \`dispatch\` object literal — the gate cannot verify kind coverage.`)
  } else {
    const covered = new Set(
      dispatchObj.properties
        .map((p) => (p.name && (ts.isIdentifier(p.name) || ts.isStringLiteralLike(p.name)) ? p.name.text : null))
        .filter(Boolean),
    )
    for (const k of kinds) {
      if (!covered.has(k)) {
        problems.push(`A3 ${ACTION}: dispatch has no entry for deliverable kind "${k}" — it would fail at runtime.`)
      }
    }
    for (const k of covered) {
      if (!kinds.includes(k)) {
        problems.push(`A3 ${ACTION}: dispatch entry "${k}" is not a DeliverableKind in ${CORE}.`)
      }
    }
  }

  if (!depsObj) {
    problems.push(`A3 ${ACTION}: no \`deps\` object literal — the gate cannot verify the real guards are bound.`)
  } else {
    const bound = new Map()
    for (const p of depsObj.properties) {
      if (!p.name || !ts.isIdentifier(p.name)) continue
      if (ts.isShorthandPropertyAssignment(p)) bound.set(p.name.text, p.name.text)
      else if (ts.isPropertyAssignment(p) && ts.isIdentifier(p.initializer)) bound.set(p.name.text, p.initializer.text)
      else bound.set(p.name.text, '(expression)')
    }
    const required = {
      requireAccess: 'requireCrmAccess',
      requireScope: 'requirePersonInScope',
      withIdempotency: 'withSendIdempotency',
      dispatch: 'dispatch',
      personExists: 'personExists',
    }
    for (const [key, expected] of Object.entries(required)) {
      const actual = bound.get(key)
      if (actual !== expected) {
        problems.push(
          `A3 ${ACTION}: deps.${key} must be bound to ${expected} (found ${actual ?? 'nothing'}) — the chokepoint would not run the real guard.`,
        )
      }
    }
  }

  let callsCore = false
  walk(action, (n) => {
    if (ts.isCallExpression(n) && ts.isIdentifier(n.expression) && n.expression.text === 'runSendDeliverable') {
      callsCore = true
    }
  })
  if (!callsCore) problems.push(`A3 ${ACTION}: never calls runSendDeliverable — the policy is not applied.`)

  return kinds
}

// ── RULE B ──────────────────────────────────────────────────────────────────
function listFiles(dir, out = []) {
  const abs = join(ROOT, dir)
  if (!existsSync(abs)) return out
  for (const entry of readdirSync(abs)) {
    if (entry === 'node_modules' || entry === '.next' || entry.startsWith('.')) continue
    const rel = join(dir, entry)
    const st = statSync(join(ROOT, rel))
    if (st.isDirectory()) listFiles(rel, out)
    else if (/\.(ts|tsx)$/.test(entry) && !/\.test\.(ts|tsx)$/.test(entry) && !/\.d\.ts$/.test(entry)) out.push(rel)
  }
  return out
}

/** Resolve an import specifier to a repo-relative module path (no extension). */
function resolveSpecifier(spec, fromRel) {
  if (spec.startsWith('@/')) return spec.slice(2).replace(/\.(ts|tsx)$/, '')
  if (spec.startsWith('.')) {
    const abs = resolvePath(dirname(join(ROOT, fromRel)), spec)
    return relative(ROOT, abs).replace(/\.(ts|tsx)$/, '')
  }
  return null
}

function ruleB() {
  const found = {}
  const sites = []
  for (const dir of SCAN_DIRS) {
    for (const rel of listFiles(dir)) {
      if (ALLOWED.has(rel)) continue
      const sf = parse(rel)
      if (!sf) continue
      for (const stmt of sf.statements) {
        if (!ts.isImportDeclaration(stmt)) continue
        if (!ts.isStringLiteralLike(stmt.moduleSpecifier)) continue
        const mod = resolveSpecifier(stmt.moduleSpecifier.text, rel)
        const engines = mod ? ENGINE_MODULES[mod] : null
        if (!engines) continue
        const clause = stmt.importClause
        if (!clause || clause.isTypeOnly) continue
        const named = clause.namedBindings
        if (!named || !ts.isNamedImports(named)) continue
        for (const el of named.elements) {
          if (el.isTypeOnly) continue
          const imported = (el.propertyName ?? el.name).text
          if (!engines.includes(imported)) continue
          found[rel] = (found[rel] ?? 0) + 1
          const line = sf.getLineAndCharacterOfPosition(el.getStart(sf)).line + 1
          sites.push(`${rel}:${line}  ${imported}`)
        }
      }
    }
  }
  return { found, sites }
}

// ── run ─────────────────────────────────────────────────────────────────────
const kinds = ruleA()
const { found, sites } = ruleB()

if (REPORT) {
  console.log(`Deliverable kinds: ${kinds.join(', ') || '(none)'}`)
  console.log(`Bypass import sites (${sites.length}):`)
  for (const s of sites.sort()) console.log(`  ${s}`)
}

if (WRITE) {
  const payload = {
    $comment:
      'Ratchet baseline for check-deliverable-send-chokepoint.mjs (RULE B). Each key is a file that imports a deliverable-send ENGINE directly instead of calling sendDeliverable (app/actions/send-deliverable.ts); the value is the number of such imports. Counts may only SHRINK. Route the surface through sendDeliverable and regenerate with: node scripts/check-deliverable-send-chokepoint.mjs --write-baseline. NEVER hand-add an entry or bump a count.',
    files: Object.fromEntries(Object.entries(found).sort(([a], [b]) => a.localeCompare(b))),
  }
  writeFileSync(BASELINE_PATH, `${JSON.stringify(payload, null, 2)}\n`)
  console.log(`✓ wrote ${relative(ROOT, BASELINE_PATH)} (${Object.keys(found).length} files, ${sites.length} sites)`)
  process.exit(0)
}

let baseline = { files: {} }
if (existsSync(BASELINE_PATH)) {
  baseline = JSON.parse(readFileSync(BASELINE_PATH, 'utf8'))
} else {
  problems.push(
    `RULE B: baseline missing at ${relative(ROOT, BASELINE_PATH)} — run --write-baseline once, then commit it.`,
  )
}
const base = baseline.files ?? {}

for (const [file, count] of Object.entries(found)) {
  const allowed = base[file] ?? 0
  if (count > allowed) {
    problems.push(
      `B ${file}: imports a deliverable-send engine ${count}× (baseline ${allowed}). Call sendDeliverable() from @/app/actions/send-deliverable instead — one chokepoint, one auth shape, one at-most-once ledger.`,
    )
  }
}
const shrunk = []
for (const [file, allowed] of Object.entries(base)) {
  const count = found[file] ?? 0
  if (count < allowed) shrunk.push(`${file}: ${allowed} → ${count}`)
}

console.log('Deliverable-send chokepoint gate (ci:deliverable-send-chokepoint)')
console.log('=================================================================')
console.log(`kinds: ${kinds.length}  ·  bypass sites: ${sites.length} across ${Object.keys(found).length} file(s)`)
if (shrunk.length) {
  console.log('\nRatchet moved (re-baseline to lock it in):')
  for (const s of shrunk) console.log(`  ↓ ${s}`)
}

if (problems.length) {
  console.error('\n[31mProblems:[0m')
  for (const p of problems) console.error(`  ✗ ${p}`)
  console.error(
    `\n[31m✗ ci:deliverable-send-chokepoint: ${problems.length} problem(s).[0m`,
  )
  process.exit(1)
}

console.log('\n✓ The chokepoint holds its guarantees and no new surface bypasses it.')
process.exit(0)
