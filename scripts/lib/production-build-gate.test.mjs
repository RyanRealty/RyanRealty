import { describe, expect, it } from 'vitest'
import { PENDING_TIP_GRACE_MS, productionBuildGate } from './production-build-gate.mjs'

const NOW = Date.parse('2026-10-15T00:05:00Z')
const dep = (sha, state, minutesAgo = 1) => ({
  uid: `dpl_${sha}`,
  state,
  created: NOW - minutesAgo * 60_000,
  meta: { githubCommitSha: `${sha}0000000000000000000000000000000` },
})

describe('productionBuildGate', () => {
  it('waits while a production build is running: #632 merged while #633 was still building', () => {
    const gate = productionBuildGate([dep('0a9c47645', 'BUILDING', 3), dep('8357b3122', 'READY', 10)], {
      mainSha: '0a9c476450000000000000000000000000000000',
      now: NOW,
    })
    expect(gate.wait).toBe(true)
    expect(gate.reason).toBe('production build in flight: 0a9c47645 BUILDING 3 min')
  })

  it('waits on a queued or initializing build too', () => {
    for (const state of ['QUEUED', 'INITIALIZING', 'PENDING']) {
      expect(productionBuildGate([dep('4837ad8a8', state)], { now: NOW }).wait).toBe(true)
    }
  })

  it('merges when every production build has finished, whatever its outcome', () => {
    const gate = productionBuildGate(
      [dep('4837ad8a8', 'READY'), dep('0a9c47645', 'ERROR', 6), dep('7e097ad04', 'CANCELED', 30)],
      { mainSha: '4837ad8a80000000000000000000000000000000', now: NOW },
    )
    expect(gate).toEqual({ wait: false, reason: 'no production build in flight', inFlight: [] })
  })

  it('waits for the deployment main just pushed, until Vercel has had time to open it', () => {
    const list = [dep('8357b3122', 'READY', 8)]
    const tip = '0a9c476450000000000000000000000000000000'
    expect(productionBuildGate(list, { mainSha: tip, tipPendingForMs: 10_000, now: NOW }).wait).toBe(true)
    // A push Vercel never builds stops holding the merge after the grace.
    expect(productionBuildGate(list, { mainSha: tip, tipPendingForMs: PENDING_TIP_GRACE_MS, now: NOW }).wait).toBe(false)
  })

  it('matches a short or a full sha', () => {
    const list = [{ uid: 'dpl_x', state: 'READY', sha: '0a9c476' }]
    expect(productionBuildGate(list, { mainSha: '0a9c476450000000000000000000000000000000', now: NOW }).wait).toBe(false)
  })

  it('treats no deployments and no main sha as nothing running', () => {
    expect(productionBuildGate([], { now: NOW }).wait).toBe(false)
    expect(productionBuildGate(undefined, { now: NOW }).wait).toBe(false)
  })
})
