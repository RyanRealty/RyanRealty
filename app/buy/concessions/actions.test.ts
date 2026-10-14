/**
 * /buy/concessions ask: the lead carries the channel:, campaign: and ad-content:
 * tags of the page's utm, else of the link that started the visit the submit
 * happens in (Matt 2026-10-09, "Visit they signed up in"). Until 2026-10-14 the
 * page carried a clicked-around visitor's utm in a tab-lifetime sessionStorage
 * copy, which credited a submit days later to the old ad.
 *
 * Doubles: CRM writes, tagger, stitch, notifications, tracking, cookies, fetch,
 * the visit read. Never hits production.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const h = vi.hoisted(() => ({
  sendEvent: vi.fn(),
  canonicallyTagLead: vi.fn(),
  ensureNativeLead: vi.fn(),
  readLiveVisit: vi.fn(),
  fireLeadGenerated: vi.fn(),
  afterTasks: [] as Array<() => Promise<void>>,
}))

vi.mock('next/server', () => ({ after: (fn: () => Promise<void>) => h.afterTasks.push(fn) }))
vi.mock('next/headers', () => ({
  cookies: async () => ({ get: () => undefined }),
  headers: async () => new Headers(),
}))
vi.mock('@/lib/crm/send-event', () => ({ sendEvent: (...a: unknown[]) => h.sendEvent(...a) }))
vi.mock('@/lib/canonical-lead-tagger', () => ({ canonicallyTagLead: (...a: unknown[]) => h.canonicallyTagLead(...a) }))
vi.mock('@/lib/data/crm/ensureNativeLead', () => ({ ensureNativeLead: (...a: unknown[]) => h.ensureNativeLead(...a) }))
vi.mock('@/lib/data/identity/visitCampaign', () => ({ readLiveVisit: (...a: unknown[]) => h.readLiveVisit(...a) }))
vi.mock('@/lib/lead-tracking', () => ({ fireLeadGenerated: (...a: unknown[]) => h.fireLeadGenerated(...a) }))
vi.mock('@/lib/crm/enroll', () => ({ autoEnrollByPersonId: vi.fn(async () => undefined) }))
vi.mock('@/lib/visitor-backfill', () => ({ stitchFormSubmitIdentity: vi.fn(async () => undefined) }))
vi.mock('@/lib/resend', () => ({ sendContactNotification: vi.fn(async () => undefined) }))
vi.mock('@/lib/meta-pixel-helpers', () => ({ generateEventId: () => 'evt-1' }))
vi.mock('@/lib/meta-capi-visitor', () => ({
  visitorCapiConsent: async () => ({ allowed: false, consentCookie: null, secGpc: null }),
}))

import { submitConcessionsLead } from './actions'

const PERSON_ID = 999
const SESSION_ID = '550e8400-e29b-41d4-a716-446655440000'

function form(fields: Record<string, string> = {}): FormData {
  const fd = new FormData()
  fd.set('name', 'Pat Buyer')
  fd.set('email', 'pat@example.com')
  fd.set('sessionId', SESSION_ID)
  for (const [k, v] of Object.entries(fields)) fd.set(k, v)
  return fd
}

async function submit(fields?: Record<string, string>) {
  const res = await submitConcessionsLead(form(fields))
  for (const task of h.afterTasks.splice(0)) await task()
  return res
}

const tagCall = () => h.canonicallyTagLead.mock.calls[0][0] as { extraTags: string[]; originContext: Record<string, unknown> }

beforeEach(() => {
  h.sendEvent.mockReset().mockResolvedValue({ ok: true, status: 200, personId: PERSON_ID, suspect: false })
  h.canonicallyTagLead.mockReset().mockResolvedValue(undefined)
  h.ensureNativeLead.mockReset().mockResolvedValue({ personId: PERSON_ID, created: true })
  h.readLiveVisit.mockReset().mockResolvedValue(null)
  h.fireLeadGenerated.mockReset().mockResolvedValue(undefined)
  h.afterTasks.length = 0
  vi.stubGlobal('fetch', vi.fn(async () => new Response(null, { status: 200 })))
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('submitConcessionsLead attribution', () => {
  it('with no live visit, the page’s utm tags the lead', async () => {
    const res = await submit({ lp_source: 'facebook', lp_medium: 'paid_social', lp_campaign: 'Concessions', lp_content: 'act-1', cr: 'Rate Buydown' })

    expect(res).toMatchObject({ success: true })
    expect(h.readLiveVisit).toHaveBeenCalledWith({ sessionId: SESSION_ID, rrVid: null })
    expect(tagCall().extraTags).toEqual(['channel:fb-ads', 'campaign:concessions', 'ad-content:act-1', 'creative:rate-buydown'])
    expect(tagCall().originContext).toMatchObject({ utmSource: 'facebook', utmMedium: 'paid_social', utmCampaign: 'Concessions', utmContent: 'act-1' })
  })

  it('a page with no utm is credited to the visit’s landing link', async () => {
    h.readLiveVisit.mockResolvedValue({ campaign: { source: 'google', medium: 'cpc', campaign: 'bend-buyers', content: null } })

    await submit()

    expect(tagCall().extraTags).toEqual(['channel:google-ads', 'campaign:bend-buyers'])
    expect(tagCall().originContext).toMatchObject({ utmSource: 'google', utmMedium: 'cpc', utmCampaign: 'bend-buyers' })
  })

  it('a live visit with no campaign gives no paid tag; the note keeps the page’s utm', async () => {
    h.readLiveVisit.mockResolvedValue({ campaign: null })

    await submit({ lp_source: 'cma', lp_medium: 'document' })

    expect(tagCall().extraTags).toEqual([])
    expect(tagCall().originContext).toMatchObject({ utmSource: 'cma', utmMedium: 'document' })
  })

  it('no link on the page or the visit: no paid tag', async () => {
    await submit()
    expect(tagCall().extraTags).toEqual([])
    expect(tagCall().originContext.utmSource).toBeUndefined()
  })

  it('a filled honeypot reads no visit', async () => {
    await submitConcessionsLead(form({ company: 'Acme Bot Farm' }))
    expect(h.readLiveVisit).not.toHaveBeenCalled()
  })

  it('the native fallback carries the visit’s tags when the CRM push fails', async () => {
    h.sendEvent.mockResolvedValueOnce({ ok: false, error: 'down' })
    h.readLiveVisit.mockResolvedValue({ campaign: { source: 'facebook', medium: 'paid_social', campaign: null, content: null } })

    await submit()

    expect(h.ensureNativeLead).toHaveBeenCalledWith(expect.objectContaining({ tags: expect.arrayContaining(['channel:fb-ads']) }))
  })
})
