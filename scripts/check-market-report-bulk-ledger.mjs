#!/usr/bin/env node
/**
 * check-market-report-bulk-ledger.mjs — ci:market-report-bulk-ledger (W8.6).
 *
 * The market-report product must have exactly ONE bulk delivery path, and that
 * path is the newsletter delivery ledger. The failure this gate makes impossible:
 * someone adds a "just send it to this list" loop next to the audience selector,
 * and that loop quietly skips the rails the ledger enforces per recipient
 * (opt-out never resurrected, suppression re-checked immediately before each
 * send, RFC 8058 one-click unsubscribe header, deliverability block on a bad
 * sender reputation, the bounce/complaint circuit breaker, warm-up tranching,
 * and the per-recipient delivery record).
 *
 * Four properties, all checked against the TypeScript AST (repo rule: code-
 * inspecting gates use the compiler, never regex) so a comment, a doc block, or
 * a string literal can never satisfy a requirement:
 *
 *   1. LEDGER ROUTING — lib/newsletter/market-report-bulk.ts references BOTH
 *      queue entrypoints (enqueueNewsletter, enqueueNewsletterToEmails) as real
 *      values imported from lib/newsletter/send-queue.
 *   2. NO SECOND SEND PATH — no file in the bulk lane references a raw send
 *      primitive (sendEmail / sendGovernedEmail / sendSms / Resend). Bulk
 *      delivery is the queue's job; this lane only renders and enqueues.
 *   3. NO DEAD AUDIENCE OPTION — every kind declared in
 *      MARKET_REPORT_AUDIENCE_KINDS has a real `case` clause in ledgerRouteFor
 *      (a route), in resolveMarketReportAudience (a resolver), and in the admin
 *      picker's descriptor switch (a UI branch). Adding a kind without wiring it
 *      is RED, not a silently broken menu item.
 *   4. AUTHZ — both exported admin actions call requireSuperuser. A bulk send
 *      reaches the company-wide book; a broker-scoped admin must not fire it.
 *
 * Usage:
 *   node scripts/check-market-report-bulk-ledger.mjs            # CI, exits 1 on a hit
 *   node scripts/check-market-report-bulk-ledger.mjs --report   # human, never exits 1
 */
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import ts from 'typescript'

const ROOT = process.cwd()
const REPORT = process.argv.includes('--report')

const AUDIENCE_FILE = 'lib/newsletter/market-report-audience.ts'
const BULK_FILE = 'lib/newsletter/market-report-bulk.ts'
const ACTIONS_FILE = 'app/admin/(protected)/crm/settings/market-reports/actions.ts'
const FORM_FILE = 'app/admin/(protected)/crm/settings/market-reports/BulkSendForm.tsx'
const TEST_FILE = 'lib/newsletter/market-report-bulk.contract.test.ts'

/** The queue entrypoints that ARE the delivery ledger. */
const LEDGER_ENTRYPOINTS = ['enqueueNewsletter', 'enqueueNewsletterToEmails']
const SEND_QUEUE_SPECIFIERS = ['./send-queue', '@/lib/newsletter/send-queue']

/** Raw send primitives. None of these belong anywhere in the bulk lane. */
const BANNED_SEND_IDENTIFIERS = ['sendEmail', 'sendGovernedEmail', 'sendSms', 'sendSmsViaMessagingService', 'Resend']

/** Files that must contain no direct send. */
const LANE_FILES = [BULK_FILE, AUDIENCE_FILE, ACTIONS_FILE, FORM_FILE]

const problems = []

function parse(rel) {
  const p = join(ROOT, rel)
  if (!existsSync(p)) {
    problems.push(`${rel}: file not found (the W8.6 bulk seam is missing)`)
    return null
  }
  const kind = rel.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS
  return ts.createSourceFile(rel, readFileSync(p, 'utf8'), ts.ScriptTarget.Latest, true, kind)
}

function walk(node, fn) {
  fn(node)
  ts.forEachChild(node, (c) => walk(c, fn))
}

/** Every identifier that appears as REAL CODE (comments and strings are not identifiers). */
function identifiers(sf) {
  const out = new Set()
  walk(sf, (n) => {
    if (ts.isIdentifier(n)) out.add(n.text)
  })
  return out
}

