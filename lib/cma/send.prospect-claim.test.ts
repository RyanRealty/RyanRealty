import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * The 2026-09-28 defect, pinned. "Send now" emailed six expired owners and left
 * every one of their prospect rows reading "never emailed". sendCmaToLead now
 * takes the owner's email slot the way the weekday drip does:
 *
 *   claim (before the PDF) -> send -> stamp the provider id -> delivered stamp
 *   -> finalize, and release the claim when nothing left.
 *
 * Only the transports and the CMA/CRM reads are mocked (same style as
 * send.test.ts). The prospect layer is REAL: the resolver, the lease and the
 * claim wrappers run against a scripted service client, so the RPC names and
 * arguments asserted here are the contract with the SQL in
 * supabase/migrations/20260722010100_prospect_email_outreach.sql.
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
  screenAddressForSolicitation: vi.fn(async () => ({ ok: true as const, checked: 1, detail: 'clear' })),
  /** Every observable step, in the order it happened. */
  order: [] as string[],
  state: {
    row: {} as Record<string, unknown>,
  },
  broker: {
    slug: 'matthew-ryan',
    display_name: 'Matt Ryan',
    title: 'Owner & Principal Broker',
    email: 'matt@ryan-realty.com',
    twilio_number: '+15417033095',
    photo_url: null,
  },
  db: {
    cma: { id: 'cma-uuid-1', subject_listing_key: 'LK-2026-0001' } as
      | { id: string; subject_listing_key: string | null }
      | null,
    expiredByCmaId: null as string | null,
    fsboByCmaId: null as string | null,
    expiredByKey: null as string | null,
    failTable: null as string | null,
    reads: [] as string[],
    rpc: vi.fn(),
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
  getCmaAdminRowBySlug: vi.fn(async () => h.state.row),
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
  renderCmaPdfBuffer: vi.fn(async () => {
    h.order.push('pdf')
    return { buffer: Buffer.from('%PDF-1.7') }
  }),
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

// The prospect layer runs for real against this scripted client.
vi.mock('@/lib/supabase/service', () => ({
  createServiceClient: () => ({
    from(table: string) {
      if (!['cmas', 'expired_listings', 'fsbo_listings'].includes(table)) {
        throw new Error(`unscripted table in test: ${table}`)
      }
      const filters: Record<string, unknown> = {}
      const q = {
        select() {
          return q
        },
        eq(col: string, v: unknown) {
          filters[col] = v
          return q
        },
        limit() {
          return q
        },
        maybeSingle() {
          h.db.reads.push(`${table}:${Object.keys(filters).join(',')}`)
          if (h.db.failTable === table) {
            return Promise.resolve({ data: null, error: { message: 'connection reset' } })
          }
          if (table === 'cmas') return Promise.resolve({ data: h.db.cma, error: null })
          if (table === 'expired_listings' && 'cma_id' in filters) {
            return Promise.resolve({ data: h.db.expiredByCmaId ? { listing_key: h.db.expiredByCmaId } : null, error: null })
          }
          if (table === 'fsbo_listings' && 'cma_id' in filters) {
            return Promise.resolve({ data: h.db.fsboByCmaId ? { fsbo_url: h.db.fsboByCmaId } : null, error: null })
          }
          if (table === 'expired_listings' && 'listing_key' in filters) {
            return Promise.resolve({ data: h.db.expiredByKey ? { listing_key: h.db.expiredByKey } : null, error: null })
          }
          throw new Error(`unscripted read: ${table} ${JSON.stringify(filters)}`)
        },
      }
      return q
    },
    rpc(name: string, args: unknown) {
      h.order.push(`rpc:${name}`)
      return h.db.rpc(name, args)
    },
  }),
}))

import { sendCmaToLead } from '@/lib/cma/send'

const SLUG = 'cma-1109-yapoah-crater-sisters'
const LK = 'LK-2026-0001'
const OWNER_EMAIL = 'ashley.kuczek@gmail.com'

const OWNER_ROW = {
  id: 'cma-uuid-1',
  status: 'finalized',
  client_email: OWNER_EMAIL,
  client_name: 'Ashley Kuczek',
  broker_slug: 'matthew-ryan',
  subject_address: '1109 Yapoah Crater, Sisters, OR 97759',
  subject_city: 'Sisters',
  subject_listing_key: LK,
  request_source: 'expired-listing-cron',
  doc_type: 'cma',
  value_low: 500000,
  value_high: 540000,
  recommended_list: 525000,
  build_summary: null,
}

const rpcNames = () => h.db.rpc.mock.calls.map((c) => c[0] as string)
const at = (step: string) => h.order.indexOf(step)

/** Scripted claim answer; every other RPC succeeds. */
function claimAnswers(answer: string) {
  h.db.rpc.mockImplementation(async (name: string) => ({
    data: name === 'prospect_email_send_claim' ? answer : null,
    error: null,
  }))
}

let consoleError: ReturnType<typeof vi.spyOn>
let consoleWarn: ReturnType<typeof vi.spyOn>

beforeEach(() => {
  vi.stubEnv('GOOGLE_SERVICE_ACCOUNT_CLIENT_EMAIL', 'viewer@ryanrealty.iam.gserviceaccount.com')
  vi.stubEnv('GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY', 'test-key')
  h.order.length = 0
  h.state.row = { ...OWNER_ROW }
  h.db.cma = { id: 'cma-uuid-1', subject_listing_key: LK }
  h.db.expiredByCmaId = LK
  h.db.fsboByCmaId = null
  h.db.expiredByKey = null
  h.db.failTable = null
  h.db.reads.length = 0
  h.authorize.mockResolvedValue({ access_token: 'ya29.test' })
  h.gmailSend.mockImplementation(async () => {
    h.order.push('gmail')
    return { data: { id: 'msg-1', threadId: 'thr-1' } }
  })
  h.sendEmail.mockImplementation(async () => {
    h.order.push('resend')
    return { id: 'resend-1' }
  })
  h.updateCmaRowFieldsBySlug.mockImplementation(async () => {
    h.order.push('cmas-delivered')
    return { ok: true }
  })
  h.logCmaTimelineEvent.mockResolvedValue(undefined)
  h.recordEmailEvent.mockImplementation(async () => {
    h.order.push('email_events')
    return { ok: true }
  })
  h.ensureNativeLead.mockResolvedValue({ personId: 88, created: true })
  h.stampCmaPersonId.mockResolvedValue({ ok: true })
  h.screenAddressForSolicitation.mockResolvedValue({ ok: true, checked: 1, detail: 'clear' })
  h.db.rpc.mockReset()
  claimAnswers('claimed')
  consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
  consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {})
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllEnvs()
  vi.clearAllMocks()
  consoleError.mockRestore()
  consoleWarn.mockRestore()
})

