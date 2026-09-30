import { beforeEach, describe, it, expect, vi } from 'vitest'

const m = vi.hoisted(() => ({
  resolveReportLinkContact: vi.fn(),
  getReportSubscriptionRecord: vi.fn(),
  getMarketReportSendByEmailKey: vi.fn(),
  listMarketReportSendsForPerson: vi.fn(),
  getSuppressionSignals: vi.fn(),
  getEmailKeyedSuppressionSignals: vi.fn(),
}))

vi.mock('@/lib/data/crm/marketReportSubscription', () => ({
  resolveReportLinkContact: m.resolveReportLinkContact,
  getReportSubscriptionRecord: m.getReportSubscriptionRecord,
}))
vi.mock('@/lib/data/crm/marketReportSends', () => ({
  getMarketReportSendByEmailKey: m.getMarketReportSendByEmailKey,
  listMarketReportSendsForPerson: m.listMarketReportSendsForPerson,
}))
vi.mock('@/lib/data/crm/getSuppressionSignals', () => ({ getSuppressionSignals: m.getSuppressionSignals }))
vi.mock('@/lib/data/newsletter/perLead', async () => {
  const consent = await vi.importActual<typeof import('@/lib/crm/membership-consent')>('@/lib/crm/membership-consent')
  return {
    getEmailKeyedSuppressionSignals: m.getEmailKeyedSuppressionSignals,
    // The real rule, inlined: only an owner-clearable email unsubscribe may be lifted.
    canUserResubscribe: (signals: Array<{ channel: string; reason: string }>) =>
      consent.canSubscribe(
        'email',
        signals.filter((s) => !(s.channel === 'email' && s.reason === 'unsubscribe')) as never,
      ),
  }
})

import { readReportForView, readReportPreferences, resolveReportLink } from './reportPreferences'
import { reportEmailLinks, signReportLinkToken, verifyReportLinkToken } from '@/lib/email/report-link-token'

const CONTACT = {
  personId: 64138,
  name: 'Cheryl Younger',
  firstName: 'Cheryl',
  primaryEmail: 'cybend61@gmail.com',
  assignedBroker: 'matt',
  deleted: false,
  mergedInto: null,
}
const SUB = {
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
}

const manage = (over: Record<string, unknown> = {}) =>
  signReportLinkToken({ personId: 64138, subscriptionId: 9016, purpose: 'manage', ...over } as never)

beforeEach(() => {
  for (const fn of Object.values(m)) fn.mockReset()
  m.resolveReportLinkContact.mockResolvedValue(CONTACT)
  m.getReportSubscriptionRecord.mockResolvedValue(SUB)
  m.listMarketReportSendsForPerson.mockResolvedValue([])
  m.getSuppressionSignals.mockResolvedValue([])
  m.getEmailKeyedSuppressionSignals.mockResolvedValue([])
})

describe('resolveReportLink (a link does one job)', () => {
  it('opens the page only for the purpose it was signed for', async () => {
    expect(await resolveReportLink(manage(), 'manage')).toMatchObject({ ok: true })
    expect(await resolveReportLink(manage(), 'stop')).toEqual({ ok: false, reason: 'invalid' })
    const view = signReportLinkToken({ personId: 64138, purpose: 'view', emailKey: 'k1' })
    expect(await resolveReportLink(view, 'manage')).toEqual({ ok: false, reason: 'invalid' })
    expect(await resolveReportLink('garbage', 'manage')).toEqual({ ok: false, reason: 'invalid' })
  })

  it('refuses a subscription that belongs to someone else, and a contact that does not exist', async () => {
    m.getReportSubscriptionRecord.mockResolvedValue({ ...SUB, personId: 1 })
    expect(await resolveReportLink(manage(), 'manage')).toEqual({ ok: false, reason: 'not-found' })
    m.getReportSubscriptionRecord.mockResolvedValue(SUB)
    m.resolveReportLinkContact.mockResolvedValue(null)
    expect(await resolveReportLink(manage(), 'manage')).toEqual({ ok: false, reason: 'not-found' })
  })

  it('a DELETED contact still opens her link, so she can stop what is still going out', async () => {
    m.resolveReportLinkContact.mockResolvedValue({ ...CONTACT, deleted: true })
    const res = await resolveReportLink(manage(), 'manage')
    expect(res.ok).toBe(true)
    expect(res.ok && res.link.contact.deleted).toBe(true)
    expect(res.ok && res.link.subscription?.id).toBe(9016)
    const stop = signReportLinkToken({ personId: 64138, subscriptionId: 9016, purpose: 'stop', emailKey: 'k1' })
    expect(await resolveReportLink(stop, 'stop')).toMatchObject({ ok: true })
  })

  it('a read failure is "unavailable", never a false "not found"', async () => {
    m.resolveReportLinkContact.mockRejectedValue(new Error('timeout'))
    expect(await resolveReportLink(manage(), 'manage')).toEqual({ ok: false, reason: 'unavailable' })
  })

  it('after a contact merge, her old link opens the survivor and the subscription the merge moved', async () => {
    // Her link names 64138; the merge made 70000 the survivor and moved 9016 onto it.
    m.resolveReportLinkContact.mockResolvedValue({ ...CONTACT, personId: 70000 })
    m.getReportSubscriptionRecord.mockImplementation(async (by: { id?: number; personId?: number }) =>
      by.id === 9016 ? { ...SUB, personId: 70000 } : null,
    )
    const res = await resolveReportLink(manage(), 'manage')
    expect(m.resolveReportLinkContact).toHaveBeenCalledWith(64138)
    expect(res.ok && res.link.contact.personId).toBe(70000)
    expect(res.ok && res.link.subscription?.id).toBe(9016)
  })

  it("after a merge that kept the survivor's own row, her link acts on that row", async () => {
    m.resolveReportLinkContact.mockResolvedValue({ ...CONTACT, personId: 70000 })
    m.getReportSubscriptionRecord.mockImplementation(async (by: { id?: number; personId?: number }) =>
      by.id === 9016 ? null : by.personId === 70000 ? { ...SUB, id: 9100, personId: 70000 } : null,
    )
    const res = await resolveReportLink(manage(), 'manage')
    expect(res.ok && res.link.subscription?.id).toBe(9100)
    expect(m.getReportSubscriptionRecord).toHaveBeenCalledWith({ personId: 70000 })
  })
})

