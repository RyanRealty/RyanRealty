#!/usr/bin/env node
/**
 * check-gates-wired.mjs — the META-GATE: every gate must actually be enforced.
 *
 * A gate that runs nowhere automatically is "prose" — it relies on a human
 * remembering to run it. That defeats the gates-not-prose model. This meta-gate
 * runs TWO checks:
 *
 *   1. ci:* SCRIPT orphans. Every `ci:*` npm script must be wired into the
 *      `ci:gates` chain (run by .github/workflows/ci.yml) OR a workflow file.
 *
 *   2. GATE-FILE orphans (added 2026-06-20). The 2026-06-20 audit found 28
 *      `scripts/check-*.mjs` gate files that ran NOWHERE while CLAUDE.md /
 *      docs/MECHANICAL_GATES.md documented several of them as "enforced" — the
 *      original meta-gate only enumerated `ci:*` scripts, so a gate FILE with
 *      no `ci:*` wrapper was invisible to it. This check closes that blind spot:
 *      every `scripts/check-*.mjs` must be reachable (chain / workflow / husky /
 *      any npm script) OR recorded in scripts/gates-wired-baseline.json as known
 *      debt. A NEW unaccounted gate file fails the build — orphaning can never be
 *      silent again. The baseline can only shrink (wire or delete to reduce it).
 *
 * Usage:
 *   node scripts/check-gates-wired.mjs                    # check (CI/local)
 *   node scripts/check-gates-wired.mjs --write-baseline   # record current file-orphans
 */
import { readFileSync, readdirSync, writeFileSync, existsSync } from 'node:fs'

const WRITE = process.argv.includes('--write-baseline')
const BASELINE_PATH = 'scripts/gates-wired-baseline.json'

const pkg = JSON.parse(readFileSync('package.json', 'utf8'))
const scripts = pkg.scripts ?? {}
const gatesChain = scripts['ci:gates'] ?? ''

let workflowText = ''
try {
  for (const f of readdirSync('.github/workflows')) {
    if (f.endsWith('.yml') || f.endsWith('.yaml')) workflowText += '\n' + readFileSync(`.github/workflows/${f}`, 'utf8')
  }
} catch {
  /* no workflows dir */
}
let huskyText = ''
try {
  for (const f of readdirSync('.husky')) {
    try { huskyText += '\n' + readFileSync(`.husky/${f}`, 'utf8') } catch { /* dir entry */ }
  }
} catch {
  /* no husky dir */
}

// Helper/dev variants are not gates themselves — they support a gate.
const isVariant = (k) => /:(report|baseline|refresh|start|postbuild)$/.test(k)
// The chain + its postbuild are the runner, not a gate to wire.
const isRunner = (k) => k === 'ci:gates' || k === 'ci:gates:postbuild'

// Generators / refreshers that write an artifact and do NOT exit non-zero on
// failure — not pass/fail gates, so not required to be wired. Keep TINY.
const NOT_A_GATE = new Set([
  'ci:routes', // scripts/index-routes.mjs — generates docs/ROUTE_INVENTORY.md; drives ci:route-smoke
])

// Gates intentionally NOT in the static `ci:gates` chain. Each MUST carry a
// reason. They are still enforced — just elsewhere (e.g. DB-dependent gates run
// in a workflow with Supabase creds / locally), not in the secret-less static chain.
const KNOWN_UNWIRED = new Map([
  ['ci:data-access', 'G16 regenerates the schema snapshot from LIVE Supabase (needs DB creds); run via `npm run ci:data-access` locally + nightly, not the secret-less static ci:gates chain'],
])

// ---- Check 1: ci:* SCRIPT orphans ----
const allGates = Object.keys(scripts).filter(
  (k) => k.startsWith('ci:') && !isVariant(k) && !isRunner(k) && !NOT_A_GATE.has(k) && !KNOWN_UNWIRED.has(k),
)

