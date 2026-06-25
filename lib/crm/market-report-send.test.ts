import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { MarketReportSubscriber } from '@/lib/data/crm/getMarketReportSubscribers'
import type { MarketReportAreaBlock } from '@/lib/data/crm/getMarketReportData'

// Mock the send-leaf collaborators so sendOneSubscriber can be tested in
// isolation: the suppression chokepoint must run BEFORE sendEmail.
const isSuppressed = vi.fn()
const sendEmail = vi.fn()
const recordEmailEvent = vi.fn()
vi.mock('@/lib/crm/suppressions', () => ({ isSuppressed: (...a: unknown[]) => isSuppressed(...a) }))
vi.mock('@/lib/resend', () => ({ sendEmail: (...a: unknown[]) => sendEmail(...a) }))
vi.mock('@/lib/crm/email-events', () => ({ recordEmailEvent: (...a: unknown[]) => recordEmailEvent(...a) }))
// Keep prepare / attribution real but cheap — they are pure string transforms.

import { runMarketReportSend, sendOneSubscriber, type SendDeps } from './market-report-send'

const NOW = new Date('2026-06-25T12:00:00.000Z')
const DAY = 24 * 60 * 60 * 1000

function sub(over: Partial<MarketReportSubscriber> = {}): MarketReportSubscriber {
  return {
    subscriptionId: over.subscriptionId ?? 1,
    personId: over.personId ?? 100,
    personName: over.personName ?? 'Test Contact',
    assignedBroker: over.assignedBroker ?? 'matt',
    fubPersonId: over.fubPersonId ?? null,
    areas: over.areas ?? ['bend'],
    frequency: over.frequency ?? 'weekly',
    isActive: over.isActive ?? true,
    lastSentAt: 'lastSentAt' in over ? (over.lastSentAt as string | null) : null,
    lastAttemptAt: over.lastAttemptAt ?? null,
  }
}

const BLOCK: MarketReportAreaBlock = {
  slug: 'bend',
  areaLabel: 'Bend',
  geoType: 'city',
  medianPrice: 750000,
  activeListings: 420,
  soldLast12mo: 1200,
  monthsOfSupply: 4.2,
  marketVerdict: 'balanced',
  domMedian: 38,
  yoyPct: 2.1,
  marketHealthLabel: 'Warm',
  refreshedAt: '2026-06-24T00:00:00.000Z',
  source: 'market_pulse_live',
  href: '/cities/bend',
}

function makeDeps(over: Partial<SendDeps> = {}): SendDeps {
  return {
    fetchSubscribers: vi.fn(async () => [sub()]),
    resolveEmail: vi.fn(async () => 'jane@example.com'),
    fetchAreas: vi.fn(async () => [BLOCK]),
    sendOne: vi.fn(async ({ personId }) => ({ personId, status: 'sent' as const, messageId: 'm1' })),
    stampAttempt: vi.fn(async () => ({ ok: true as const })),
    stampSent: vi.fn(async () => ({ ok: true as const })),
    ...over,
  }
}

beforeEach(() => {
  isSuppressed.mockReset()
  sendEmail.mockReset()
  recordEmailEvent.mockReset()
})

