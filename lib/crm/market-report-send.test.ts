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

  it('holds a due subscription nobody has approved: one held row, nothing sent, no attempt stamp', async () => {
    const deps = makeDeps({ fetchSubscribers: vi.fn(async () => [sub({ firstSendApprovedAt: null })]) })
    const s = await runMarketReportSend({ now: IN_WINDOW, deps })
    expect(s.skippedByReason['awaiting-approval']).toBe(1)
    expect(deps.recordHold).toHaveBeenCalledWith(expect.objectContaining({ subscriptionId: 1 }), 'awaiting-approval', IN_WINDOW)
    expect(deps.deliver).not.toHaveBeenCalled()
    expect(deps.stampAttempt).not.toHaveBeenCalled()
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
    expect(deps.stampAttempt).not.toHaveBeenCalled()
    expect(deps.recordHold).not.toHaveBeenCalled()
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

describe('sendOneSubscriber: the one send call', () => {
  const MANAGE = 'https://ryan-realty.com/email-preferences?t=m.tok'
  const UNSUB = `${MANAGE}&stop=1`
  const ONE_CLICK = 'https://ryan-realty.com/api/email/report-unsubscribe?t=s.tok'
  const ADDRESS = 'Ryan Realty, 115 NW Oregon Ave #2, Bend, OR 97703'
  const baseArgs: SendOneInput = {
    kind: 'scheduled',
    personId: 100,
    brokerSlug: 'matt',
    to: 'jane@example.com',
    subject: 'Bend home prices are down 1.2% from a year ago',
    html: `<p>Hello</p><p><a href="https://ryan-realty.com/housing-market/bend?utm_source=crm#market">See it</a></p><p>${ADDRESS} &middot; <a href="${MANAGE}">Manage your report</a> &middot; <a href="${UNSUB}">Unsubscribe</a>.</p>`,
    text: `Hello\n\n--\n${ADDRESS}\nManage your report: ${MANAGE}\nUnsubscribe: ${UNSUB}`,
    unsubscribeUrl: UNSUB,
    oneClickUrl: ONE_CLICK,
    emailKey: 'market-report:run:100',
    contactEmail: 'jane@example.com',
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

  it('a preview checks the CONTACT\'s address, never the broker mailbox it goes to', async () => {
    isSuppressed.mockResolvedValue({ suppressed: false, reasons: [] })
    isSuppressedByEmail.mockResolvedValue({ suppressed: true, reasons: ['email:email:unsubscribe'] })
    const out = await sendOneSubscriber({ ...baseArgs, kind: 'preview', to: 'matt@ryan-realty.com', subject: '[Preview] Bend' })
    expect(out.status).toBe('suppressed')
    expect(isSuppressedByEmail).toHaveBeenCalledWith('jane@example.com', 'email')
    expect(sendEmail).not.toHaveBeenCalled()
  })

  it('passes the send key to the provider as its idempotency key', async () => {
    isSuppressed.mockResolvedValue({ suppressed: false, reasons: [] })
    sendEmail.mockResolvedValue({ id: 'msg-3' })
    recordEmailEvent.mockResolvedValue({ ok: true })
    await sendOneSubscriber({ ...baseArgs, emailKey: 'market-report:scheduled:9016:first' })
    expect(sendEmail.mock.calls[0][0].idempotencyKey).toBe('market-report:scheduled:9016:first')
  })

  it('checks suppression BEFORE sending, sends once with the broker identity and records the event', async () => {
    const order: string[] = []
    isSuppressed.mockImplementation(async () => {
      order.push('isSuppressed')
      return { suppressed: false, reasons: [] }
    })
    sendEmail.mockImplementation(async () => {
      order.push('sendEmail')
      return { id: 'msg-1' }
    })
    recordEmailEvent.mockResolvedValue({ ok: true })

    isSuppressedByEmail.mockImplementation(async () => {
      order.push('isSuppressedByEmail')
      return { suppressed: false, reasons: [] }
    })
    const out = await sendOneSubscriber(baseArgs)
    expect(out).toMatchObject({ status: 'sent', messageId: 'msg-1' })
    expect(order).toEqual(['isSuppressed', 'isSuppressedByEmail', 'sendEmail'])
    const sent = sendEmail.mock.calls[0][0]
    expect(sent.to).toBe('jane@example.com')
    expect(sent.from).toContain('Matt Ryan')
    expect(sent.replyTo).toBeTruthy()
    // RFC 8058 at the report-scoped one-click endpoint.
    expect(sent.headers['List-Unsubscribe']).toBe(`<${ONE_CLICK}>`)
    expect(sent.headers['List-Unsubscribe-Post']).toBe('List-Unsubscribe=One-Click')
    // One footer: the body already carries it, so prepare adds none.
    expect(sent.html.split(ADDRESS).length - 1).toBe(1)
    expect(sent.text.split(ADDRESS).length - 1).toBe(1)
    // Open and click tracking on a real send, with the broker on the event.
    expect(sent.html).toContain('/api/track/e/open')
    expect(recordEmailEvent).toHaveBeenCalledTimes(1)
    expect(recordEmailEvent.mock.calls[0][0]).toMatchObject({
      sendType: 'market-report',
      event: 'sent',
      broker: 'matt',
      emailKey: 'market-report:run:100',
      messageId: 'msg-1',
    })
    // The stored copy is the prepared html, still free of tracking.
    if (out.status === 'sent') expect(out.preparedHtml).not.toContain('/api/track/e/')
  })

  it('never wraps or decorates the preferences links (a private address)', async () => {
    isSuppressed.mockResolvedValue({ suppressed: false, reasons: [] })
    sendEmail.mockResolvedValue({ id: 'msg-2' })
    recordEmailEvent.mockResolvedValue({ ok: true })
    await sendOneSubscriber(baseArgs)
    const html: string = sendEmail.mock.calls[0][0].html
    expect(html).toContain(`href="${MANAGE}"`)
    expect(html).toContain(`href="${UNSUB}"`)
  })

  it('a PREVIEW carries no person token, no pixel, no click wraps and records no event', async () => {
    isSuppressed.mockResolvedValue({ suppressed: false, reasons: [] })
    sendEmail.mockResolvedValue({ id: 'msg-p' })
    const out = await sendOneSubscriber({ ...baseArgs, kind: 'preview', to: 'matt@ryan-realty.com', subject: '[Preview] Bend' })
    expect(out.status).toBe('sent')
    const html: string = sendEmail.mock.calls[0][0].html
    expect(html).not.toContain('/api/track/e/')
    expect(recordEmailEvent).not.toHaveBeenCalled()
    // The preview is still gated on the contact: no report she cannot receive is previewed.
    expect(isSuppressed).toHaveBeenCalledWith(100, 'email')
  })

  it('reports a provider failure without throwing and records no sent event', async () => {
    isSuppressed.mockResolvedValue({ suppressed: false, reasons: [] })
    sendEmail.mockResolvedValue({ error: 'Resend 500' })
    const out = await sendOneSubscriber(baseArgs)
    expect(out).toMatchObject({ status: 'failed', detail: 'Resend 500' })
    expect(recordEmailEvent).not.toHaveBeenCalled()
  })
})
