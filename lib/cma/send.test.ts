import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * sendCmaToLead's two rails: the broker's own Gmail first, Resend when Gmail
 * fails. The fallback is only safe when nothing reached the lead. A Gmail
 * sign-in that stalls fails fast and falls back; a send Gmail never answered
 * may already be in the lead's inbox, so it must NOT go out a second time by
 * Resend.
 *
 * lib/gmail-draft.ts runs for real here against a stubbed googleapis, so the
 * handoff between the two modules is what gets tested. The deadlines themselves
 * are pinned against the real Google client in lib/gmail-draft.test.ts.
 */

const h = vi.hoisted(() => ({
  authorize: vi.fn(),
  gmailSend: vi.fn(),
  sendEmail: vi.fn(),
  updateCmaRowFieldsBySlug: vi.fn(),
  logCmaTimelineEvent: vi.fn(),
  recordEmailEvent: vi.fn(),
  ensureNativeLead: vi.fn(),
  stampCmaPersonId: vi.fn(),
  row: {
    id: 'row-1',
    status: 'finalized',
    client_email: 'lead@example.com',
    client_name: 'Pat Lead',
    broker_slug: 'matthew-ryan',
    subject_address: '123 Main St, Bend, OR 97701',
    request_source: 'seller-home-value',
    doc_type: 'cma',
    value_low: 500000,
    value_high: 540000,
    recommended_list: 525000,
    build_summary: null,
  },
  broker: {
    slug: 'matthew-ryan',
    display_name: 'Matt Ryan',
    title: 'Owner & Principal Broker',
    email: 'matt@ryan-realty.com',
    twilio_number: '+15417033095',
    photo_url: null,
  },
}))

vi.mock('googleapis', () => ({
  google: {
    auth: {
      JWT: class {
        authorize = h.authorize
      },
    },
    gmail: () => ({ users: { messages: { send: h.gmailSend } } }),
  },
}))

vi.mock('@/lib/data', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/data')>()),
  getCmaAdminRowBySlug: vi.fn(async () => h.row),
  getCmaBrokerBySlugOrEmail: vi.fn(async () => h.broker),
  getCmaProspectAsk: vi.fn(async () => null),
  updateCmaRowFieldsBySlug: h.updateCmaRowFieldsBySlug,
  findCrmPersonIdByEmail: vi.fn(async () => 42),
  stampCmaLinkOnPerson: vi.fn(async () => undefined),
  stampCmaPersonId: h.stampCmaPersonId,
  logCmaTimelineEvent: h.logCmaTimelineEvent,
  getBrokers: vi.fn(async () => []),
}))
vi.mock('@/lib/crm/suppressions', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/crm/suppressions')>()),
  isSuppressed: vi.fn(async () => ({ suppressed: false, reasons: [] })),
  isSuppressedByEmail: vi.fn(async () => ({ suppressed: false, reasons: [] })),
}))
vi.mock('@/lib/resend', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/resend')>()),
  sendEmail: h.sendEmail,
}))
vi.mock('@/lib/cma/first-contact-place', () => ({ resolveFirstContactPlace: vi.fn(async () => null) }))
vi.mock('@/lib/cma-pdf', () => ({
  renderCmaPdfBuffer: vi.fn(async () => ({ buffer: Buffer.from('%PDF-1.7') })),
  CmaNotFoundError: class CmaNotFoundError extends Error {},
}))
vi.mock('@/lib/crm/email-events', () => ({ recordEmailEvent: h.recordEmailEvent }))
vi.mock('@/lib/data/crm/ensureNativeLead', () => ({
  ensureNativeLead: (...args: unknown[]) => h.ensureNativeLead(...args),
}))
vi.mock('@/lib/email/auto-track', () => ({ instrumentLeadHtml: vi.fn(async (html: string) => html) }))

import { sendCmaToLead } from '@/lib/cma/send'
import { GMAIL_AUTH_TIMEOUT_MS } from '@/lib/gmail-draft'

const SLUG = 'cma-123-main-st'

let consoleError: ReturnType<typeof vi.spyOn>

beforeEach(() => {
  vi.stubEnv('GOOGLE_SERVICE_ACCOUNT_CLIENT_EMAIL', 'viewer@ryanrealty.iam.gserviceaccount.com')
  vi.stubEnv('GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY', 'test-key')
  h.authorize.mockResolvedValue({ access_token: 'ya29.test' })
  h.gmailSend.mockResolvedValue({ data: { id: 'msg-1', threadId: 'thr-1' } })
  h.sendEmail.mockResolvedValue({ id: 'resend-1' })
  h.updateCmaRowFieldsBySlug.mockResolvedValue({ ok: true })
  h.logCmaTimelineEvent.mockResolvedValue(undefined)
  h.recordEmailEvent.mockResolvedValue({ ok: true })
  h.ensureNativeLead.mockResolvedValue({ personId: 88, created: true })
  h.stampCmaPersonId.mockResolvedValue(undefined)
  consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllEnvs()
  vi.clearAllMocks()
  consoleError.mockRestore()
})

