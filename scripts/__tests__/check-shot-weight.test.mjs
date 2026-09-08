import { afterAll, describe, expect, it } from 'vitest'
import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'

/**
 * Break-tests for ci:shot-weight (scripts/check-shot-weight.mjs, G74).
 *
 * The gate refuses a PNG over 1 MiB under `design_system/**` `/shots/**`, and
 * keeps its oversized-file baseline shrink-only. Every case below builds a
 * disposable tree outside the checked-out repo and runs the real gate against
 * it with --root / --baseline, so nothing here can read or write the real
 * design_system directory or the real baseline.
 *
 * Sizes are all the gate reads, so the fixtures are zero-filled buffers with a
 * .png name — no encoder, no fixture images to keep in git.
 */

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')
const GATE = join(REPO, 'scripts/check-shot-weight.mjs')
const CAP = 1_048_576

// A gate suite can run inside the pre-commit hook, where git exports
// GIT_INDEX_FILE / GIT_DIR and friends. Nothing here shells out to git, but the
// same leak class has poisoned a real index before
// (reference_git_fixture_env_leak.md), so the child gets a scrubbed env.
const cleanEnv = Object.fromEntries(
  Object.entries(process.env).filter(([k]) => !k.startsWith('GIT_')),
)

const SANDBOX = join(tmpdir(), `rr-shot-weight-sandbox-${process.pid}-${Math.random().toString(16).slice(2)}`)

function reset() {
  rmSync(SANDBOX, { recursive: true, force: true })
  mkdirSync(SANDBOX, { recursive: true })
}

/** Write a file of exactly `bytes` at `relPath` inside the sandbox. */
function writePng(relPath, bytes) {
  const dest = join(SANDBOX, relPath)
  mkdirSync(dirname(dest), { recursive: true })
  writeFileSync(dest, Buffer.alloc(bytes))
}

function writeBaseline(files) {
  writeFileSync(
    join(SANDBOX, 'baseline.json'),
    JSON.stringify({ note: 'fixture', cap_bytes: CAP, files }, null, 2),
  )
}

function run(extraArgs = []) {
  const r = spawnSync(
    'node',
    [GATE, '--root=design_system', '--baseline=baseline.json', ...extraArgs],
    { cwd: SANDBOX, encoding: 'utf8', env: cleanEnv },
  )
  return { code: r.status, out: `${r.stdout}${r.stderr}` }
}

afterAll(() => rmSync(SANDBOX, { recursive: true, force: true }))

