import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { MarketReportSubscriber } from '@/lib/data/crm/getMarketReportSubscribers'

// The send leaf's collaborators. The suppression chokepoint must run BEFORE
// sendEmail, and a preview must never record an event against the contact.
const isSuppressed = vi.fn()
const isSuppressedByEmail = vi.fn()
const sendEmail = vi.fn()
const recordEmailEvent = vi.fn()
vi.mock('@/lib/crm/suppressions', () => ({
  isSuppressed: (...a: unknown[]) => isSuppressed(...a),
  isSuppressedByEmail: (...a: unknown[]) => isSuppressedByEmail(...a),
}))
vi.mock('@/lib/resend', () => ({ sendEmail: (...a: unknown[]) => sendEmail(...a) }))
vi.mock('@/lib/crm/email-events', () => ({ recordEmailEvent: (...a: unknown[]) => recordEmailEvent(...a) }))
// Alerts page Matt on the ops channel; never let a unit run write one for real.
const queueBrokerHealthAlert = vi.fn<(...a: unknown[]) => Promise<boolean>>(async () => true)
vi.mock('@/lib/crm/broker-alerts', () => ({ queueBrokerHealthAlert: (...a: unknown[]) => queueBrokerHealthAlert(...a) }))
// prepare and attribution stay real: they are pure string transforms.

import {
  prepareReportEmail,
  reportIdempotencyKey,
  runMarketReportSend,
  sendOneSubscriber,
  type ScheduledDeliverOutcome,
  type SendDeps,
  type SendOneInput,
} from './market-report-send'

/** 3pm Pacific (22:00 UTC): inside the 8am to 8pm window. */
const IN_WINDOW = new Date('2026-06-25T22:00:00.000Z')
/** 5am Pacific (12:00 UTC): outside it. */
const OUT_OF_WINDOW = new Date('2026-06-25T12:00:00.000Z')
const DAY = 24 * 60 * 60 * 1000

function sub(over: Partial<MarketReportSubscriber> = {}): MarketReportSubscriber {
  return {
    subscriptionId: over.subscriptionId ?? 1,
    personId: over.personId ?? 100,
    personName: over.personName ?? 'Test Contact',
    assignedBroker: 'assignedBroker' in over ? (over.assignedBroker as string | null) : 'matt',
    fubPersonId: over.fubPersonId ?? null,
    areas: over.areas ?? ['bend'],
    frequency: over.frequency ?? 'weekly',
    isActive: over.isActive ?? true,
    lastSentAt: 'lastSentAt' in over ? (over.lastSentAt as string | null) : null,
    lastAttemptAt: over.lastAttemptAt ?? null,
    firstSendApprovedAt: 'firstSendApprovedAt' in over ? (over.firstSendApprovedAt as string | null) : '2026-06-01T17:00:00.000Z',
    personDeleted: over.personDeleted ?? false,
  }
}

function makeDeps(over: Partial<SendDeps> = {}): SendDeps & {
  deliver: ReturnType<typeof vi.fn>
  recordHold: ReturnType<typeof vi.fn>
  stampAttempt: ReturnType<typeof vi.fn>
  resolveEmail: ReturnType<typeof vi.fn>
} {
  return {
    fetchSubscribers: vi.fn(async () => [sub()]),
    resolveEmail: vi.fn(async () => 'jane@example.com'),
    deliver: vi.fn(async (): Promise<ScheduledDeliverOutcome> => ({ status: 'sent', messageId: 'msg-1' })),
    recordHold: vi.fn(async () => undefined),
    stampAttempt: vi.fn(async () => ({ ok: true as const })),
    ...over,
  } as never
}

beforeEach(() => {
  isSuppressed.mockReset()
  isSuppressedByEmail.mockReset()
  isSuppressedByEmail.mockResolvedValue({ suppressed: false, reasons: [] })
  sendEmail.mockReset()
  recordEmailEvent.mockReset()
  queueBrokerHealthAlert.mockClear()
})

