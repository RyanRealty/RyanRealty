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
  screenAddressForSolicitation: vi.fn(
    async (): Promise<import('@/lib/cma/solicit-screen').SolicitScreen> => ({
      ok: true as const,
      checked: 1,
      detail: 'clear',
    }),
  ),
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
vi.mock('@/lib/cma/solicit-screen', () => ({
  screenAddressForSolicitation: h.screenAddressForSolicitation,
}))
// These tests are about the two rails. The owner's prospect row (claim, stamp,
// finalize, release) is pinned in send.prospect-claim.test.ts; here no prospect
// row resolves, so the send proceeds exactly as it did before that lease existed.
vi.mock('@/lib/data/prospecting/cma-send-prospect', () => ({
  resolveProspectForCmaSend: vi.fn(async () => null),
}))

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
  h.stampCmaPersonId.mockResolvedValue({ ok: true })
  h.screenAddressForSolicitation.mockResolvedValue({ ok: true, checked: 1, detail: 'clear' })
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
    expect(h.stampCmaPersonId).toHaveBeenCalledWith(SLUG, 42)
  })

  it('saves an existing CRM contact on the cmas row before the PDF renders', async () => {
    const pdf = await import('@/lib/cma-pdf')
    const order: string[] = []
    h.stampCmaPersonId.mockImplementation(async () => {
      order.push('stamp')
      return { ok: true }
    })
    vi.mocked(pdf.renderCmaPdfBuffer).mockImplementation(async () => {
      order.push('pdf')
      return { buffer: Buffer.from('%PDF-1.7'), finalized: true }
    })

    const res = await sendCmaToLead(SLUG)

    expect(res).toMatchObject({ ok: true, personId: 42 })
    expect(h.stampCmaPersonId).toHaveBeenCalledWith(SLUG, 42)
    expect(order).toEqual(['stamp', 'pdf'])
  })

  it('fails the send when saving the contact id on the row fails, and does not render the PDF', async () => {
    const pdf = await import('@/lib/cma-pdf')
    h.stampCmaPersonId.mockResolvedValueOnce({ ok: false, error: 'write refused' })

    const res = await sendCmaToLead(SLUG)

    expect(res.ok).toBe(false)
    expect(res.error).toMatch(/untracked/i)
    expect(res.error).toMatch(/write refused/)
    expect(pdf.renderCmaPdfBuffer).not.toHaveBeenCalled()
    expect(h.gmailSend).not.toHaveBeenCalled()
    expect(h.sendEmail).not.toHaveBeenCalled()
    expect(h.updateCmaRowFieldsBySlug).not.toHaveBeenCalled()
    expect(h.recordEmailEvent).not.toHaveBeenCalled()
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

  it('passes the subject listing key into the solicitation screen on an expired send', async () => {
    const { getCmaAdminRowBySlug } = await import('@/lib/data')
    vi.mocked(getCmaAdminRowBySlug).mockResolvedValueOnce({
      ...h.row,
      request_source: 'expired-outreach-queue',
      doc_type: 'expired-audit',
      subject_address: '4242 Example Lane, Bend, OR 97701',
      subject_city: 'Bend',
      subject_listing_key: 'ZZTESTKEYLOT33',
    })

    const res = await sendCmaToLead(SLUG)

    expect(res.ok).toBe(true)
    // live: the send chokepoint also asks the MLS itself, not only our listings copy.
    expect(h.screenAddressForSolicitation).toHaveBeenCalledWith({
      address: '4242 Example Lane, Bend, OR 97701',
      city: 'Bend',
      sinceIso: null,
      subjectListingKey: 'ZZTESTKEYLOT33',
      live: true,
      liveAlreadyClear: false,
    })
  })

  it('passes null when the expired row has no subject listing key', async () => {
    const { getCmaAdminRowBySlug } = await import('@/lib/data')
    vi.mocked(getCmaAdminRowBySlug).mockResolvedValueOnce({
      ...h.row,
      request_source: 'expired-outreach-queue',
      doc_type: 'expired-audit',
      subject_address: '4242 Example Lane, Bend, OR 97701',
      subject_city: 'Bend',
      subject_listing_key: null,
    })

    const res = await sendCmaToLead(SLUG)

    expect(res.ok).toBe(true)
    expect(h.screenAddressForSolicitation).toHaveBeenCalledWith(
      expect.objectContaining({ subjectListingKey: null, address: '4242 Example Lane, Bend, OR 97701' }),
    )
  })
})

