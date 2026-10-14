/**
 * /buy/[intent] lead form: the visitor's URL utm reaches the CRM person as the
 * channel:, campaign: and ad-content: tags buyer-lead-attribution matches on.
 * Until 2026-10-04 the utm went only to sendEvent's `campaign` field, which is
 * accepted and not stored, so no lead from this form could be attributed.
 *
 * Doubles: CRM writes, tagger, stitch, notifications, tracking, cookies, fetch.
 * Never hits production.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const sendEvent = vi.fn()
vi.mock('@/lib/crm/send-event', () => ({
  sendEvent: (...args: unknown[]) => sendEvent(...args),
}))

const canonicallyTagLead = vi.fn()
vi.mock('@/lib/canonical-lead-tagger', () => ({
  canonicallyTagLead: (...args: unknown[]) => canonicallyTagLead(...args),
}))

const ensureNativeLead = vi.fn()
const enrichNativeLead = vi.fn()
vi.mock('@/lib/data/crm/ensureNativeLead', () => ({
  ensureNativeLead: (...args: unknown[]) => ensureNativeLead(...args),
  enrichNativeLead: (...args: unknown[]) => enrichNativeLead(...args),
}))

vi.mock('@/lib/visitor-backfill', () => ({ stitchFormSubmitIdentity: vi.fn(async () => undefined) }))
vi.mock('@/lib/resend', () => ({ sendContactNotification: vi.fn(async () => undefined) }))

const fireLeadGenerated = vi.fn()
vi.mock('@/lib/lead-tracking', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/lead-tracking')>()
  return {
    ...actual,
    fireLeadGenerated: (...args: unknown[]) => fireLeadGenerated(...args),
  }
})
vi.mock('@/lib/meta-pixel-helpers', () => ({ generateEventId: () => 'evt-1' }))
vi.mock('@/lib/meta-capi-visitor', () => ({
  visitorCapiConsent: async () => ({ allowed: true, consentCookie: 'granted' }),
}))
vi.mock('next/headers', () => ({
  cookies: async () => ({ get: () => undefined }),
  headers: async () => new Headers(),
}))
// The visit's landing link (visitor_sessions). Never read production.
const readVisitCampaign = vi.fn()
vi.mock('@/lib/data/identity/visitCampaign', () => ({
  readVisitCampaign: (...args: unknown[]) => readVisitCampaign(...args),
}))

import { submitLeadLandingForm } from './lead-landing'

const PERSON_ID = 777

function input(lpContext?: Record<string, string>) {
  return {
    audience: 'buyer' as const,
    pageTitle: 'First-time home buyer',
    pagePath: '/buy/first-time-home-buyer',
    leadIntent: 'first-time-home-buyer',
    name: 'Pat Buyer',
    email: 'pat@example.com',
    ...(lpContext ? { lpContext } : {}),
  }
}

beforeEach(() => {
  sendEvent.mockReset().mockResolvedValue({ ok: true, personId: PERSON_ID })
  canonicallyTagLead.mockReset().mockResolvedValue({ ok: true })
  ensureNativeLead.mockReset().mockResolvedValue({ personId: PERSON_ID, created: true })
  enrichNativeLead.mockReset().mockResolvedValue(undefined)
  fireLeadGenerated.mockReset().mockResolvedValue(undefined)
  readVisitCampaign.mockReset().mockResolvedValue(null)
  vi.stubGlobal('fetch', vi.fn(async () => new Response(null, { status: 200 })))
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('submitLeadLandingForm paid attribution', () => {
  it('tags the person with the ad that sent them', async () => {
    const res = await submitLeadLandingForm(
      input({ lp_source: 'facebook', lp_medium: 'paid', lp_campaign: 'Spring Buyers', lp_content: 'act-123' }),
    )
    expect(res).toEqual({ error: null })
    expect(canonicallyTagLead).toHaveBeenCalledWith(
      expect.objectContaining({
        fubPersonId: PERSON_ID,
        audience: 'buyer',
        source: 'buyer-lp',
        extraTags: ['channel:fb-ads', 'campaign:spring-buyers', 'ad-content:act-123'],
      }),
    )
  })

  it('adds no paid tag to a visit that carried no utm', async () => {
    await submitLeadLandingForm(input())
    expect(canonicallyTagLead).toHaveBeenCalledWith(expect.objectContaining({ extraTags: [] }))
  })

  it('names an organic post click for its platform, never as an ad, and keeps the post id', async () => {
    await submitLeadLandingForm(input({ lp_source: 'facebook', lp_medium: 'social', lp_campaign: 'social-post', lp_content: 'act-77' }))
    expect(canonicallyTagLead).toHaveBeenCalledWith(
      expect.objectContaining({ extraTags: ['channel:facebook', 'campaign:social-post', 'ad-content:act-77'] }),
    )
  })

  it('keeps the tags on the native fallback when the CRM push fails', async () => {
    sendEvent.mockResolvedValueOnce({ ok: false, error: 'down' })
    const res = await submitLeadLandingForm(input({ lp_source: 'facebook', lp_medium: 'paid_social', lp_content: 'act-9' }))
    expect(res.error).toBe('down')
    expect(ensureNativeLead).toHaveBeenCalledWith(
      expect.objectContaining({
        source: 'buyer-lp',
        tags: ['audience:buyer', 'source:buyer-lp', 'fub-fallback', 'channel:fb-ads', 'ad-content:act-9'],
      }),
    )
    expect(canonicallyTagLead).not.toHaveBeenCalled()
  })

  it('puts gclid and fbclid from lpContext on the CRM source URL', async () => {
    await submitLeadLandingForm(
      input({ lp_source: 'google', gclid: 'g-1', fbclid: 'f-1' }),
    )
    const sourceUrl = sendEvent.mock.calls[0]?.[0].sourceUrl as string
    expect(sourceUrl).toContain('gclid=g-1')
    expect(sourceUrl).toContain('fbclid=f-1')
    expect(sourceUrl).toContain('utm_source=google')
  })

  it('accepts form_id, lead_type, and lp_variant overrides without value on generate_lead', async () => {
    await submitLeadLandingForm({
      ...input(),
      formId: 'buyer_leverage_lp',
      leadType: 'buyer_alerts',
      lpVariant: 'buy-leverage',
    })
    expect(fireLeadGenerated).toHaveBeenCalledWith(
      expect.objectContaining({
        lead_type: 'buyer_alerts',
        form_id: 'buyer_leverage_lp',
        lp_variant: 'buy-leverage',
      }),
    )
    const payload = fireLeadGenerated.mock.calls[0]?.[0] as Record<string, unknown>
    expect(JSON.stringify(payload)).not.toMatch(/"value"/)
    expect(JSON.stringify(payload)).not.toMatch(/currency/)
  })

  it('sends Meta CAPI Lead with lead_type and content_name, never value or currency', async () => {
    await submitLeadLandingForm({
      ...input(),
      formId: 'buyer_leverage_lp',
      leadType: 'buyer_alerts',
      lpVariant: 'buy-leverage',
    })
    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>
    const capiCall = fetchMock.mock.calls.find((call) => String(call[0]).includes('/api/meta-capi'))
    expect(capiCall).toBeTruthy()
    const body = JSON.parse(String((capiCall?.[1] as { body?: string })?.body)) as {
      eventName: string
      customData: Record<string, unknown>
    }
    expect(body.eventName).toBe('Lead')
    expect(body.customData).toMatchObject({
      content_name: 'buyer_leverage_lp',
      lead_type: 'buyer_alerts',
    })
    expect(body.customData).not.toHaveProperty('value')
    expect(body.customData).not.toHaveProperty('currency')
  })
})

// Matt 2026-10-09, "Visit they signed up in": a buyer who clicked around before
// submitting is credited to the link that started that visit, read on the
// server. Until 2026-10-14 the page carried it in a tab-lifetime sessionStorage
// copy, which credited a submit days later to the old ad.
describe('submitLeadLandingForm visit attribution', () => {
  const SESSION_ID = '550e8400-e29b-41d4-a716-446655440000'

  it('a page with no utm is credited to the visit’s landing link', async () => {
    readVisitCampaign.mockResolvedValue({ source: 'facebook', medium: 'paid_social', campaign: 'spring-buyers', content: 'act-9' })

    const res = await submitLeadLandingForm({ ...input(), sessionId: SESSION_ID })

    expect(res).toEqual({ error: null })
    expect(readVisitCampaign).toHaveBeenCalledWith({ sessionId: SESSION_ID, rrVid: null })
    expect(canonicallyTagLead).toHaveBeenCalledWith(
      expect.objectContaining({ extraTags: ['channel:fb-ads', 'campaign:spring-buyers', 'ad-content:act-9'] }),
    )
  })

  it('the page’s own utm wins and the visit is never read', async () => {
    readVisitCampaign.mockResolvedValue({ source: 'facebook', medium: 'paid_social', campaign: null, content: null })

    await submitLeadLandingForm({ ...input({ lp_source: 'google', lp_medium: 'cpc' }), sessionId: SESSION_ID })

    expect(readVisitCampaign).not.toHaveBeenCalled()
    expect(canonicallyTagLead).toHaveBeenCalledWith(expect.objectContaining({ extraTags: ['channel:google-ads'] }))
  })

  it('no link on the page or the visit: no paid tag', async () => {
    await submitLeadLandingForm({ ...input(), sessionId: SESSION_ID })
    expect(canonicallyTagLead).toHaveBeenCalledWith(expect.objectContaining({ extraTags: [] }))
  })
})
