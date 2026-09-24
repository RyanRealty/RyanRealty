import { afterAll, describe, expect, it } from 'vitest'
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'
import { classifyTestFiles, nodeRunTestFiles, wiredScriptNames } from '../check-tests-wired.mjs'

/**
 * Break-tests for ci:tests-wired (scripts/check-tests-wired.mjs, G78).
 *
 * Every case builds a small repo OUTSIDE the checkout (git init, a vitest
 * config, a playwright config, a package.json) with node_modules symlinked in,
 * and runs the real gate against it. The gate asks vitest itself which files
 * each project runs, so these cases exercise vitest's real include/exclude and
 * `extends: true` behaviour, not a model of it.
 */

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')
const GATE = join(REPO, 'scripts/check-tests-wired.mjs')

// The pre-commit hook exports GIT_INDEX_FILE / GIT_DIR, and a vitest worker
// exports VITEST_*. The sandbox runs its own `git init` and its own vitest, so
// neither may leak in.
const cleanEnv = Object.fromEntries(
  Object.entries(process.env).filter(([k]) => !k.startsWith('GIT_') && !k.startsWith('VITEST')),
)

const sandboxes = []
afterAll(() => {
  for (const dir of sandboxes) rmSync(dir, { recursive: true, force: true })
})

const UNIT_AND_INT = `export default {
  test: {
    projects: [
      { extends: true, test: { name: 'unit', include: ['lib/**/*.test.ts'], exclude: ['**/node_modules/**', 'lib/**/*.int.test.ts'] } },
      { extends: true, test: { name: 'int', include: ['lib/**/*.int.test.ts'] } },
    ],
  },
}
`

const PKG = {
  name: 'tests-wired-sandbox',
  private: true,
  scripts: {
    'ci:gates:chain': 'npm run ci:hook-suite',
    'ci:hook-suite': 'node tools/__tests__/hook.test.mjs',
  },
}

/** A clean repo every runner accounts for: 1 unit, 1 int, 1 playwright, 1 node. */
function sandbox({ config = UNIT_AND_INT, pkg = PKG, playwright = "export default { testDir: './e2e' }\n" } = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'rr-tests-wired-sandbox-'))
  sandboxes.push(dir)
  symlinkSync(join(REPO, 'node_modules'), join(dir, 'node_modules'), 'dir')
  const init = spawnSync('git', ['init', '-q'], { cwd: dir, env: cleanEnv, encoding: 'utf8' })
  if (init.status !== 0) throw new Error(`git init failed: ${init.stderr}`)
  write(dir, '.gitignore', 'node_modules\nout/\n')
  write(dir, 'vitest.config.mjs', config)
  write(dir, 'package.json', JSON.stringify(pkg, null, 2))
  if (playwright !== null) write(dir, 'playwright.config.ts', playwright)
  write(dir, 'lib/a.test.ts', "import { it } from 'vitest'\nit('a', () => {})\n")
  write(dir, 'lib/b.int.test.ts', "import { it } from 'vitest'\nit('b', () => {})\n")
  write(dir, 'e2e/flow.spec.ts', '// playwright\n')
  write(dir, 'tools/__tests__/hook.test.mjs', 'process.exit(0)\n')
  return dir
}

function write(dir, rel, text) {
  mkdirSync(dirname(join(dir, rel)), { recursive: true })
  writeFileSync(join(dir, rel), text)
}

function run(dir, args = []) {
  const r = spawnSync('node', [GATE, ...args], { cwd: dir, encoding: 'utf8', env: cleanEnv })
  return { code: r.status, out: `${r.stdout}${r.stderr}` }
}

