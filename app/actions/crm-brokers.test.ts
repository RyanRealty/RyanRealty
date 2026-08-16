/**
 * SMS-agent toggle is a security boundary: only the owner may flip
 * brokers.sms_agent_enabled, and unknown slugs never reach the DAL.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

let access: { email: string; role: 'superuser' | 'broker' | 'report_viewer'; brokerSlug: string | null } | null =
  null
vi.mock('@/app/actions/crm', () => ({
  getCrmAccess: () => Promise.resolve(access),
}))

const setAgentEnabled = vi.fn()
vi.mock('@/lib/data/agent/broker-agent-flags', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/data/agent/broker-agent-flags')>()
  return {
    ...actual,
    setAgentEnabled: (...args: unknown[]) => setAgentEnabled(...args),
  }
})

vi.mock('next/cache', () => ({
  revalidatePath: () => {},
  revalidateTag: () => {},
}))

import { setCrmBrokerSmsAgentAction } from '@/app/actions/crm-brokers'

beforeEach(() => {
  access = { email: 'matt@ryan-realty.com', role: 'superuser', brokerSlug: 'matt' }
  setAgentEnabled.mockReset()
  setAgentEnabled.mockResolvedValue({ ok: true })
})

describe('setCrmBrokerSmsAgentAction', () => {
  it('refuses a signed-out caller without touching the DAL', async () => {
    access = null
    const result = await setCrmBrokerSmsAgentAction('matt', false)
    expect(result).toEqual({ ok: false, error: 'Not authorized' })
    expect(setAgentEnabled).not.toHaveBeenCalled()
  })

  it('refuses a non-owner without touching the DAL', async () => {
    access = { email: 'paul@ryan-realty.com', role: 'broker', brokerSlug: 'paul' }
    const result = await setCrmBrokerSmsAgentAction('paul', true)
    expect(result).toEqual({ ok: false, error: 'Only the owner can change the broker roster' })
    expect(setAgentEnabled).not.toHaveBeenCalled()
  })

  it('refuses an unknown slug without touching the DAL', async () => {
    const result = await setCrmBrokerSmsAgentAction('not-a-broker', true)
    expect(result.ok).toBe(false)
    if (result.ok) throw new Error('expected failure')
    expect(result.error).toMatch(/unknown broker/i)
    expect(setAgentEnabled).not.toHaveBeenCalled()
  })

  it('flips the per-broker flag through the existing DAL', async () => {
    const result = await setCrmBrokerSmsAgentAction('rebecca', false)
    expect(result).toEqual({ ok: true })
    expect(setAgentEnabled).toHaveBeenCalledWith('rebecca', false)
  })
})
