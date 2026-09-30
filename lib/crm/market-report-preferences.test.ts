import { beforeEach, describe, it, expect, vi } from 'vitest'
import type { ReportSubscriptionRecord } from '@/lib/data/crm/marketReportSubscription'

const m = vi.hoisted(() => ({
  resolveReportLink: vi.fn(),
  readEmailSignals: vi.fn(),
  applyReportSubscriptionPatch: vi.fn(),
  createReportSubscription: vi.fn(),
  logReportTimeline: vi.fn(),
  getMarketReportSendByEmailKey: vi.fn(),
  listMarketReportSendsForPerson: vi.fn(),
  canUserResubscribe: vi.fn(),
  removeSoftEmailUnsubscribeByEmailValue: vi.fn(),
  addSuppression: vi.fn(),
  removeSuppression: vi.fn(),
  recordEmailEvent: vi.fn(),
}))

vi.mock('@/lib/data/crm/reportPreferences', () => ({
  resolveReportLink: m.resolveReportLink,
  readEmailSignals: m.readEmailSignals,
}))
vi.mock('@/lib/data/crm/marketReportSubscription', () => ({
  applyReportSubscriptionPatch: m.applyReportSubscriptionPatch,
  createReportSubscription: m.createReportSubscription,
  logReportTimeline: m.logReportTimeline,
}))
vi.mock('@/lib/data/crm/marketReportSends', () => ({
  getMarketReportSendByEmailKey: m.getMarketReportSendByEmailKey,
  listMarketReportSendsForPerson: m.listMarketReportSendsForPerson,
}))
vi.mock('@/lib/data/newsletter/perLead', () => ({
  canUserResubscribe: m.canUserResubscribe,
  removeSoftEmailUnsubscribeByEmailValue: m.removeSoftEmailUnsubscribeByEmailValue,
}))
vi.mock('@/lib/crm/suppressions', () => ({ addSuppression: m.addSuppression, removeSuppression: m.removeSuppression }))
vi.mock('@/lib/crm/email-events', () => ({ recordEmailEvent: m.recordEmailEvent }))

import { applyReportPreference } from './market-report-preferences'

const NOW = new Date('2026-09-29T18:00:00.000Z')
const CONTACT = {
  personId: 64138,
  name: 'Cheryl Younger',
  firstName: 'Cheryl',
  primaryEmail: 'cybend61@gmail.com',
  assignedBroker: 'matt',
  deleted: false,
  mergedInto: null,
}

function sub(over: Partial<ReportSubscriptionRecord> = {}): ReportSubscriptionRecord {
  return {
    id: 9016,
    personId: 64138,
    areas: ['bend', 'bend-larkspur'],
    frequency: 'monthly',
    isActive: true,
    lastSentAt: '2026-09-29T16:00:00.000Z',
    lastAttemptAt: null,
    createdAt: null,
    updatedAt: null,
    firstSendApprovedAt: '2026-09-29T15:00:00.000Z',
    firstSendApprovedBy: 'matt@ryan-realty.com',
    source: 'email-reply',
    requestedAt: '2026-09-28T22:54:59.000Z',
    consentNote: null,
    stoppedAt: null,
    stoppedVia: null,
    ...over,
  }
}

function link(
  over: { subscription?: ReportSubscriptionRecord | null; preview?: boolean; emailKey?: string | null; deleted?: boolean } = {},
) {
  return {
    ok: true,
    link: {
      token: {
        personId: 64138,
        subscriptionId: 9016,
        purpose: 'manage',
        emailKey: 'emailKey' in over ? over.emailKey : 'market-report:run1:64138',
        preview: over.preview ?? false,
      },
      contact: { ...CONTACT, deleted: over.deleted ?? false },
      subscription: 'subscription' in over ? over.subscription : sub(),
    },
  }
}

beforeEach(() => {
  for (const fn of Object.values(m)) fn.mockReset()
  m.applyReportSubscriptionPatch.mockResolvedValue({ ok: true })
  m.createReportSubscription.mockResolvedValue({
    ok: true,
    created: true,
    record: sub({ isActive: false, stoppedAt: NOW.toISOString(), stoppedVia: 'email-link' }),
  })
  m.logReportTimeline.mockResolvedValue(true)
  m.recordEmailEvent.mockResolvedValue({ ok: true })
  m.readEmailSignals.mockResolvedValue({ all: [], off: false })
  m.listMarketReportSendsForPerson.mockResolvedValue([])
})

