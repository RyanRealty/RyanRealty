import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * §1 guard at the wiring level. lib/cma/auto-send.test.ts proves the DECISION
 * is right; this proves the worker actually asks it, on success only, and
 * records the answer where a person can read it.
 *
 * The failure this stops is silent: a refactor that drops the call leaves every
 * test in auto-send.test.ts green while the switch does nothing, and Matt is
 * told expireds are automated when they are not.
 */

type Args = unknown[]
const listOpenCmaActions = vi.fn((..._a: Args) => Promise.resolve([] as unknown[]))
const updateCmaActionRow = vi.fn((..._a: Args) => Promise.resolve(undefined))
const getCmaActionPayload = vi.fn((..._a: Args) => Promise.resolve({} as Record<string, unknown>))
const getCmaServeHead = vi.fn((..._a: Args) => Promise.resolve(null as unknown))
const attachCmaToPerson = vi.fn((..._a: Args) => Promise.resolve(undefined))
const buildCma = vi.fn((..._a: Args) => Promise.resolve({ ok: false } as Record<string, unknown>))
const autoSendBuiltCma = vi.fn((..._a: Args) =>
  Promise.resolve({
    outcome: 'lane-off',
    reason: 'Auto-send is off for the expired lane.',
    lane: 'expired',
    state: 'ready',
  } as Record<string, unknown>),
)

vi.mock('@/lib/data', () => ({
  listOpenCmaActions: (...a: Args) => listOpenCmaActions(...a),
  updateCmaActionRow: (...a: Args) => updateCmaActionRow(...a),
  getCmaActionPayload: (...a: Args) => getCmaActionPayload(...a),
  getCmaServeHead: (...a: Args) => getCmaServeHead(...a),
  attachCmaToPerson: (...a: Args) => attachCmaToPerson(...a),
}))
vi.mock('@/lib/cma/build', () => ({ buildCma: (...a: Args) => buildCma(...a) }))
vi.mock('@/lib/cma/auto-send', () => ({ autoSendBuiltCma: (...a: Args) => autoSendBuiltCma(...a) }))

import { runCmaBuildWorker } from './worker'

function action(over: Record<string, unknown> = {}) {
  return {
    id: 'a1',
    target: 'cma:cma-1-main',
    payload: { subject_address: '1 Main St' },
    executor_response: null,
    data_evidence: { request_source: 'expired-listing-cron' },
    failure_log: null,
    ...over,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  getCmaServeHead.mockResolvedValue(null)
  autoSendBuiltCma.mockResolvedValue({
    outcome: 'lane-off',
    reason: 'Auto-send is off for the expired lane.',
    lane: 'expired',
    state: 'ready',
  })
  getCmaActionPayload.mockResolvedValue({})
})

describe('runCmaBuildWorker → auto-send', () => {
  it('asks the lane switch after a successful build, and records the answer', async () => {
    listOpenCmaActions.mockResolvedValue([action()])
    buildCma.mockResolvedValue({ ok: true, pricing: { recommended: 500000 }, comps: [], pageCount: 12 })

    const res = await runCmaBuildWorker(1)
    expect(res.built).toBe(1)
    expect(autoSendBuiltCma).toHaveBeenCalledWith('cma-1-main')

    const readyWrite = updateCmaActionRow.mock.calls
      .map((c) => c[1] as { status?: string; executor_response?: Record<string, unknown> } | undefined)
      .find((f) => f?.status === 'ready')
    const decision = readyWrite?.executor_response?.lane_auto_send as Record<string, unknown> | undefined
    expect(decision?.outcome).toBe('lane-off')
    expect(decision?.reason).toBe('Auto-send is off for the expired lane.')
  })

  it('never reaches auto-send when the build failed', async () => {
    listOpenCmaActions.mockResolvedValue([action()])
    buildCma.mockResolvedValue({ ok: false, error: 'subject not resolved' })

    await runCmaBuildWorker(1)
    expect(autoSendBuiltCma).not.toHaveBeenCalled()
  })

  it('never reaches auto-send when the build was skipped as a clobber', async () => {
    // The document is already finalized/delivered — building would reset it to
    // draft and break the client's live link, so the worker kills the action.
    listOpenCmaActions.mockResolvedValue([action()])
    getCmaServeHead.mockResolvedValue({ status: 'delivered' })

    await runCmaBuildWorker(1)
    expect(buildCma).not.toHaveBeenCalled()
    expect(autoSendBuiltCma).not.toHaveBeenCalled()
  })
})