/** The script file a gate runs, e.g. "ci:broker-sales" -> "check-broker-sales.mjs". */
function scriptFile(gate) {
  const m = (scripts[gate] ?? '').match(/([\w.-]+\.(?:mjs|cjs|js|ts))/)
  return m ? m[1] : null
}
function ciWired(gate) {
  const inChain = new RegExp(`(^|\\s|&)${gate.replace(/[-:]/g, '\\$&')}(\\s|&|$)`).test(gatesChain)
  const file = scriptFile(gate)
  return inChain || workflowText.includes(gate) || (!!file && workflowText.includes(file))
}
const ciOrphans = allGates.filter((g) => !ciWired(g))

// ---- Check 2: GATE-FILE orphans ----
// A file is "enforced" if its name appears in the expanded ci:gates chain, any
// workflow, any husky hook, or ANY npm script command (covers helper files run
// by db:guard / deploy:verify / ci:route-smoke on their own triggers).
let expandedChain = gatesChain
for (const tok of gatesChain.match(/ci:[\w:-]+/g) ?? []) expandedChain += '\n' + (scripts[tok] ?? '')
const allCmds = Object.values(scripts).join('\n')
const reachText = `${expandedChain}\n${workflowText}\n${huskyText}\n${allCmds}`
const checkFiles = readdirSync('scripts').filter((f) => f.startsWith('check-') && f.endsWith('.mjs'))
const fileOrphans = checkFiles.filter((f) => !reachText.includes(f)).sort()

if (WRITE) {
  writeFileSync(
    BASELINE_PATH,
    JSON.stringify(
      {
        note: 'check-*.mjs gate files that run nowhere automatically — KNOWN DEBT pending triage (wire into ci:gates / a workflow, or delete). Count may only SHRINK. Regenerate with `node scripts/check-gates-wired.mjs --write-baseline`.',
        generated_by: 'check-gates-wired.mjs --write-baseline',
        files: fileOrphans,
      },
      null,
      2,
    ) + '\n',
  )
  console.log(`Wrote ${fileOrphans.length} file-orphans to ${BASELINE_PATH}`)
  process.exit(0)
}

const baseline = existsSync(BASELINE_PATH)
  ? new Set(JSON.parse(readFileSync(BASELINE_PATH, 'utf8')).files ?? [])
  : new Set()
const newFileOrphans = fileOrphans.filter((f) => !baseline.has(f))

console.log('Gate-enforcement meta-gate')
console.log('==========================\n')
console.log(`ci:* gates: ${allGates.length} checked · ${allGates.length - ciOrphans.length} wired · ${ciOrphans.length} orphaned`)
if (KNOWN_UNWIRED.size) {
  console.log(`ci:* intentionally off the static chain (${KNOWN_UNWIRED.size}):`)
  for (const [k, r] of KNOWN_UNWIRED) console.log(`  • ${k} — ${r}`)
}
console.log(`\ngate FILES: ${checkFiles.length} total · ${fileOrphans.length} run nowhere (baseline ${baseline.size})`)

let failed = false
if (ciOrphans.length) {
  failed = true
  console.error('\nORPHANED ci:* GATES (exist but never run automatically — prose, not a gate):')
  for (const o of ciOrphans) console.error(`  ✗ ${o}`)
  console.error('  Wire each into the `ci:gates` chain or a .github/workflows/*.yml, or add to KNOWN_UNWIRED with a reason.')
}
if (newFileOrphans.length) {
  failed = true
  console.error('\nNEW orphaned gate FILE(s) — a scripts/check-*.mjs that runs nowhere:')
  for (const o of newFileOrphans) console.error(`  ✗ ${o}`)
  console.error('  Wire it into ci:gates / a workflow, delete it, or `node scripts/check-gates-wired.mjs --write-baseline` if the debt is intentional.')
}
if (fileOrphans.length) {
  console.log('\nKNOWN orphaned-gate-file backlog (triage: wire or delete — this count may only shrink):')
  for (const o of fileOrphans) console.log(`  · ${o}`)
}

if (failed) {
  console.error('\nGate-enforcement meta-gate FAILED.')
  process.exit(1)
}
console.log('\nAll gates accounted for (wired, intentionally-off-chain, or baselined backlog).')
process.exit(0)
