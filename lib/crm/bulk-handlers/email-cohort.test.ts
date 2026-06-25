import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Mocks (declared before importing the module under test) ────────────────────

const mockIsSuppressed = vi.fn()
vi.mock('@/lib/crm/suppressions', () => ({
  isSuppressed: (...args: unknown[]) => mockIsSuppressed(...args),
}))

const mockSendEmail = vi.fn()
vi.mock('@/lib/resend', () => ({
  sendEmail: (...args: unknown[]) => mockSendEmail(...args),
}))

// The send now CLAIMS the (jobId, personId) via an idempotent insertEmailEvent
// BEFORE the wire (the double-send guard), and rolls back via
// deleteEmailEventByDedupeKey on a wire failure. The claim row IS the `sent`
// measurement row — there is no separate recordEmailEvent after the send.
const mockInsertEmailEvent = vi.fn()
const mockDeleteEmailEvent = vi.fn()
vi.mock('@/lib/data/crm/insertEmailEvent', () => ({
  insertEmailEvent: (...args: unknown[]) => mockInsertEmailEvent(...args),
  deleteEmailEventByDedupeKey: (...args: unknown[]) => mockDeleteEmailEvent(...args),
}))

const mockGetRecipients = vi.fn()
const mockGetTemplate = vi.fn()
vi.mock('@/lib/data/crm/getEmailCohortRecipients', () => ({
  getEmailCohortRecipients: (...args: unknown[]) => mockGetRecipients(...args),
  getCrmTemplateForSend: (...args: unknown[]) => mockGetTemplate(...args),
}))

// attributeOutbound + prepareDeliverableEmail + renderCrmMerge are pure and safe
// to run unmocked, but prepare pulls 'server-only' env helpers; mock them thin so
// the test asserts the handler's orchestration, not their internals.
vi.mock('@/lib/crm/attributed-links', () => ({
  attributeOutbound: (html: string) => `ATTR(${html})`,
}))
vi.mock('@/lib/email/prepare', () => ({
  prepareDeliverableEmail: (input: { subject: string; html: string }) => ({
    subject: input.subject,
    html: `PREP(${input.html})`,
    text: 'plain',
    headers: { 'List-Unsubscribe': '<u>' },
    report: { level: 'pass', issues: [] },
  }),
}))

import {
  resolveCohortContent,
  suppressionBucket,
  attributionSlug,
  cohortEmailKey,
  cohortSendDedupeKey,
  sendOneCohortEmail,
  emailCohortHandler,
  type EmailCohortParams,
} from './email-cohort'
import type { EmailCohortRecipient } from '@/lib/data/crm/getEmailCohortRecipients'
import type { BulkContext } from '@/lib/crm/bulk-jobs'

const CTX: BulkContext = { jobId: 42, actorEmail: 'matt@ryan-realty.com', brokerScope: null }

const recipient = (over: Partial<EmailCohortRecipient> = {}): EmailCohortRecipient => ({
  id: 7,
  fub_legacy_id: 100,
  email: 'lead@example.com',
  assigned_broker: 'rebecca',
  name: 'Jane Doe',
  first_name: 'Jane',
  custom: {},
  ...over,
})

const CONTENT = { subject: 'Hi %first%', body: '<p>Hello %first%</p>' }

