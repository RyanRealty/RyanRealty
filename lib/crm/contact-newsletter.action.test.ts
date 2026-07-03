/**
 * Guard tests for sendNewsletterToContactAction (Stream 3).
 *
 * Under lib/crm/ so vitest picks it up. Heavy deps mocked so we verify the
 * access guard, the suppression chokepoint (fails closed), the no-newsletter
 * path, and the never-throw contract without a real send.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'

const getCrmAccess = vi.fn()
const requirePersonInScope = vi.fn()
vi.mock('@/app/actions/crm', () => ({
  getCrmAccess: () => getCrmAccess(),
  requirePersonInScope: (...a: unknown[]) => requirePersonInScope(...a),
}))

const isSuppressed = vi.fn()
vi.mock('@/lib/crm/suppressions', () => ({ isSuppressed: (...a: unknown[]) => isSuppressed(...a) }))

const sendEmail = vi.fn()
vi.mock('@/lib/resend', () => ({ sendEmail: (...a: unknown[]) => sendEmail(...a) }))

vi.mock('@/lib/email-templates/newsletter-shell', () => ({
  wrapNewsletterHtml: (a: { bodyHtml: string }) => a.bodyHtml,
  newsletterTextFooter: () => '\nUnsubscribe',
}))
vi.mock('@/lib/crm/merge', () => ({ attributeSiteLinks: (t: string) => t }))
vi.mock('@/lib/email-tracking', () => ({ instrumentEmailHtml: (h: string) => h }))

const subscribeToNewsletter = vi.fn()
const getNewsletter = vi.fn()
const recordRecipientSend = vi.fn()
vi.mock('@/lib/data', () => ({
  subscribeToNewsletter: (...a: unknown[]) => subscribeToNewsletter(...a),
  getNewsletter: (...a: unknown[]) => getNewsletter(...a),
  recordRecipientSend: (...a: unknown[]) => recordRecipientSend(...a),
}))

// Supabase stub: person + subscriber lookups + newsletters resolution + insert.
let personRow: unknown = null
let subRow: unknown = null
let sentNewsletterId: string | null = null
let draftNewsletterId: string | null = null
const insertSpy = vi.fn()
function makeSb() {
  let table = ''
  let statusFilter = ''
  const builder: Record<string, unknown> = {
    select: () => builder,
    eq: (col: string, val: string) => { if (col === 'status') statusFilter = val; return builder },
    ilike: () => builder,
    order: () => builder,
    limit: () => builder,
    insert: (row: unknown) => { insertSpy(row); return Promise.resolve({ error: null }) },
    maybeSingle: () => {
      if (table === 'crm_people') return Promise.resolve({ data: personRow })
      if (table === 'newsletter_subscribers') return Promise.resolve({ data: subRow })
      if (table === 'newsletters') {
        const id = statusFilter === 'sent' ? sentNewsletterId : draftNewsletterId
        return Promise.resolve({ data: id ? { id } : null })
      }
      return Promise.resolve({ data: null })
    },
  }
  return {
    from: (t: string) => { table = t; statusFilter = ''; return builder },
  }
}
vi.mock('@/lib/supabase/service', () => ({ createServiceClient: () => makeSb() }))

import { sendNewsletterToContactAction } from '@/app/actions/contact-newsletter'

afterEach(() => {
  vi.clearAllMocks()
  personRow = null
  subRow = null
  sentNewsletterId = null
  draftNewsletterId = null
})

describe('sendNewsletterToContactAction', () => {
  it('refuses when unauthorized', async () => {
    getCrmAccess.mockResolvedValue(null)
    const r = await sendNewsletterToContactAction(5)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error).toBe('Unauthorized')
    expect(sendEmail).not.toHaveBeenCalled()
  })

  it('fails closed on suppression', async () => {
    getCrmAccess.mockResolvedValue({ email: 'matt@ryan-realty.com', role: 'superuser', brokerSlug: 'matt' })
    requirePersonInScope.mockResolvedValue({ ok: true })
    personRow = { id: 5, fub_legacy_id: 1, emails: [{ value: 'a@b.com', isPrimary: 1 }], name: 'A', assigned_broker: 'matt' }
    isSuppressed.mockResolvedValue({ suppressed: true, reasons: ['hard-stop'] })
    const r = await sendNewsletterToContactAction(5)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error).toContain('suppression')
    expect(sendEmail).not.toHaveBeenCalled()
  })

  it('refuses when no newsletter is ready', async () => {
    getCrmAccess.mockResolvedValue({ email: 'matt@ryan-realty.com', role: 'superuser', brokerSlug: 'matt' })
    requirePersonInScope.mockResolvedValue({ ok: true })
    personRow = { id: 5, fub_legacy_id: 1, emails: [{ value: 'a@b.com', isPrimary: 1 }], name: 'A', assigned_broker: 'matt' }
    isSuppressed.mockResolvedValue({ suppressed: false, reasons: [] })
    sentNewsletterId = null
    draftNewsletterId = null
    const r = await sendNewsletterToContactAction(5)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error).toBe('No newsletter is ready to send')
  })

  it('sends to exactly one contact, records tracking, and logs to the timeline', async () => {
    getCrmAccess.mockResolvedValue({ email: 'matt@ryan-realty.com', role: 'superuser', brokerSlug: 'matt' })
    requirePersonInScope.mockResolvedValue({ ok: true })
    personRow = { id: 5, fub_legacy_id: 42, emails: [{ value: 'a@b.com', isPrimary: 1 }], name: 'A', assigned_broker: 'matt' }
    isSuppressed.mockResolvedValue({ suppressed: false, reasons: [] })
    sentNewsletterId = 'nl-1'
    getNewsletter.mockResolvedValue({ id: 'nl-1', subject: 'June update', preview_text: null, body_html: '<p>hi</p>', body_text: null })
    subscribeToNewsletter.mockResolvedValue({ ok: true })
    // status is required now — the one-click path refuses to reactivate an opt-out
    // (S-10). An already-active subscriber is used as-is (segment preserved).
    subRow = { id: 'sub-1', status: 'active', unsubscribe_token: 'tok-1' }
    sendEmail.mockResolvedValue({ id: 'resend-1' })

    const r = await sendNewsletterToContactAction(5)
    expect(r.ok).toBe(true)
    expect(sendEmail).toHaveBeenCalledTimes(1)
    expect(sendEmail.mock.calls[0][0].to).toBe('a@b.com')
    expect(recordRecipientSend).toHaveBeenCalledTimes(1)
    // One timeline row logged for the send.
    expect(insertSpy).toHaveBeenCalledTimes(1)
    expect(insertSpy.mock.calls[0][0].kind).toBe('email_out')
  })

  it('refuses to reactivate an opt-out (S-10)', async () => {
    getCrmAccess.mockResolvedValue({ email: 'matt@ryan-realty.com', role: 'superuser', brokerSlug: 'matt' })
    requirePersonInScope.mockResolvedValue({ ok: true })
    personRow = { id: 5, fub_legacy_id: 42, emails: [{ value: 'a@b.com', isPrimary: 1 }], name: 'A', assigned_broker: 'matt' }
    isSuppressed.mockResolvedValue({ suppressed: false, reasons: [] })
    sentNewsletterId = 'nl-1'
    getNewsletter.mockResolvedValue({ id: 'nl-1', subject: 'June update', preview_text: null, body_html: '<p>hi</p>', body_text: null })
    subRow = { id: 'sub-1', status: 'unsubscribed', unsubscribe_token: 'tok-1' }

    const r = await sendNewsletterToContactAction(5)
    expect(r.ok).toBe(false)
    expect(sendEmail).not.toHaveBeenCalled()
    expect(subscribeToNewsletter).not.toHaveBeenCalled() // never resurrected
  })

  it('never throws', async () => {
    getCrmAccess.mockRejectedValue(new Error('boom'))
    const r = await sendNewsletterToContactAction(5)
    expect(r.ok).toBe(false)
  })
})
