#!/usr/bin/env node
/**
 * check-deploy-defect-filing.mjs — ci:deploy-defect-filing (G85).
 *
 * Matt 2026-10-14: "When the post-deploy check finds a problem, it would
 * automatically file one claimable work item. The first session to claim it owns
 * the fix, and every other session sees it's taken." That day two sessions both
 * saw `npm run deploy:verify` flag the same noindex sitemap URLs and both built a
 * fix (#580 and a duplicate that had to be thrown away).
 *
 * The mechanism is lib/data/loop/deploy-defects.ts (rules) bound to the work-graph
 * DAL (deploy-defects-dal.ts), run from deploy:verify through
 * scripts/lib/deploy-defect-report.mjs and scripts/deploy-defects.ts. Its unit
 * tests prove the rules. This gate proves the WIRING stays: a later edit that
 * drops a check's record, exits before the filer runs, writes a claim by hand, or
 * lets the boot brief stop listing the nodes would leave every test green and
 * bring the duplicate fix back. Source assertions (TypeScript AST, comments and
 * strings cannot fake a call):
 *
 *   R1  check-vercel-deploy.mjs builds the report (createDefectReport + noFileRequested)
 *       and runs every live check in runLiveChecks().
 *   R2  runLiveChecks() records a fail AND a pass for every check family in
 *       DEPLOY_CHECK_FAMILIES (a new family needs both), calls defects.flush(), and
 *       never calls process.exit (an early exit would skip the filer).
 *   R3  main() hands the READY deploy to runLiveChecks and exits with what it returns,
 *       so the exit code is the checks' verdict, not the filer's.
 *   R4  deploy-defect-report.mjs runs scripts/deploy-defects.ts under
 *       --conditions=react-server and its flush() and priorityPaths() cannot throw.
 *   R5  deploy-defects-dal.ts reaches the table only through the work-graph DAL
 *       (createWorkNode, claimWorkNode, completeWorkNode, releaseWorkNode,
 *       readWorkNodesByGap) and builds no client. deploy-defects.ts (the rules) and
 *       scripts/deploy-defects.ts (the claim path) build none either: a claim is
 *       never written by hand.
 *   R6  loop-brief.ts prints formatDeployDefectBrief above the handoff.
 *   R7  fleet-cases.ts leaves DEPLOY-* nodes out of the fleet packs.
 *   R8  docs/RUN_LOOP.md carries the rule: check the node, claim it, leave a claimed one.
 *
 * Cannot see: that the child process works against the live database (the unit
 * tests mock the DAL; a `--no-file` run exercises the read), or a NEW check added to
 * deploy:verify outside runLiveChecks (R2 only knows the families the module lists).
 *
 * Usage: node scripts/check-deploy-defect-filing.mjs [--report] [--json]
 *   --report  print the findings, always exit 0.  --json  machine-readable.
 * Break-tests: scripts/__tests__/check-deploy-defect-filing.test.mjs
 */
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const FILES = {
  deploy: 'scripts/check-vercel-deploy.mjs',
  report: 'scripts/lib/deploy-defect-report.mjs',
  rules: 'lib/data/loop/deploy-defects.ts',
  dal: 'lib/data/loop/deploy-defects-dal.ts',
  cli: 'scripts/deploy-defects.ts',
  brief: 'scripts/loop-brief.ts',
  fleet: 'lib/data/loop/fleet-cases.ts',
  runLoop: 'docs/RUN_LOOP.md',
}
const DAL_FUNCTIONS = ['createWorkNode', 'claimWorkNode', 'completeWorkNode', 'releaseWorkNode', 'readWorkNodesByGap']

const args = process.argv.slice(2)
const REPORT = args.includes('--report')
const JSON_OUT = args.includes('--json')

const problems = []
const fail = (rule, msg) => problems.push({ rule, msg })

function read(key) {
  const p = join(ROOT, FILES[key])
  if (!existsSync(p)) {
    fail(key, `${FILES[key]} is missing`)
    return null
  }
  return readFileSync(p, 'utf8')
}

function parse(rel, text) {
  return ts.createSourceFile(rel, text, ts.ScriptTarget.Latest, true, rel.endsWith('.ts') ? ts.ScriptKind.TS : ts.ScriptKind.JS)
}

function walk(node, visit) {
  visit(node)
  ts.forEachChild(node, (c) => walk(c, visit))
}

function findFunction(sf, name) {
  let found = null
  walk(sf, (n) => {
    if (!found && ts.isFunctionDeclaration(n) && n.name?.text === name) found = n
  })
  return found
}

function callsIn(node) {
  const out = []
  walk(node, (n) => {
    if (ts.isCallExpression(n)) out.push(n)
  })
  return out
}

const calleeText = (call, sf) => call.expression.getText(sf)

