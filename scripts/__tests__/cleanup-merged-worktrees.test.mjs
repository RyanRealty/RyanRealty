import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { execFileSync, spawn } from 'node:child_process'
import { existsSync, mkdirSync, rmSync, writeFileSync, mkdtempSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'

const REPO = resolve(new URL('.', import.meta.url).pathname, '../..')
const SCRIPT = join(REPO, 'scripts/cleanup-merged-worktrees.sh')
const ROOT = mkdtempSync(join(tmpdir(), 'rr-wt-cleanup-'))

function fixtureEnv() {
  const env = { ...process.env }
  // Husky / the parent checkout export GIT_DIR. A fixture that inherits them
  // writes into the real repo and dies with "index file open failed".
  for (const key of Object.keys(env)) {
    if (key === 'GIT_DIR' || key === 'GIT_WORK_TREE' || key === 'GIT_INDEX_FILE' || key === 'GIT_COMMON_DIR' || key === 'GIT_PREFIX' || key.startsWith('GIT_')) {
      delete env[key]
    }
  }
  env.GIT_AUTHOR_NAME = 'Test'
  env.GIT_AUTHOR_EMAIL = 'test@example.com'
  env.GIT_COMMITTER_NAME = 'Test'
  env.GIT_COMMITTER_EMAIL = 'test@example.com'
  env.HUSKY = '0'
  return env
}

function sh(cwd, ...args) {
  return execFileSync(args[0], args.slice(1), {
    cwd,
    encoding: 'utf8',
    env: fixtureEnv(),
  })
}

function git(cwd, ...args) {
  return sh(cwd, 'git', '-c', 'user.name=Test', '-c', 'user.email=test@example.com', ...args)
}

function ageFiles(dir) {
  sh(dir, 'find', dir, '(', '-name', 'node_modules', '-o', '-name', '.next', '-o', '-name', '.git', ')', '-prune', '-o', '-type', 'f', '-exec', 'touch', '-t', '202001010101', '{}', '+')
}

function runCleanup(extraEnv = {}, extraArgs = []) {
  try {
    const out = execFileSync('bash', [SCRIPT, ...extraArgs], {
      encoding: 'utf8',
      env: {
        ...fixtureEnv(),
        RR_CLEANUP_REPO: join(ROOT, 'primary'),
        RR_CLEANUP_HOME: join(ROOT, 'home'),
        RR_CLEANUP_ALLOW_ANY_ORIGIN: '1',
        RR_CLEANUP_ORIGIN_FETCH: '0',
        RR_CLEANUP_GH: '0',
        RR_CLEANUP_RECENT_MINUTES: '180',
        ...extraEnv,
      },
    })
    return { code: 0, out }
  } catch (error) {
    return { code: error.status ?? 1, out: `${error.stdout ?? ''}${error.stderr ?? ''}` }
  }
}

beforeAll(() => {
  const origin = join(ROOT, 'origin.git')
  const primary = join(ROOT, 'primary')
  const home = join(ROOT, 'home')
  mkdirSync(home, { recursive: true })
  mkdirSync(join(home, '.grok', 'worktrees'), { recursive: true })

  sh(ROOT, 'git', 'init', '--bare', origin)
  git(ROOT, 'clone', origin, primary)
  writeFileSync(join(primary, 'README'), 'main\n')
  git(primary, 'add', 'README')
  git(primary, 'commit', '-m', 'init')
  git(primary, 'branch', '-M', 'main')
  git(primary, 'push', '-u', 'origin', 'main')

  // Linked worktrees of PRIMARY.
  const cases = {
    'wt-dirty': 'dirty',
    'wt-unpushed': 'unpushed',
    'wt-active': 'active',
    'wt-stash': 'stashed',
    'wt-recent': 'recent',
    'wt-done': 'done',
  }
  for (const [folder, branch] of Object.entries(cases)) {
    const path = join(ROOT, folder)
    git(primary, 'worktree', 'add', '-b', branch, path)
    writeFileSync(join(path, 'work.txt'), `${branch}\n`)
    git(path, 'add', 'work.txt')
    git(path, 'commit', '-m', `${branch} work`)
    git(path, 'push', '-u', 'origin', branch)
  }

  // Replay `done` and `active` onto main so git cherry is empty, then drop those
  // origin branches. Local worktrees stay on their branches.
  git(primary, 'checkout', 'main')
  git(primary, 'cherry-pick', '-x', 'done')
  git(primary, 'push', 'origin', 'main')

  // sibling clone matching ~/rr-* while origin/done still exists
  const clone = join(home, 'rr-done-clone')
  git(ROOT, 'clone', origin, clone)
  git(clone, 'checkout', '-B', 'clone-done', 'origin/done')

  git(primary, 'push', 'origin', '--delete', 'done')

  // dirty
  writeFileSync(join(ROOT, 'wt-dirty', 'work.txt'), 'dirty extra\n')

  // unpushed: extra local commit, branch deleted from origin so the unique
  // patch is the skip reason
  writeFileSync(join(ROOT, 'wt-unpushed', 'extra.txt'), 'only local\n')
  git(join(ROOT, 'wt-unpushed'), 'add', 'extra.txt')
  git(join(ROOT, 'wt-unpushed'), 'commit', '-m', 'unpushed')
  git(primary, 'push', 'origin', '--delete', 'unpushed')

  // stash from this HEAD (linked worktree — first parent is HEAD)
  writeFileSync(join(ROOT, 'wt-stash', 'wip.txt'), 'stash me\n')
  git(join(ROOT, 'wt-stash'), 'stash', 'push', '-u', '-m', 'wip')

  // recent: leave a just-written source file (do not age this tree)
  writeFileSync(join(ROOT, 'wt-recent', 'fresh.txt'), 'now\n')
  git(join(ROOT, 'wt-recent'), 'add', 'fresh.txt')
  git(join(ROOT, 'wt-recent'), 'commit', '-m', 'recent')
  git(join(ROOT, 'wt-recent'), 'push', 'origin', 'recent')

  ageFiles(clone)

  ageFiles(join(ROOT, 'wt-done'))
  ageFiles(join(ROOT, 'wt-dirty'))
  ageFiles(join(ROOT, 'wt-unpushed'))
  ageFiles(join(ROOT, 'wt-stash'))
  ageFiles(join(ROOT, 'wt-active'))
  // wt-recent stays fresh on purpose
})

afterAll(() => {
  rmSync(ROOT, { recursive: true, force: true })
})

describe('cleanup-merged-worktrees.sh', () => {
  it('dry-run keeps the primary, skips dirty/unpushed/stashed/recent, would remove a merged clean worktree and matching clone', () => {
    const { code, out } = runCleanup({ RR_CLEANUP_DRY_RUN: '1' })
    expect(code).toBe(0)
    expect(out).toMatch(/KEEP\s+\S+\/primary\s+primary checkout/)
    expect(out).toMatch(/SKIP\s+\S+\/wt-dirty\s+dirty working tree/)
    expect(out).toMatch(/SKIP\s+\S+\/wt-unpushed/)
    expect(out).toMatch(/SKIP\s+\S+\/wt-stash\s+stash present/)
    expect(out).toMatch(/SKIP\s+\S+\/wt-recent\s+changed in last/)
    expect(out).toMatch(/WOULD\s+\S+\/wt-done/)
    expect(out).toMatch(/WOULD\s+\S+\/rr-done-clone/)
    expect(existsSync(join(ROOT, 'wt-done'))).toBe(true)
    expect(existsSync(join(ROOT, 'home', 'rr-done-clone'))).toBe(true)
  })

  it('skips a checkout another process has as cwd', () => {
    const child = spawn('sleep', ['30'], {
      cwd: join(ROOT, 'wt-active'),
      detached: true,
      stdio: 'ignore',
    })
    try {
      const { out } = runCleanup({ RR_CLEANUP_DRY_RUN: '1' })
      expect(out).toMatch(/SKIP\s+\S+\/wt-active/)
      expect(out).toMatch(/pid |cwd|lsof/)
    } finally {
      try {
        process.kill(child.pid, 'SIGTERM')
      } catch {
        /* already gone */
      }
    }
  })

  it('live mode removes the merged clean worktree and the matching clone, leaves the others', () => {
    const { code, out } = runCleanup({})
    expect(code).toBe(0)
    expect(out).toMatch(/REMOVE\s+\S+\/wt-done/)
    expect(out).toMatch(/REMOVE\s+\S+\/rr-done-clone/)
    expect(existsSync(join(ROOT, 'wt-done'))).toBe(false)
    expect(existsSync(join(ROOT, 'home', 'rr-done-clone'))).toBe(false)
    expect(existsSync(join(ROOT, 'wt-dirty'))).toBe(true)
    expect(existsSync(join(ROOT, 'wt-unpushed'))).toBe(true)
    expect(existsSync(join(ROOT, 'wt-stash'))).toBe(true)
    expect(existsSync(join(ROOT, 'wt-recent'))).toBe(true)
    expect(existsSync(join(ROOT, 'primary'))).toBe(true)
  })
})
