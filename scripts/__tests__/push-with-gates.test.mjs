import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, mkdirSync, writeFileSync, copyFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

// Regression lock for the canonical push path (`npm run push`,
// scripts/push-with-gates.sh): a rejected `git push` MUST surface as a
// non-zero exit from the wrapper. On 2026-07-29 a non-fast-forward rejection
// ("! [rejected] main -> main") was observed alongside a green `npm run push`
// — a rejected push that reports success means the commit never deploys while
// every log line says gates passed. The script now propagates the push exit
// code explicitly (do_push) instead of relying on `set -e` falling off the
// end of the script.
//
// The fixture is a real git topology: bare origin + a stale clone whose
// origin/main has advanced underneath it. The heavy gate chain is stubbed
// (package.json no-op scripts) — the property under test is exit-code
// propagation, not the gates. PUSH_GATES_IN_PLACE=1 keeps the fixture
// portable (the isolated-verification branch uses APFS `cp -Rc`, macOS-only);
// both branches push through the same do_push function.

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const PUSH_SCRIPT = join(repoRoot, 'scripts', 'push-with-gates.sh')
const STAMP_SCRIPT = join(repoRoot, 'scripts', 'stamp-gates-marker.mjs')

// When this suite runs inside a git hook (pre-commit runs `npm test`), git
// exports GIT_INDEX_FILE / GIT_DIR-family vars that would redirect the
// fixture's git commands at the REAL repo. Strip every GIT_* before spawning.
const cleanEnv = Object.fromEntries(
  Object.entries(process.env).filter(([k]) => !k.startsWith('GIT_')),
)

let base
let originDir
let seederDir
let staleDir

function git(cwd, ...args) {
  const r = spawnSync('git', args, { cwd, encoding: 'utf8', env: cleanEnv })
  if (r.status !== 0) {
    throw new Error(`git ${args.join(' ')} failed in ${cwd}:\n${r.stdout}${r.stderr}`)
  }
  return r.stdout.trim()
}

function runPushScript(cwd) {
  const r = spawnSync('sh', ['scripts/push-with-gates.sh'], {
    cwd,
    encoding: 'utf8',
    env: { ...cleanEnv, PUSH_GATES_IN_PLACE: '1' },
  })
  return { status: r.status, output: `${r.stdout}\n${r.stderr}` }
}

beforeAll(() => {
  base = mkdtempSync(join(tmpdir(), 'push-with-gates-test-'))
  originDir = join(base, 'origin.git')
  seederDir = join(base, 'seeder')
  staleDir = join(base, 'stale')

  const init = spawnSync('git', ['init', '--bare', '-b', 'main', originDir], {
    encoding: 'utf8',
    env: cleanEnv,
  })
  if (init.status !== 0) throw new Error(`git init --bare failed:\n${init.stdout}${init.stderr}`)

  // Seeder: commit A on main, push — origin now has history.
  git(base, 'clone', originDir, seederDir)
  git(seederDir, 'config', 'user.email', 'test@test.invalid')
  git(seederDir, 'config', 'user.name', 'test')
  writeFileSync(join(seederDir, 'README.md'), 'one\n')
  git(seederDir, 'add', '.')
  git(seederDir, 'commit', '-m', 'A')
  git(seederDir, 'push', 'origin', 'HEAD:main')

  // Stale clone taken at A, with the REAL script under test + stubbed gates.
  git(base, 'clone', originDir, staleDir)
  git(staleDir, 'config', 'user.email', 'test@test.invalid')
  git(staleDir, 'config', 'user.name', 'test')
  mkdirSync(join(staleDir, 'scripts'))
  copyFileSync(PUSH_SCRIPT, join(staleDir, 'scripts', 'push-with-gates.sh'))
  copyFileSync(STAMP_SCRIPT, join(staleDir, 'scripts', 'stamp-gates-marker.mjs'))
  writeFileSync(
    join(staleDir, 'stub-ok.cjs'),
    "console.log('stub OK')\n",
  )
  writeFileSync(
    join(staleDir, 'package.json'),
    JSON.stringify(
      {
        name: 'push-fixture',
        version: '0.0.0',
        scripts: {
          'ci:gates': 'node stub-ok.cjs',
          lint: 'node stub-ok.cjs',
          build: 'node stub-ok.cjs',
          'ci:bundle-budget': 'node stub-ok.cjs',
        },
      },
      null,
      2,
    ),
  )
  git(staleDir, 'add', '.')
  git(staleDir, 'commit', '-m', 'C: fixture scaffolding')

  // Origin advances past the stale clone — its push is now non-fast-forward.
  writeFileSync(join(seederDir, 'README.md'), 'one\ntwo\n')
  git(seederDir, 'add', '.')
  git(seederDir, 'commit', '-m', 'B')
  git(seederDir, 'push', 'origin', 'HEAD:main')
}, 60_000)

afterAll(() => {
  if (base) rmSync(base, { recursive: true, force: true })
})

describe('push-with-gates.sh exit-code propagation', () => {
  it(
    'exits non-zero and says so when git push is rejected (non-fast-forward)',
    () => {
      const before = git(originDir, 'rev-parse', 'main')
      const { status, output } = runPushScript(staleDir)

      expect(output).toMatch(/\[rejected\]/)
      expect(status).not.toBe(0)
      expect(status).toBe(1)
      expect(output).toMatch(/git push FAILED/)
      // The rejection must not have moved the remote.
      expect(git(originDir, 'rev-parse', 'main')).toBe(before)
    },
    120_000,
  )

  it(
    'exits 0 with an explicit OK once the push fast-forwards',
    () => {
      git(staleDir, 'fetch', 'origin')
      git(staleDir, 'rebase', 'origin/main')
      const { status, output } = runPushScript(staleDir)

      expect(output).toMatch(/git push OK/)
      expect(status).toBe(0)
      // The remote landed exactly the pushed HEAD.
      expect(git(originDir, 'rev-parse', 'main')).toBe(git(staleDir, 'rev-parse', 'HEAD'))
    },
    120_000,
  )
})