describe('readReportPreferences (what her page shows)', () => {
  it('shows her areas with registry labels, her interval, the state, and what she can add', async () => {
    const res = await readReportPreferences(manage(), new Date('2026-09-29T18:00:00Z'))
    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.view.areas).toEqual([
      { slug: 'bend', label: 'Bend' },
      { slug: 'bend-larkspur', label: 'Larkspur' },
    ])
    expect(res.view.frequency).toBe('monthly')
    expect(res.view.state).toBe('paused')
    expect(res.view.awaitingFirstReport).toBe(true)
    expect(res.view.nextSendLabel).toBeNull()
    expect(res.view.addable.some((a) => a.slug === 'bend-larkspur')).toBe(false)
    expect(res.view.addable.some((a) => a.slug === 'sisters')).toBe(true)
    expect(res.view.emailOff).toBe(false)
  })

  it('a deleted record opens as closed: nothing scheduled, nothing awaiting approval', async () => {
    m.resolveReportLinkContact.mockResolvedValue({ ...CONTACT, deleted: true })
    m.getReportSubscriptionRecord.mockResolvedValue({ ...SUB, isActive: true, firstSendApprovedAt: '2026-09-29T00:00:00Z' })
    const res = await readReportPreferences(manage(), new Date('2026-09-29T18:00:00Z'))
    if (!res.ok) throw new Error('expected ok')
    expect(res.view.closed).toBe(true)
    expect(res.view.nextSendLabel).toBeNull()
    expect(res.view.awaitingFirstReport).toBe(false)
  })

  it('says whether SHE stopped the report, or a broker did', async () => {
    m.getReportSubscriptionRecord.mockResolvedValue({ ...SUB, stoppedAt: '2026-09-20T00:00:00Z', stoppedVia: 'admin' })
    let res = await readReportPreferences(manage())
    expect(res.ok && res.view.state).toBe('stopped')
    expect(res.ok && res.view.stoppedByContact).toBe(false)
    m.getReportSubscriptionRecord.mockResolvedValue({ ...SUB, stoppedAt: '2026-09-20T00:00:00Z', stoppedVia: 'one-click' })
    res = await readReportPreferences(manage())
    expect(res.ok && res.view.stoppedByContact).toBe(true)
  })

  it('says plainly when all email is off, and whether she can turn it back on herself', async () => {
    m.getSuppressionSignals.mockResolvedValue([{ channel: 'email', reason: 'unsubscribe' }])
    let res = await readReportPreferences(manage())
    expect(res.ok && res.view.emailOff && res.view.emailRestartable).toBe(true)
    m.getSuppressionSignals.mockResolvedValue([{ channel: 'email', reason: 'bounce' }])
    res = await readReportPreferences(manage())
    expect(res.ok && res.view.emailOff).toBe(true)
    expect(res.ok && res.view.emailRestartable).toBe(false)
  })

  it('lists her past reports with a signed web-view link each, and a real link never lists previews', async () => {
    m.listMarketReportSendsForPerson.mockResolvedValue([
      { emailKey: 'k2', sentAt: '2026-10-29T16:00:00Z', subject: 'Larkspur homes sold for a median $612,000', kind: 'scheduled' },
    ])
    const res = await readReportPreferences(manage())
    expect(m.listMarketReportSendsForPerson).toHaveBeenCalledWith(64138, expect.objectContaining({ kinds: ['scheduled', 'manual'], statuses: ['sent'] }))
    if (!res.ok) throw new Error('expected ok')
    expect(res.view.reports).toHaveLength(1)
    const t = new URL(res.view.reports[0].viewUrl).searchParams.get('t')
    expect(verifyReportLinkToken(t)).toMatchObject({ purpose: 'view', emailKey: 'k2', personId: 64138, preview: false })
    expect(res.view.reports[0].dateLabel).toBe('October 29, 2026')
  })

  it('a broker PREVIEW page lists her real reports with preview links only, never her live ones', async () => {
    m.listMarketReportSendsForPerson.mockResolvedValue([
      { emailKey: 'k2', sentAt: '2026-10-29T16:00:00Z', subject: 'Real report', kind: 'scheduled' },
      { emailKey: 'kp', sentAt: '2026-10-28T16:00:00Z', subject: '[Preview] Real report', kind: 'preview' },
    ])
    const res = await readReportPreferences(manage({ preview: true }))
    if (!res.ok) throw new Error('expected ok')
    expect(res.view.reports).toHaveLength(2)
    for (const r of res.view.reports) {
      expect(verifyReportLinkToken(new URL(r.viewUrl).searchParams.get('t'))).toMatchObject({ purpose: 'view', preview: true })
    }
  })
})