describe('runMarketReportSend — cadence + skip taxonomy', () => {
  it('sends a due, never-sent subscriber and stamps last_sent_at', async () => {
    const deps = makeDeps()
    const s = await runMarketReportSend({ now: NOW, deps })
    expect(s.scanned).toBe(1)
    expect(s.due).toBe(1)
    expect(s.sent).toBe(1)
    expect(s.skipped).toBe(0)
    expect(deps.stampAttempt).toHaveBeenCalledTimes(1)
    expect(deps.stampSent).toHaveBeenCalledTimes(1)
    expect(deps.sendOne).toHaveBeenCalledTimes(1)
  })

  it('skips a not-due subscriber without stamping or sending', async () => {
    // weekly cadence, sent 2 days ago → not due.
    const recent = new Date(NOW.getTime() - 2 * DAY).toISOString()
    const deps = makeDeps({ fetchSubscribers: vi.fn(async () => [sub({ lastSentAt: recent })]) })
    const s = await runMarketReportSend({ now: NOW, deps })
    expect(s.due).toBe(0)
    expect(s.sent).toBe(0)
    expect(s.skippedByReason['not-due']).toBe(1)
    expect(deps.stampAttempt).not.toHaveBeenCalled()
    expect(deps.sendOne).not.toHaveBeenCalled()
  })

  it('skips a due subscriber with no email on file (stamps attempt, not sent)', async () => {
    const deps = makeDeps({ resolveEmail: vi.fn(async () => null) })
    const s = await runMarketReportSend({ now: NOW, deps })
    expect(s.due).toBe(1)
    expect(s.sent).toBe(0)
    expect(s.skippedByReason['no-email']).toBe(1)
    expect(deps.stampAttempt).toHaveBeenCalledTimes(1)
    expect(deps.stampSent).not.toHaveBeenCalled()
    expect(deps.sendOne).not.toHaveBeenCalled()
  })

  it('skips a due subscriber whose areas all resolve unavailable (no fabricated email)', async () => {
    const deps = makeDeps({ fetchAreas: vi.fn(async () => []) })
    const s = await runMarketReportSend({ now: NOW, deps })
    expect(s.due).toBe(1)
    expect(s.sent).toBe(0)
    expect(s.skippedByReason['no-areas']).toBe(1)
    expect(deps.sendOne).not.toHaveBeenCalled()
    expect(deps.stampSent).not.toHaveBeenCalled()
  })

  it('honors the maxSends chunk cap', async () => {
    const many = Array.from({ length: 5 }, (_, i) => sub({ subscriptionId: i + 1, personId: 200 + i }))
    const deps = makeDeps({ fetchSubscribers: vi.fn(async () => many) })
    const s = await runMarketReportSend({ now: NOW, maxSends: 2, deps })
    expect(s.sent).toBe(2)
    expect(deps.sendOne).toHaveBeenCalledTimes(2)
  })

  it('never throws when the subscriber fetch fails', async () => {
    const deps = makeDeps({
      fetchSubscribers: vi.fn(async () => {
        throw new Error('db down')
      }),
    })
    const s = await runMarketReportSend({ now: NOW, deps })
    expect(s.sent).toBe(0)
    expect(s.skippedByReason['send-error']).toBe(1)
    expect(s.outcomes[0]).toMatchObject({ reason: 'send-error' })
  })
})

describe('sendOneSubscriber — suppression chokepoint', () => {
  const baseArgs = {
    personId: 100,
    fubPersonId: null,
    brokerSlug: 'matt',
    email: 'jane@example.com',
    subject: 'Bend market update',
    html: '<p>Hello</p>',
    text: 'Hello',
    unsubscribeUrl: 'https://ryan-realty.com/api/email/unsubscribe?t=tok',
    emailKey: 'market-report:run:100',
  }

  it('does NOT send when the contact is suppressed (fail-closed)', async () => {
    isSuppressed.mockResolvedValue({ suppressed: true, reasons: ['tag:unsubscribed'] })
    const out = await sendOneSubscriber(baseArgs)
    expect(out).toMatchObject({ status: 'skipped', reason: 'suppressed' })
    expect(sendEmail).not.toHaveBeenCalled()
    expect(recordEmailEvent).not.toHaveBeenCalled()
  })

  it('checks suppression BEFORE sending, then sends + records on a clean contact', async () => {
    const callOrder: string[] = []
    isSuppressed.mockImplementation(async () => {
      callOrder.push('isSuppressed')
      return { suppressed: false, reasons: [] }
    })
    sendEmail.mockImplementation(async () => {
      callOrder.push('sendEmail')
      return { id: 'msg-1' }
    })
    recordEmailEvent.mockResolvedValue({ ok: true })

    const out = await sendOneSubscriber(baseArgs)
    expect(out).toMatchObject({ status: 'sent', messageId: 'msg-1' })
    expect(callOrder).toEqual(['isSuppressed', 'sendEmail'])
    expect(recordEmailEvent).toHaveBeenCalledTimes(1)
    expect(recordEmailEvent.mock.calls[0][0]).toMatchObject({ sendType: 'market-report', event: 'sent' })
  })

  it('reports a send-error without throwing and does not record a sent event', async () => {
    isSuppressed.mockResolvedValue({ suppressed: false, reasons: [] })
    sendEmail.mockResolvedValue({ error: 'Resend 500' })
    const out = await sendOneSubscriber(baseArgs)
    expect(out).toMatchObject({ status: 'skipped', reason: 'send-error' })
    expect(recordEmailEvent).not.toHaveBeenCalled()
  })
})