describe('sendCmaToLead: the owner is claimed, stamped and finalized', () => {
  it('claims cma-send:<slug> before the PDF, stamps the Gmail id after the send, finalizes after the delivered stamp', async () => {
    const res = await sendCmaToLead(SLUG)

    expect(res).toMatchObject({ ok: true, transport: 'gmail', gmailMessageId: 'msg-1', personId: 42 })
    expect(h.db.rpc).toHaveBeenCalledTimes(3)
    expect(h.db.rpc).toHaveBeenNthCalledWith(1, 'prospect_email_send_claim', {
      p_kind: 'expired',
      p_id: LK,
      p_idem: `cma-send:${SLUG}`,
    })
    expect(h.db.rpc).toHaveBeenNthCalledWith(2, 'prospect_email_send_stamp', {
      p_kind: 'expired',
      p_id: LK,
      p_message_id: 'msg-1',
    })
    expect(h.db.rpc).toHaveBeenNthCalledWith(3, 'prospect_email_send_finalize', {
      p_kind: 'expired',
      p_id: LK,
      p_idem: `cma-send:${SLUG}`,
      p_message_id: 'msg-1',
      p_person_id: 42,
    })

    // The order that makes it safe: claim, then render, then send, then stamp at
    // once, then the rest of the bookkeeping, and finalize last.
    expect(at('rpc:prospect_email_send_claim')).toBeGreaterThan(-1)
    expect(at('rpc:prospect_email_send_claim')).toBeLessThan(at('pdf'))
    expect(at('pdf')).toBeLessThan(at('gmail'))
    expect(at('gmail')).toBeLessThan(at('rpc:prospect_email_send_stamp'))
    expect(at('rpc:prospect_email_send_stamp')).toBeLessThan(at('email_events'))
    expect(at('rpc:prospect_email_send_stamp')).toBeLessThan(at('cmas-delivered'))
    expect(at('cmas-delivered')).toBeLessThan(at('rpc:prospect_email_send_finalize'))
    expect(h.order[h.order.length - 1]).toBe('rpc:prospect_email_send_finalize')
    expect(rpcNames()).not.toContain('prospect_email_send_release')
  })

  it('still marks the CMA delivered and logs the send, exactly as before', async () => {
    await sendCmaToLead(SLUG)
    expect(h.updateCmaRowFieldsBySlug).toHaveBeenCalledWith(SLUG, expect.objectContaining({ status: 'delivered' }))
    expect(h.recordEmailEvent).toHaveBeenCalledWith(expect.objectContaining({ event: 'sent', emailKey: `cma:${SLUG}` }))
    expect(h.logCmaTimelineEvent).toHaveBeenCalled()
  })

  it('stamps the Resend id when Gmail refuses and Resend carries the send', async () => {
    h.gmailSend.mockImplementation(async () => {
      h.order.push('gmail')
      throw Object.assign(new Error('Invalid To header'), { response: { status: 400 } })
    })
    const res = await sendCmaToLead(SLUG)

    expect(res).toMatchObject({ ok: true, transport: 'resend', resendId: 'resend-1' })
    expect(h.db.rpc).toHaveBeenCalledWith('prospect_email_send_stamp', { p_kind: 'expired', p_id: LK, p_message_id: 'resend-1' })
    expect(h.db.rpc).toHaveBeenCalledWith('prospect_email_send_finalize', {
      p_kind: 'expired',
      p_id: LK,
      p_idem: `cma-send:${SLUG}`,
      p_message_id: 'resend-1',
      p_person_id: 42,
    })
    expect(rpcNames()).not.toContain('prospect_email_send_release')
  })

  it('claims an FSBO owner by fsbo_url', async () => {
    h.db.expiredByCmaId = null
    h.db.fsboByCmaId = 'https://fsbo.example.com/listing/7'
    h.state.row = { ...OWNER_ROW, request_source: 'fsbo-cron' }
    const res = await sendCmaToLead(SLUG)

    expect(res.ok).toBe(true)
    expect(h.db.rpc).toHaveBeenNthCalledWith(1, 'prospect_email_send_claim', {
      p_kind: 'fsbo',
      p_id: 'https://fsbo.example.com/listing/7',
      p_idem: `cma-send:${SLUG}`,
    })
    expect(h.db.rpc).toHaveBeenCalledWith('prospect_email_send_finalize', expect.objectContaining({ p_kind: 'fsbo' }))
  })

  it('an owner who asked for a valuation gets it even after our cold email: no claim, the send goes out', async () => {
    // Linked to the expired owner's row, but the owner requested this one from
    // the seller page. The owner row is already stamped from the cold email.
    h.state.row = { ...OWNER_ROW, request_source: 'seller-lp' }
    claimAnswers('already_sent')
    const res = await sendCmaToLead(SLUG)

    expect(res.ok).toBe(true)
    expect(rpcNames()).toEqual([])
    expect(h.gmailSend).toHaveBeenCalledTimes(1)
  })

  it('an orphan second CMA on the same house resolves through subject_listing_key and claims the owner row', async () => {
    // Not linked by cma_id (the prospect points at a different CMA), same MLS key.
    h.db.expiredByCmaId = null
    h.db.fsboByCmaId = null
    h.db.expiredByKey = LK
    const res = await sendCmaToLead(`${SLUG}--v2`)

    expect(res.ok).toBe(true)
    expect(h.db.reads).toContain('expired_listings:listing_key')
    expect(h.db.rpc).toHaveBeenNthCalledWith(1, 'prospect_email_send_claim', {
      p_kind: 'expired',
      p_id: LK,
      p_idem: `cma-send:${SLUG}--v2`,
    })
    expect(rpcNames()).toEqual([
      'prospect_email_send_claim',
      'prospect_email_send_stamp',
      'prospect_email_send_finalize',
    ])
  })

  it('an ordinary CMA with no prospect row sends as before and touches no prospect RPC', async () => {
    h.db.expiredByCmaId = null
    h.db.expiredByKey = null
    const res = await sendCmaToLead(SLUG)

    expect(res).toMatchObject({ ok: true, transport: 'gmail' })
    expect(h.db.rpc).not.toHaveBeenCalled()
  })
})