describe('email-cohort pure helpers', () => {
  describe('resolveCohortContent', () => {
    it('uses the template when a templateId is set', () => {
      const out = resolveCohortContent(
        { templateId: 5 },
        { subject: 'Tmpl subj', body: 'Tmpl body' },
      )
      expect(out).toEqual({ subject: 'Tmpl subj', body: 'Tmpl body' })
    })
    it('returns null when templateId is set but the template is missing', () => {
      expect(resolveCohortContent({ templateId: 5 }, null)).toBeNull()
    })
    it('returns null when a template has an empty subject or body', () => {
      expect(resolveCohortContent({ templateId: 5 }, { subject: '', body: 'b' })).toBeNull()
      expect(resolveCohortContent({ templateId: 5 }, { subject: 's', body: '  ' })).toBeNull()
    })
    it('uses inline subject+body when no templateId', () => {
      expect(resolveCohortContent({ subject: 's', body: 'b' }, null)).toEqual({ subject: 's', body: 'b' })
    })
    it('returns null when inline content is incomplete', () => {
      expect(resolveCohortContent({ subject: 's' }, null)).toBeNull()
      expect(resolveCohortContent({ body: 'b' }, null)).toBeNull()
      expect(resolveCohortContent({}, null)).toBeNull()
    })
  })

  describe('suppressionBucket', () => {
    it('maps hard-stop first', () => {
      expect(suppressionBucket(['tag:compliance:hard-stop', 'email:unsubscribed'])).toBe('suppressed-hard-stop')
    })
    it('maps a failed check to hard-stop (fail-closed)', () => {
      expect(suppressionBucket(['suppression-check-failed: boom'])).toBe('suppressed-hard-stop')
    })
    it('maps unsubscribe / do_not_email', () => {
      expect(suppressionBucket(['email:unsubscribed'])).toBe('suppressed-unsubscribed')
      expect(suppressionBucket(['tag:do_not_email'])).toBe('suppressed-unsubscribed')
    })
    it('maps bounce and complaint', () => {
      expect(suppressionBucket(['email:bounced'])).toBe('suppressed-bounced')
      expect(suppressionBucket(['email:complained'])).toBe('suppressed-complained')
    })
    it('falls back to generic suppressed', () => {
      expect(suppressionBucket(['email:something-else'])).toBe('suppressed')
    })
  })

  describe('attributionSlug', () => {
    it('uses the assigned broker', () => {
      expect(attributionSlug('rebecca')).toBe('rebecca')
    })
    it('falls back to matt when unassigned', () => {
      expect(attributionSlug(null)).toBe('matt')
      expect(attributionSlug('  ')).toBe('matt')
    })
  })

  describe('cohortEmailKey', () => {
    it('uses the param key when set', () => {
      expect(cohortEmailKey({ emailKey: 'k1' }, 9)).toBe('k1')
    })
    it('derives from the jobId otherwise', () => {
      expect(cohortEmailKey({}, 9)).toBe('bulk:email-cohort:9')
    })
  })

  describe('cohortSendDedupeKey', () => {
    it('is stable + unique per (jobId, personId)', () => {
      expect(cohortSendDedupeKey(42, 7)).toBe('bulk:email-cohort:42:p:7:sent')
      // Same inputs -> same key (two overlapping runs collapse on it).
      expect(cohortSendDedupeKey(42, 7)).toBe(cohortSendDedupeKey(42, 7))
      // Different person or job -> different key.
      expect(cohortSendDedupeKey(42, 8)).not.toBe(cohortSendDedupeKey(42, 7))
      expect(cohortSendDedupeKey(43, 7)).not.toBe(cohortSendDedupeKey(42, 7))
    })
  })
})

describe('sendOneCohortEmail — suppression + claim-before-send + record shape', () => {
  beforeEach(() => {
    mockIsSuppressed.mockReset()
    mockSendEmail.mockReset()
    mockInsertEmailEvent.mockReset()
    mockDeleteEmailEvent.mockReset()
    // Default: the claim wins (a fresh row landed).
    mockInsertEmailEvent.mockResolvedValue({ ok: true, inserted: true })
    mockDeleteEmailEvent.mockResolvedValue({ ok: true })
  })

  it('skips + buckets a suppressed recipient WITHOUT claiming or sending', async () => {
    mockIsSuppressed.mockResolvedValue({ suppressed: true, reasons: ['email:unsubscribed'] })
    const out = await sendOneCohortEmail(recipient(), CONTENT, {}, CTX)
    expect(out).toEqual({ kind: 'skipped', bucket: 'suppressed-unsubscribed' })
    expect(mockInsertEmailEvent).not.toHaveBeenCalled()
    expect(mockSendEmail).not.toHaveBeenCalled()
  })

  it('skips no-email before checking suppression', async () => {
    const out = await sendOneCohortEmail(recipient({ email: '' }), CONTENT, {}, CTX)
    expect(out).toEqual({ kind: 'skipped', bucket: 'no-email' })
    expect(mockIsSuppressed).not.toHaveBeenCalled()
    expect(mockSendEmail).not.toHaveBeenCalled()
  })

  it('claims, then sends a merged, attributed, prepared email (claim IS the sent row)', async () => {
    mockIsSuppressed.mockResolvedValue({ suppressed: false, reasons: [] })
    mockSendEmail.mockResolvedValue({ id: 'msg-1' })

    const out = await sendOneCohortEmail(recipient(), CONTENT, { fromIdentity: 'x@ryan-realty.com' }, CTX)
    expect(out).toEqual({ kind: 'processed' })

    expect(mockIsSuppressed).toHaveBeenCalledWith(7, 'email')

    // The claim row is the idempotent `sent` event keyed per (jobId, personId).
    expect(mockInsertEmailEvent).toHaveBeenCalledTimes(1)
    const claimArg = mockInsertEmailEvent.mock.calls[0][0]
    expect(claimArg).toMatchObject({
      recipient_email: 'lead@example.com',
      person_id: 7,
      broker: 'rebecca',
      send_type: 'campaign',
      event: 'sent',
      email_key: 'bulk:email-cohort:42',
      subject: 'Hi Jane',
      dedupe_key: cohortSendDedupeKey(42, 7),
    })

    // sendEmail got the merged subject, the prepared (attributed) html + headers.
    expect(mockSendEmail).toHaveBeenCalledTimes(1)
    const sendArg = mockSendEmail.mock.calls[0][0]
    expect(sendArg.to).toBe('lead@example.com')
    expect(sendArg.subject).toBe('Hi Jane') // %first% merged
    expect(sendArg.html).toBe('PREP(ATTR(<p>Hello Jane</p>))') // attributed then prepared
    expect(sendArg.from).toBe('x@ryan-realty.com')
    expect(sendArg.headers).toEqual({ 'List-Unsubscribe': '<u>' })

    // No rollback on success.
    expect(mockDeleteEmailEvent).not.toHaveBeenCalled()
  })

  it('SKIPS the wire send when the claim already exists (overlapping run)', async () => {
    mockIsSuppressed.mockResolvedValue({ suppressed: false, reasons: [] })
    // A sibling run already claimed this recipient -> insert collapses.
    mockInsertEmailEvent.mockResolvedValue({ ok: true, inserted: false })

    const out = await sendOneCohortEmail(recipient(), CONTENT, {}, CTX)
    expect(out).toEqual({ kind: 'skipped', bucket: 'already-sent' })
    // The double-send guard: NO wire send when the claim was already taken.
    expect(mockSendEmail).not.toHaveBeenCalled()
    expect(mockDeleteEmailEvent).not.toHaveBeenCalled()
  })

  it('skips claim-error when the claim WRITE fails (never sends undeduped)', async () => {
    mockIsSuppressed.mockResolvedValue({ suppressed: false, reasons: [] })
    mockInsertEmailEvent.mockResolvedValue({ ok: false, error: 'db down' })
    const out = await sendOneCohortEmail(recipient(), CONTENT, {}, CTX)
    expect(out).toEqual({ kind: 'skipped', bucket: 'claim-error' })
    expect(mockSendEmail).not.toHaveBeenCalled()
  })

  it('rolls the claim back + buckets send-error on a wire failure', async () => {
    mockIsSuppressed.mockResolvedValue({ suppressed: false, reasons: [] })
    mockSendEmail.mockResolvedValue({ error: 'Resend down' })
    const out = await sendOneCohortEmail(recipient(), CONTENT, {}, CTX)
    expect(out).toEqual({ kind: 'skipped', bucket: 'send-error' })
    // Claim rolled back so a later run can re-attempt — no false `sent` left.
    expect(mockDeleteEmailEvent).toHaveBeenCalledTimes(1)
    expect(mockDeleteEmailEvent).toHaveBeenCalledWith(cohortSendDedupeKey(42, 7))
  })
})