describe('applyReportPreference: the link', () => {
  it('a bad link changes nothing and says so', async () => {
    m.resolveReportLink.mockResolvedValue({ ok: false, reason: 'invalid' })
    expect(await applyReportPreference('bad', { kind: 'stop' }, 'email-link', NOW)).toEqual({ ok: false, error: 'link' })
    m.resolveReportLink.mockResolvedValue({ ok: false, reason: 'unavailable' })
    expect(await applyReportPreference('x', { kind: 'stop' }, 'email-link', NOW)).toEqual({ ok: false, error: 'unavailable' })
    expect(m.applyReportSubscriptionPatch).not.toHaveBeenCalled()
  })

  it('the page resolves a manage link; the one-click header resolves a stop link', async () => {
    m.resolveReportLink.mockResolvedValue(link())
    await applyReportPreference('t', { kind: 'pause' }, 'email-link', NOW)
    expect(m.resolveReportLink).toHaveBeenLastCalledWith('t', 'manage')
    await applyReportPreference('t', { kind: 'stop' }, 'one-click', NOW)
    expect(m.resolveReportLink).toHaveBeenLastCalledWith('t', 'stop')
  })

  it('a broker preview link changes nothing', async () => {
    m.resolveReportLink.mockResolvedValue(link({ preview: true }))
    expect(await applyReportPreference('t', { kind: 'stop' }, 'email-link', NOW)).toEqual({ ok: true, changed: false, done: 'preview' })
    expect(m.applyReportSubscriptionPatch).not.toHaveBeenCalled()
    expect(m.recordEmailEvent).not.toHaveBeenCalled()
  })
})

describe('applyReportPreference: stop these reports (report-scoped)', () => {
  it('stops only the market report, records the unsubscribe against this report, and logs it', async () => {
    m.resolveReportLink.mockResolvedValue(link())
    const out = await applyReportPreference('t', { kind: 'stop' }, 'one-click', NOW)
    expect(out).toEqual({ ok: true, changed: true, done: 'stopped' })
    const [, patch, timeline] = m.applyReportSubscriptionPatch.mock.calls[0]
    expect(patch).toEqual({ is_active: false, stopped_at: NOW.toISOString(), stopped_via: 'one-click' })
    expect(timeline.title).toBe("Market report stopped by the one-click unsubscribe in the report's email")
    expect(m.recordEmailEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'unsubscribe',
        sendType: 'market-report',
        emailKey: 'market-report:run1:64138',
        personId: 64138,
        meta: { via: 'one-click', scope: 'market-report' },
      }),
    )
    // The global suppression is untouched: other email keeps working.
    expect(m.addSuppression).not.toHaveBeenCalled()
  })

  it('a report sent without a subscription is stopped as a stopped row, so the choice is on record', async () => {
    m.resolveReportLink.mockResolvedValue(link({ subscription: null }))
    m.getMarketReportSendByEmailKey.mockResolvedValue({ areas: ['bend'] })
    const out = await applyReportPreference('t', { kind: 'stop' }, 'email-link', NOW)
    expect(out).toEqual({ ok: true, changed: true, done: 'stopped' })
    expect(m.createReportSubscription).toHaveBeenCalledWith(
      64138,
      expect.objectContaining({ areas: ['bend'], isActive: false, stoppedAt: NOW.toISOString(), stoppedVia: 'email-link' }),
      expect.anything(),
    )
    expect(m.applyReportSubscriptionPatch).not.toHaveBeenCalled()
    m.resolveReportLink.mockResolvedValue(link({ subscription: null }))
    expect(await applyReportPreference('t', { kind: 'pause' }, 'email-link', NOW)).toEqual({ ok: false, error: 'no-subscription' })
  })

  it('when a row appeared since the link was read, the stop lands on that row, never a false "stopped"', async () => {
    m.resolveReportLink.mockResolvedValue(link({ subscription: null }))
    m.getMarketReportSendByEmailKey.mockResolvedValue({ areas: ['bend'] })
    // The insert found a row a broker had just turned on, and left it alone.
    m.createReportSubscription.mockResolvedValue({ ok: true, created: false, record: sub() })
    const out = await applyReportPreference('t', { kind: 'stop' }, 'one-click', NOW)
    expect(out).toEqual({ ok: true, changed: true, done: 'stopped' })
    expect(m.applyReportSubscriptionPatch).toHaveBeenCalledTimes(1)
    const [target, patch] = m.applyReportSubscriptionPatch.mock.calls[0]
    expect(target).toMatchObject({ id: 9016, personId: 64138 })
    expect(patch).toEqual({ is_active: false, stopped_at: NOW.toISOString(), stopped_via: 'one-click' })
    expect(m.recordEmailEvent).toHaveBeenCalledTimes(1)
  })
})