describe('sendCmaToLead — the screen after the 2026-09-30 review', () => {
  const CLEAR = {
    relisted: false,
    verifyFailed: false,
    failureScope: null,
    reason: null,
    blockedStatus: null,
    blockedKey: null,
    blockedDate: null,
    source: null,
  }
  async function fsboRow() {
    const { getCmaAdminRowBySlug } = await import('@/lib/data')
    vi.mocked(getCmaAdminRowBySlug).mockResolvedValueOnce({
      ...h.row,
      request_source: 'fsbo-outreach',
      doc_type: 'fsbo-audit',
      subject_address: '2804 NW 19th St, Redmond, OR 97756',
      subject_city: 'Redmond',
      subject_listing_key: '20200227022945350309000000',
    })
  }

  it("hands the screen the prospect's detect day, so the FSBO's 2004 sale on the subject key is history", async () => {
    await fsboRow()
    await sendCmaToLead(SLUG, undefined, { soldAfter: '2026-08-01T00:00:00Z' })
    expect(h.screenAddressForSolicitation).toHaveBeenCalledWith(
      expect.objectContaining({ sinceIso: '2026-08-01T00:00:00Z', subjectListingKey: '20200227022945350309000000', live: true }),
    )
  })

  it('a fresh, clear, server-minted verdict skips the Spark call; a look-alike does not', async () => {
    const { mintRelistProof } = await import('@/lib/prospecting/send-capability')
    await fsboRow()
    await sendCmaToLead(SLUG, undefined, { relistProof: mintRelistProof('fsbo', 'https://fsbo.example/1', CLEAR) })
    expect(h.screenAddressForSolicitation).toHaveBeenLastCalledWith(expect.objectContaining({ liveAlreadyClear: true }))

    await fsboRow()
    const forged = { kind: 'fsbo', id: 'https://fsbo.example/1', verdict: CLEAR, checkedAt: Date.now() }
    await sendCmaToLead(SLUG, undefined, { relistProof: forged as never })
    expect(h.screenAddressForSolicitation).toHaveBeenLastCalledWith(expect.objectContaining({ liveAlreadyClear: false }))
  })

  it('a stale verdict, or one for the other kind of prospect, is asked again', async () => {
    const { mintRelistProof, RELIST_PROOF_MAX_AGE_MS } = await import('@/lib/prospecting/send-capability')
    await fsboRow()
    await sendCmaToLead(SLUG, undefined, {
      relistProof: mintRelistProof('fsbo', 'https://fsbo.example/1', CLEAR, Date.now() - RELIST_PROOF_MAX_AGE_MS - 1),
    })
    expect(h.screenAddressForSolicitation).toHaveBeenLastCalledWith(expect.objectContaining({ liveAlreadyClear: false }))
    await fsboRow()
    await sendCmaToLead(SLUG, undefined, { relistProof: mintRelistProof('expired', 'LK', CLEAR) })
    expect(h.screenAddressForSolicitation).toHaveBeenLastCalledWith(expect.objectContaining({ liveAlreadyClear: false }))
  })

  it('a refusal says which kind it was, so the drip can tell listed from unanswerable from a failed send', async () => {
    await fsboRow()
    h.screenAddressForSolicitation.mockResolvedValueOnce({
      ok: false,
      reason: 'sold',
      detail: 'The live MLS check blocks this send. Spark: listing K is Closed (closed 2026-09-12).',
      listingKey: 'K',
      checked: 1,
    })
    const sold = await sendCmaToLead(SLUG)
    expect(sold).toMatchObject({ ok: false, screenRefusal: { code: 'relisted', reason: 'sold', scope: null } })
    expect(h.gmailSend).not.toHaveBeenCalled()

    await fsboRow()
    h.screenAddressForSolicitation.mockResolvedValueOnce({
      ok: false,
      reason: 'unverified',
      detail: 'The live MLS check could not answer',
      listingKey: null,
      checked: 1,
      scope: 'row',
    })
    const unanswered = await sendCmaToLead(SLUG)
    expect(unanswered).toMatchObject({ ok: false, screenRefusal: { code: 'verify-failed', reason: 'unverified', scope: 'row' } })
  })
})