describe('emailCohortHandler — chunk tally', () => {
  beforeEach(() => {
    mockIsSuppressed.mockReset()
    mockSendEmail.mockReset()
    mockInsertEmailEvent.mockReset()
    mockDeleteEmailEvent.mockReset()
    mockGetRecipients.mockReset()
    mockGetTemplate.mockReset()
    mockInsertEmailEvent.mockResolvedValue({ ok: true, inserted: true })
    mockDeleteEmailEvent.mockResolvedValue({ ok: true })
  })

  it('returns empty for an empty chunk', async () => {
    const out = await emailCohortHandler([], { subject: 's', body: 'b' }, CTX)
    expect(out).toEqual({ processed: 0, skipped: 0, breakdown: {} })
    expect(mockGetRecipients).not.toHaveBeenCalled()
  })

  it('tallies sent / suppressed / no-email / no-person across a chunk', async () => {
    // id 1 sends, id 2 suppressed, id 3 no-email, id 4 has no person row.
    mockGetRecipients.mockResolvedValue([
      recipient({ id: 1, email: 'a@x.com' }),
      recipient({ id: 2, email: 'b@x.com' }),
      recipient({ id: 3, email: '' }),
    ])
    mockIsSuppressed.mockImplementation(async (id: number) =>
      id === 2 ? { suppressed: true, reasons: ['email:bounced'] } : { suppressed: false, reasons: [] },
    )
    mockSendEmail.mockResolvedValue({ id: 'm' })

    const out = await emailCohortHandler([1, 2, 3, 4], { subject: 'S', body: 'B' } as EmailCohortParams, CTX)

    expect(out.processed).toBe(1)
    expect(out.skipped).toBe(3)
    expect(out.breakdown).toEqual({
      sent: 1,
      'suppressed-bounced': 1,
      'no-email': 1,
      'no-person': 1,
    })
    // Exactly one wire send (id 1 only) — suppressed/no-email/no-person never sent.
    expect(mockSendEmail).toHaveBeenCalledTimes(1)
  })

  it('counts no-content for every id when content cannot resolve', async () => {
    mockGetRecipients.mockResolvedValue([recipient({ id: 1 }), recipient({ id: 2 })])
    // templateId set but template missing -> content null.
    mockGetTemplate.mockResolvedValue(null)
    const out = await emailCohortHandler([1, 2], { templateId: 99 } as EmailCohortParams, CTX)
    expect(out.processed).toBe(0)
    expect(out.skipped).toBe(2)
    expect(out.breakdown).toEqual({ 'no-content': 2 })
    expect(mockSendEmail).not.toHaveBeenCalled()
  })
})
