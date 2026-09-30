import { beforeEach, describe, it, expect, vi } from 'vitest'
import type { ReportSubscriptionRecord } from '@/lib/data/crm/marketReportSubscription'

const m = vi.hoisted(() => ({
  applyReportSubscriptionPatch: vi.fn(),
  createReportSubscription: vi.fn(),
  getMarketReportContact: vi.fn(),
  getReportSubscriptionRecord: vi.fn(),
  getLatestDeliveredReportAt: vi.fn(),
  getLatestReportPreview: vi.fn(),
  deliverMarketReport: vi.fn(),
  isInternalOutboundRecipient: vi.fn(),
}))

vi.mock('@/lib/data/crm/marketReportSubscription', () => ({
  applyReportSubscriptionPatch: m.applyReportSubscriptionPatch,
  createReportSubscription: m.createReportSubscription,
  getMarketReportContact: m.getMarketReportContact,
  getReportSubscriptionRecord: m.getReportSubscriptionRecord,
}))
vi.mock('@/lib/data/crm/marketReportSends', () => ({
  getLatestDeliveredReportAt: m.getLatestDeliveredReportAt,
  getLatestReportPreview: m.getLatestReportPreview,
}))
vi.mock('@/lib/crm/market-report-deliver', () => ({ deliverMarketReport: m.deliverMarketReport }))
vi.mock('@/lib/email/auto-track', () => ({ isInternalOutboundRecipient: m.isInternalOutboundRecipient }))

import {
  adminApproveFirstSend,
  adminChangeMessage,
  adminSendReportPreview,
  adminUpdateReportSubscription,
  sanitizeAdminAreas,
} from './market-report-admin'

const ADMIN = { email: 'matt@ryan-realty.com', brokerSlug: 'matt' }

function sub(over: Partial<ReportSubscriptionRecord> = {}): ReportSubscriptionRecord {
  return {
    id: 9016,
    personId: 64138,
    areas: ['bend', 'bend-larkspur'],
    frequency: 'monthly',
    isActive: false,
    lastSentAt: null,
    lastAttemptAt: null,
    createdAt: null,
    updatedAt: null,
    firstSendApprovedAt: null,
    firstSendApprovedBy: null,
    source: 'email-reply',
    requestedAt: '2026-09-28T22:54:59Z',
    consentNote: null,
    stoppedAt: null,
    stoppedVia: null,
    pausedAt: null,
    pausedVia: null,
    ...over,
  }
}

beforeEach(() => {
  for (const fn of Object.values(m)) fn.mockReset()
  m.applyReportSubscriptionPatch.mockResolvedValue({ ok: true })
  m.createReportSubscription.mockResolvedValue({ ok: true, created: true, record: sub() })
  m.getReportSubscriptionRecord.mockResolvedValue(sub())
  m.getMarketReportContact.mockResolvedValue({
    personId: 64138,
    name: 'Cheryl Younger',
    firstName: 'Cheryl',
    primaryEmail: 'cybend61@gmail.com',
    assignedBroker: 'matt',
    deleted: false,
    mergedInto: null,
  })
  m.isInternalOutboundRecipient.mockImplementation((e: string) => e.endsWith('@ryan-realty.com'))
})

describe('sanitizeAdminAreas', () => {
  it('keeps registry slugs once, in order, and names the unknown ones', () => {
    expect(sanitizeAdminAreas(['bend-larkspur', 'bend', 'bend', ' sisters ', 'atlantis', 7])).toEqual({
      areas: ['bend-larkspur', 'bend', 'sisters'],
      unknown: ['atlantis'],
    })
  })

  it("checks against the calling surface's own list when it passes one (the hub's config table)", () => {
    const configured = new Set(['bend', 'tumalo'])
    expect(sanitizeAdminAreas(['tumalo', 'bend', 'sisters'], configured)).toEqual({
      areas: ['tumalo', 'bend'],
      unknown: ['sisters'],
    })
  })
})

describe('adminChangeMessage (the broker is told what changed)', () => {
  it('says the first send still waits on approval after a resume', () => {
    expect(adminChangeMessage({ kind: 'resume' }, { firstSendApprovedAt: null })).toContain('waits for your approval')
    expect(adminChangeMessage({ kind: 'resume' }, { firstSendApprovedAt: '2026-09-29T00:00:00Z' })).toBe('Market reports turned on.')
    expect(adminChangeMessage({ kind: 'frequency', frequency: 'weekly' }, { firstSendApprovedAt: null })).toBe('Market reports set to weekly.')
  })
})