describe('readReportForView (the stored copy, only to its own reader)', () => {
  const view = (over: Record<string, unknown> = {}) =>
    signReportLinkToken({ personId: 64138, subscriptionId: 9016, purpose: 'view', emailKey: 'k1', ...over } as never)
  const SENT = { personId: 64138, status: 'sent', kind: 'scheduled', html: '<p>stored</p>' }

  it('serves the stored html for her own sent report', async () => {
    m.getMarketReportSendByEmailKey.mockResolvedValue(SENT)
    expect(await readReportForView(view())).toEqual({ ok: true, html: '<p>stored</p>' })
  })

  it("never serves another person's report, a failed attempt, or a manage link", async () => {
    m.getMarketReportSendByEmailKey.mockResolvedValue({ ...SENT, personId: 1 })
    expect(await readReportForView(view())).toEqual({ ok: false, reason: 'not-found' })
    m.resolveReportLinkContact.mockResolvedValue(null)
    expect(await readReportForView(view())).toEqual({ ok: false, reason: 'not-found' })
    m.getMarketReportSendByEmailKey.mockResolvedValue({ ...SENT, status: 'failed' })
    expect(await readReportForView(view())).toEqual({ ok: false, reason: 'not-found' })
    expect(await readReportForView(manage())).toEqual({ ok: false, reason: 'invalid' })
  })

  it('after a contact merge moved her reports onto the survivor, her old link still opens her copy', async () => {
    m.getMarketReportSendByEmailKey.mockResolvedValue({ ...SENT, personId: 70000 })
    m.resolveReportLinkContact.mockResolvedValue({ ...CONTACT, personId: 70000 })
    expect(await readReportForView(view())).toEqual({ ok: true, html: '<p>stored</p>' })
    expect(m.resolveReportLinkContact).toHaveBeenCalledWith(64138)
    m.resolveReportLinkContact.mockRejectedValue(new Error('timeout'))
    expect(await readReportForView(view())).toEqual({ ok: false, reason: 'unavailable' })
  })

  it('a broker preview copy opens only from a preview link', async () => {
    m.getMarketReportSendByEmailKey.mockResolvedValue({ ...SENT, kind: 'preview' })
    expect(await readReportForView(view())).toEqual({ ok: false, reason: 'not-found' })
    expect(await readReportForView(view({ preview: true }))).toEqual({ ok: true, html: '<p>stored</p>' })
  })

  it('her real report opened from a PREVIEW link carries no live link of hers: every one is re-signed as a preview', async () => {
    const live = reportEmailLinks({ personId: 64138, subscriptionId: 9016, emailKey: 'k1' })
    const html = `<a href="${live.viewUrl}">View this report online</a> <a href="${live.manageUrl}">Manage your report</a> <a href="${live.unsubscribeUrl}">Unsubscribe</a>`
    m.getMarketReportSendByEmailKey.mockResolvedValue({ ...SENT, html })
    // Her own link: her copy exactly as sent.
    expect(await readReportForView(view())).toEqual({ ok: true, html })
    // A broker's preview link: the same copy, every report link a preview.
    const res = await readReportForView(view({ preview: true }))
    if (!res.ok) throw new Error('expected ok')
    const tokens = [...res.html.matchAll(/\?t=([^&"]+)/g)].map((x) => verifyReportLinkToken(decodeURIComponent(x[1]!)))
    expect(tokens).toHaveLength(3)
    for (const t of tokens) expect(t).toMatchObject({ personId: 64138, subscriptionId: 9016, emailKey: 'k1', preview: true })
    expect(res.html).toContain('>Manage your report<')
  })

  it('a deleted contact still reads her own copy', async () => {
    m.getMarketReportSendByEmailKey.mockResolvedValue({ ...SENT, personId: 70000 })
    m.resolveReportLinkContact.mockResolvedValue({ ...CONTACT, personId: 70000, deleted: true })
    expect(await readReportForView(view())).toEqual({ ok: true, html: '<p>stored</p>' })
  })
})