describe('runMarketReportSend: the window', () => {
  it('does nothing outside 8am to 8pm Pacific (no reads, no writes)', async () => {
    const deps = makeDeps()
    const s = await runMarketReportSend({ now: OUT_OF_WINDOW, deps })
    expect(s.outsideWindow).toBe(true)
    expect(deps.fetchSubscribers).not.toHaveBeenCalled()
    expect(deps.deliver).not.toHaveBeenCalled()
    expect(s.sent).toBe(0)
  })

  it('runs inside the window', async () => {
    const deps = makeDeps()
    const s = await runMarketReportSend({ now: IN_WINDOW, deps })
    expect(s.outsideWindow).toBe(false)
    expect(s.sent).toBe(1)
  })
})

describe('runMarketReportSend: cadence and approval', () => {
  it('skips a contact that is not due, without stamping an attempt', async () => {
    const deps = makeDeps({
      fetchSubscribers: vi.fn(async () => [sub({ lastSentAt: new Date(IN_WINDOW.getTime() - DAY).toISOString() })]),
    })
    const s = await runMarketReportSend({ now: IN_WINDOW, deps })
    expect(s.skippedByReason['not-due']).toBe(1)
    expect(deps.stampAttempt).not.toHaveBeenCalled()
    expect(deps.deliver).not.toHaveBeenCalled()
  })

  it('holds a due subscription nobody has approved: one held row, nothing sent, and the attempt is stamped so it rotates to the back of the scan', async () => {
    const deps = makeDeps({ fetchSubscribers: vi.fn(async () => [sub({ firstSendApprovedAt: null })]) })
    const s = await runMarketReportSend({ now: IN_WINDOW, deps })
    expect(s.skippedByReason['awaiting-approval']).toBe(1)
    expect(deps.recordHold).toHaveBeenCalledWith(expect.objectContaining({ subscriptionId: 1 }), 'awaiting-approval', IN_WINDOW)
    expect(deps.deliver).not.toHaveBeenCalled()
    // The scan reads never-attempted rows first (nulls first, oldest attempt
    // next, limit 1000): an unstamped row that can never send would sit at the
    // front of every run and starve the rows behind it (review 2026-09-30).
    expect(deps.stampAttempt).toHaveBeenCalledWith(1, IN_WINDOW)
  })

  it('delivers an approved, due contact from the assigned broker with the cycle\'s send key', async () => {
    const deps = makeDeps({ fetchSubscribers: vi.fn(async () => [sub({ assignedBroker: 'rebecca', personId: 42 })]) })
    const s = await runMarketReportSend({ now: IN_WINDOW, deps, runId: 'run1' })
    expect(s.sent).toBe(1)
    expect(deps.stampAttempt).toHaveBeenCalledWith(1, IN_WINDOW)
    expect(deps.deliver).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'jane@example.com', brokerSlug: 'rebecca', emailKey: 'market-report:scheduled:1:first', now: IN_WINDOW }),
    )
  })

  it('two overlapping runs claim the SAME send key for a subscription and cycle (never one per run)', async () => {
    const lastSentAt = new Date(IN_WINDOW.getTime() - 8 * DAY).toISOString()
    const a = makeDeps({ fetchSubscribers: vi.fn(async () => [sub({ subscriptionId: 9016, lastSentAt })]) })
    const b = makeDeps({ fetchSubscribers: vi.fn(async () => [sub({ subscriptionId: 9016, lastSentAt })]) })
    await Promise.all([
      runMarketReportSend({ now: IN_WINDOW, deps: a, runId: 'run-a' }),
      runMarketReportSend({ now: new Date(IN_WINDOW.getTime() + 60_000), deps: b, runId: 'run-b' }),
    ])
    const keyA = a.deliver.mock.calls[0][0].emailKey
    const keyB = b.deliver.mock.calls[0][0].emailKey
    expect(keyA).toBe(keyB)
    expect(keyA).toBe(`market-report:scheduled:9016:${lastSentAt.replace(/[^0-9]/g, '').slice(0, 14)}`)
  })

  it('never mails a deleted contact, and does not count her as due', async () => {
    const deps = makeDeps({ fetchSubscribers: vi.fn(async () => [sub({ personDeleted: true })]) })
    const s = await runMarketReportSend({ now: IN_WINDOW, deps })
    expect(s.skippedByReason['contact-deleted']).toBe(1)
    expect(s.due).toBe(0)
    expect(deps.deliver).not.toHaveBeenCalled()
    expect(deps.recordHold).not.toHaveBeenCalled()
    // Stamped all the same, so a row that can never send does not hold the
    // front of the scan (review 2026-09-30).
    expect(deps.stampAttempt).toHaveBeenCalledWith(1, IN_WINDOW)
  })

  it('stops starting deliveries past the time budget; the rest wait for the next run', async () => {
    const many = Array.from({ length: 3 }, (_, i) => sub({ personId: i + 1, subscriptionId: i + 1 }))
    const deps = makeDeps({ fetchSubscribers: vi.fn(async () => many) })
    const s = await runMarketReportSend({ now: IN_WINDOW, deps, timeBudgetMs: 0 })
    expect(deps.deliver).not.toHaveBeenCalled()
    expect(s.deferred).toBe(3)
  })

  it("falls back to Matt's identity when no broker is assigned", async () => {
    const deps = makeDeps({ fetchSubscribers: vi.fn(async () => [sub({ assignedBroker: null })]) })
    await runMarketReportSend({ now: IN_WINDOW, deps })
    expect(deps.deliver).toHaveBeenCalledWith(expect.objectContaining({ brokerSlug: 'matt' }))
  })

  it('holds a contact with no email on file', async () => {
    const deps = makeDeps({ resolveEmail: vi.fn(async () => null) })
    const s = await runMarketReportSend({ now: IN_WINDOW, deps })
    expect(s.skippedByReason['no-email']).toBe(1)
    expect(deps.recordHold).toHaveBeenCalledWith(expect.anything(), 'no-email', IN_WINDOW)
    expect(deps.deliver).not.toHaveBeenCalled()
  })
})