describe('adminUpdateReportSubscription', () => {
  it('a first setup starts unapproved, from the broker, dated from the last report she actually got', async () => {
    m.getReportSubscriptionRecord.mockResolvedValue(null)
    m.getLatestDeliveredReportAt.mockResolvedValue('2026-09-29T16:00:00Z')
    const r = await adminUpdateReportSubscription({
      personId: 64138,
      admin: ADMIN,
      areas: ['bend'],
      frequency: 'monthly',
      active: true,
      createIfMissing: true,
    })
    expect(r).toMatchObject({ ok: true })
    const [, values, timeline] = m.createReportSubscription.mock.calls[0]
    expect(values).toMatchObject({ areas: ['bend'], isActive: true, lastSentAt: '2026-09-29T16:00:00Z', source: 'broker' })
    expect(values).not.toHaveProperty('firstSendApprovedAt')
    expect(timeline.title).toBe('Market reports set to monthly for Bend by matt@ryan-realty.com')
  })

  it('refuses an unknown area by name', async () => {
    expect(await adminUpdateReportSubscription({ personId: 64138, admin: ADMIN, areas: ['atlantis'] })).toEqual({
      ok: false,
      error: 'Unknown area: atlantis',
    })
  })

  it('switching off with every area unticked keeps the areas and just turns it off', async () => {
    m.getReportSubscriptionRecord.mockResolvedValue(sub({ isActive: true }))
    const r = await adminUpdateReportSubscription({ personId: 64138, admin: ADMIN, areas: [], active: false })
    expect(r).toEqual({ ok: true, message: 'Market reports turned off.' })
    expect(m.applyReportSubscriptionPatch).toHaveBeenCalledTimes(1)
    // A broker's pause is recorded as the broker's (review 2026-09-30), so it
    // never reads as the contact's own.
    expect(m.applyReportSubscriptionPatch.mock.calls[0][1]).toEqual({ is_active: false, paused_at: expect.any(String), paused_via: 'admin' })
  })

  it('a report that changed after the card was read is refused in words a broker can act on (review 2026-09-30)', async () => {
    m.getReportSubscriptionRecord.mockResolvedValue(sub({ isActive: true }))
    m.applyReportSubscriptionPatch.mockResolvedValue({ ok: false, error: 'changed' })
    const r = await adminUpdateReportSubscription({ personId: 64138, admin: ADMIN, active: false })
    expect(r.ok).toBe(false)
    expect((r as { error: string }).error).toContain('changed since this page was opened')
  })

  it('a contact-stopped report needs her consent note to restart', async () => {
    m.getReportSubscriptionRecord.mockResolvedValue(sub({ stoppedAt: '2026-10-01T00:00:00Z', stoppedVia: 'one-click' }))
    const refused = await adminUpdateReportSubscription({ personId: 64138, admin: ADMIN, active: true })
    expect(refused.ok).toBe(false)
    const ok = await adminUpdateReportSubscription({
      personId: 64138,
      admin: ADMIN,
      active: true,
      consentNote: 'She emailed Matt on 10/2 asking to get it again',
    })
    expect(ok.ok).toBe(true)
  })

  it('a refused turn-on saves NOTHING, not even the areas and interval planned before it', async () => {
    m.getReportSubscriptionRecord.mockResolvedValue(sub({ stoppedAt: '2026-10-01T00:00:00Z', stoppedVia: 'email-link' }))
    const r = await adminUpdateReportSubscription({
      personId: 64138,
      admin: ADMIN,
      areas: ['sisters'],
      frequency: 'weekly',
      active: true,
    })
    expect(r.ok).toBe(false)
    expect(m.applyReportSubscriptionPatch).not.toHaveBeenCalled()
  })

  it('areas, interval and turn-on land as ONE write with one timeline row', async () => {
    m.getReportSubscriptionRecord.mockResolvedValue(sub({ firstSendApprovedAt: '2026-09-29T00:00:00Z' }))
    const r = await adminUpdateReportSubscription({
      personId: 64138,
      admin: ADMIN,
      areas: ['sisters'],
      frequency: 'weekly',
      active: true,
    })
    expect(r).toEqual({ ok: true, message: 'Market report areas saved. Market reports set to weekly. Market reports turned on.' })
    expect(m.applyReportSubscriptionPatch).toHaveBeenCalledTimes(1)
    const [, patch, timeline] = m.applyReportSubscriptionPatch.mock.calls[0]
    expect(patch).toEqual({ areas: ['sisters'], frequency: 'weekly', is_active: true })
    expect(timeline.title).toBe(
      'Market report areas set to Sisters by matt@ryan-realty.com; Market report set to weekly by matt@ryan-realty.com; Market report resumed by matt@ryan-realty.com',
    )
    expect(timeline.payload).toEqual({ via: 'admin', change: 'areas+frequency+resume' })
  })

  it('an unchanged save writes nothing and says so', async () => {
    const r = await adminUpdateReportSubscription({ personId: 64138, admin: ADMIN, frequency: 'monthly', active: false })
    expect(r).toEqual({ ok: true, message: 'Nothing to change.' })
    expect(m.applyReportSubscriptionPatch).not.toHaveBeenCalled()
  })

  it('when a row appeared between the read and the insert, the change lands on that row', async () => {
    m.getReportSubscriptionRecord.mockResolvedValue(null)
    m.createReportSubscription.mockResolvedValue({ ok: true, created: false, record: sub({ frequency: 'monthly' }) })
    const r = await adminUpdateReportSubscription({
      personId: 64138,
      admin: ADMIN,
      frequency: 'quarterly',
      createIfMissing: true,
    })
    expect(r).toEqual({ ok: true, message: 'Market reports set to quarterly.' })
    expect(m.applyReportSubscriptionPatch.mock.calls[0][1]).toEqual({ frequency: 'quarterly' })
  })

  it("accepts an area the hub's config table offers when the hub passes that list", async () => {
    const r = await adminUpdateReportSubscription({
      personId: 64138,
      admin: ADMIN,
      areas: ['tumalo'],
      validAreas: new Set(['tumalo']),
    })
    expect(r.ok).toBe(true)
    expect(m.applyReportSubscriptionPatch.mock.calls[0][1]).toEqual({ areas: ['tumalo'] })
  })
})