describe('check-shot-weight', () => {
  it('passes a well-captured shot under the cap', () => {
    reset()
    writeBaseline({})
    writePng('design_system/ryan-realty/ui_kits/sell/shots/sell-1440.png', 545_567)
    writePng('design_system/ryan-realty/ui_kits/sell/shots/sell-375.png', 58_907)

    const { code, out } = run()
    expect(code).toBe(0)
    expect(out).toContain('2 PNG(s)')
  })

  it('FAILS an oversized PNG, naming the file, its size, the cap and the fix', () => {
    reset()
    writeBaseline({})
    writePng('design_system/ryan-realty/ui_kits/city/shots/desktop.png', 11_346_285)

    const { code, out } = run()
    expect(code).toBe(1)
    expect(out).toContain('design_system/ryan-realty/ui_kits/city/shots/desktop.png')
    expect(out).toContain('11,346,285 bytes')
    expect(out).toContain('cap 1,048,576 bytes')
    expect(out).toContain('scripts/take-route-shots.mjs')
    expect(out).toContain('ci:shot-weight FAILED')
  })

  it('fails a PNG one byte over the cap, and passes it at exactly the cap', () => {
    reset()
    writeBaseline({})
    writePng('design_system/ryan-realty/ui_kits/city/shots/desktop.png', CAP + 1)
    expect(run().code).toBe(1)

    reset()
    writeBaseline({})
    writePng('design_system/ryan-realty/ui_kits/city/shots/desktop.png', CAP)
    expect(run().code).toBe(0)
  })

  it('passes an oversized PNG that is recorded in the baseline', () => {
    reset()
    writeBaseline({ 'design_system/ryan-realty/ui_kits/city/shots/desktop.png': 11_346_285 })
    writePng('design_system/ryan-realty/ui_kits/city/shots/desktop.png', 11_346_285)

    const { code, out } = run()
    expect(code).toBe(0)
    expect(out).toContain('1 baselined')
  })

  it('FAILS a baselined PNG that has grown past its recorded size', () => {
    // 1,147,456 -> 4,298,049 -> 10,619,761 is how the neighborhood shot got
    // where it is. Each step was individually "already oversized anyway".
    reset()
    writeBaseline({ 'design_system/ryan-realty/ui_kits/neighborhood/shots/desktop.png': 4_298_049 })
    writePng('design_system/ryan-realty/ui_kits/neighborhood/shots/desktop.png', 10_619_761)

    const { code, out } = run()
    expect(code).toBe(1)
    expect(out).toContain('BASELINED BUT GROWING')
    expect(out).toContain('10,619,761 bytes, was 4,298,049 bytes')
  })

  it('FAILS a baseline entry that is now under the cap (shrink-only)', () => {
    reset()
    writeBaseline({ 'design_system/ryan-realty/ui_kits/city/shots/desktop.png': 11_346_285 })
    writePng('design_system/ryan-realty/ui_kits/city/shots/desktop.png', 402_113)

    const { code, out } = run()
    expect(code).toBe(1)
    expect(out).toContain('BASELINE IS STALE')
    expect(out).toContain('--write-baseline')
  })

  it('FAILS a baseline entry whose file no longer exists', () => {
    reset()
    writeBaseline({ 'design_system/ryan-realty/ui_kits/gone/shots/desktop.png': 2_000_000 })

    const { code, out } = run()
    expect(code).toBe(1)
    expect(out).toContain('BASELINE ENTRY WITH NO FILE')
  })

  it('ignores an oversized PNG outside a shots/ directory', () => {
    reset()
    writeBaseline({})
    writePng('design_system/ryan-realty/assets/hero/hero-old-mill-master-4k.jpg.png', 9_000_000)
    writePng('design_system/ryan-realty/ui_kits/city/mockups/desktop.png', 9_000_000)

    const { code, out } = run()
    expect(code).toBe(0)
    expect(out).toContain('0 PNG(s)')
  })

  it('ignores a non-PNG inside a shots/ directory', () => {
    reset()
    writeBaseline({})
    writePng('design_system/ryan-realty/ui_kits/city/shots/desktop.jpg', 9_000_000)

    expect(run().code).toBe(0)
  })

  it('--report reports the same findings but exits 0', () => {
    reset()
    writeBaseline({})
    writePng('design_system/ryan-realty/ui_kits/city/shots/desktop.png', 11_346_285)

    const { code, out } = run(['--report'])
    expect(code).toBe(0)
    expect(out).toContain('OVER THE CAP')
    expect(out).not.toContain('ci:shot-weight FAILED')
  })

  it('--json emits the machine-readable result and still fails', () => {
    reset()
    writeBaseline({})
    writePng('design_system/ryan-realty/ui_kits/city/shots/desktop.png', 11_346_285)

    const { code, out } = run(['--json'])
    expect(code).toBe(1)
    const parsed = JSON.parse(out)
    expect(parsed.cap).toBe(CAP)
    expect(parsed.failed).toBe(true)
    expect(parsed.newOversize).toEqual([
      { path: 'design_system/ryan-realty/ui_kits/city/shots/desktop.png', bytes: 11_346_285 },
    ])
  })

  it('--write-baseline records exactly the oversized files and then passes', () => {
    reset()
    writeBaseline({})
    writePng('design_system/ryan-realty/ui_kits/city/shots/desktop.png', 11_346_285)
    writePng('design_system/ryan-realty/ui_kits/sell/shots/sell-1440.png', 545_567)

    expect(run().code).toBe(1)
    expect(run(['--write-baseline']).code).toBe(0)

    const written = JSON.parse(
      spawnSync('node', ['-e', 'process.stdout.write(require("fs").readFileSync("baseline.json","utf8"))'], {
        cwd: SANDBOX,
        encoding: 'utf8',
        env: cleanEnv,
      }).stdout,
    )
    expect(Object.keys(written.files)).toEqual([
      'design_system/ryan-realty/ui_kits/city/shots/desktop.png',
    ])
    expect(run().code).toBe(0)
  })

  it('the real repo baseline holds only files that are still oversized', () => {
    // Guards the shipped baseline itself: every entry must exist and still be
    // over the cap, or the gate is green for the wrong reason.
    const r = spawnSync('node', [GATE], { cwd: REPO, encoding: 'utf8', env: cleanEnv })
    expect(`${r.stdout}${r.stderr}`).not.toContain('BASELINE')
    expect(r.status).toBe(0)
  })
})
