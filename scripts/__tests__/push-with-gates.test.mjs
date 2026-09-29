import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, mkdirSync, writeFileSync, copyFileSync, readFileSync, rmSync } from 'node:fs'
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
          'test:unit': 'node stub-ok.cjs',
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
    'exits 7 (retryable) and says so when git push is rejected (non-fast-forward)',
    () => {
      // Contract since 2026-08-21: non-fast-forward is the ONE retryable
      // failure — exit 7 so push-retry.sh (npm run push) can fetch + rebase +
      // re-verify. Every other push failure keeps its own non-zero status.
      const before = git(originDir, 'rev-parse', 'main')
      const { status, output } = runPushScript(staleDir)

      expect(output).toMatch(/\[rejected\]/)
      expect(status).not.toBe(0)
      expect(status).toBe(7)
      expect(output).toMatch(/origin moved during verification/)
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
      expect(output).toMatch(/skipping full next generate/)
      expect(output).not.toMatch(/production build \(Turbopack/)
      // PROCESS-9: the push runs the unit tests for what it changes, scoped to
      // the upstream merge-base, before the remote is contacted.
      expect(output).toMatch(/test:unit for files changed since [0-9a-f]{40}/)
      expect(output).toMatch(/test:unit OK/)
      expect(status).toBe(0)
      // The remote landed exactly the pushed HEAD.
      expect(git(originDir, 'rev-parse', 'main')).toBe(git(staleDir, 'rev-parse', 'HEAD'))
    },
    120_000,
  )

  it(
    'aborts with nothing pushed when the unit tests fail (PROCESS-9)',
    () => {
      writeFileSync(join(staleDir, 'stub-fail.cjs'), "console.error('unit FAIL'); process.exit(1)\n")
      const pkgPath = join(staleDir, 'package.json')
      const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'))
      pkg.scripts['test:unit'] = 'node stub-fail.cjs'
      writeFileSync(pkgPath, JSON.stringify(pkg, null, 2))
      git(staleDir, 'add', '.')
      git(staleDir, 'commit', '-m', 'D: a failing unit suite')
      const before = git(originDir, 'rev-parse', 'main')
      const { status, output } = runPushScript(staleDir)

      expect(status).not.toBe(0)
      expect(output).toMatch(/test:unit FAILED/)
      expect(output).not.toMatch(/git push OK/)
      expect(git(originDir, 'rev-parse', 'main')).toBe(before)
    },
    120_000,
  )
})

