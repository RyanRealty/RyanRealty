import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  classifyTip,
  isSkippableTip,
  findSupersedingDeploy,
  DEFAULT_TIMEOUT_MS,
  DEFAULT_SKIP_WAIT_MS,
} from './deploy-verify-policy.mjs'

describe('isSkippableTip', () => {
  it('treats Vercel ignoreCommand outcomes as skippable', () => {
    expect(isSkippableTip('skip')).toBe(true)
    expect(isSkippableTip('empty')).toBe(true)
    expect(isSkippableTip('build')).toBe(false)
    expect(isSkippableTip('unknown')).toBe(false)
  })
})

describe('findSupersedingDeploy', () => {
  const ours = {
    created: 1000,
    state: 'CANCELED',
    sha: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
  }

  it('returns a newer READY/BUILDING deploy of a different SHA', () => {
    const newer = {
      created: 2000,
      state: 'READY',
      sha: 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
      uid: 'dpl_new',
    }
    expect(findSupersedingDeploy(ours, [ours, newer], ours.sha)).toEqual(newer)
  })

  it('ignores another CANCELED or ERROR row', () => {
    const other = {
      created: 2000,
      state: 'ERROR',
      sha: 'cccccccccccccccccccccccccccccccccccccccc',
    }
    expect(findSupersedingDeploy(ours, [ours, other], ours.sha)).toBeNull()
  })

  it('ignores a newer row that is still this SHA', () => {
    const retry = {
      created: 2000,
      state: 'BUILDING',
      sha: ours.sha,
    }
    expect(findSupersedingDeploy(ours, [ours, retry], ours.sha)).toBeNull()
  })
})

describe('timeouts', () => {
  it('waits longer than a queued generate, and skip-wait is short', () => {
    expect(DEFAULT_TIMEOUT_MS).toBe(15 * 60 * 1000)
    expect(DEFAULT_SKIP_WAIT_MS).toBe(45 * 1000)
    expect(DEFAULT_SKIP_WAIT_MS).toBeLessThan(DEFAULT_TIMEOUT_MS)
  })
})

describe('classifyTip: the commit being verified, never the checkout HEAD', () => {
  let dir = ''
  let productSha = ''
  let docsSha = ''
  const git = (...args) =>
    execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@example.com', '-c', 'commit.gpgsign=false', ...args], {
      cwd: dir,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim()
  const commit = (file) => {
    mkdirSync(join(dir, file, '..'), { recursive: true })
    writeFileSync(join(dir, file), `${file}\n`)
    git('add', file)
    git('commit', '-q', '-m', file)
    return git('rev-parse', 'HEAD')
  }

  beforeAll(() => {
    dir = mkdtempSync(join(tmpdir(), 'deploy-verify-tip-'))
    git('init', '-q', '-b', 'main')
    commit('README.md')
    productSha = commit('app/page.tsx')
    docsSha = commit('docs/plans/CROSS_AGENT_HANDOFF.md') // the checkout's HEAD
  })
  afterAll(() => {
    if (dir) rmSync(dir, { recursive: true, force: true })
  })

  it('a product commit verified from a docs-only HEAD waits the full budget (not the SKIP window)', () => {
    const tip = classifyTip(productSha, { cwd: dir, prev: '' })
    expect(tip.status).toBe('build')
    expect(isSkippableTip(tip.status)).toBe(false)
  })

  it('the docs commit itself is still skippable', () => {
    expect(isSkippableTip(classifyTip(docsSha, { cwd: dir, prev: '' }).status)).toBe(true)
  })
})
