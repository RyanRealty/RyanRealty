/**
 * The freshness check, against throwaway repositories only. Every test builds its
 * own repo with GIT_DIR, GIT_WORK_TREE and GIT_INDEX_FILE set and every inherited
 * GIT_* variable removed (test-git.ts), so nothing here can touch the checkout it
 * runs in or fetch from anywhere.
 */
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { checkFreshness, fetchAndCheckFreshness, gitRunner, withoutAnyGitVar, withoutRepoLocation } from './freshness'
import { makeTempRepo } from './test-git'

let dir = ''
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'rr-fresh-'))
})
afterEach(() => {
  rmSync(dir, { recursive: true, force: true })
})

const fresh = (shape: Parameters<typeof makeTempRepo>[1]) => checkFreshness(gitRunner({ env: makeTempRepo(dir, shape).env }))

describe('checkFreshness', () => {
  it('passes a checkout level with origin/main', () => {
    expect(fresh('level')).toMatchObject({ ok: true })
  })

  it('passes a checkout ahead of origin/main', () => {
    expect(fresh('ahead')).toMatchObject({ ok: true })
  })

  it('refuses a checkout behind origin/main and says how many commits', () => {
    const out = fresh('behind')
    expect(out).toMatchObject({ ok: false })
    expect(!out.ok && out.problem).toMatch(/behind origin\/main \(main has 1 commit/)
  })

  it('refuses a checkout that has diverged from origin/main: main has commits it lacks', () => {
    const out = fresh('diverged')
    expect(!out.ok && out.problem).toMatch(/behind origin\/main/)
  })

  it('refuses when there is no origin/main to compare with: it cannot tell, so it does not proceed', () => {
    const out = fresh('no-origin')
    expect(!out.ok && out.problem).toMatch(/no refs\/remotes\/origin\/main/)
  })

  it('refuses when git cannot read HEAD at all', () => {
    const out = checkFreshness(() => ({ status: 128, stdout: '', stderr: 'fatal: not a git repository' }))
    expect(!out.ok && out.problem).toMatch(/could not read HEAD/)
  })

  it('refuses when git answers something other than yes or no', () => {
    const answers: Record<string, { status: number; stdout: string }> = { 'rev-parse': { status: 0, stdout: 'abc\n' }, 'merge-base': { status: 128, stdout: '' } }
    const out = checkFreshness((args) => ({ ...(answers[args[0]] ?? { status: 0, stdout: '' }), stderr: 'fatal: bad object' }))
    expect(!out.ok && out.problem).toMatch(/could not tell whether this checkout is behind origin\/main/)
  })
})

describe('fetchAndCheckFreshness', () => {
  it('refuses when the fetch cannot be made (a temp repo has no origin), without reaching a network', () => {
    const repo = makeTempRepo(dir, 'level')
    const out = fetchAndCheckFreshness(dir, { env: repo.env, fetchTimeoutMs: 5000 })
    expect(!out.ok && out.problem).toMatch(/could not fetch origin\/main.*the run is refused/)
  })
})

describe('the environment a git child gets', () => {
  const poisoned = { PATH: '/bin', GIT_DIR: '/elsewhere/.git', GIT_WORK_TREE: '/elsewhere', GIT_INDEX_FILE: '/elsewhere/index', GIT_SSL_CAINFO: '/ca.pem', GIT_TERMINAL_PROMPT: '0', HOME: '/h' } as unknown as NodeJS.ProcessEnv

  it('withoutAnyGitVar removes every GIT_* variable and keeps the rest', () => {
    expect(withoutAnyGitVar(poisoned)).toEqual({ PATH: '/bin', HOME: '/h' })
  })

  it('withoutRepoLocation removes only the variables that pick the repository, keeping auth and proxy settings', () => {
    expect(withoutRepoLocation(poisoned)).toEqual({ PATH: '/bin', GIT_SSL_CAINFO: '/ca.pem', GIT_TERMINAL_PROMPT: '0', HOME: '/h' })
  })

  it('a temp repo ignores the environment it was started from', () => {
    const saved = { GIT_DIR: process.env.GIT_DIR, GIT_WORK_TREE: process.env.GIT_WORK_TREE }
    process.env.GIT_DIR = '/nonexistent/should-never-be-used'
    process.env.GIT_WORK_TREE = '/nonexistent'
    try {
      const repo = makeTempRepo(dir, 'level')
      expect(repo.env.GIT_DIR).toBe(join(dir, 'repo.git'))
      expect(repo.env.GIT_WORK_TREE).toBe(join(dir, 'work'))
      expect(repo.env.GIT_INDEX_FILE).toBe(join(dir, 'index'))
      expect(checkFreshness(gitRunner({ env: repo.env }))).toMatchObject({ ok: true })
    } finally {
      for (const [k, v] of Object.entries(saved)) {
        if (v === undefined) delete process.env[k]
        else process.env[k] = v
      }
    }
  })
})
