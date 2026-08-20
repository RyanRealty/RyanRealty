#!/usr/bin/env node
/**
 * check-gates-wired.mjs — the META-GATE: every gate must actually be enforced.
 *
 * A gate that runs nowhere automatically is "prose" — it relies on a human
 * remembering to run it. That defeats the gates-not-prose model.
 *
 * A ci:* gate is "wired" if it appears in ANY of:
 *   - package.json `ci:gates:chain` (the static push chain)
 *   - scripts/ci-lanes.json `always` | `path` | `nightly` | `cert` (when present)
 *   - a .github/workflows/*.yml
 *   - a .husky/ hook
 *
 * Nightly/Cert in ci-lanes.json counts as wired even when the gate is not in
 * the static chain, so demoting a gate off the push path does not fail this
 * meta-gate. DB-secret gates stay in KNOWN_UNWIRED.
 *
 * If ci-lanes.json exists, every `ci:gates:chain` member must also appear in
 * a lane (chain ⊆ lanes). If the file is missing, skip that drift check —
 * another agent owns writing the lanes file.
 *
 * Gate FILES: every `scripts/check-*.mjs` must be reachable (chain / lanes /
 * workflow / husky / any npm script) OR recorded in
 * scripts/gates-wired-baseline.json. The orphan list may only SHRINK.
 *
 * Usage:
 *   node scripts/check-gates-wired.mjs                    # check (CI/local)
 *   node scripts/check-gates-wired.mjs --write-baseline   # record current file-orphans
 */
import { readFileSync, readdirSync, writeFileSync, existsSync, realpathSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)

const WRITE = process.argv.includes('--write-baseline')
const BASELINE_PATH = 'scripts/gates-wired-baseline.json'
const LANES_PATH = 'scripts/ci-lanes.json'
export const LANE_KEYS = ['always', 'path', 'nightly', 'cert']

// Helper/dev variants are not gates themselves — they support a gate.
const isVariant = (k) => /:(report|baseline|refresh|start|postbuild|worklist|next)$/.test(k)
// The chain + its postbuild are the runner, not a gate to wire.
const isRunner = (k) =>
  k === 'ci:gates' || k === 'ci:gates:postbuild' || k === 'ci:gates:chain'

// Generators / refreshers that write an artifact and do NOT exit non-zero on
// failure — not pass/fail gates, so not required to be wired. Keep TINY.
const NOT_A_GATE = new Set([
  'ci:routes', // scripts/index-routes.mjs — generates docs/ROUTE_INVENTORY.md; drives ci:route-smoke
])

// Gates intentionally NOT in the static `ci:gates` chain. Each MUST carry a
// reason. They are still enforced — just elsewhere (e.g. DB-dependent gates run
// in a workflow with Supabase creds / locally), not in the secret-less static chain.
export const KNOWN_UNWIRED = new Map([
  ['ci:data-access', 'G16 regenerates the schema snapshot from LIVE Supabase (needs DB creds); run via `npm run ci:data-access` locally + nightly, not the secret-less static ci:gates chain'],
  ['ci:resend-webhook', 'needs a Resend secret; off-chain nightly like G16 — run locally/nightly, never in the secret-less static chain'],
  ['ci:community-alias-cities', 'needs live Supabase (asserts registry mls_cities coverage vs actual MLS City spellings); runs inside the ci:data-access chain, same cadence as G16'],
])

/** Unique `ci:*` names from `ci:gates:chain` (`npm run ci:foo && …`). */
export function parseChainGateNames(chain) {
  const names = []
  const seen = new Set()
  for (const t of String(chain ?? '').match(/ci:[\w:-]+/g) ?? []) {
    if (seen.has(t)) continue
    seen.add(t)
    names.push(t)
  }
  return names
}

function addCiName(set, value) {
  if (typeof value === 'string' && value.startsWith('ci:')) set.add(value)
}

/**
 * Names in always[] / path keys (or path[]) / nightly[] / cert[].
 * Path is a map of gate → globs in the locked schema; an array is also accepted.
 */
export function collectLaneGates(lanes) {
  const names = new Set()
  if (!lanes || typeof lanes !== 'object' || Array.isArray(lanes)) return names

  for (const key of ['always', 'nightly', 'cert']) {
    const val = lanes[key]
    if (Array.isArray(val)) for (const item of val) addCiName(names, item)
  }

  const path = lanes.path
  if (path && typeof path === 'object' && !Array.isArray(path)) {
    for (const k of Object.keys(path)) addCiName(names, k)
  } else if (Array.isArray(path)) {
    for (const item of path) addCiName(names, item)
  }
  return names
}