/** Map of module specifier -> imported binding names. */
function imports(sf) {
  const out = new Map()
  walk(sf, (n) => {
    if (!ts.isImportDeclaration(n) || !ts.isStringLiteralLike(n.moduleSpecifier)) return
    const spec = n.moduleSpecifier.text
    const names = out.get(spec) ?? new Set()
    const clause = n.importClause
    if (clause?.name) names.add(clause.name.text)
    if (clause?.namedBindings && ts.isNamedImports(clause.namedBindings)) {
      for (const el of clause.namedBindings.elements) names.add(el.name.text)
    }
    out.set(spec, names)
  })
  return out
}

/**
 * String elements of `export const <name> = [ ... ] as const`. Real array
 * literal only — a JSDoc list of kinds cannot satisfy it.
 */
function constStringArray(sf, name) {
  let found = null
  walk(sf, (n) => {
    if (!ts.isVariableDeclaration(n) || !ts.isIdentifier(n.name) || n.name.text !== name) return
    let init = n.initializer
    if (init && ts.isAsExpression(init)) init = init.expression
    if (!init || !ts.isArrayLiteralExpression(init)) return
    found = init.elements.filter(ts.isStringLiteralLike).map((e) => e.text)
  })
  return found
}

/** Locate a function-ish declaration by name (function decl, or const = arrow/function). */
function functionNode(sf, name) {
  let found = null
  walk(sf, (n) => {
    if (ts.isFunctionDeclaration(n) && n.name?.text === name) found = n
    if (
      ts.isVariableDeclaration(n) &&
      ts.isIdentifier(n.name) &&
      n.name.text === name &&
      n.initializer &&
      (ts.isArrowFunction(n.initializer) || ts.isFunctionExpression(n.initializer))
    ) {
      found = n.initializer
    }
  })
  return found
}

/** String literals used as `case '<x>':` inside the named function. Real CaseClause nodes only. */
function switchCaseLiterals(sf, fnName) {
  const fn = functionNode(sf, fnName)
  if (!fn) return null
  const out = new Set()
  walk(fn, (n) => {
    if (ts.isCaseClause(n) && ts.isStringLiteralLike(n.expression)) out.add(n.expression.text)
  })
  return out
}

/** True when the named function body contains a real call to `callee`. */
function functionCalls(sf, fnName, callee) {
  const fn = functionNode(sf, fnName)
  if (!fn) return false
  let hit = false
  walk(fn, (n) => {
    if (!ts.isCallExpression(n)) return
    const e = n.expression
    const nm = ts.isIdentifier(e) ? e.text : ts.isPropertyAccessExpression(e) ? e.name.text : null
    if (nm === callee) hit = true
  })
  return hit
}

// ── parse the lane ────────────────────────────────────────────────────────────

const audienceSf = parse(AUDIENCE_FILE)
const bulkSf = parse(BULK_FILE)
const actionsSf = parse(ACTIONS_FILE)
const formSf = parse(FORM_FILE)
if (!existsSync(join(ROOT, TEST_FILE))) {
  problems.push(`${TEST_FILE}: contract test not found (the seam must be pinned by a test)`)
}

// ── 1. ledger routing ─────────────────────────────────────────────────────────

if (bulkSf) {
  const bulkImports = imports(bulkSf)
  const fromQueue = new Set()
  for (const spec of SEND_QUEUE_SPECIFIERS) {
    for (const n of bulkImports.get(spec) ?? []) fromQueue.add(n)
  }
  const bulkIds = identifiers(bulkSf)
  for (const entry of LEDGER_ENTRYPOINTS) {
    if (!fromQueue.has(entry)) {
      problems.push(
        `${BULK_FILE}: does not import ${entry} from the newsletter queue — bulk delivery must route through the delivery ledger, not a second path`,
      )
    } else if (!bulkIds.has(entry)) {
      problems.push(`${BULK_FILE}: imports ${entry} but never references it (an unused import is not a route)`)
    }
  }
}

// ── 2. no second send path ────────────────────────────────────────────────────

for (const rel of LANE_FILES) {
  const sf = rel === BULK_FILE ? bulkSf : rel === AUDIENCE_FILE ? audienceSf : rel === ACTIONS_FILE ? actionsSf : formSf
  if (!sf) continue
  const ids = identifiers(sf)
  for (const banned of BANNED_SEND_IDENTIFIERS) {
    if (ids.has(banned)) {
      problems.push(
        `${rel}: references ${banned} — the bulk lane renders and enqueues, it never sends. Delivery belongs to the newsletter queue drain, which re-checks suppression per recipient.`,
      )
    }
  }
}

