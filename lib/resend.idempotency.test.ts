import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * sendEmail and the Idempotency-Key (reviews of 2026-09-30).
 *
 * Resend keeps a key for 24 hours: a repeat with the same key AND the same
 * payload returns the first answer (the same email id) and sends nothing; the
 * same key with a different payload is refused (409 invalid_idempotent_request);
 * a request while the first is still in progress is refused (409
 * concurrent_idempotent_requests). So a key protects a byte-for-byte replay
 * only, and a caller must know when an answer never came: that attempt may
 * have been delivered, and it is UNKNOWN, never a failure to retry with a new
 * render. The Resend client is mocked: nothing here reaches the network.
 */

const h = vi.hoisted(() => ({
  calls: [] as Array<{ payload: Record<string, unknown>; options: unknown }>,
  answer: { data: { id: 'msg-1' }, error: null } as { data: unknown; error: unknown },
  throws: null as Error | null,
  getAnswer: { data: { id: 'msg-1', created_at: '2026-09-30T16:00:03.000Z', last_event: 'delivered' }, error: null } as { data: unknown; error: unknown },
  instrument: vi.fn(async (html: string) => html),
}))

vi.mock('resend', () => ({
  Resend: class {
    emails = {
      send: async (payload: Record<string, unknown>, options?: unknown) => {
        h.calls.push({ payload, options })
        if (h.throws) throw h.throws
        return h.answer
      },
      get: async () => h.getAnswer,
    }
  },
}))
vi.mock('@/lib/email/auto-track', () => ({ instrumentLeadHtml: (...a: unknown[]) => h.instrument(...(a as [string])) }))

import { getSentEmail, sendEmail } from './resend'

beforeEach(() => {
  h.calls.length = 0
  h.answer = { data: { id: 'msg-1' }, error: null }
  h.throws = null
  h.instrument.mockClear()
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
    expect(h.calls[0]!.options).toEqual({ idempotencyKey: 'market-report:scheduled:9016:first' })
  })

  it('sends no key when the caller has none', async () => {
    await sendEmail({ to: 'a@example.com', subject: 's', html: '<p>x</p>' })
    expect(h.calls[0]!.options).toBeUndefined()
  })

  it('an `exact` send posts the html exactly as given: no auto-instrumentation (a replay must be the same bytes)', async () => {
    await sendEmail({ to: 'a@example.com', subject: 's', html: '<p>x</p>', exact: true, idempotencyKey: 'k' })
    expect(h.instrument).not.toHaveBeenCalled()
    expect(h.calls[0]!.payload.html).toBe('<p>x</p>')
    await sendEmail({ to: 'a@example.com', subject: 's', html: '<p>x</p>' })
    expect(h.instrument).toHaveBeenCalledTimes(1)
  })
})

describe('sendEmail: an answer that never came is UNKNOWN, not a failure', () => {
  it('the SDK reports a request that could not be resolved (statusCode null): unknown', async () => {
    h.answer = { data: null, error: { name: 'application_error', statusCode: null, message: 'Unable to fetch data. The request could not be resolved.' } }
    const res = await sendEmail({ to: 'a@example.com', subject: 's', html: '<p>x</p>', idempotencyKey: 'k' })
    expect(res).toMatchObject({ error: 'Unable to fetch data. The request could not be resolved.', statusCode: null, unknown: true })
  })

  it('a throw after the request began: unknown', async () => {
    h.throws = new Error('socket hang up')
    const res = await sendEmail({ to: 'a@example.com', subject: 's', html: '<p>x</p>', idempotencyKey: 'k' })
    expect(res).toMatchObject({ error: 'socket hang up', unknown: true })
  })

  it('a key already in use (in progress, or used with another payload): unknown, since a send under it may exist', async () => {
    for (const name of ['concurrent_idempotent_requests', 'invalid_idempotent_request']) {
      h.answer = { data: null, error: { name, statusCode: 409, message: name } }
      const res = await sendEmail({ to: 'a@example.com', subject: 's', html: '<p>x</p>', idempotencyKey: 'k' })
      expect(res).toMatchObject({ statusCode: 409, unknown: true })
    }
  })

  it('a refusal Resend answered is a definite failure, with its status', async () => {
    h.answer = { data: null, error: { name: 'validation_error', statusCode: 422, message: 'Invalid `to` field' } }
    const res = await sendEmail({ to: 'a@example.com', subject: 's', html: '<p>x</p>', idempotencyKey: 'k' })
    expect(res).toEqual({ error: 'Invalid `to` field', statusCode: 422 })
    expect(res.unknown).toBeUndefined()
  })
})

describe('getSentEmail (the evidence for an attempt whose answer was lost)', () => {
  it('returns what Resend holds for an email id', async () => {
    expect(await getSentEmail('msg-1')).toEqual({ ok: true, id: 'msg-1', createdAt: '2026-09-30T16:00:03.000Z', lastEvent: 'delivered' })
  })

  it('says not found apart from an error it could not read through', async () => {
    h.getAnswer = { data: null, error: { name: 'not_found', statusCode: 404, message: 'Email not found' } }
    expect(await getSentEmail('msg-x')).toEqual({ ok: false, notFound: true, error: 'Email not found' })
    h.getAnswer = { data: null, error: { name: 'application_error', statusCode: null, message: 'Unable to fetch data.' } }
    expect(await getSentEmail('msg-x')).toEqual({ ok: false, notFound: false, error: 'Unable to fetch data.' })
  })
})
