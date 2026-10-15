import { afterAll, describe, expect, it } from 'vitest'
import { execFileSync } from 'node:child_process'
import { mkdirSync, rmSync, cpSync, symlinkSync, writeFileSync, readFileSync, chmodSync } from 'node:fs'
import { join, dirname, resolve } from 'node:path'
import { tmpdir } from 'node:os'
import { resolvingNodeModules } from '../lib/resolve-node-modules.mjs'

const REPO = resolve(new URL('.', import.meta.url).pathname, '../..')
const SANDBOX = join(tmpdir(), `rr-wt-cleanup-gate-${process.pid}-${Math.random().toString(16).slice(2)}`)
const GATE = join(SANDBOX, 'scripts/check-worktree-cleanup.mjs')

const FILES = [
  'scripts/check-worktree-cleanup.mjs',
  'scripts/cleanup-merged-worktrees.sh',
  'scripts/install-cleanup-launchd.sh',
  'scripts/launchd/com.ryanrealty.cleanup-merged-worktrees.plist',
  'scripts/ship-pr.sh',
  'package.json',
  'AGENTS.md',
  'CLAUDE.md',
  'docs/GROK_BOT_BRAIN.md',
  'docs/GROK_BOT_COMPANY.md',
  '.cursor/rules/cleanup-merged-worktrees.mdc',
  '.cursor/rules/always-merge-to-main.mdc',
  '.husky/post-merge',
  '.husky/post-checkout',
]

function run() {
  try {
    const out = execFileSync('node', [GATE], { encoding: 'utf8', cwd: SANDBOX })
    return { code: 0, out }
  } catch (error) {
    return { code: error.status ?? 1, out: `${error.stdout ?? ''}${error.stderr ?? ''}` }
  }
}

function reset() {
  rmSync(SANDBOX, { recursive: true, force: true })
  for (const rel of FILES) {
    const dest = join(SANDBOX, rel)
    mkdirSync(dirname(dest), { recursive: true })
    cpSync(join(REPO, rel), dest)
  }
  chmodSync(join(SANDBOX, 'scripts/cleanup-merged-worktrees.sh'), 0o755)
  symlinkSync(resolvingNodeModules(), join(SANDBOX, 'node_modules'), 'dir')
}

afterAll(() => {
  rmSync(SANDBOX, { recursive: true, force: true })
})

describe('ci:worktree-cleanup', () => {
  it('passes on the real wired tree copied into a sandbox', () => {
    reset()
    const { code, out } = run()
    expect(code, out).toBe(0)
  })

  it('fails when an agent instruction file drops the safety rule', () => {
    reset()
    writeFileSync(join(SANDBOX, 'docs/GROK_BOT_BRAIN.md'), '# brain\nno cleanup here\n')
    const { code, out } = run()
    expect(code).not.toBe(0)
    expect(out).toMatch(/GROK_BOT_BRAIN/)
  })

  it('fails when the post-merge hook no longer calls the script', () => {
    reset()
    writeFileSync(join(SANDBOX, '.husky/post-merge'), '#!/bin/sh\ntrue\n')
    const { code, out } = run()
    expect(code).not.toBe(0)
    expect(out).toMatch(/post-merge/)
  })

  it('fails when wt:cleanup is removed from package.json', () => {
    reset()
    const pkgPath = join(SANDBOX, 'package.json')
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'))
    delete pkg.scripts['wt:cleanup']
    writeFileSync(pkgPath, JSON.stringify(pkg, null, 2))
    const { code, out } = run()
    expect(code).not.toBe(0)
    expect(out).toMatch(/wt:cleanup/)
  })
})
