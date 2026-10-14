/**
 * Twilio inbound ack: TwiML/200 under the carrier deadline even when CRM/DB
 * is slow or throws; raw payload persisted; replay is idempotent by sid.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'

const {
  insertTwilioRawEvent,
  claimTwilioRawEvent,
  markTwilioRawEventProcessed,
  markTwilioRawEventError,
  listUnprocessedTwilioRawEvents,
} = vi.hoisted(() => ({
  insertTwilioRawEvent: vi.fn(async () => ({ ok: true as const, id: 11, persisted: true as const })),
  claimTwilioRawEvent: vi.fn(async () => true),
  markTwilioRawEventProcessed: vi.fn(async () => {}),
  markTwilioRawEventError: vi.fn(async () => {}),
  listUnprocessedTwilioRawEvents: vi.fn(async () => []),
}))

vi.mock('@/lib/data/crm/twilioRawEvents', () => ({
  insertTwilioRawEvent,
  claimTwilioRawEvent,
  markTwilioRawEventProcessed,
  markTwilioRawEventError,
  listUnprocessedTwilioRawEvents,
}))

vi.mock('@/lib/crm/twilio', () => ({
  verifiedTwilioParams: async (request: Request) => {
    const form = await request.formData()
    const params: Record<string, string> = {}
    for (const [k, v] of form.entries()) params[k] = String(v)
    return { ok: true, params }
  },
}))

vi.mock('next/server', async () => {
  const actual = await vi.importActual<typeof import('next/server')>('next/server')
  return {
    ...actual,
    after: () => {
      throw new Error('no request context')
    },
  }
})

import {
  ackTwilioWebhook,
  flushScheduledAckWork,
  clearScheduledAckWork,
  persistTwilioRawEvent,
  replayTwilioRawEvent,
  replayUnprocessedTwilioRawEvents,
  smsKeywordReply,
  SMS_STOP_REPLY,
  TWILIO_ACK_DEADLINE_MS,
  TWILIO_RAW_PERSIST_MS,
} from './twilio-webhook-ack'

function post(fields: Record<string, string>): Request {
  return new Request('https://ryan-realty.com/api/twilio/inbound-sms', {
    method: 'POST',
    body: new URLSearchParams(fields),
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  })
}

describe('twilio webhook ack', () => {
  beforeEach(() => {
    insertTwilioRawEvent.mockClear()
    insertTwilioRawEvent.mockResolvedValue({ ok: true, id: 11, persisted: true })
    claimTwilioRawEvent.mockClear()
    claimTwilioRawEvent.mockResolvedValue(true)
    markTwilioRawEventProcessed.mockClear()
    markTwilioRawEventError.mockClear()
    listUnprocessedTwilioRawEvents.mockClear()
    clearScheduledAckWork()
  })

  it('acks under the deadline when CRM processing hangs', async () => {
    const process = vi.fn(() => new Promise<void>(() => {}))
    const started = Date.now()
    const res = await ackTwilioWebhook({
      request: post({ From: '+15035550123', To: '+15417033095', Body: 'hello', MessageSid: 'SMslow' }),
      kind: 'inbound-sms',
      process,
      respond: () => new Response('<Response></Response>', { status: 200, headers: { 'Content-Type': 'text/xml' } }),
    })
    expect(res.status).toBe(200)
    expect(Date.now() - started).toBeLessThan(TWILIO_ACK_DEADLINE_MS)
    expect(insertTwilioRawEvent).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'inbound-sms', providerSid: 'SMslow', payload: expect.objectContaining({ Body: 'hello' }) }),
    )
  })

  it('acks under the deadline when CRM processing throws', async () => {
    const process = vi.fn(async () => {
      throw new Error('crm down')
    })
    const started = Date.now()
    const res = await ackTwilioWebhook({
      request: post({ From: '+15035550123', To: '+15417033095', Body: 'STOP', MessageSid: 'SMthrow' }),
      kind: 'inbound-sms',
      process,
      respond: () => new Response(SMS_STOP_REPLY, { status: 200 }),
    })
    expect(res.status).toBe(200)
    expect(Date.now() - started).toBeLessThan(TWILIO_ACK_DEADLINE_MS)
    expect(await res.text()).toContain('unsubscribed')
  })

  it('acks under the deadline when the raw insert hangs', async () => {
    vi.useFakeTimers()
    insertTwilioRawEvent.mockImplementation(() => new Promise(() => {}))
    try {
      const started = Date.now()
      const pending = ackTwilioWebhook({
        request: post({ From: '+15035550123', To: '+15417033095', Body: 'hi', MessageSid: 'SMdbhang' }),
        kind: 'inbound-sms',
        process: vi.fn(async () => {}),
        respond: () => new Response('<Response></Response>', { status: 200, headers: { 'Content-Type': 'text/xml' } }),
      })
      await vi.advanceTimersByTimeAsync(TWILIO_RAW_PERSIST_MS + 400)
      const res = await pending
      expect(res.status).toBe(200)
      expect(Date.now() - started).toBeLessThan(TWILIO_ACK_DEADLINE_MS)
    } finally {
      vi.useRealTimers()
    }
  })

  it('persists the raw payload before the ack', async () => {
    const order: string[] = []
    insertTwilioRawEvent.mockImplementation(async (row) => {
      order.push(`persist:${row.providerSid}`)
      return { ok: true, id: 4, persisted: true }
    })
    const res = await ackTwilioWebhook({
      request: post({ From: '+15035550123', To: '+15419990002', Body: 'hi', MessageSid: 'SMpersist' }),
      kind: 'inbound-sms',
      process: async () => {
        order.push('process')
      },
      respond: () => {
        order.push('respond')
        return new Response('ok', { status: 200 })
      },
    })
    expect(res.status).toBe(200)
    expect(order[0]).toBe('persist:SMpersist')
    expect(order).toContain('respond')
    expect(order.indexOf('persist:SMpersist')).toBeLessThan(order.indexOf('respond'))
  })

  it('acks when the raw insert fails and still runs process from memory', async () => {
    insertTwilioRawEvent.mockResolvedValue({ ok: false, persisted: false, error: 'statement timeout' })
    const process = vi.fn(async () => {})
    const res = await ackTwilioWebhook({
      request: post({ From: '+15035550123', To: '+15417033095', Body: 'STOP', MessageSid: 'SMfallback' }),
      kind: 'inbound-sms',
      process,
      respond: () => new Response('ok', { status: 200 }),
    })
    expect(res.status).toBe(200)
    await flushScheduledAckWork()
    expect(process).toHaveBeenCalledTimes(1)
  })

  it('replay is idempotent on MessageSid — a second claim does not process again', async () => {
    const process = vi.fn(async () => {})
    claimTwilioRawEvent.mockResolvedValueOnce(true).mockResolvedValueOnce(false)
    const first = await replayTwilioRawEvent({
      kind: 'inbound-sms',
      providerSid: 'SMdup',
      params: { MessageSid: 'SMdup', Body: 'STOP', From: '+15035550123' },
      process,
      rawEventId: 9,
    })
    const second = await replayTwilioRawEvent({
      kind: 'inbound-sms',
      providerSid: 'SMdup',
      params: { MessageSid: 'SMdup', Body: 'STOP', From: '+15035550123' },
      process,
      rawEventId: 9,
    })
    expect(first).toEqual({ ran: true, reason: 'processed' })
    expect(second).toEqual({ ran: false, reason: 'already-claimed-or-processed' })
    expect(process).toHaveBeenCalledTimes(1)
    expect(markTwilioRawEventProcessed).toHaveBeenCalledTimes(1)
  })

  it('cron replay walks unprocessed rows once per sid', async () => {
    const process = vi.fn(async () => {})
    listUnprocessedTwilioRawEvents.mockResolvedValue([
      {
        id: 1,
        kind: 'inbound-sms',
        provider_sid: 'SMone',
        payload: { MessageSid: 'SMone', Body: 'hi' },
        received_at: new Date().toISOString(),
        processed_at: null,
        processing_started_at: null,
        process_attempts: 0,
        last_error: null,
      },
    ])
    const out = await replayUnprocessedTwilioRawEvents({ 'inbound-sms': process }, 10)
    expect(out).toEqual({ scanned: 1, ran: 1, skipped: 0 })
    expect(process).toHaveBeenCalledTimes(1)
  })

  it('STOP keyword still produces the opt-out reply on the hot path', () => {
    expect(smsKeywordReply('STOP')).toBe(SMS_STOP_REPLY)
    expect(smsKeywordReply('stop please')).toBe(SMS_STOP_REPLY)
    expect(smsKeywordReply('hello')).toBeUndefined()
  })

  it('persistTwilioRawEvent records the payload', async () => {
    const result = await persistTwilioRawEvent({
      kind: 'voice',
      providerSid: 'CAabc',
      payload: { CallSid: 'CAabc', From: '+15035550123' },
    })
    expect(result.persisted).toBe(true)
    expect(insertTwilioRawEvent).toHaveBeenCalledWith({
      kind: 'voice',
      providerSid: 'CAabc',
      payload: { CallSid: 'CAabc', From: '+15035550123' },
    })
  })
})
