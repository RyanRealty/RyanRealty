import { createHmac } from 'node:crypto'
import { NextRequest } from 'next/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * The Resend webhook mirrors each email event onto the contact's crm_timeline.
 * It used to discard the result of that upsert, so when the live
 * crm_timeline_kind_check refused 'email_delivered' / 'email_bounce' (418 rows
 * in one day, 2026-10-15) the route answered 200 and said nothing.
 * Pinned here: the right kind is written, a refusal still answers 200 (Resend
 * must not retry a permanent failure), and the refusal logs ONE line per kind
 * naming the table and the value, with no address and no row.
 */
const upsert = vi.hoisted(() => vi.fn())
const personIds = vi.hoisted(() => vi.fn(async (_email: string) => [101, 102]))

vi.mock('@/lib/supabase/service', () => ({ createServiceClient: () => ({ from: () => ({ upsert }) }) }))
vi.mock('@/lib/data/crm/getPersonIdsByEmail', () => ({ getPersonIdsByEmail: (e: string) => personIds(e) }))
vi.mock('@/lib/data', () => ({
  recordNewsletterEvent: vi.fn(async () => {}),
  setSubscriberStatusByEmail: vi.fn(async () => {}),
}))
vi.mock('@/lib/data/newsletter/queue', () => ({
  getRecipientByMessageId: vi.fn(async () => null),
  recordLedgerEvent: vi.fn(async () => {}),
  ledgerEventFor: vi.fn(() => null),
}))
vi.mock('@/lib/crm/suppressions', () => ({ addSuppression: vi.fn(async () => {}) }))
vi.mock('@/lib/crm/email-events', () => ({ recordEmailEvent: vi.fn(async () => ({ ok: true })) }))

import { POST } from './route'

const SECRET_BYTES = Buffer.from('resend-test-secret-bytes')
const SECRET = `whsec_${SECRET_BYTES.toString('base64')}`
const EMAIL = 'recipient@example.com'

function signed(body: Record<string, unknown>): NextRequest {
  const raw = JSON.stringify(body)
  const id = 'msg_test_1'
  const ts = String(Math.floor(Date.now() / 1000))
  const sig = createHmac('sha256', SECRET_BYTES).update(`${id}.${ts}.${raw}`).digest('base64')
  return new NextRequest('https://ryan-realty.com/api/webhooks/resend', {
    method: 'POST',
    headers: { 'svix-id': id, 'svix-timestamp': ts, 'svix-signature': `v1,${sig}` },
    body: raw,
  })
}

const event = (type: string, extra: Record<string, unknown> = {}) => ({
  type,
  created_at: '2026-10-15T00:31:18.000Z',
  data: { email_id: 'em_1', to: [EMAIL], subject: 'A subject', ...extra },
})

const checkViolation = {
  code: '23514',
  message: 'new row for relation "crm_timeline" violates check constraint "crm_timeline_kind_check"',
  details: `Failing row contains (1, 101, email_delivered, {"email": "${EMAIL}"})`,
}

let errorSpy: ReturnType<typeof vi.spyOn>
const secretBefore = process.env.RESEND_WEBHOOK_SECRET
beforeEach(() => {
  process.env.RESEND_WEBHOOK_SECRET = SECRET
  upsert.mockReset()
  errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
})
afterEach(() => {
  errorSpy.mockRestore()
  process.env.RESEND_WEBHOOK_SECRET = secretBefore
})

describe('POST /api/webhooks/resend: the crm_timeline mirror', () => {
  it('writes email_delivered for each matched person and logs nothing when the write lands', async () => {
    upsert.mockResolvedValue({ error: null })
    const res = await POST(signed(event('email.delivered')))
    expect(res.status).toBe(200)
    expect(upsert).toHaveBeenCalledTimes(2)
    expect(upsert.mock.calls[0][0]).toMatchObject({
      person_id: 101,
      kind: 'email_delivered',
      title: 'Email delivered',
      source: 'resend',
      dedupe_key: 'resend:em_1:delivered:p101',
    })
    expect(errorSpy).not.toHaveBeenCalled()
  })

  it('a refused kind still answers 200 and logs ONE line for the two people it fanned out to', async () => {
    upsert.mockResolvedValue({ error: checkViolation })
    const res = await POST(signed(event('email.delivered')))
    expect(res.status).toBe(200)
    expect(upsert).toHaveBeenCalledTimes(2)
    expect(errorSpy).toHaveBeenCalledTimes(1)
    const line = String(errorSpy.mock.calls[0][0])
    expect(line).toContain('[resend-webhook]')
    expect(line).toContain('table=crm_timeline')
    expect(line).toContain('column=kind')
    expect(line).toContain('value=email_delivered')
    expect(line).toContain('code=23514')
    // No address, no row, no subject.
    expect(line).not.toContain(EMAIL)
    expect(line).not.toContain('Failing row')
    expect(line).not.toContain('A subject')
  })

  it('a bounce is written as email_bounce and a refusal names that value', async () => {
    upsert.mockResolvedValue({ error: checkViolation })
    const res = await POST(signed(event('email.bounced', { bounce: { type: 'Permanent' } })))
    expect(res.status).toBe(200)
    expect(upsert.mock.calls[0][0]).toMatchObject({ kind: 'email_bounce', title: 'Email bounced' })
    expect(errorSpy).toHaveBeenCalledTimes(1)
    expect(String(errorSpy.mock.calls[0][0])).toContain('value=email_bounce')
  })

  it('a complaint is written as email_complaint', async () => {
    upsert.mockResolvedValue({ error: null })
    await POST(signed(event('email.complained')))
    expect(upsert.mock.calls[0][0]).toMatchObject({ kind: 'email_complaint', title: 'Spam complaint' })
  })

  it('the unsubscribe path logs a refusal too, once', async () => {
    upsert.mockResolvedValue({ error: checkViolation })
    const res = await POST(signed(event('email.unsubscribed')))
    expect(res.status).toBe(200)
    expect(upsert.mock.calls[0][0]).toMatchObject({ kind: 'email_unsubscribe', dedupe_key: 'resend:em_1:unsubscribed:p101' })
    expect(errorSpy).toHaveBeenCalledTimes(1)
    expect(String(errorSpy.mock.calls[0][0])).toContain('value=email_unsubscribe')
  })

  it('rejects an unsigned request before writing anything', async () => {
    const req = new NextRequest('https://ryan-realty.com/api/webhooks/resend', {
      method: 'POST',
      body: JSON.stringify(event('email.delivered')),
    })
    const res = await POST(req)
    expect(res.status).toBe(401)
    expect(upsert).not.toHaveBeenCalled()
  })
})
