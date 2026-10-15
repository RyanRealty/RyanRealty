/**
 * Break-tests for scripts/worktree-setup.sh.
 *
 * On Linux the script aborted before it installed `.husky/_`: it assumed the
 * main checkout lived at $HOME/RyanRealty and used `cp -Rc` (an APFS clone,
 * macOS only) for node_modules, so a fresh worktree was left with no git hooks
 * and a push from it skipped every gate. These cases build a real main
 * checkout plus a real `git worktree add` in a temp dir and prove: the main
 * checkout is found from `git worktree list` (HOME points nowhere), the hooks
 * land even with no .env.local in the main checkout, node_modules arrives by
 * the Linux or macOS copy, and `--link` makes a symlink.
 */
import { execFileSync, spawnSync } from 'node:child_process'
import {
  chmodSync,
  copyFileSync,
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'

const ROOT = process.cwd()
const made = []
afterEach(() => {
  while (made.length) rmSync(made.pop(), { recursive: true, force: true })
})

/**
 * The environment every git and shell call here runs in. Under a git hook (this
 * suite runs from pre-commit and pre-push) git exports GIT_DIR, GIT_INDEX_FILE
 * and friends; a child `git init` or `git commit` that inherited them would act
 * on the REAL repository: it re-initialised the shared config as bare, wrote a
 * test identity into it, and committed to the developer's branch. So every GIT_*
 * variable is dropped, the user and system git config are ignored, and the
 * identity comes from variables set here.
 */
function cleanEnv(extra = {}) {
  const env = {}
  for (const [key, value] of Object.entries(process.env)) {
    if (!key.startsWith('GIT_')) env[key] = value
  }
  return {
    ...env,
    GIT_CONFIG_GLOBAL: '/dev/null',
    GIT_CONFIG_NOSYSTEM: '1',
    GIT_AUTHOR_NAME: 'test',
    GIT_AUTHOR_EMAIL: 'test@example.com',
    GIT_COMMITTER_NAME: 'test',
    GIT_COMMITTER_EMAIL: 'test@example.com',
    ...extra,
  }
}

function git(cwd, ...args) {
  return execFileSync('git', args, { cwd, env: cleanEnv(), encoding: 'utf8' }).trim()
}

/** A main checkout with the script committed and the gitignored files present. */
function checkout({ envLocal = true } = {}) {
  const base = mkdtempSync(join(tmpdir(), 'worktree-setup-'))
  made.push(base)
  const main = join(base, 'elsewhere', 'main-checkout')
  mkdirSync(join(main, 'scripts'), { recursive: true })
  git(main, 'init', '-q', '-b', 'main')
  // Every call below must act on this temp repository and no other.
  expect(realpathSync(git(main, 'rev-parse', '--show-toplevel'))).toBe(realpathSync(main))
  expect(realpathSync(main).startsWith(realpathSync(tmpdir()))).toBe(true)
  for (const file of ['worktree-setup.sh', 'check-hooks-installed.mjs']) {
    copyFileSync(join(ROOT, 'scripts', file), join(main, 'scripts', file))
  }
  writeFileSync(join(main, '.gitignore'), '.husky/_\nnode_modules\n.env.local\n')
  git(main, 'add', '-A')
  git(main, 'commit', '-q', '-m', 'init')
  git(main, 'config', 'core.hooksPath', '.husky/_')

  mkdirSync(join(main, '.husky', '_'), { recursive: true })
  for (const hook of ['pre-push', 'pre-commit', 'commit-msg']) {
    writeFileSync(join(main, '.husky', '_', hook), '#!/usr/bin/env sh\nexit 0\n')
  }
  mkdirSync(join(main, 'node_modules', '.bin'), { recursive: true })
  writeFileSync(join(main, 'node_modules', '.bin', 'tsc'), '#!/usr/bin/env sh\nexit 0\n')
  chmodSync(join(main, 'node_modules', '.bin', 'tsc'), 0o755)
  if (envLocal) writeFileSync(join(main, '.env.local'), 'NEXT_PUBLIC_SUPABASE_URL=https://example.invalid\n')

  const wt = join(base, 'wt')
  git(main, 'worktree', 'add', '-q', '-b', 'feature', wt)
  return { main, wt, base }
}

function setup(cwd, base, args = []) {
  const env = cleanEnv({ HOME: join(base, 'no-such-home') })
  delete env.CI
  delete env.GITHUB_ACTIONS
  return spawnSync('sh', ['scripts/worktree-setup.sh', ...args], { cwd, env, encoding: 'utf8' })
}

describe('scripts/worktree-setup.sh', () => {
  it('starts from a worktree with no hooks, no env file and no node_modules', () => {
    const { wt } = checkout()
    expect(existsSync(join(wt, '.husky', '_', 'pre-push'))).toBe(false)
    expect(existsSync(join(wt, 'node_modules'))).toBe(false)
    expect(existsSync(join(wt, '.env.local'))).toBe(false)
  })

  it('finds the main checkout from git, not from $HOME, and sets the tree up', () => {
    const { wt, base } = checkout()
    const run = setup(wt, base)
    expect(run.status, run.stdout + run.stderr).toBe(0)
    for (const hook of ['pre-push', 'pre-commit', 'commit-msg']) {
      expect(existsSync(join(wt, '.husky', '_', hook))).toBe(true)
    }
    expect(existsSync(join(wt, 'node_modules', '.bin', 'tsc'))).toBe(true)
    expect(lstatSync(join(wt, 'node_modules')).isSymbolicLink()).toBe(false)
    expect(existsSync(join(wt, '.env.local'))).toBe(true)
    expect(run.stdout).toContain('ci:hooks-installed — OK')
  })

  it('installs the hooks even when the main checkout has no .env.local', () => {
    const { wt, base } = checkout({ envLocal: false })
    const run = setup(wt, base)
    expect(run.status, run.stdout + run.stderr).toBe(0)
    expect(existsSync(join(wt, '.husky', '_', 'pre-push'))).toBe(true)
    expect(existsSync(join(wt, '.env.local'))).toBe(false)
    expect(run.stdout).toContain('.env.local: none')
  })

  it('--link symlinks node_modules to the main checkout', () => {
    const { wt, main, base } = checkout()
    const run = setup(wt, base, ['--link'])
    expect(run.status, run.stdout + run.stderr).toBe(0)
    expect(lstatSync(join(wt, 'node_modules')).isSymbolicLink()).toBe(true)
    expect(existsSync(join(wt, 'node_modules', '.bin', 'tsc'))).toBe(true)
    expect(existsSync(join(main, 'node_modules', '.bin', 'tsc'))).toBe(true)
    expect(existsSync(join(wt, '.husky', '_', 'pre-push'))).toBe(true)
  })

  it('accepts the main checkout path as an argument', () => {
    const { wt, main, base } = checkout()
    const run = setup(wt, base, [main])
    expect(run.status, run.stdout + run.stderr).toBe(0)
    expect(existsSync(join(wt, '.husky', '_', 'pre-push'))).toBe(true)
  })

  it('leaves a tree that already has everything alone', () => {
    const { wt, base } = checkout()
    expect(setup(wt, base).status).toBe(0)
    const again = setup(wt, base)
    expect(again.status, again.stdout + again.stderr).toBe(0)
    expect(again.stdout).toContain('.husky/_: present')
    expect(again.stdout).toContain('node_modules: present')
  })

  it('does nothing in the main checkout itself', () => {
    const { main, base } = checkout()
    const run = setup(main, base)
    expect(run.status, run.stdout + run.stderr).toBe(0)
    expect(run.stdout).toContain('already in the main checkout')
  })

  it('stops with a message when the main checkout has no hooks to copy', () => {
    const { wt, main, base } = checkout()
    rmSync(join(main, '.husky'), { recursive: true, force: true })
    const run = setup(wt, base)
    expect(run.status).toBe(1)
    expect(run.stderr).toContain('no main checkout with .husky/_')
  })
})