describe('adminApproveFirstSend (approval means "send what I previewed")', () => {
  it('refuses until a preview of the current areas and interval exists', async () => {
    m.getLatestReportPreview.mockResolvedValue(null)
    expect((await adminApproveFirstSend({ personId: 64138, admin: ADMIN })).ok).toBe(false)
    m.getLatestReportPreview.mockResolvedValue({ areas: ['bend'], frequency: 'monthly' })
    expect((await adminApproveFirstSend({ personId: 64138, admin: ADMIN })).ok).toBe(false)
    expect(m.applyReportSubscriptionPatch).not.toHaveBeenCalled()
  })

  it('approves after a matching preview and names the approver', async () => {
    m.getLatestReportPreview.mockResolvedValue({ areas: ['bend-larkspur', 'bend'], frequency: 'monthly' })
    const r = await adminApproveFirstSend({ personId: 64138, admin: ADMIN })
    expect(r.ok).toBe(true)
    expect(m.applyReportSubscriptionPatch.mock.calls[0][1]).toMatchObject({ first_send_approved_by: 'matt@ryan-realty.com' })
  })
})

describe('adminSendReportPreview', () => {
  it('only a broker mailbox receives a preview', async () => {
    const r = await adminSendReportPreview({ personId: 64138, admin: { email: 'someone@gmail.com', brokerSlug: null } })
    expect(r.ok).toBe(false)
    expect(m.deliverMarketReport).not.toHaveBeenCalled()
  })

  it("previews her report from her assigned broker, with her greeting and areas, to the admin's inbox", async () => {
    m.deliverMarketReport.mockResolvedValue({ status: 'sent', messageId: 'm1', subject: '[Preview] x', figures: [] })
    const now = new Date('2026-09-29T18:00:00Z')
    const r = await adminSendReportPreview({ personId: 64138, admin: { email: 'paul@ryan-realty.com', brokerSlug: 'paul' }, now })
    expect(r).toEqual({ ok: true, message: 'Preview sent to paul@ryan-realty.com.' })
    expect(m.deliverMarketReport).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'preview',
        to: 'paul@ryan-realty.com',
        brokerSlug: 'matt',
        contactName: 'Cheryl',
        areaSlugs: ['bend', 'bend-larkspur'],
        emailKey: `market-report:preview:64138:${now.getTime()}`,
      }),
    )
  })
})
