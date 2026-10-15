import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  classifyTip,
  isSkippableTip,
  findSupersedingDeploy,
  pickDeployForSha,
  concurrentBuilds,
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
      // Pre-commit sets GIT_DIR / GIT_INDEX_FILE to this repo; a temp repo must not inherit them.
      env: Object.fromEntries(
        Object.entries(process.env).filter(([key]) => !key.startsWith('GIT_')),
      ),
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

describe('concurrentBuilds', () => {
  const ours = { uid: 'dpl_ours', buildingAt: 1_000, ready: 2_000, state: 'READY', sha: 'aaaaaaa1' }

  it('names the builds whose window overlapped ours, and never ourselves', () => {
    const others = [
      ours,
      { uid: 'dpl_before', buildingAt: 100, ready: 999, state: 'READY', sha: 'bbbbbbb2' },
      { uid: 'dpl_during', buildingAt: 1_500, ready: 2_500, state: 'READY', meta: { githubCommitSha: 'ccccccc3dddd' } },
      { uid: 'dpl_errored', buildingAt: 900, ready: 1_100, state: 'ERROR', sha: 'eeeeeee5' },
      { uid: 'dpl_after', buildingAt: 2_000, ready: 3_000, state: 'READY', sha: 'fffffff6' },
    ]
    expect(concurrentBuilds(ours, others, 5_000)).toEqual([
      { id: 'dpl_during', sha: 'ccccccc', state: 'READY' },
      { id: 'dpl_errored', sha: 'eeeeeee', state: 'ERROR' },
    ])
  })

  it('a deployment that never built (ignoreCommand canceled it) is not a concurrent build', () => {
    const others = [{ uid: 'dpl_docs', state: 'CANCELED', created: 1_200, sha: 'ddddddd4' }]
    expect(concurrentBuilds(ours, others, 5_000)).toEqual([])
  })

  it('a deployment still building ends at now', () => {
    const others = [{ uid: 'dpl_live', buildingAt: 1_900, state: 'BUILDING', sha: 'ggggggg7' }]
    expect(concurrentBuilds(ours, others, 5_000)).toEqual([{ id: 'dpl_live', sha: 'ggggggg', state: 'BUILDING' }])
    expect(concurrentBuilds(ours, [{ uid: 'dpl_live', buildingAt: 2_100, state: 'BUILDING' }], 5_000)).toEqual([])
  })

  it('without a build window of our own there is nothing to compare', () => {
    expect(concurrentBuilds({ uid: 'dpl_ours', state: 'READY' }, [{ uid: 'x', buildingAt: 1, ready: 2, state: 'READY' }])).toEqual([])
    expect(concurrentBuilds(ours, null)).toEqual([])
  })
})

describe('pickDeployForSha', () => {
  const sha = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
  const other = { created: 5000, state: 'READY', sha: 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb', uid: 'dpl_other' }

  it('takes the READY build over a newer CANCELED duplicate of the same commit', () => {
    const ready = { created: 1000, state: 'READY', sha, uid: 'dpl_ready' }
    const dup = { created: 2000, state: 'CANCELED', sha, uid: 'dpl_dup' }
    expect(pickDeployForSha([other, dup, ready], sha)).toEqual(ready)
  })

  it('takes a build still in flight over a CANCELED or ERROR row', () => {
    const building = { created: 1000, state: 'BUILDING', sha, uid: 'dpl_b' }
    const canceled = { created: 3000, state: 'CANCELED', sha, uid: 'dpl_c' }
    const errored = { created: 2000, state: 'ERROR', sha, uid: 'dpl_e' }
    expect(pickDeployForSha([canceled, errored, building], sha)).toEqual(building)
  })

  it('reports ERROR before CANCELED when nothing else exists', () => {
    const canceled = { created: 3000, state: 'CANCELED', sha, uid: 'dpl_c' }
    const errored = { created: 2000, state: 'ERROR', sha, uid: 'dpl_e' }
    expect(pickDeployForSha([canceled, errored], sha)).toEqual(errored)
  })

  it('takes the newest row within one state, and matches a short SHA', () => {
    const older = { created: 1000, state: 'READY', sha, uid: 'dpl_old' }
    const newer = { created: 2000, state: 'READY', meta: { githubCommitSha: sha }, uid: 'dpl_new' }
    expect(pickDeployForSha([older, newer], sha.slice(0, 7))).toEqual(newer)
  })

  it('returns null when no row is this commit', () => {
    expect(pickDeployForSha([other], sha)).toBeNull()
    expect(pickDeployForSha([], sha)).toBeNull()
    expect(pickDeployForSha([other], '')).toBeNull()
  })
})
