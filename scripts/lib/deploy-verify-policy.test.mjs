import { describe, it, expect } from 'vitest'
import {
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