/** The script file a gate runs, e.g. "ci:broker-sales" -> "check-broker-sales.mjs". */
export function scriptFile(gate, scripts) {
  const m = (scripts[gate] ?? '').match(/([\w.-]+\.(?:mjs|cjs|js|ts))/)
  return m ? m[1] : null
}

export function isCiGateWired(gate, { chainSet, laneSet, workflowText, huskyText, file }) {
  if (chainSet.has(gate) || laneSet.has(gate)) return true
  if (workflowText.includes(gate) || (file && workflowText.includes(file))) return true
  if (huskyText.includes(gate) || (file && huskyText.includes(file))) return true
  return false
}

/**
 * Pure evaluation of the meta-gate. `lanes: null` means ci-lanes.json is absent
 * (skip chain↔lanes drift). Pass a parsed object when the file exists.
 */
export function evaluateWiredState({
  scripts = {},
  workflowText = '',
  huskyText = '',
  lanes = null,
  checkFiles = [],
  baselineFiles = [],
} = {}) {
  const gatesChain = scripts['ci:gates:chain'] ?? scripts['ci:gates'] ?? ''
  const chainNames = parseChainGateNames(gatesChain)
  const chainSet = new Set(chainNames)
  const laneSet = lanes ? collectLaneGates(lanes) : new Set()

  const allGates = Object.keys(scripts).filter(
    (k) => k.startsWith('ci:') && !isVariant(k) && !isRunner(k) && !NOT_A_GATE.has(k) && !KNOWN_UNWIRED.has(k),
  )

  const ciOrphans = allGates.filter(
    (g) => !isCiGateWired(g, { chainSet, laneSet, workflowText, huskyText, file: scriptFile(g, scripts) }),
  )

  let expandedChain = gatesChain
  for (const tok of chainNames) expandedChain += '\n' + (scripts[tok] ?? '')
  const allCmds = Object.values(scripts).join('\n')
  let laneText = ''
  for (const g of laneSet) laneText += `\n${g}\n${scripts[g] ?? ''}`
  const reachText = `${expandedChain}\n${workflowText}\n${huskyText}\n${allCmds}\n${laneText}`

  const fileOrphans = [...checkFiles].filter((f) => !reachText.includes(f)).sort()
  const baseline = new Set(baselineFiles)
  const newFileOrphans = fileOrphans.filter((f) => !baseline.has(f))

  const chainMembers = chainNames.filter((g) => !isRunner(g))
  const chainMissingFromLanes = lanes ? chainMembers.filter((g) => !laneSet.has(g)) : null

  const failed =
    ciOrphans.length > 0 ||
    newFileOrphans.length > 0 ||
    (chainMissingFromLanes !== null && chainMissingFromLanes.length > 0)

  return {
    allGates,
    ciOrphans,
    fileOrphans,
    newFileOrphans,
    chainMissingFromLanes,
    laneCount: laneSet.size,
    failed,
  }
}

function readDirConcat(dir, predicate) {
  let text = ''
  try {
    for (const f of readdirSync(dir)) {
      if (predicate && !predicate(f)) continue
      try {
        text += '\n' + readFileSync(`${dir}/${f}`, 'utf8')
      } catch {
        /* dir entry */
      }
    }
  } catch {
    /* missing dir */
  }
  return text
}

function loadLanes(path) {
  if (!existsSync(path)) return { present: false, lanes: null, error: null }
  try {
    const parsed = JSON.parse(readFileSync(path, 'utf8'))
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return { present: true, lanes: null, error: `${path} must be a JSON object with always/path/nightly/cert` }
    }
    return { present: true, lanes: parsed, error: null }
  } catch (err) {
    return { present: true, lanes: null, error: `${path} is not valid JSON: ${err.message}` }
  }
}