describe('applyReportPreference: her stop always lands on a report a broker stopped', () => {
  it('her one-click replaces the broker stop with hers and records the unsubscribe', async () => {
    m.resolveReportLink.mockResolvedValue(
      link({ subscription: sub({ isActive: false, stoppedAt: '2026-09-25T00:00:00.000Z', stoppedVia: 'admin' }) }),
    )
    const out = await applyReportPreference('t', { kind: 'stop' }, 'one-click', NOW)
    expect(out).toEqual({ ok: true, changed: true, done: 'stopped' })
    expect(m.applyReportSubscriptionPatch.mock.calls[0][1]).toEqual({
      is_active: false,
      stopped_at: NOW.toISOString(),
      stopped_via: 'one-click',
    })
    expect(m.recordEmailEvent).toHaveBeenCalledWith(
      expect.objectContaining({ event: 'unsubscribe', meta: { via: 'one-click', scope: 'market-report' } }),
    )
  })
})

describe('applyReportPreference: a link whose contact record was deleted', () => {
  it('her one-click and her Stop still stop the report on that record', async () => {
    m.resolveReportLink.mockResolvedValue(link({ deleted: true }))
    expect(await applyReportPreference('t', { kind: 'stop' }, 'one-click', NOW)).toEqual({ ok: true, changed: true, done: 'stopped' })
    expect(m.applyReportSubscriptionPatch.mock.calls[0][0]).toMatchObject({ id: 9016, personId: 64138 })
    expect(m.recordEmailEvent).toHaveBeenCalledTimes(1)
  })

  it('"Stop all Ryan Realty email" still turns email off for her', async () => {
    m.resolveReportLink.mockResolvedValue(link({ deleted: true }))
    expect(await applyReportPreference('t', { kind: 'stop-all-email' }, 'email-link', NOW)).toEqual({
      ok: true,
      changed: true,
      done: 'all-email-off',
    })
    expect(m.addSuppression).toHaveBeenCalledWith(expect.objectContaining({ personId: 64138, value: 'cybend61@gmail.com' }))
  })

  it('nothing else changes a deleted record: no resume, interval, area or email restart', async () => {
    m.resolveReportLink.mockResolvedValue(link({ deleted: true, subscription: sub({ isActive: false, stoppedAt: NOW.toISOString(), stoppedVia: 'admin' }) }))
    for (const action of [
      { kind: 'resume' },
      { kind: 'pause' },
      { kind: 'frequency', frequency: 'weekly' },
      { kind: 'add-area', slug: 'sisters' },
      { kind: 'remove-area', slug: 'bend' },
      { kind: 'restart-all-email' },
    ] as const) {
      expect(await applyReportPreference('t', action, 'email-link', NOW)).toEqual({ ok: false, error: 'closed' })
    }
    expect(m.applyReportSubscriptionPatch).not.toHaveBeenCalled()
    expect(m.removeSuppression).not.toHaveBeenCalled()
  })
})

