import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * sendEmail passes a caller's send key to Resend as its Idempotency-Key
 * (review 2026-09-30): the market report claims one key per subscription per
 * cycle, and a repeat of that send must be refused by the provider too. The
 * Resend client is mocked: nothing here reaches the network.
 */

const calls = vi.hoisted(() => [] as Array<{ payload: Record<string, unknown>; options: unknown }>)

vi.mock('resend', () => ({
  Resend: class {
    emails = {
      send: async (payload: Record<string, unknown>, options?: unknown) => {
        calls.push({ payload, options })
        return { data: { id: 'msg-1' }, error: null }
      },
    }
  },
}))
vi.mock('@/lib/email/auto-track', () => ({ instrumentLeadHtml: async (html: string) => html }))

import { sendEmail } from './resend'

beforeEach(() => {
  calls.length = 0
  process.env.RESEND_API_KEY = 'test-key-not-real'
  process.env.RESEND_FROM = 'Ryan Realty <noreply@mail.ryan-realty.com>'
})
afterEach(() => {
  delete process.env.RESEND_API_KEY
  delete process.env.RESEND_FROM
})

describe('sendEmail idempotency key', () => {
  it('passes the key to Resend as its Idempotency-Key', async () => {
    const res = await sendEmail({ to: 'a@example.com', subject: 's', html: '<p>x</p>', idempotencyKey: 'market-report:scheduled:9016:first' })
    expect(res).toEqual({ id: 'msg-1' })
    expect(calls[0]!.options).toEqual({ idempotencyKey: 'market-report:scheduled:9016:first' })
  })

  it('sends no key when the caller has none', async () => {
    await sendEmail({ to: 'a@example.com', subject: 's', html: '<p>x</p>' })
    expect(calls[0]!.options).toBeUndefined()
  })
})