describe('runMarketReportSend: delivery outcomes', () => {
  it('counts a stale-data hold and pages the ops channel once per run', async () => {
    const deps = makeDeps({
      fetchSubscribers: vi.fn(async () => [sub({ personId: 1 }), sub({ personId: 2, subscriptionId: 2 })]),
      deliver: vi.fn(async (): Promise<ScheduledDeliverOutcome> => ({ status: 'held', reason: 'stale-data', detail: 'market_stats_cache 41h old' })),
    })
    const s = await runMarketReportSend({ now: IN_WINDOW, deps })
    expect(s.skippedByReason['stale-data']).toBe(2)
    expect(queueBrokerHealthAlert).toHaveBeenCalledTimes(1)
    expect(queueBrokerHealthAlert).toHaveBeenCalledWith(expect.objectContaining({ key: 'market-report-send:stale-data' }))
  })

  it('an unknown provider outcome is a send error, never counted as sent (review 2026-09-30)', async () => {
    const deps = makeDeps({
      deliver: vi.fn(async (): Promise<ScheduledDeliverOutcome> => ({ status: 'unknown', detail: 'Resend did not answer; held in flight' })),
    })
    const s = await runMarketReportSend({ now: IN_WINDOW, deps })
    expect(s.sent).toBe(0)
    expect(s.skippedByReason['send-error']).toBe(1)
    expect(s.outcomes[0]).toMatchObject({ status: 'skipped', reason: 'send-error', detail: expect.stringContaining('did not answer') })
  })

  it('treats "already sent inside the window" as not due', async () => {
    const deps = makeDeps({
      deliver: vi.fn(async (): Promise<ScheduledDeliverOutcome> => ({ status: 'already-sent', sentAt: '2026-06-24T22:00:00.000Z' })),
    })
    const s = await runMarketReportSend({ now: IN_WINDOW, deps })
    expect(s.skippedByReason['not-due']).toBe(1)
    expect(s.sent).toBe(0)
  })

  it('counts a Spark hold and a cancelled delivery under their own reasons', async () => {
    const deps = makeDeps({
      fetchSubscribers: vi.fn(async () => [sub({ personId: 1 }), sub({ personId: 2, subscriptionId: 2 }), sub({ personId: 3, subscriptionId: 3 })]),
      deliver: vi
        .fn()
        .mockResolvedValueOnce({ status: 'held', reason: 'spark-stop', detail: 'bend homes for sale 729 vs 741' })
        .mockResolvedValueOnce({ status: 'held', reason: 'spark-unreconciled', detail: 'Spark down' })
        .mockResolvedValueOnce({ status: 'cancelled', reason: 'stopped', detail: 'stopped during the run' }),
    })
    const s = await runMarketReportSend({ now: IN_WINDOW, deps })
    expect(s.skippedByReason['spark-stop']).toBe(1)
    expect(s.skippedByReason['spark-unreconciled']).toBe(1)
    expect(s.skippedByReason.cancelled).toBe(1)
    expect(s.sent).toBe(0)
  })

  it('maps a suppressed hold and a failure to their reasons', async () => {
    const deps = makeDeps({
      fetchSubscribers: vi.fn(async () => [sub({ personId: 1 }), sub({ personId: 2, subscriptionId: 2 })]),
      deliver: vi
        .fn()
        .mockResolvedValueOnce({ status: 'held', reason: 'suppressed', detail: 'email:unsubscribe' })
        .mockResolvedValueOnce({ status: 'failed', detail: 'Resend 500' }),
    })
    const s = await runMarketReportSend({ now: IN_WINDOW, deps })
    expect(s.skippedByReason.suppressed).toBe(1)
    expect(s.skippedByReason['send-error']).toBe(1)
  })

  it('never throws when a delivery throws', async () => {
    const deps = makeDeps({ deliver: vi.fn(async () => { throw new Error('boom') }) })
    const s = await runMarketReportSend({ now: IN_WINDOW, deps })
    expect(s.skippedByReason['send-error']).toBe(1)
  })

  it('caps sends per run', async () => {
    const many = Array.from({ length: 5 }, (_, i) => sub({ personId: i + 1, subscriptionId: i + 1 }))
    const deps = makeDeps({ fetchSubscribers: vi.fn(async () => many) })
    const s = await runMarketReportSend({ now: IN_WINDOW, deps, maxSends: 2 })
    expect(s.sent).toBe(2)
    expect(deps.deliver).toHaveBeenCalledTimes(2)
  })

  it('pages Matt when the subscriber list cannot be read', async () => {
    const deps = makeDeps({ fetchSubscribers: vi.fn(async () => { throw new Error('db down') }) })
    const s = await runMarketReportSend({ now: IN_WINDOW, deps })
    expect(s.skippedByReason['send-error']).toBe(1)
    expect(queueBrokerHealthAlert).toHaveBeenCalledWith(
      expect.objectContaining({ key: 'market-report-send:fetch-subscribers-failed' }),
    )
  })
})

