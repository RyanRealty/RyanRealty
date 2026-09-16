/**
 * runtime-gate-summary.mjs — the piece of run-runtime-gates.sh's fix
 * (2026-09-16, "all four gates run every time") that is pure enough to test
 * directly: given each gate's own exit code, does the run report every gate
 * and fail overall when ANY of them did not pass.
 */
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { parseGateArgs, summarizeGateRun } from '../lib/runtime-gate-summary.mjs'

const SCRIPT_PATH = fileURLToPath(new URL('../lib/runtime-gate-summary.mjs', import.meta.url))

describe('summarizeGateRun', () => {
  it('is ok (overall 0) when every gate exited 0', () => {
    const { lines, overall } = summarizeGateRun([
      { name: 'route-smoke', status: 0 },
      { name: 'tap-targets', status: 0 },
    ])
    expect(overall).toBe(0)
    expect(lines).toEqual(['  ok    route-smoke', '  ok    tap-targets'])
  })

  it('is non-zero when ANY one gate failed, and every gate still gets its own line', () => {
    const { lines, overall } = summarizeGateRun([
      { name: 'route-smoke', status: 1 },
      { name: 'page-payload', status: 0 },
      { name: 'tap-targets', status: 0 },
      { name: 'route-content-floor', status: 0 },
    ])
    expect(overall).toBe(1)
    expect(lines).toHaveLength(4)
    expect(lines[0]).toBe('  FAIL  route-smoke (exit 1)')
    expect(lines[1]).toBe('  ok    page-payload')
    expect(lines[2]).toBe('  ok    tap-targets')
    expect(lines[3]).toBe('  ok    route-content-floor')
  })

  it('a gate later in the list still reports its own status — the whole point of the fix', () => {
    // Before 2026-09-16, `set -e` meant a failure here (position 0) meant
    // positions 1 and 2 never ran at all, let alone got a line.
    const { lines, overall } = summarizeGateRun([
      { name: 'route-smoke', status: 1 },
      { name: 'tap-targets', status: 0 },
      { name: 'route-content-floor', status: 0 },
    ])
    expect(overall).toBe(1)
    expect(lines[1]).toBe('  ok    tap-targets')
    expect(lines[2]).toBe('  ok    route-content-floor')
  })

  it('carries a nonzero exit code through as-is in the printed line', () => {
    const { lines } = summarizeGateRun([{ name: 'route-smoke', status: 127 }])
    expect(lines[0]).toBe('  FAIL  route-smoke (exit 127)')
  })
})

describe('parseGateArgs', () => {
  it('parses "name=status" pairs, as run-runtime-gates.sh passes them', () => {
    expect(parseGateArgs(['route-smoke=0', 'tap-targets=1'])).toEqual([
      { name: 'route-smoke', status: 0 },
      { name: 'tap-targets', status: 1 },
    ])
  })

  it('rejects an arg with no "="', () => {
    expect(() => parseGateArgs(['route-smoke'])).toThrow(/expected "name=status"/)
  })

  it('rejects a non-numeric status', () => {
    expect(() => parseGateArgs(['route-smoke=not-a-number'])).toThrow(/non-numeric/)
  })
})

describe('runtime-gate-summary.mjs as a CLI — what run-runtime-gates.sh actually invokes', () => {
  it('exits 0 and prints an ok line per gate when all four passed', () => {
    const r = spawnSync('node', [
      SCRIPT_PATH,
      'route-smoke=0',
      'page-payload=0',
      'tap-targets=0',
      'route-content-floor=0',
    ], { encoding: 'utf8' })
    expect(r.status).toBe(0)
    expect(r.stdout).toMatch(/ok {4}route-smoke/)
    expect(r.stdout).toMatch(/ok {4}page-payload/)
    expect(r.stdout).toMatch(/ok {4}tap-targets/)
    expect(r.stdout).toMatch(/ok {4}route-content-floor/)
    expect(r.stdout).toMatch(/runtime-gates OK/)
  })

  it('exits non-zero and names the failing gate when only one of four failed', () => {
    const r = spawnSync('node', [
      SCRIPT_PATH,
      'route-smoke=1',
      'page-payload=0',
      'tap-targets=0',
      'route-content-floor=0',
    ], { encoding: 'utf8' })
    expect(r.status).not.toBe(0)
    expect(r.stdout).toMatch(/FAIL {2}route-smoke \(exit 1\)/)
    expect(r.stdout).toMatch(/ok {4}page-payload/)
    expect(r.stdout).toMatch(/ok {4}tap-targets/)
    expect(r.stdout).toMatch(/ok {4}route-content-floor/)
    expect(r.stderr).toMatch(/runtime-gates FAILED/)
  })

  it('exits 2 on a malformed arg rather than crashing silently', () => {
    const r = spawnSync('node', [SCRIPT_PATH, 'not-a-pair'], { encoding: 'utf8' })
    expect(r.status).toBe(2)
    expect(r.stderr).toMatch(/expected "name=status"/)
  })
})