// ── 3. no dead audience option ────────────────────────────────────────────────

let kinds = null
if (audienceSf) {
  kinds = constStringArray(audienceSf, 'MARKET_REPORT_AUDIENCE_KINDS')
  if (!kinds || kinds.length === 0) {
    problems.push(`${AUDIENCE_FILE}: MARKET_REPORT_AUDIENCE_KINDS is missing or not a literal string array`)
  }
}

if (kinds && kinds.length > 0) {
  const routeCases = audienceSf ? switchCaseLiterals(audienceSf, 'ledgerRouteFor') : null
  if (!routeCases) {
    problems.push(`${AUDIENCE_FILE}: ledgerRouteFor not found (every audience kind needs a ledger route)`)
  }
  const resolverCases = bulkSf ? switchCaseLiterals(bulkSf, 'resolveMarketReportAudience') : null
  if (!resolverCases) {
    problems.push(`${BULK_FILE}: resolveMarketReportAudience not found (every audience kind needs a resolver)`)
  }
  const uiCases = formSf ? switchCaseLiterals(formSf, 'audienceDescriptor') : null
  if (!uiCases) {
    problems.push(`${FORM_FILE}: audienceDescriptor not found (the picker must build a descriptor per kind)`)
  }

  for (const kind of kinds) {
    if (routeCases && !routeCases.has(kind)) {
      problems.push(`audience kind "${kind}" has no case in ledgerRouteFor (${AUDIENCE_FILE}) — it reaches no ledger entrypoint`)
    }
    if (resolverCases && !resolverCases.has(kind)) {
      problems.push(`audience kind "${kind}" has no case in resolveMarketReportAudience (${BULK_FILE}) — it resolves to nobody`)
    }
    if (uiCases && !uiCases.has(kind)) {
      problems.push(`audience kind "${kind}" has no case in the admin picker's audienceDescriptor (${FORM_FILE}) — a dead menu option`)
    }
  }

  // The picker must render the SHARED kind list, never a hardcoded subset.
  if (formSf) {
    const formImports = imports(formSf)
    const fromAudience = new Set([
      ...(formImports.get('@/lib/newsletter/market-report-audience') ?? []),
      ...(formImports.get('./market-report-audience') ?? []),
    ])
    if (!fromAudience.has('MARKET_REPORT_AUDIENCE_KINDS')) {
      problems.push(
        `${FORM_FILE}: does not import MARKET_REPORT_AUDIENCE_KINDS — the picker must render the shared kind list so it cannot drift from the resolver`,
      )
    }
  }
}

// ── 4. authz ──────────────────────────────────────────────────────────────────

if (actionsSf) {
  for (const fn of ['previewMarketReportBulkAction', 'queueMarketReportBulkAction']) {
    if (!functionNode(actionsSf, fn)) {
      problems.push(`${ACTIONS_FILE}: ${fn} not found`)
    } else if (!functionCalls(actionsSf, fn, 'requireSuperuser')) {
      problems.push(
        `${ACTIONS_FILE}: ${fn} does not call requireSuperuser — a bulk market-report send reaches the company-wide book and is superuser-only`,
      )
    }
  }
}

// ── report ────────────────────────────────────────────────────────────────────

console.log('Market-report bulk → newsletter ledger gate (ci:market-report-bulk-ledger)')
console.log('==========================================================================')
console.log(`audience kinds: ${kinds ? kinds.join(', ') : '(unreadable)'}`)
console.log(`lane files scanned: ${LANE_FILES.length}`)

if (problems.length) {
  console.error('\nProblems:')
  for (const p of problems) console.error(`  ✗ ${p}`)
  if (REPORT) process.exit(0)
  console.error(
    `\n[31m✗ ci:market-report-bulk-ledger: ${problems.length} problem(s). Bulk market-report delivery must run through the newsletter delivery ledger, with every declared audience kind routed, resolved, and offered.[0m`,
  )
  process.exit(1)
}

console.log('\n✓ Bulk delivery routes through the newsletter queue, no second send path, every audience kind is routed + resolved + offered, actions are superuser-only.')
process.exit(0)
