/**
 * run-runtime-gates.sh — locks the 2026-09-16 fix in the source text.
 *
 * The script itself needs a built .next/, a free port, and a real server to
 * execute end to end, which is what push-with-gates.test.mjs pays for with a
 * whole fixture git repo. That cost buys nothing here: the property under
 * test — every gate runs, and the run fails if any one of them did — lives
 * entirely in scripts/lib/runtime-gate-summary.mjs and is covered directly in
 * runtime-gate-summary.test.mjs. What this file locks is that the SHELL
 * SCRIPT actually wires itself up that way: `set -e` still guards the setup
 * section, `set +e` drops before the gates run, none of the four gate
 * invocations are `&&`-chained to each other (which would silently
 * reintroduce the skip-on-failure bug), and the untouched guards — staleness,
 * the three port-holder detectors, the trap-based server stop — are still
 * there byte for byte.
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const SCRIPT = readFileSync(fileURLToPath(new URL('../run-runtime-gates.sh', import.meta.url)), 'utf8')

describe('run-runtime-gates.sh: setup still fails fast, gates no longer do', () => {
  it('guards the setup section (build staleness, port check, server boot) with set -e', () => {
    const firstSetE = SCRIPT.indexOf('\nset -e')
    // The header comment mentions wait-for-server.mjs by name too (why it's
    // used), so anchor on the actual invocation, not the first substring hit.
    const waiterCall = SCRIPT.indexOf('if ! node scripts/wait-for-server.mjs')
    expect(firstSetE).toBeGreaterThan(-1)
    expect(waiterCall).toBeGreaterThan(-1)
    expect(firstSetE).toBeLessThan(waiterCall)
  })

  it('drops to set +e before the first gate runs', () => {
    const setPlusE = SCRIPT.indexOf('\nset +e')
    const firstGate = SCRIPT.indexOf('npm run ci:route-smoke')
    expect(setPlusE).toBeGreaterThan(-1)
    expect(firstGate).toBeGreaterThan(-1)
    expect(setPlusE).toBeLessThan(firstGate)
  })

  it('runs all four gates, each on its own line, each exit code captured right after it', () => {
    expect(SCRIPT).toMatch(/\nnpm run ci:route-smoke\nSTATUS_SMOKE=\$\?\n/)
    expect(SCRIPT).toMatch(/\nnpm run ci:page-payload\nSTATUS_PAYLOAD=\$\?\n/)
    expect(SCRIPT).toMatch(/\nnpm run ci:tap-targets\nSTATUS_TAP=\$\?\n/)
    expect(SCRIPT).toMatch(/\nnpm run ci:route-content-floor\nSTATUS_FLOOR=\$\?\n/)
  })

  it('does not chain the four gates with && or || to each other — that would reintroduce skip-on-failure', () => {
    const start = SCRIPT.indexOf('npm run ci:route-smoke')
    const end = SCRIPT.indexOf('runtime-gate-summary.mjs')
    const gateBlock = SCRIPT.slice(start, end)
    expect(gateBlock).not.toMatch(/&&/)
    expect(gateBlock).not.toMatch(/\|\|/)
  })

  it('hands every captured status to the summary script and exits with ITS code', () => {
    expect(SCRIPT).toMatch(/node scripts\/lib\/runtime-gate-summary\.mjs/)
    expect(SCRIPT).toMatch(/"route-smoke=\$STATUS_SMOKE"/)
    expect(SCRIPT).toMatch(/"page-payload=\$STATUS_PAYLOAD"/)
    expect(SCRIPT).toMatch(/"tap-targets=\$STATUS_TAP"/)
    expect(SCRIPT).toMatch(/"route-content-floor=\$STATUS_FLOOR"/)
    expect(SCRIPT.trimEnd().endsWith('exit $?')).toBe(true)
  })

  it('leaves the stale-build guard untouched', () => {
    expect(SCRIPT).toMatch(/no \.next\/BUILD_ID/)
    expect(SCRIPT).toMatch(/BUILD_AT" -lt "\$HEAD_AT"/)
  })

  it('leaves all three port-holder detectors untouched', () => {
    expect(SCRIPT).toMatch(/lsof -ti "tcp:\$\{PORT\}"/)
    expect(SCRIPT).toMatch(/fuser -n tcp "\$\{PORT\}"/)
    expect(SCRIPT).toMatch(/ss -ltnp/)
  })

  it('leaves the server start/wait/stop trap untouched', () => {
    expect(SCRIPT).toMatch(/npm run start:ci > "\$LOG" 2>&1 &/)
    expect(SCRIPT).toMatch(/trap stop_server EXIT INT TERM/)
    expect(SCRIPT).toMatch(/node scripts\/wait-for-server\.mjs "\$BASE"/)
  })
})