describe('sendCmaToLead: a claim that is not clean refuses, and nothing leaves', () => {
  function expectNothingSent() {
    expect(h.order).not.toContain('pdf')
    expect(h.gmailSend).not.toHaveBeenCalled()
    expect(h.sendEmail).not.toHaveBeenCalled()
    expect(h.updateCmaRowFieldsBySlug).not.toHaveBeenCalled()
    expect(h.recordEmailEvent).not.toHaveBeenCalled()
    expect(h.logCmaTimelineEvent).not.toHaveBeenCalled()
    expect(rpcNames().filter((n) => n !== 'prospect_email_send_claim')).toEqual([])
  }

  it.each([
    ['already_sent', /already emailed for this home[\s\S]*use your own inbox/i],
    ['replay', /already went to the owner[\s\S]*use your own inbox/i],
    ['claimed_elsewhere', /another send to this owner is in progress/i],
    ['not_found', /prospect record could not be found/i],
  ])('refuses on %s and names the reason', async (answer, message) => {
    claimAnswers(answer)
    const res = await sendCmaToLead(SLUG)

    expect(res.ok).toBe(false)
    expect(res.error).toMatch(/^Not sent\./)
    expect(res.error).toMatch(message)
    expectNothingSent()
  })

  it('refuses when the claim RPC is not deployed yet (fails closed, no raw PGRST202)', async () => {
    h.db.rpc.mockImplementation(async () => ({
      data: null,
      error: { code: 'PGRST202', message: 'Could not find the function public.prospect_email_send_claim' },
    }))
    const res = await sendCmaToLead(SLUG)

    expect(res.ok).toBe(false)
    expect(res.error).toMatch(/not set up on this database yet/i)
    expect(res.error).toMatch(/20260722010100/)
    expectNothingSent()
  })

  it('refuses when the claim call fails for any other reason', async () => {
    h.db.rpc.mockImplementation(async () => ({ data: null, error: { code: '57014', message: 'canceling statement' } }))
    const res = await sendCmaToLead(SLUG)

    expect(res.ok).toBe(false)
    expect(res.error).toMatch(/could not reserve this owner's email slot/i)
    expectNothingSent()
  })

  it('refuses when the owner lookup fails: not a quiet "no prospect row"', async () => {
    h.db.failTable = 'expired_listings'
    const res = await sendCmaToLead(SLUG)

    expect(res.ok).toBe(false)
    expect(res.error).toMatch(/could not check whether this owner was already emailed/i)
    expect(h.db.rpc).not.toHaveBeenCalled()
    expect(h.order).not.toContain('pdf')
    expect(h.gmailSend).not.toHaveBeenCalled()
    expect(h.sendEmail).not.toHaveBeenCalled()
  })
})

describe('sendCmaToLead: recipients and callers that must not claim', () => {
  it.each(['matt@ryan-realty.com', 'marketing+dana@ryan-realty.com', 'Marketing+Blake@Ryan-Realty.com'])(
    'the internal recipient %s sends without a claim, a stamp or a finalize',
    async (email) => {
      const { getCmaAdminRowBySlug } = await import('@/lib/data')
      vi.mocked(getCmaAdminRowBySlug).mockResolvedValueOnce({ ...OWNER_ROW, client_email: email })
      const res = await sendCmaToLead(SLUG)

      expect(res).toMatchObject({ ok: true, transport: 'gmail' })
      expect(h.gmailSend).toHaveBeenCalledTimes(1)
      // The real owner's row is never read, let alone marked.
      expect(h.db.reads).toEqual([])
      expect(h.db.rpc).not.toHaveBeenCalled()
    },
  )

  it('a caller that already holds the claim gets no second claim, and the rail leaves the row alone', async () => {
    const res = await sendCmaToLead(SLUG, undefined, { callerHoldsProspectClaim: true })

    expect(res).toMatchObject({ ok: true, transport: 'gmail', gmailMessageId: 'msg-1' })
    expect(h.db.reads).toEqual([])
    expect(h.db.rpc).not.toHaveBeenCalled()
  })

  it('a caller that holds the claim also gets no release when the send fails before anything leaves', async () => {
    const pdf = await import('@/lib/cma-pdf')
    vi.mocked(pdf.renderCmaPdfBuffer).mockRejectedValueOnce(new Error('chromium crashed'))
    const res = await sendCmaToLead(SLUG, undefined, { callerHoldsProspectClaim: true })

    expect(res.ok).toBe(false)
    expect(h.db.rpc).not.toHaveBeenCalled()
  })
})

describe('sendCmaToLead: releasing, and not releasing', () => {
  const releaseCall = ['prospect_email_send_release', { p_kind: 'expired', p_id: LK }] as const

  it('releases the claim when the PDF fails to render', async () => {
    const pdf = await import('@/lib/cma-pdf')
    vi.mocked(pdf.renderCmaPdfBuffer).mockRejectedValueOnce(new Error('chromium crashed'))
    const res = await sendCmaToLead(SLUG)

    expect(res).toEqual({ ok: false, error: 'PDF render failed: chromium crashed' })
    expect(rpcNames()).toEqual(['prospect_email_send_claim', 'prospect_email_send_release'])
    expect(h.db.rpc).toHaveBeenLastCalledWith(...releaseCall)
    expect(h.gmailSend).not.toHaveBeenCalled()
  })

  it('releases the claim when the CMA document is missing at render time', async () => {
    const pdf = await import('@/lib/cma-pdf')
    vi.mocked(pdf.renderCmaPdfBuffer).mockRejectedValueOnce(new pdf.CmaNotFoundError('gone'))
    const res = await sendCmaToLead(SLUG)

    expect(res).toEqual({ ok: false, error: 'CMA document not found for PDF render' })
    expect(rpcNames()).toEqual(['prospect_email_send_claim', 'prospect_email_send_release'])
  })

  it('releases the claim when the PDF is over the attachment cap', async () => {
    const pdf = await import('@/lib/cma-pdf')
    vi.mocked(pdf.renderCmaPdfBuffer).mockResolvedValueOnce({
      buffer: { byteLength: 26 * 1024 * 1024 } as unknown as Buffer,
    } as never)
    const res = await sendCmaToLead(SLUG)

    expect(res).toEqual({ ok: false, error: 'The rendered PDF exceeds the 25 MB attachment cap.' })
    expect(rpcNames()).toEqual(['prospect_email_send_claim', 'prospect_email_send_release'])
    expect(h.gmailSend).not.toHaveBeenCalled()
  })

  it('releases the claim when both rails fail', async () => {
    h.gmailSend.mockImplementation(async () => {
      h.order.push('gmail')
      throw Object.assign(new Error('Invalid To header'), { response: { status: 400 } })
    })
    h.sendEmail.mockImplementation(async () => {
      h.order.push('resend')
      return { error: 'resend is down' }
    })
    const res = await sendCmaToLead(SLUG)

    expect(res.ok).toBe(false)
    expect(res.error).toMatch(/failed on both rails/)
    expect(h.sendEmail).toHaveBeenCalledTimes(1)
    expect(rpcNames()).toEqual(['prospect_email_send_claim', 'prospect_email_send_release'])
    expect(h.db.rpc).toHaveBeenLastCalledWith(...releaseCall)
    expect(h.updateCmaRowFieldsBySlug).not.toHaveBeenCalled()
  })

  it('releases the claim, and sends nothing, when an opt-out lands while the PDF renders', async () => {
    const { isSuppressed } = await import('@/lib/crm/suppressions')
    // First look (before the PDF): clear. Second look (right before the wire): opted out.
    vi.mocked(isSuppressed)
      .mockResolvedValueOnce({ suppressed: false, reasons: [] } as never)
      .mockResolvedValueOnce({ suppressed: true, reasons: ['unsubscribed'] } as never)
    const res = await sendCmaToLead(SLUG)

    expect(res).toEqual({ ok: false, error: 'This contact has opted out of email (unsubscribed).' })
    expect(h.order).toContain('pdf')
    expect(h.gmailSend).not.toHaveBeenCalled()
    expect(h.sendEmail).not.toHaveBeenCalled()
    expect(rpcNames()).toEqual(['prospect_email_send_claim', 'prospect_email_send_release'])
  })

  it('releases the claim when something unexpected throws before the send', async () => {
    const pdf = await import('@/lib/cma-pdf')
    vi.mocked(pdf.renderCmaPdfBuffer).mockResolvedValueOnce({ buffer: null } as never)

    await expect(sendCmaToLead(SLUG)).rejects.toThrow()
    expect(rpcNames()).toEqual(['prospect_email_send_claim', 'prospect_email_send_release'])
    expect(h.gmailSend).not.toHaveBeenCalled()
  })

  it('does NOT release when a rail throws mid-call: the message may already be out', async () => {
    // Gmail refuses for certain, then the Resend wrapper blows up. Nobody can say
    // whether that request left, so the claim stays and the error reaches the caller.
    h.gmailSend.mockImplementation(async () => {
      h.order.push('gmail')
      throw Object.assign(new Error('Invalid To header'), { response: { status: 400 } })
    })
    h.sendEmail.mockRejectedValue(new Error('socket hang up'))

    await expect(sendCmaToLead(SLUG)).rejects.toThrow('socket hang up')
    expect(rpcNames()).toEqual(['prospect_email_send_claim'])
    expect(h.updateCmaRowFieldsBySlug).not.toHaveBeenCalled()
  })

  it('does NOT release when Gmail took the send and never answered', async () => {
    h.gmailSend.mockImplementation(async () => {
      h.order.push('gmail')
      throw Object.assign(new Error('The operation was aborted.'), { name: 'AbortError' })
    })
    const res = await sendCmaToLead(SLUG)

    expect(res.ok).toBe(false)
    expect(res.error).toMatch(/may have gone out.*check Sent/i)
    expect(h.sendEmail).not.toHaveBeenCalled()
    // The email may be out: the claim stays, nothing is stamped or finalized.
    expect(rpcNames()).toEqual(['prospect_email_send_claim'])
    expect(h.updateCmaRowFieldsBySlug).not.toHaveBeenCalled()
  })
})

describe('sendCmaToLead: bookkeeping trouble after the email left', () => {
  it('a finalize that keeps failing never turns the completed send into an error', async () => {
    h.db.rpc.mockImplementation(async (name: string) => {
      if (name === 'prospect_email_send_claim') return { data: 'claimed', error: null }
      if (name === 'prospect_email_send_finalize') return { data: null, error: { message: 'db down' } }
      return { data: null, error: null }
    })
    const res = await sendCmaToLead(SLUG)

    expect(res).toMatchObject({ ok: true, transport: 'gmail', gmailMessageId: 'msg-1' })
    expect(rpcNames().filter((n) => n === 'prospect_email_send_finalize')).toHaveLength(3)
    expect(rpcNames()).not.toContain('prospect_email_send_release')
    expect(consoleError).toHaveBeenCalledWith(
      expect.stringContaining('SENT but finalize FAILED'),
      expect.objectContaining({ kind: 'expired', id: LK, messageId: 'msg-1' }),
    )
    // The message id was stamped before finalize was ever tried.
    expect(at('rpc:prospect_email_send_stamp')).toBeLessThan(at('rpc:prospect_email_send_finalize'))
  })

  it('a failed message-id stamp is not an error either, and finalize still runs', async () => {
    h.db.rpc.mockImplementation(async (name: string) => {
      if (name === 'prospect_email_send_claim') return { data: 'claimed', error: null }
      if (name === 'prospect_email_send_stamp') return { data: null, error: { message: 'rpc down' } }
      return { data: null, error: null }
    })
    const res = await sendCmaToLead(SLUG)

    expect(res.ok).toBe(true)
    expect(rpcNames()).toContain('prospect_email_send_finalize')
    expect(consoleError).toHaveBeenCalledWith(expect.stringContaining('prospect_email_send_stamp failed'), 'rpc down')
  })

  it('finalizes even when the delivered stamp throws after the email left, and the error still propagates', async () => {
    h.updateCmaRowFieldsBySlug.mockRejectedValueOnce(new Error('db down'))

    await expect(sendCmaToLead(SLUG)).rejects.toThrow('db down')
    expect(rpcNames()).toEqual([
      'prospect_email_send_claim',
      'prospect_email_send_stamp',
      'prospect_email_send_finalize',
    ])
    expect(rpcNames()).not.toContain('prospect_email_send_release')
  })
})