describe('prepareReportEmail: the exact request, built once (review 2026-09-30)', () => {
  const MANAGE = 'https://ryan-realty.com/email-preferences?t=m.tok'
  const UNSUB = `${MANAGE}&stop=1`
  const ONE_CLICK = 'https://ryan-realty.com/api/email/report-unsubscribe?t=s.tok'
  const ADDRESS = 'Ryan Realty, 115 NW Oregon Ave #2, Bend, OR 97703'
  const args = {
    kind: 'scheduled' as const,
    personId: 100,
    brokerSlug: 'matt',
    to: 'jane@example.com',
    subject: 'Bend home prices are down 1.2% from a year ago',
    html: `<p>Hello</p><p><a href="https://ryan-realty.com/housing-market/bend?utm_source=crm#market">See it</a></p><p>${ADDRESS} &middot; <a href="${MANAGE}">Manage your report</a> &middot; <a href="${UNSUB}">Unsubscribe</a>.</p>`,
    text: `Hello\n\n--\n${ADDRESS}\nManage your report: ${MANAGE}\nUnsubscribe: ${UNSUB}`,
    unsubscribeUrl: UNSUB,
    oneClickUrl: ONE_CLICK,
    emailKey: 'market-report:scheduled:9016:first',
  }

  it('builds the provider request: broker identity, RFC 8058 headers, one footer, tracking on a real send', () => {
    const p = prepareReportEmail(args)
    expect(p.request.to).toBe('jane@example.com')
    expect(p.request.from).toContain('Matt Ryan')
    expect(p.request.replyTo).toBeTruthy()
    expect(p.request.headers['List-Unsubscribe']).toBe(`<${ONE_CLICK}>`)
    expect(p.request.headers['List-Unsubscribe-Post']).toBe('List-Unsubscribe=One-Click')
    expect(p.request.html.split(ADDRESS).length - 1).toBe(1)
    expect(p.request.text.split(ADDRESS).length - 1).toBe(1)
    expect(p.request.html).toContain('/api/track/e/open')
    // The stored copy is the prepared html, still free of tracking.
    expect(p.cleanHtml).not.toContain('/api/track/e/')
    expect(p.cleanText.split(ADDRESS).length - 1).toBe(1)
  })

  it('never wraps or decorates the preferences links (a private address)', () => {
    const { request } = prepareReportEmail(args)
    expect(request.html).toContain(`href="${MANAGE}"`)
    expect(request.html).toContain(`href="${UNSUB}"`)
  })

  it('a PREVIEW carries no person token, no pixel and no click wraps', () => {
    const { request } = prepareReportEmail({ ...args, kind: 'preview', to: 'matt@ryan-realty.com', subject: '[Preview] Bend' })
    expect(request.html).not.toContain('/api/track/e/')
    expect(request.to).toBe('matt@ryan-realty.com')
  })

  it('the idempotency key follows the payload: the same bytes keep it, a new render gets a new one', () => {
    const a = prepareReportEmail(args).request
    const b = prepareReportEmail(args).request
    expect(reportIdempotencyKey(args.emailKey, a)).toBe(reportIdempotencyKey(args.emailKey, b))
    expect(reportIdempotencyKey(args.emailKey, a).startsWith(`${args.emailKey}:`)).toBe(true)
    const changed = prepareReportEmail({ ...args, html: args.html.replace('Hello', 'Hello again') }).request
    expect(reportIdempotencyKey(args.emailKey, changed)).not.toBe(reportIdempotencyKey(args.emailKey, a))
  })
})

