/**
 * runtime-gate-summary.mjs — the pass/fail table for
 * scripts/run-runtime-gates.sh.
 *
 * WHY THIS IS ITS OWN FILE (2026-09-16). `run-runtime-gates.sh` ran its four
 * gates under `set -e`, so when `ci:route-smoke` failed the three gates
 * after it — page-payload, tap-targets, route-content-floor — never ran at
 * all. CLAUDE.md's ship class rule ("same-category fleet findings share one
 * `npm run push` and one `deploy:verify` — do not rebuild after each bot
 * finding") needs every gate's result from the SAME run, not a report that
 * silently stops at the first failure.
 *
 * The table itself is pure formatting with no shell process to launch, so it
 * lives here where `npx vitest run` exercises it directly, instead of only
 * through a full shell-script spawn that would also have to fake a build, a
 * free port, and a live server just to reach the four lines under test.
 *
 * `run-runtime-gates.sh` runs every gate first (capturing each exit code,
 * `set +e`), then calls this as:
 *   node scripts/lib/runtime-gate-summary.mjs name1=status1 name2=status2 ...
 * and exits with the code this process exits with — 0 only when every named
 * status was 0.
 */
import { fileURLToPath } from 'node:url'
import { resolve } from 'node:path'
import { realpathSync } from 'node:fs'

/**
 * @param {{name: string, status: number}[]} results
 * @returns {{lines: string[], overall: number}} `overall` is 0 only when
 *   every result's status is 0, else 1.
 */
export function summarizeGateRun(results) {
  const lines = []
  let overall = 0
  for (const { name, status } of results) {
    if (status === 0) {
      lines.push(`  ok    ${name}`)
    } else {
      overall = 1
      lines.push(`  FAIL  ${name} (exit ${status})`)
    }
  }
  return { lines, overall }
}

/** `name=status` args, as run-runtime-gates.sh passes them, into records. */
export function parseGateArgs(argv) {
  return argv.map((arg) => {
    const eq = arg.indexOf('=')
    if (eq < 0) throw new Error(`runtime-gate-summary: expected "name=status", got "${arg}"`)
    const name = arg.slice(0, eq)
    const status = Number(arg.slice(eq + 1))
    if (!Number.isFinite(status)) {
      throw new Error(`runtime-gate-summary: non-numeric exit status in "${arg}"`)
    }
    return { name, status }
  })
}

const __filename = fileURLToPath(import.meta.url)
const invokedDirectly = (() => {
  try {
    return Boolean(process.argv[1]) && realpathSync(resolve(process.argv[1])) === __filename
  } catch {
    return false
  }
})()

if (invokedDirectly) {
  let results
  try {
    results = parseGateArgs(process.argv.slice(2))
  } catch (err) {
    console.error(err instanceof Error ? err.message : String(err))
    process.exit(2)
  }
  const { lines, overall } = summarizeGateRun(results)
  console.log('')
  console.log('runtime-gates summary')
  console.log('======================================')
  for (const line of lines) console.log(line)
  console.log('')
  if (overall !== 0) {
    console.error('runtime-gates FAILED — at least one gate above did not pass.')
  } else {
    console.log('runtime-gates OK — every gate ran and passed.')
  }
  process.exit(overall)
}