describe('sendCmaToLead', () => {
  it('sends from the broker mailbox and marks the CMA delivered (happy path)', async () => {
    const res = await sendCmaToLead(SLUG)

    expect(res).toMatchObject({ ok: true, transport: 'gmail', mailbox: 'matt@ryan-realty.com', gmailMessageId: 'msg-1' })
    expect(h.gmailSend).toHaveBeenCalledTimes(1)
    expect(h.sendEmail).not.toHaveBeenCalled()
    expect(h.updateCmaRowFieldsBySlug).toHaveBeenCalledWith(SLUG, expect.objectContaining({ status: 'delivered' }))
    expect(h.recordEmailEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'sent',
        emailKey: `cma:${SLUG}`,
        meta: expect.objectContaining({
          transport: 'gmail',
          slug: SLUG,
          gmailThreadId: 'thr-1',
          rfcMessageId: expect.stringMatching(/^<.+@ryan-realty\.com>$/),
        }),
      }),
    )
    expect(h.ensureNativeLead).not.toHaveBeenCalled()
  })

  it('creates a CRM contact when none exists, then tracks the send', async () => {
    const { findCrmPersonIdByEmail } = await import('@/lib/data')
    vi.mocked(findCrmPersonIdByEmail).mockResolvedValueOnce(null)

    const res = await sendCmaToLead(SLUG)

    expect(res).toMatchObject({ ok: true, transport: 'gmail', personId: 88 })
    expect(h.ensureNativeLead).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'lead@example.com', source: 'cma-send' }),
    )
    expect(h.stampCmaPersonId).toHaveBeenCalledWith(SLUG, 88)
    expect(h.recordEmailEvent).toHaveBeenCalledWith(expect.objectContaining({ personId: 88 }))
    expect(h.logCmaTimelineEvent).toHaveBeenCalled()
  })

  it('refuses the send when a CRM contact cannot be created', async () => {
    const { findCrmPersonIdByEmail } = await import('@/lib/data')
    vi.mocked(findCrmPersonIdByEmail).mockResolvedValueOnce(null)
    h.ensureNativeLead.mockResolvedValueOnce({ personId: 0, created: false })

    const res = await sendCmaToLead(SLUG)

    expect(res.ok).toBe(false)
    expect(res.error).toMatch(/untracked/i)
    expect(h.gmailSend).not.toHaveBeenCalled()
    expect(h.sendEmail).not.toHaveBeenCalled()
    expect(h.updateCmaRowFieldsBySlug).not.toHaveBeenCalled()
    expect(h.recordEmailEvent).not.toHaveBeenCalled()
  })

  it('falls back to Resend when the Gmail sign-in stalls past its deadline', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    let signInAsked!: () => void
    const asked = new Promise<void>((resolve) => (signInAsked = resolve))
    h.authorize.mockImplementation(() => {
      signInAsked()
      return new Promise(() => {})
    })

    const pending = sendCmaToLead(SLUG)
    await asked
    await vi.advanceTimersByTimeAsync(GMAIL_AUTH_TIMEOUT_MS)
    const res = await pending

    expect(h.gmailSend).not.toHaveBeenCalled()
    expect(h.sendEmail).toHaveBeenCalledTimes(1)
    expect(h.sendEmail).toHaveBeenCalledWith(expect.objectContaining({ to: 'lead@example.com' }))
    expect(res).toMatchObject({ ok: true, transport: 'resend', resendId: 'resend-1' })
  })

  it('falls back to Resend when Gmail refuses the send', async () => {
    h.gmailSend.mockRejectedValue(Object.assign(new Error('Invalid To header'), { response: { status: 400 } }))

    const res = await sendCmaToLead(SLUG)

    expect(h.sendEmail).toHaveBeenCalledTimes(1)
    expect(res).toMatchObject({ ok: true, transport: 'resend' })
  })

  it('does not fall back when Gmail never answered the send, and tells the broker to check Sent', async () => {
    // What gaxios throws when the request timed out or the connection dropped: no HTTP response.
    h.gmailSend.mockRejectedValue(Object.assign(new Error('The operation was aborted.'), { name: 'AbortError' }))

    const res = await sendCmaToLead(SLUG)

    expect(h.sendEmail).not.toHaveBeenCalled()
    expect(res.ok).toBe(false)
    expect(res.error).toMatch(/matt@ryan-realty\.com/)
    expect(res.error).toMatch(/may have gone out.*check Sent/i)
    // Not recorded as delivered: nobody knows that it was.
    expect(h.updateCmaRowFieldsBySlug).not.toHaveBeenCalled()
    expect(h.logCmaTimelineEvent).not.toHaveBeenCalled()
    expect(h.recordEmailEvent).not.toHaveBeenCalled()
    expect(consoleError).toHaveBeenCalledWith(expect.stringContaining(SLUG))
  })
})