function strProp(obj, name) {
  for (const p of obj.properties) {
    if (ts.isPropertyAssignment(p) && p.name.getText() === name && ts.isStringLiteralLike(p.initializer)) return p.initializer.text
  }
  return null
}

/** The check families deploy:verify must record: the keys of DEPLOY_CHECK_FAMILIES. */
function familiesOf(sf) {
  let names = null
  walk(sf, (n) => {
    if (names || !ts.isVariableDeclaration(n) || n.name.getText() !== 'DEPLOY_CHECK_FAMILIES' || !n.initializer) return
    let init = n.initializer
    while (ts.isAsExpression(init) || ts.isParenthesizedExpression(init)) init = init.expression
    if (ts.isObjectLiteralExpression(init)) {
      names = init.properties.filter((p) => p.name).map((p) => (ts.isStringLiteralLike(p.name) ? p.name.text : p.name.getText()))
    }
  })
  return names
}

/** Does this file import `name` from a specifier ending in `from`? */
function importsFrom(sf, name, from) {
  let ok = false
  walk(sf, (n) => {
    if (!ts.isImportDeclaration(n) || !ts.isStringLiteralLike(n.moduleSpecifier) || !n.moduleSpecifier.text.endsWith(from)) return
    const nb = n.importClause?.namedBindings
    if (nb && ts.isNamedImports(nb) && nb.elements.some((e) => (e.propertyName ?? e.name).text === name)) ok = true
  })
  return ok
}

/** Does the node tie to a try statement (the function cannot throw)? */
function hasTry(node) {
  let t = false
  walk(node, (n) => {
    if (ts.isTryStatement(n)) t = true
  })
  return t
}

function methodNamed(sf, name) {
  let found = null
  walk(sf, (n) => {
    if (!found && ts.isMethodDeclaration(n) && n.name.getText() === name) found = n
  })
  return found
}

// ── rules ───────────────────────────────────────────────────────────────────

const rulesSrc = read('rules')
const rulesSf = rulesSrc ? parse(FILES.rules, rulesSrc) : null
const families = rulesSf ? familiesOf(rulesSf) : null
if (rulesSf && (!families || families.length === 0)) fail('R2', `${FILES.rules} must export DEPLOY_CHECK_FAMILIES (an object literal of the checks deploy:verify runs)`)