describe('sendOneSubscriber: the one send call, replaying a stored request', () => {
  const REQUEST = {
    from: '"Matt Ryan · Ryan Realty" <matt@mail.ryan-realty.com>',
    to: 'jane@example.com',
    replyTo: 'matt@ryan-realty.com',
    subject: 'Bend home prices are down 1.2% from a year ago',
    html: '<p>Hello</p><img src="https://ryan-realty.com/api/track/e/open?x=1">',
    text: 'Hello',
    headers: { 'List-Unsubscribe': '<https://ryan-realty.com/api/email/report-unsubscribe?t=s.tok>' },
  }
  const PAYLOAD = { v: 1 as const, idempotencyKey: 'market-report:scheduled:9016:first:abc123', builtAt: '2026-09-30T16:00:00.000Z', request: REQUEST }
  const baseArgs: SendOneInput = {
    kind: 'scheduled',
    personId: 100,
    brokerSlug: 'matt',
    contactEmail: 'jane@example.com',
    emailKey: 'market-report:scheduled:9016:first',
    payload: PAYLOAD,
  }

  it('does NOT send when the contact is suppressed (fail-closed)', async () => {
    isSuppressed.mockResolvedValue({ suppressed: true, reasons: ['email:unsubscribe'] })
    const out = await sendOneSubscriber(baseArgs)
    expect(out).toMatchObject({ status: 'suppressed', detail: 'email:unsubscribe' })
    expect(sendEmail).not.toHaveBeenCalled()
    expect(recordEmailEvent).not.toHaveBeenCalled()
  })

  it('does NOT send when only her ADDRESS is suppressed (an address-only row the newsletter wrote)', async () => {
    isSuppressed.mockResolvedValue({ suppressed: false, reasons: [] })
    isSuppressedByEmail.mockResolvedValue({ suppressed: true, reasons: ['email:email:unsubscribe'] })
    const out = await sendOneSubscriber(baseArgs)
    expect(out).toMatchObject({ status: 'suppressed', detail: 'email:email:unsubscribe' })
    expect(isSuppressedByEmail).toHaveBeenCalledWith('jane@example.com', 'email')
    expect(sendEmail).not.toHaveBeenCalled()
  })

  it("a preview checks the CONTACT's address, never the broker mailbox it goes to", async () => {
    isSuppressed.mockResolvedValue({ suppressed: false, reasons: [] })
    isSuppressedByEmail.mockResolvedValue({ suppressed: true, reasons: ['email:email:unsubscribe'] })
    const out = await sendOneSubscriber({ ...baseArgs, kind: 'preview', payload: { ...PAYLOAD, request: { ...REQUEST, to: 'matt@ryan-realty.com' } } })
    expect(out.status).toBe('suppressed')
    expect(isSuppressedByEmail).toHaveBeenCalledWith('jane@example.com', 'email')
    expect(sendEmail).not.toHaveBeenCalled()
  })

  it('checks suppression BEFORE sending, then sends the stored request byte for byte under its own idempotency key', async () => {
    const order: string[] = []
    isSuppressed.mockImplementation(async () => {
      order.push('isSuppressed')
      return { suppressed: false, reasons: [] }
    })
    isSuppressedByEmail.mockImplementation(async () => {
      order.push('isSuppressedByEmail')
      return { suppressed: false, reasons: [] }
    })
    sendEmail.mockImplementation(async () => {
      order.push('sendEmail')
      return { id: 'msg-1' }
    })
    recordEmailEvent.mockResolvedValue({ ok: true })
    const out = await sendOneSubscriber(baseArgs)
    expect(out).toEqual({ status: 'sent', messageId: 'msg-1' })
    expect(order).toEqual(['isSuppressed', 'isSuppressedByEmail', 'sendEmail'])
    // Exactly the stored request: nothing re-rendered, nothing re-instrumented.
    expect(sendEmail).toHaveBeenCalledWith({ ...REQUEST, idempotencyKey: PAYLOAD.idempotencyKey, exact: true })
    expect(recordEmailEvent.mock.calls[0][0]).toMatchObject({
      sendType: 'market-report',
      event: 'sent',
      broker: 'matt',
      emailKey: 'market-report:scheduled:9016:first',
      messageId: 'msg-1',
      recipientEmail: 'jane@example.com',
    })
  })

  it('a request read back from its jsonb row (keys in another order) posts the same bytes as the first send', async () => {
    // jsonb keeps object keys in its own order, not the order they were built
    // in; a replay must still post what the first send posted, or Resend
    // refuses the key (409).
    isSuppressed.mockResolvedValue({ suppressed: false, reasons: [] })
    isSuppressedByEmail.mockResolvedValue({ suppressed: false, reasons: [] })
    sendEmail.mockResolvedValue({ id: 'msg-1' })
    recordEmailEvent.mockResolvedValue({ ok: true })
    const built = {
      ...REQUEST,
      headers: { 'List-Unsubscribe': '<https://ryan-realty.com/u>', 'X-Entity-Ref-ID': 'k', 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' },
    }
    const readBack = {
      text: built.text,
      headers: { 'X-Entity-Ref-ID': 'k', 'List-Unsubscribe': '<https://ryan-realty.com/u>', 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' },
      subject: built.subject,
      html: built.html,
      to: built.to,
      replyTo: built.replyTo,
      from: built.from,
    }
    await sendOneSubscriber({ ...baseArgs, payload: { ...PAYLOAD, request: built } })
    await sendOneSubscriber({ ...baseArgs, payload: { ...PAYLOAD, request: readBack } })
    const [first, replay] = sendEmail.mock.calls.map((c) => JSON.stringify(c[0]))
    expect(replay).toBe(first)
  })

  it('a PREVIEW records no event against the contact', async () => {
    isSuppressed.mockResolvedValue({ suppressed: false, reasons: [] })
    sendEmail.mockResolvedValue({ id: 'msg-p' })
    const out = await sendOneSubscriber({ ...baseArgs, kind: 'preview', payload: { ...PAYLOAD, request: { ...REQUEST, to: 'matt@ryan-realty.com' } } })
    expect(out.status).toBe('sent')
    expect(recordEmailEvent).not.toHaveBeenCalled()
    expect(isSuppressed).toHaveBeenCalledWith(100, 'email')
  })

  it('a refusal the provider answered is a failure; an answer that never came is UNKNOWN, never a failure', async () => {
    isSuppressed.mockResolvedValue({ suppressed: false, reasons: [] })
    sendEmail.mockResolvedValue({ error: 'Invalid `to` field', statusCode: 422 })
    expect(await sendOneSubscriber(baseArgs)).toEqual({ status: 'failed', detail: 'Invalid `to` field' })
    sendEmail.mockResolvedValue({ error: 'Unable to fetch data. The request could not be resolved.', statusCode: null, unknown: true })
    expect(await sendOneSubscriber(baseArgs)).toEqual({ status: 'unknown', detail: 'Unable to fetch data. The request could not be resolved.' })
    expect(recordEmailEvent).not.toHaveBeenCalled()
  })
})
