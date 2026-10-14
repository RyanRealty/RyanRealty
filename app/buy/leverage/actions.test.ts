/**
 * /buy/leverage lead forms route through submitLeadLandingForm:
 * form_id buyer_leverage_lp, lead_type buyer_alerts (one constant),
 * lp_variant buy-leverage, no SMS, no value/currency.
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

const fireLeadGenerated = vi.fn()
vi.mock('@/lib/lead-tracking', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/lead-tracking')>()
  return {
    ...actual,
    fireLeadGenerated: (...args: unknown[]) => fireLeadGenerated(...args),
  }
})

vi.mock('@/lib/visitor-backfill', () => ({ stitchFormSubmitIdentity: vi.fn(async () => undefined) }))
vi.mock('@/lib/resend', () => ({ sendContactNotification: vi.fn(async () => undefined) }))
vi.mock('@/lib/meta-pixel-helpers', () => ({ generateEventId: () => 'evt-1' }))
vi.mock('@/lib/meta-capi-visitor', () => ({
  visitorCapiConsent: async () => ({ allowed: false, consentCookie: null, secGpc: null }),
}))
vi.mock('next/headers', () => ({
  cookies: async () => ({ get: () => undefined }),
  headers: async () => new Headers(),
}))
// The visit's landing link (visitor_sessions). Never read production.
vi.mock('@/lib/data/identity/visitCampaign', () => ({ readVisitCampaign: vi.fn(async () => null) }))

import { submitLeverageLead } from './actions'
import { LEVERAGE_FORM_ID, LEVERAGE_LEAD_TYPE, LEVERAGE_LP_VARIANT } from './_v3/leverage-constants'

const PERSON_ID = 888

function input(over: Partial<Parameters<typeof submitLeverageLead>[0]> = {}) {
  return {
    kind: 'report' as const,
    name: 'Pat Buyer',
    email: 'pat@example.com',
    ...over,
  }
}

beforeEach(() => {
  sendEvent.mockReset().mockResolvedValue({ ok: true, personId: PERSON_ID, status: 200, suspect: false })
  canonicallyTagLead.mockReset().mockResolvedValue({ ok: true })
  ensureNativeLead.mockReset().mockResolvedValue({ personId: PERSON_ID, created: true })
  enrichNativeLead.mockReset().mockResolvedValue(undefined)
  fireLeadGenerated.mockReset().mockResolvedValue(undefined)
  vi.stubGlobal('fetch', vi.fn(async () => new Response(null, { status: 200 })))
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('submitLeverageLead', () => {
  it('tags the person with the ad that sent them', async () => {
    const res = await submitLeverageLead(
      input({
        lpContext: {
          lp_source: 'facebook',
          lp_medium: 'paid',
          lp_campaign: 'Spring Buyers',
          lp_content: 'act-123',
        },
      }),
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
    expect(sendEvent.mock.calls[0]?.[0].sourceUrl).toContain('utm_source=facebook')
  })

  it('puts gclid and fbclid on the CRM source URL', async () => {
    await submitLeverageLead(
      input({
        lpContext: { lp_source: 'google', gclid: 'g-1', fbclid: 'f-1' },
      }),
    )
    const sourceUrl = sendEvent.mock.calls[0]?.[0].sourceUrl as string
    expect(sourceUrl).toContain('gclid=g-1')
    expect(sourceUrl).toContain('fbclid=f-1')
  })

  it('adds no paid tag to a visit that carried no utm', async () => {
    await submitLeverageLead(input())
    expect(canonicallyTagLead).toHaveBeenCalledWith(
      expect.objectContaining({ extraTags: [] }),
    )
  })

  it('fires generate_lead with buyer_alerts and buyer_leverage_lp', async () => {
    await submitLeverageLead(input())
    expect(fireLeadGenerated).toHaveBeenCalledWith(
      expect.objectContaining({
        lead_type: LEVERAGE_LEAD_TYPE,
        form_id: LEVERAGE_FORM_ID,
        lp_variant: LEVERAGE_LP_VARIANT,
      }),
    )
    const payload = fireLeadGenerated.mock.calls[0]?.[0] as Record<string, unknown>
    expect(JSON.stringify(payload)).not.toMatch(/"value"/)
    expect(JSON.stringify(payload)).not.toMatch(/currency/)
  })

  it('keeps consult on the same lead_type constant', async () => {
    await submitLeverageLead(input({ kind: 'consult', message: 'Sisters townhomes' }))
    expect(fireLeadGenerated).toHaveBeenCalledWith(
      expect.objectContaining({
        lead_type: LEVERAGE_LEAD_TYPE,
        form_id: LEVERAGE_FORM_ID,
        lp_variant: LEVERAGE_LP_VARIANT,
      }),
    )
    expect(fireLeadGenerated.mock.calls[0]?.[0].extra).toEqual(
      expect.objectContaining({ intent: 'buyer-consult' }),
    )
  })

  it('swallows a filled honeypot without writing a lead', async () => {
    const res = await submitLeverageLead(input({ company: 'Acme Bot' }))
    expect(res).toEqual({ error: null })
    expect(sendEvent).not.toHaveBeenCalled()
    expect(fireLeadGenerated).not.toHaveBeenCalled()
  })

  it('stores ad-match consent on the person and keeps it off generate_lead', async () => {
    await submitLeverageLead(input({ adMatchConsent: true }))
    expect(enrichNativeLead).toHaveBeenCalledWith(
      expect.objectContaining({
        personId: PERSON_ID,
        custom: expect.objectContaining({ adMatchConsent: 'granted' }),
      }),
    )
    const block = JSON.stringify(fireLeadGenerated.mock.calls[0]?.[0])
    expect(block).not.toContain('sms')
    expect(block).not.toContain('adMatch')
  })

  it('falls back to a native lead and skips generate_lead when CRM fails', async () => {
    sendEvent.mockResolvedValueOnce({ ok: false, error: 'down' })
    const res = await submitLeverageLead(
      input({ lpContext: { lp_source: 'facebook', lp_medium: 'paid_social', lp_content: 'act-9' } }),
    )
    expect(res.error).toBe('down')
    expect(ensureNativeLead).toHaveBeenCalled()
    expect(fireLeadGenerated).not.toHaveBeenCalled()
  })
})