// RUN_LOOP §5: a session's own branch never lands on main through
// `npm run push`. On 2026-09-24 a cloud session's branch, restarted with
// `git checkout -B <branch> origin/main`, tracked origin/main, and the
// upstream push sent four unreviewed commits straight to main (d1a4c6979).
describe('push-with-gates.sh refuses a session branch that tracks origin/main', () => {
  let gBase
  let gOrigin
  let gWork

  beforeAll(() => {
    gBase = mkdtempSync(join(tmpdir(), 'push-guard-test-'))
    gOrigin = join(gBase, 'origin.git')
    gWork = join(gBase, 'work')
    const init = spawnSync('git', ['init', '--bare', '-b', 'main', gOrigin], { encoding: 'utf8', env: cleanEnv })
    if (init.status !== 0) throw new Error(`git init --bare failed:\n${init.stdout}${init.stderr}`)
    git(gBase, 'clone', gOrigin, gWork)
    git(gWork, 'config', 'user.email', 'test@test.invalid')
    git(gWork, 'config', 'user.name', 'test')
    mkdirSync(join(gWork, 'scripts'))
    copyFileSync(PUSH_SCRIPT, join(gWork, 'scripts', 'push-with-gates.sh'))
    copyFileSync(join(repoRoot, 'scripts', 'push-retry.sh'), join(gWork, 'scripts', 'push-retry.sh'))
    copyFileSync(STAMP_SCRIPT, join(gWork, 'scripts', 'stamp-gates-marker.mjs'))
    writeFileSync(join(gWork, 'stub-ok.cjs'), "console.log('stub OK')\n")
    const scripts = Object.fromEntries(
      ['ci:gates', 'lint', 'build', 'ci:bundle-budget', 'test:unit'].map((s) => [s, 'node stub-ok.cjs']),
    )
    writeFileSync(join(gWork, 'package.json'), JSON.stringify({ name: 'push-guard', version: '0.0.0', scripts }, null, 2))
    writeFileSync(join(gWork, 'README.md'), 'base\n')
    git(gWork, 'add', '.')
    git(gWork, 'commit', '-m', 'base')
    git(gWork, 'push', 'origin', 'HEAD:main')
    git(gWork, 'fetch', 'origin')
  }, 60_000)

  afterAll(() => {
    if (gBase) rmSync(gBase, { recursive: true, force: true })
  })

  function commitOn(branch, note) {
    writeFileSync(join(gWork, `${branch.replace(/\W/g, '-')}.txt`), `${note}\n`)
    git(gWork, 'add', '.')
    git(gWork, 'commit', '-m', note)
  }

  it(
    'refuses a claude/* branch that tracks origin/main, before any gate runs',
    () => {
      git(gWork, 'checkout', '-B', 'claude/restarted', 'origin/main')
      expect(git(gWork, 'rev-parse', '--abbrev-ref', '@{u}')).toBe('origin/main')
      commitOn('claude/restarted', 'session work')
      const before = git(gOrigin, 'rev-parse', 'main')
      const { status, output } = runPushScript(gWork)

      expect(status).toBe(5)
      expect(output).toMatch(/claude\/restarted tracks main/)
      expect(output).toMatch(/git push -u origin claude\/restarted/)
      expect(output).not.toMatch(/ci:gates static chain/)
      expect(git(gOrigin, 'rev-parse', 'main')).toBe(before)
    },
    120_000,
  )

  function runWith(cwd, script, args = []) {
    const r = spawnSync('sh', [script, ...args], {
      cwd,
      encoding: 'utf8',
      env: { ...cleanEnv, PUSH_GATES_IN_PLACE: '1' },
    })
    return { status: r.status, output: `${r.stdout}\n${r.stderr}` }
  }

  it(
    'refuses it too when the only arguments are options, which still push to the upstream',
    () => {
      git(gWork, 'checkout', 'claude/restarted')
      const before = git(gOrigin, 'rev-parse', 'main')
      const { status, output } = runWith(gWork, 'scripts/push-with-gates.sh', ['--force-with-lease'])

      expect(status).toBe(5)
      expect(output).toMatch(/tracks main/)
      expect(git(gOrigin, 'rev-parse', 'main')).toBe(before)
    },
    120_000,
  )

  it(
    'refuses a branch whose merge ref is main even when origin/main is not fetched',
    () => {
      git(gWork, 'checkout', '-b', 'claude/noref')
      git(gWork, 'config', 'branch.claude/noref.remote', 'origin')
      git(gWork, 'config', 'branch.claude/noref.merge', 'refs/heads/main')
      git(gWork, 'update-ref', '-d', 'refs/remotes/origin/main')
      const before = git(gOrigin, 'rev-parse', 'main')
      try {
        const { status, output } = runPushScript(gWork)
        expect(status).toBe(5)
        expect(output).toMatch(/claude\/noref tracks main/)
        expect(git(gOrigin, 'rev-parse', 'main')).toBe(before)
      } finally {
        git(gWork, 'fetch', 'origin')
      }
    },
    120_000,
  )

  it(
    'pushes a claude/* branch that tracks its own remote to that remote',
    () => {
      git(gWork, 'checkout', '--no-track', '-b', 'claude/own', 'origin/main')
      commitOn('claude/own', 'own work')
      git(gWork, 'push', '-u', 'origin', 'claude/own')
      commitOn('claude/own', 'more own work')
      const mainBefore = git(gOrigin, 'rev-parse', 'main')
      const { status, output } = runPushScript(gWork)

      expect(output).toMatch(/git push OK/)
      expect(status).toBe(0)
      expect(git(gOrigin, 'rev-parse', 'claude/own')).toBe(git(gWork, 'rev-parse', 'HEAD'))
      expect(git(gOrigin, 'rev-parse', 'main')).toBe(mainBefore)
    },
    120_000,
  )

  it(
    'on a race, push-retry rebases a session branch onto its own remote, not main',
    () => {
      // Another checkout pushed to origin/claude/own after this one last fetched.
      const other = join(gBase, 'other')
      git(gBase, 'clone', gOrigin, other)
      git(other, 'config', 'user.email', 'test@test.invalid')
      git(other, 'config', 'user.name', 'test')
      git(other, 'checkout', 'claude/own')
      writeFileSync(join(other, 'other.txt'), 'from another checkout\n')
      git(other, 'add', '.')
      git(other, 'commit', '-m', 'other work')
      git(other, 'push', 'origin', 'claude/own')

      git(gWork, 'checkout', 'claude/own')
      commitOn('claude/own', 'local work after the race')
      const mainBefore = git(gOrigin, 'rev-parse', 'main')
      const { status, output } = runWith(gWork, 'scripts/push-retry.sh')

      expect(output).toMatch(/origin\/claude\/own moved during verification/)
      expect(output).not.toMatch(/origin\/main moved/)
      expect(output).toMatch(/git push OK/)
      expect(status).toBe(0)
      expect(git(gOrigin, 'rev-parse', 'claude/own')).toBe(git(gWork, 'rev-parse', 'HEAD'))
      expect(git(gWork, 'log', '--format=%s', '-3')).toMatch(/other work/)
      expect(git(gOrigin, 'rev-parse', 'main')).toBe(mainBefore)
    },
    120_000,
  )

  it(
    'lands a wt/* worktree branch on the origin/main it tracks',
    () => {
      git(gWork, 'fetch', 'origin')
      git(gWork, 'checkout', '-B', 'wt/lane', 'origin/main')
      commitOn('wt/lane', 'lane work')
      const { status, output } = runPushScript(gWork)

      expect(output).toMatch(/git push OK/)
      expect(status).toBe(0)
      expect(git(gOrigin, 'rev-parse', 'main')).toBe(git(gWork, 'rev-parse', 'HEAD'))
    },
    120_000,
  )

  it(
    'pushes main to origin/main',
    () => {
      git(gWork, 'fetch', 'origin')
      git(gWork, 'checkout', '-B', 'main', 'origin/main')
      commitOn('main', 'main work')
      const { status, output } = runPushScript(gWork)

      expect(output).toMatch(/git push OK/)
      expect(status).toBe(0)
      expect(git(gOrigin, 'rev-parse', 'main')).toBe(git(gWork, 'rev-parse', 'HEAD'))
    },
    120_000,
  )
})