function main() {
  const pkg = JSON.parse(readFileSync('package.json', 'utf8'))
  const scripts = pkg.scripts ?? {}
  const workflowText = readDirConcat('.github/workflows', (f) => f.endsWith('.yml') || f.endsWith('.yaml'))
  const huskyText = readDirConcat('.husky')
  const lanesLoad = loadLanes(LANES_PATH)
  const checkFiles = readdirSync('scripts').filter((f) => f.startsWith('check-') && f.endsWith('.mjs'))
  const baseline = existsSync(BASELINE_PATH)
    ? new Set(JSON.parse(readFileSync(BASELINE_PATH, 'utf8')).files ?? [])
    : new Set()

  if (WRITE) {
    const preview = evaluateWiredState({
      scripts,
      workflowText,
      huskyText,
      lanes: lanesLoad.lanes,
      checkFiles,
      baselineFiles: [...baseline],
    })
    writeFileSync(
      BASELINE_PATH,
      JSON.stringify(
        {
          note: 'check-*.mjs gate files that run nowhere automatically — KNOWN DEBT pending triage (wire into ci:gates / ci-lanes.json / a workflow, or delete). Count may only SHRINK. Regenerate with `node scripts/check-gates-wired.mjs --write-baseline`.',
          generated_by: 'check-gates-wired.mjs --write-baseline',
          files: preview.fileOrphans,
        },
        null,
        2,
      ) + '\n',
    )
    console.log(`Wrote ${preview.fileOrphans.length} file-orphans to ${BASELINE_PATH}`)
    process.exit(0)
  }

  console.log('Gate-enforcement meta-gate')
  console.log('==========================\n')

  let failed = false
  if (lanesLoad.error) {
    failed = true
    console.error(`ci-lanes.json: ${lanesLoad.error}`)
  }

  const result = evaluateWiredState({
    scripts,
    workflowText,
    huskyText,
    lanes: lanesLoad.lanes,
    checkFiles,
    baselineFiles: [...baseline],
  })

  console.log(
    `ci:* gates: ${result.allGates.length} checked · ${result.allGates.length - result.ciOrphans.length} wired · ${result.ciOrphans.length} orphaned`,
  )
  if (KNOWN_UNWIRED.size) {
    console.log(`ci:* intentionally off the static chain (${KNOWN_UNWIRED.size}):`)
    for (const [k, r] of KNOWN_UNWIRED) console.log(`  • ${k} — ${r}`)
  }
  if (!lanesLoad.present) {
    console.log('ci-lanes.json: absent — skip chain↔lanes drift check')
  } else if (!lanesLoad.error) {
    console.log(`ci-lanes.json: ${result.laneCount} gates across ${LANE_KEYS.join('/')}`)
  }
  console.log(`\ngate FILES: ${checkFiles.length} total · ${result.fileOrphans.length} run nowhere (baseline ${baseline.size})`)

  if (result.ciOrphans.length) {
    failed = true
    console.error('\nORPHANED ci:* GATES (exist but never run automatically — prose, not a gate):')
    for (const o of result.ciOrphans) console.error(`  ✗ ${o}`)
    console.error(
      '  Wire each into `ci:gates:chain`, scripts/ci-lanes.json (always/path/nightly/cert), a .github/workflows/*.yml, husky, or add to KNOWN_UNWIRED with a reason.',
    )
  }
  if (result.chainMissingFromLanes && result.chainMissingFromLanes.length) {
    failed = true
    console.error('\nCHAIN/LANES DRIFT — ci:gates:chain member missing from scripts/ci-lanes.json:')
    for (const o of result.chainMissingFromLanes) console.error(`  ✗ ${o}`)
    console.error('  Every chain member must appear in always, path, nightly, or cert.')
  }
  if (result.newFileOrphans.length) {
    failed = true
    console.error('\nNEW orphaned gate FILE(s) — a scripts/check-*.mjs that runs nowhere:')
    for (const o of result.newFileOrphans) console.error(`  ✗ ${o}`)
    console.error(
      '  Wire it into ci:gates / ci-lanes.json / a workflow / husky, delete it, or `node scripts/check-gates-wired.mjs --write-baseline` if the debt is intentional.',
    )
  }
  if (result.fileOrphans.length) {
    console.log('\nKNOWN orphaned-gate-file backlog (triage: wire or delete — this count may only shrink):')
    for (const o of result.fileOrphans) console.log(`  · ${o}`)
  }

  if (failed || result.failed) {
    console.error('\nGate-enforcement meta-gate FAILED.')
    process.exit(1)
  }
  console.log('\nAll gates accounted for (wired, intentionally-off-chain, or baselined backlog).')
  process.exit(0)
}

const invokedDirectly = (() => {
  try {
    return Boolean(process.argv[1]) && realpathSync(resolve(process.argv[1])) === __filename
  } catch {
    return false
  }
})()
if (invokedDirectly) main()
