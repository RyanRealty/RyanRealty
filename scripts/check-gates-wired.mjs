#!/usr/bin/env node
/**
 * check-gates-wired.mjs — the META-GATE: every gate must actually be enforced.
 *
 * A gate that exists only as an `npm run ci:*` script but is never run by the
 * automated pipeline is "prose" — it relies on a human remembering to run it.
 * That defeats the entire gates-not-prose model. This gate fails the build if
 * any `ci:*` gate script is NOT wired into either:
 *   - the `ci:gates` chain (run by .github/workflows/ci.yml on every push/PR), OR
 *   - any .github/workflows/*.yml file (e.g. smoke-test.yml post-deploy,
 *     quality.yml nightly).
 *
 * So a new gate cannot be added without being enforced — the model enforces
 * itself, with no human monitoring.
 *
 * Usage: node scripts/check-gates-wired.mjs
 */
import { readFileSync, readdirSync } from 'node:fs'

const pkg = JSON.parse(readFileSync('package.json', 'utf8'))
const scripts = pkg.scripts ?? {}
const gatesChain = scripts['ci:gates'] ?? ''

// Read every workflow file once.
let workflowText = ''
try {
  for (const f of readdirSync('.github/workflows')) {
    if (f.endsWith('.yml') || f.endsWith('.yaml')) workflowText += '\n' + readFileSync(`.github/workflows/${f}`, 'utf8')
  }
} catch {
  /* no workflows dir */
}

// Helper/dev variants are not gates themselves — they support a gate.
const isVariant = (k) => /:(report|baseline|refresh|start|postbuild)$/.test(k)
// The chain + its postbuild are the runner, not a gate to wire.
const isRunner = (k) => k === 'ci:gates' || k === 'ci:gates:postbuild'

// Generators / refreshers that write an artifact and do NOT exit non-zero on
// failure — they are not pass/fail gates, so they are not required to be wired.
// Keep this list TINY and justified; everything else must be an enforced gate.
const NOT_A_GATE = new Set([
  'ci:routes', // scripts/index-routes.mjs — generates docs/ROUTE_INVENTORY.md (a generator), drives ci:route-smoke
])

const allGates = Object.keys(scripts).filter(
  (k) => k.startsWith('ci:') && !isVariant(k) && !isRunner(k) && !NOT_A_GATE.has(k),
)

/** The script file a gate runs, e.g. "ci:broker-sales" -> "check-broker-sales.mjs". */
function scriptFile(gate) {
  const cmd = scripts[gate] ?? ''
  const m = cmd.match(/([\w.-]+\.(?:mjs|cjs|js|ts))/)
  return m ? m[1] : null
}

function wired(gate) {
  // In the ci:gates chain (token-boundary match so ci:page-dal != ci:page).
  const inChain = new RegExp(`(^|\\s|&)${gate.replace(/[-:]/g, '\\$&')}(\\s|&|$)`).test(gatesChain)
  // Referenced in a workflow — either by npm name (`npm run ci:x`) OR by directly
  // invoking its script file (`node scripts/check-x.mjs`). Match both forms.
  const file = scriptFile(gate)
  const inWorkflow = workflowText.includes(gate) || (!!file && workflowText.includes(file))
  return inChain || inWorkflow
}

const orphans = allGates.filter((g) => !wired(g))

console.log('Gate-enforcement meta-gate')
console.log('==========================\n')
console.log(`${allGates.length} gates · ${allGates.length - orphans.length} wired · ${orphans.length} orphaned\n`)

if (orphans.length) {
  console.log('ORPHANED GATES (exist but are never run automatically — this is prose, not a gate):')
  for (const o of orphans) console.log(`  ✗ ${o}`)
  console.log('\nWire each into the `ci:gates` chain (static gates, run in ci.yml) OR a')
  console.log('.github/workflows/*.yml file (prod-smoke gates -> smoke-test.yml).')
  process.exit(1)
}
console.log('All gates are wired into the automated pipeline.')
process.exit(0)