describe('ci:tests-wired (G78) against a sandbox repo', () => {
  it('passes a tree where every test file has exactly one runner, and names each runner', () => {
    const r = run(sandbox())
    expect(r.code, r.out).toBe(0)
    expect(r.out).toContain('4 test files')
    expect(r.out).toMatch(/unit 1/)
    expect(r.out).toMatch(/int 1/)
    expect(r.out).toContain('playwright 1')
    expect(r.out).toContain('ci:hook-suite 1')
  })

  it('R1 FAILS: a test file in a folder no project includes (the components/motion case)', () => {
    const dir = sandbox()
    write(dir, 'components/motion/digit-swap.test.ts', '')
    const r = run(dir)
    expect(r.code).toBe(1)
    expect(r.out).toContain('R1: 1 test file(s) that NO runner picks up')
    expect(r.out).toContain('components/motion/digit-swap.test.ts')
  })

  it('R1 FAILS: a .tsx test beside an include that only takes .ts (the components/site/v3 case)', () => {
    const dir = sandbox()
    write(dir, 'lib/v3/chip.test.tsx', '')
    const r = run(dir)
    expect(r.code).toBe(1)
    expect(r.out).toContain('lib/v3/chip.test.tsx')
  })

  it('R1 counts an untracked file: a new test is caught before it is ever committed', () => {
    const dir = sandbox()
    write(dir, 'data/golf/kpis.test.ts', '')
    const r = run(dir, ['--json'])
    expect(r.code).toBe(1)
    expect(JSON.parse(r.out).orphans).toEqual(['data/golf/kpis.test.ts'])
  })

  it('R2 FAILS: a root include that extends: true concatenates onto every project', () => {
    const dir = sandbox({
      config: UNIT_AND_INT.replace('test: {\n    projects', "test: {\n    include: ['lib/**/*.test.ts'],\n    projects"),
    })
    const r = run(dir)
    expect(r.code).toBe(1)
    expect(r.out).toContain('R2: 1 test file(s) run by more than one vitest project')
    expect(r.out).toContain('lib/a.test.ts (int + unit)')
  })

  it('R1 FAILS: a node-run test whose npm script runs nowhere', () => {
    const r = run(sandbox({ pkg: { ...PKG, scripts: { ...PKG.scripts, 'ci:gates:chain': 'npm run ci:other' } } }))
    expect(r.code).toBe(1)
    expect(r.out).toContain('tools/__tests__/hook.test.mjs')
  })

  it('passes a node-run test wired by a ci-lanes.json lane or a workflow instead of the chain', () => {
    const unchained = { ...PKG, scripts: { ...PKG.scripts, 'ci:gates:chain': 'npm run ci:other' } }
    const laned = sandbox({ pkg: unchained })
    write(laned, 'scripts/ci-lanes.json', JSON.stringify({ path: { 'ci:hook-suite': ['tools/**'] } }))
    expect(run(laned).code).toBe(0)

    const workflowed = sandbox({ pkg: unchained })
    write(workflowed, '.github/workflows/ci.yml', 'jobs:\n  t:\n    steps:\n      - run: npm run --silent ci:hook-suite\n')
    expect(run(workflowed).code).toBe(0)
  })

  it('R1 FAILS: a spec outside the Playwright testDir', () => {
    const dir = sandbox()
    write(dir, 'tests/other.spec.ts', '')
    const r = run(dir)
    expect(r.code).toBe(1)
    expect(r.out).toContain('tests/other.spec.ts')
  })

  it('FAILS loudly when playwright.config declares no testDir (the default would claim every file)', () => {
    const r = run(sandbox({ playwright: 'export default { retries: 1 }\n' }))
    expect(r.code).toBe(1)
    expect(r.out).toContain('declares no literal testDir')
  })

  it('with no Playwright config, an e2e spec is an orphan like any other', () => {
    const r = run(sandbox({ playwright: null }))
    expect(r.code).toBe(1)
    expect(r.out).toContain('e2e/flow.spec.ts')
  })

  it('ignores gitignored test files and anything under node_modules', () => {
    const dir = sandbox()
    write(dir, 'out/stale.test.ts', '')
    write(dir, 'packages/x/node_modules/dep/index.test.js', '')
    const r = run(dir)
    expect(r.code, r.out).toBe(0)
  })

  it('--report prints a violation and still exits 0', () => {
    const dir = sandbox()
    write(dir, 'components/motion/digit-swap.test.ts', '')
    const r = run(dir, ['--report'])
    expect(r.code).toBe(0)
    expect(r.out).toContain('components/motion/digit-swap.test.ts')
  })
})

describe('ci:tests-wired pure rules', () => {
  it('a vitest-owned file wins over every other runner and is counted once per project', () => {
    const v = classifyTestFiles({
      testFiles: ['e2e/a.spec.ts', 'lib/x.test.ts'],
      entries: [{ file: 'lib/x.test.ts', project: 'unit' }],
      playwrightDir: 'e2e/',
    })
    expect(v).toMatchObject({ orphans: [], multiProject: [], failed: false, byRunner: { vitest: { unit: 1 }, playwright: 1 } })
  })

  it('the same project listed twice for one file is not a second project', () => {
    const v = classifyTestFiles({
      testFiles: ['lib/x.test.ts'],
      entries: [
        { file: 'lib/x.test.ts', project: 'unit' },
        { file: 'lib/x.test.ts', project: 'unit' },
      ],
    })
    expect(v.multiProject).toEqual([])
  })

  it('reads `npm run` with flags and bare `npm test` from hook text, and nothing else', () => {
    const wired = wiredScriptNames({
      scripts: { 'ci:gates:chain': 'npm run ci:a' },
      lanes: { always: ['ci:b'] },
      hookText: 'npm run --silent ci:c\nnpm test\nnpm run test:unit',
    })
    expect([...wired].sort()).toEqual(['ci:a', 'ci:b', 'ci:c', 'test', 'test:unit'])
    expect(wiredScriptNames({ scripts: {}, lanes: null, hookText: 'npm run test:unit' }).has('test')).toBe(false)
  })

  it('a node-run test counts only through a wired script that names the file', () => {
    const scripts = { 'ci:h': 'node ./tools/h.test.mjs --x', 'dev:h': 'node tools/d.test.mjs' }
    const runs = nodeRunTestFiles({ scripts, wired: new Set(['ci:h']) })
    expect([...runs]).toEqual([['tools/h.test.mjs', 'ci:h']])
  })
})

describe('ci:tests-wired on the live tree', () => {
  it('every test file in this repo runs in exactly one place', () => {
    const r = spawnSync('node', [GATE], { cwd: REPO, encoding: 'utf8', env: cleanEnv })
    expect(r.status, `${r.stdout}${r.stderr}`).toBe(0)
  })
})