describe('applyReportPreference: pause, resume, interval, areas', () => {
  it('a no-op words what IS true: pausing a stopped report says stopped', async () => {
    m.resolveReportLink.mockResolvedValue(link({ subscription: sub({ isActive: false, stoppedAt: '2026-09-20T00:00:00Z', stoppedVia: 'email-link' }) }))
    expect(await applyReportPreference('t', { kind: 'pause' }, 'email-link', NOW)).toEqual({ ok: true, changed: false, done: 'stopped' })
    expect(m.applyReportSubscriptionPatch).not.toHaveBeenCalled()
  })

  it('resume after her own stop turns it on and clears the stop', async () => {
    m.resolveReportLink.mockResolvedValue(link({ subscription: sub({ isActive: false, stoppedAt: '2026-09-20T00:00:00Z', stoppedVia: 'email-link' }) }))
    expect(await applyReportPreference('t', { kind: 'resume' }, 'email-link', NOW)).toEqual({ ok: true, changed: true, done: 'on' })
    expect(m.applyReportSubscriptionPatch.mock.calls[0][1]).toEqual({ is_active: true, stopped_at: null, stopped_via: null })
  })

  it('switches the interval', async () => {
    m.resolveReportLink.mockResolvedValue(link())
    expect(await applyReportPreference('t', { kind: 'frequency', frequency: 'quarterly' }, 'email-link', NOW)).toEqual({
      ok: true,
      changed: true,
      done: 'frequency',
    })
    expect(m.applyReportSubscriptionPatch.mock.calls[0][1]).toEqual({ frequency: 'quarterly' })
  })

  it('adds an area only from the live registry', async () => {
    m.resolveReportLink.mockResolvedValue(link())
    expect(await applyReportPreference('t', { kind: 'add-area', slug: 'atlantis' }, 'email-link', NOW)).toEqual({ ok: false, error: 'unknown-area' })
    expect(await applyReportPreference('t', { kind: 'add-area', slug: 'sisters' }, 'email-link', NOW)).toEqual({ ok: true, changed: true, done: 'areas' })
    expect(m.applyReportSubscriptionPatch.mock.calls[0][1]).toEqual({ areas: ['bend', 'bend-larkspur', 'sisters'] })
    expect(m.applyReportSubscriptionPatch.mock.calls[0][2].title).toBe("Market report areas set to Bend, Larkspur, Sisters from the report's email link")
  })

  it('removes an area but never the last one', async () => {
    m.resolveReportLink.mockResolvedValue(link())
    expect(await applyReportPreference('t', { kind: 'remove-area', slug: 'bend' }, 'email-link', NOW)).toEqual({ ok: true, changed: true, done: 'areas' })
    expect(m.applyReportSubscriptionPatch.mock.calls[0][1]).toEqual({ areas: ['bend-larkspur'] })
    m.resolveReportLink.mockResolvedValue(link({ subscription: sub({ areas: ['bend'] }) }))
    expect(await applyReportPreference('t', { kind: 'remove-area', slug: 'bend' }, 'email-link', NOW)).toEqual({ ok: false, error: 'last-area' })
  })
})

describe('applyReportPreference: all Ryan Realty email', () => {
  it('"Stop all" writes the existing global suppression, logs it and records the unsubscribe', async () => {
    m.resolveReportLink.mockResolvedValue(link())
    expect(await applyReportPreference('t', { kind: 'stop-all-email' }, 'email-link', NOW)).toEqual({ ok: true, changed: true, done: 'all-email-off' })
    expect(m.addSuppression).toHaveBeenCalledWith({
      personId: 64138,
      channel: 'email',
      reason: 'unsubscribe',
      source: 'report-email-link',
      // Keyed to her address too, so an address-keyed check honors it.
      value: 'cybend61@gmail.com',
    })
    expect(m.logReportTimeline).toHaveBeenCalledWith(64138, expect.objectContaining({ title: "All Ryan Realty email turned off from the report's email link" }))
    expect(m.recordEmailEvent).toHaveBeenCalledWith(expect.objectContaining({ event: 'unsubscribe', meta: { via: 'email-link', scope: 'all' } }))
  })

  it('"Start receiving again" lifts only her own soft unsubscribe', async () => {
    m.resolveReportLink.mockResolvedValue(link())
    m.readEmailSignals.mockResolvedValue({ all: [{ channel: 'email', reason: 'unsubscribe' }], off: true })
    m.canUserResubscribe.mockReturnValue({ allowed: true })
    expect(await applyReportPreference('t', { kind: 'restart-all-email' }, 'email-link', NOW)).toEqual({ ok: true, changed: true, done: 'all-email-on' })
    expect(m.removeSuppression).toHaveBeenCalledWith({ personId: 64138, channel: 'email', reason: 'unsubscribe' })
    expect(m.removeSoftEmailUnsubscribeByEmailValue).toHaveBeenCalledWith('cybend61@gmail.com')
  })

  it('a bounce, complaint or hard stop cannot be cleared from the page', async () => {
    m.resolveReportLink.mockResolvedValue(link())
    m.readEmailSignals.mockResolvedValue({ all: [{ channel: 'email', reason: 'bounce' }], off: true })
    m.canUserResubscribe.mockReturnValue({ allowed: false, reason: 'bounced' })
    expect(await applyReportPreference('t', { kind: 'restart-all-email' }, 'email-link', NOW)).toEqual({ ok: false, error: 'restart-blocked' })
    expect(m.removeSuppression).not.toHaveBeenCalled()
  })
})