const deploySrc = read('deploy')
if (deploySrc) {
  const sf = parse(FILES.deploy, deploySrc)
  if (!importsFrom(sf, 'createDefectReport', 'deploy-defect-report.mjs') || !importsFrom(sf, 'noFileRequested', 'deploy-defect-report.mjs')) {
    fail('R1', `${FILES.deploy} must import createDefectReport and noFileRequested from ./lib/deploy-defect-report.mjs`)
  }
  const mainCalls = callsIn(sf).map((c) => calleeText(c, sf))
  if (!mainCalls.includes('createDefectReport')) fail('R1', `${FILES.deploy} must call createDefectReport({ sha, write: !noFileRequested(argv) }): every failure is filed through it`)
  if (!mainCalls.includes('noFileRequested')) fail('R1', `${FILES.deploy} must honor --no-file / DEPLOY_VERIFY_NO_FILE=1 (noFileRequested): a run that must not write needs the switch`)

  const live = findFunction(sf, 'runLiveChecks')
  if (!live) {
    fail('R1', `${FILES.deploy} must run its live checks in runLiveChecks(): one function that records every result and files before it returns`)
  } else {
    const calls = callsIn(live)
    const recorded = new Set()
    let flushed = false
    for (const c of calls) {
      const callee = calleeText(c, sf)
      if (callee === 'process.exit') fail('R2', `${FILES.deploy} runLiveChecks() calls process.exit: an exit there skips the filer. Return the code instead; main() exits with it.`)
      if (callee === 'defects.flush') flushed = true
      if (callee === 'defects.record' && c.arguments[0] && ts.isObjectLiteralExpression(c.arguments[0])) {
        const family = strProp(c.arguments[0], 'family')
        const status = strProp(c.arguments[0], 'status')
        if (family && status) recorded.add(`${family}:${status}`)
      }
    }
    if (!flushed) fail('R2', `${FILES.deploy} runLiveChecks() never calls defects.flush(): nothing would be filed`)
    for (const family of families ?? []) {
      for (const status of ['fail', 'pass']) {
        if (!recorded.has(`${family}:${status}`)) {
          fail('R2', `${FILES.deploy} runLiveChecks() never records ${family} as ${status} (defects.record({ family: '${family}', status: '${status}', ... })): a failure of that check would not be filed${status === 'pass' ? ', and its node would never close' : ''}`)
        }
      }
    }
    const main = findFunction(sf, 'main')
    const mainText = main ? main.getText(sf) : ''
    if (!/process\.exit\(\s*await\s+runLiveChecks\(/.test(mainText)) {
      fail('R3', `${FILES.deploy} main() must hand the READY deploy to runLiveChecks and exit with what it returns: process.exit(await runLiveChecks({ ... }))`)
    }
  }
}

const reportSrc = read('report')
if (reportSrc) {
  const sf = parse(FILES.report, reportSrc)
  if (!/FILER_SCRIPT\s*=\s*'scripts\/deploy-defects\.ts'/.test(reportSrc)) fail('R4', `${FILES.report} must run scripts/deploy-defects.ts (FILER_SCRIPT)`)
  if (!reportSrc.includes("'--conditions=react-server'")) fail('R4', `${FILES.report} must run the filer under --conditions=react-server (the work-graph DAL is server-only)`)
  for (const name of ['flush', 'priorityPaths']) {
    const m = methodNamed(sf, name)
    if (!m || !hasTry(m)) fail('R4', `${FILES.report} ${name}() must catch every error: filing is a courtesy on top of the verdict and must never crash deploy:verify`)
  }
}

for (const key of ['dal', 'rules', 'cli']) {
  const src = read(key)
  if (!src) continue
  const sf = parse(FILES[key], src)
  walk(sf, (n) => {
    if (
      ts.isCallExpression(n) &&
      ts.isPropertyAccessExpression(n.expression) &&
      n.expression.name.text === 'from' &&
      !['Array', 'Buffer', 'Object', 'Uint8Array'].includes(n.expression.expression.getText(sf))
    ) {
      fail('R5', `${FILES[key]} calls .from(): reach loop_work_nodes only through the work-graph DAL (lib/data/loop/work-graph.ts)`)
    }
    if (ts.isCallExpression(n) && ['createClient', 'createServiceClient'].includes(n.expression.getText(sf))) {
      fail('R5', `${FILES[key]} builds a database client: a claim is never written by hand; use the work-graph DAL`)
    }
  })
  if (key === 'dal') {
    for (const fn of DAL_FUNCTIONS) {
      if (!importsFrom(sf, fn, './work-graph') || !callsIn(sf).some((c) => calleeText(c, sf) === fn)) {
        fail('R5', `${FILES.dal} must import and call ${fn} from ./work-graph`)
      }
    }
  }
  if (key === 'cli' && !importsFrom(sf, 'deployDefectOps', 'deploy-defects-dal')) {
    fail('R5', `${FILES.cli} must build its ops with deployDefectOps() (the DAL binding)`)
  }
}

const briefSrc = read('brief')
if (briefSrc) {
  const sf = parse(FILES.brief, briefSrc)
  if (!importsFrom(sf, 'formatDeployDefectBrief', 'deploy-defects')) fail('R6', `${FILES.brief} must import formatDeployDefectBrief from lib/data/loop/deploy-defects`)
  const call = callsIn(sf).find((c) => calleeText(c, sf) === 'formatDeployDefectBrief')
  let handoffAt = -1
  walk(sf, (n) => {
    if (handoffAt < 0 && ts.isStringLiteralLike(n) && n.text.includes('--- HANDOFF (standing holds')) handoffAt = n.getStart(sf)
  })
  if (!call || handoffAt < 0 || call.getStart(sf) > handoffAt) {
    fail('R6', `${FILES.brief} must print formatDeployDefectBrief(...) above the HANDOFF section: open deploy-found nodes and who holds them belong near the top`)
  }
}

const fleetSrc = read('fleet')
if (fleetSrc && !/isDeployFoundGap\(/.test(fleetSrc)) {
  fail('R7', `${FILES.fleet} must leave DEPLOY-* nodes out of the fleet packs (isDeployFoundGap): an open defect is not upcoming work and a done one is not shipped work to re-certify`)
}

const runLoopSrc = read('runLoop')
if (runLoopSrc && !(/deploy-defects\.ts/.test(runLoopSrc) && /leave it/i.test(runLoopSrc))) {
  fail('R8', `${FILES.runLoop} must carry the rule: before fixing a defect you found, check its work node and claim it (scripts/deploy-defects.ts); if another owner holds it, leave it`)
}

// ── report ──────────────────────────────────────────────────────────────────

if (JSON_OUT) {
  console.log(JSON.stringify({ ok: problems.length === 0, problems }, null, 2))
  process.exit(REPORT || problems.length === 0 ? 0 : 1)
}
console.log('Deploy defect filing gate (ci:deploy-defect-filing)')
console.log('==================================================')
if (problems.length === 0) {
  console.log(`✓ deploy:verify records ${(families ?? []).length} check families, files through the work-graph DAL, and the boot brief lists the nodes.`)
  process.exit(0)
}
for (const p of problems) console.error(`✗ [${p.rule}] ${p.msg}`)
console.error('\nFix: docs/MECHANICAL_GATES.md G85, lib/data/loop/deploy-defects.ts header.')
process.exit(REPORT ? 0 : 1)
