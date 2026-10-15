/**
 * autoEnrollByPersonId and the SMS consent block (A2P / TCPA, consent integrity
 * 2026-10-14). true lifts the default `no-sms-consent` block, false or nothing
 * (re)applies it, and 'unproven' (a box answered by a visitor not proven to be
 * this person) writes nothing either way: a stranger can neither opt someone in
 * nor overwrite consent they gave.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

const h = vi.hoisted(() => ({
  add: vi.fn(async () => undefined),
  remove: vi.fn(async () => undefined),
  reads: 0,
}))

vi.mock('@/lib/crm/suppressions', () => ({ addSuppression: h.add, removeSuppression: h.remove }))
vi.mock('@/lib/supabase/service', () => ({
  createServiceClient: () => {
    const chain: Record<string, unknown> = {}
    for (const m of ['from', 'select', 'eq', 'in', 'order', 'limit', 'is', 'or']) chain[m] = () => chain
    // The first read finds the person; every later read (enrollment, broker text) finds nothing,
    // so only the consent block runs.
    chain.maybeSingle = async () => ({ data: h.reads++ === 0 ? { id: 5 } : null, error: null })
    return chain
  },
}))

import { autoEnrollByPersonId } from './enroll'

beforeEach(() => {
  h.add.mockClear()
  h.remove.mockClear()
  h.reads = 0
})

describe('autoEnrollByPersonId SMS consent', () => {
  it('a ticked box lifts the block', async () => {
    await autoEnrollByPersonId(5, { smsConsent: true })
    expect(h.remove).toHaveBeenCalledWith({ personId: 5, channel: 'sms', reason: 'no-sms-consent' })
    expect(h.add).not.toHaveBeenCalled()
  })

  it('no consent (re)applies the block, fail closed', async () => {
    await autoEnrollByPersonId(5, { smsConsent: false })
    expect(h.add).toHaveBeenCalledWith(expect.objectContaining({ personId: 5, channel: 'sms', reason: 'no-sms-consent' }))
    h.add.mockClear()
    h.reads = 0
    await autoEnrollByPersonId(5)
    expect(h.add).toHaveBeenCalledTimes(1)
  })

  it("an unproven answer writes nothing: no opt-in, and no overwrite of the person's own answer", async () => {
    await autoEnrollByPersonId(5, { smsConsent: 'unproven' })
    expect(h.remove).not.toHaveBeenCalled()
    expect(h.add).not.toHaveBeenCalled()
  })
})
