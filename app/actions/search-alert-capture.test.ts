/**
 * Listing-alert signup must stitch the browser to the CRM person it creates.
 * Mocks only — never create a live CRM person, never hit production.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

const h = vi.hoisted(() => ({
  sendEvent: vi.fn(),
  canonicallyTagLead: vi.fn(),
  createNativeTask: vi.fn(),
  upsertListingAlert: vi.fn(),
  fireLeadGenerated: vi.fn(),
  stitchFormSubmitIdentity: vi.fn(),
  getCookie: vi.fn(),
  sendAlertConfirmation: vi.fn(),
}))

vi.mock('next/headers', () => ({
  cookies: () => Promise.resolve({ get: h.getCookie }),
  headers: () => Promise.resolve({ get: () => null }),
}))

vi.mock('@/lib/rate-limit', () => ({
  getAuthLimiter: () => null,
}))

vi.mock('@/lib/crm/send-event', () => ({
  sendEvent: (...args: unknown[]) => h.sendEvent(...args),
}))

vi.mock('@/lib/canonical-lead-tagger', () => ({
  canonicallyTagLead: (...args: unknown[]) => h.canonicallyTagLead(...args),
}))

vi.mock('@/lib/data/crm/ensureNativeLead', () => ({
  createNativeTask: (...args: unknown[]) => h.createNativeTask(...args),
}))

vi.mock('@/lib/data/leads/listingAlerts', () => ({
  upsertListingAlert: (...args: unknown[]) => h.upsertListingAlert(...args),
}))

vi.mock('@/lib/lead-tracking', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/lead-tracking')>()
  return {
    ...actual,
    fireLeadGenerated: (...args: unknown[]) => h.fireLeadGenerated(...args),
  }
})

// SITE-09: the same-minute confirmation is a governed send; never reach the rail
// (or Supabase, through the signing-broker resolver) from a unit test.
vi.mock('@/lib/comms/site-confirmations', () => ({
  sendAlertConfirmation: (...args: unknown[]) => h.sendAlertConfirmation(...args),
}))

vi.mock('@/lib/visitor-backfill', () => ({
  stitchFormSubmitIdentity: (...args: unknown[]) => h.stitchFormSubmitIdentity(...args),
}))

import { submitSearchAlertSignup } from '@/app/actions/search-alert-capture'

const PERSON_ID = 42
const EMAIL = 'buyer@example.com'
const RR_VID = 'rr-vid-from-cookie'
const SESSION_ID = '550e8400-e29b-41d4-a716-446655440000'

const BASE = {
  email: EMAIL,
  filters: { city: 'Bend' } as Record<string, unknown>,
  company: '',
}

async function signup(overrides: Partial<Parameters<typeof submitSearchAlertSignup>[0]> = {}) {
  return submitSearchAlertSignup({ ...BASE, ...overrides })
}

beforeEach(() => {
  h.sendEvent.mockReset()
  h.canonicallyTagLead.mockReset()
  h.createNativeTask.mockReset()
  h.upsertListingAlert.mockReset()
  h.fireLeadGenerated.mockReset()
  h.stitchFormSubmitIdentity.mockReset()
  h.getCookie.mockReset()
  h.sendAlertConfirmation.mockReset()
  h.sendAlertConfirmation.mockResolvedValue({ ok: false, via: 'skipped', error: 'unit test' })

  h.sendEvent.mockResolvedValue({ ok: true, status: 200, personId: PERSON_ID })
  h.canonicallyTagLead.mockResolvedValue(undefined)
  h.createNativeTask.mockResolvedValue(undefined)
  h.upsertListingAlert.mockResolvedValue({ ok: true })
  h.fireLeadGenerated.mockResolvedValue(undefined)
  h.stitchFormSubmitIdentity.mockResolvedValue(undefined)
  h.getCookie.mockImplementation((name: string) =>
    name === 'rr_vid' ? { value: RR_VID } : undefined,
  )
})

describe('submitSearchAlertSignup identity stitch', () => {
  it('calls stitchFormSubmitIdentity with rr_vid + person id when a person exists', async () => {
    const result = await signup()

    expect(result).toEqual({ ok: true })
    expect(h.stitchFormSubmitIdentity).toHaveBeenCalledTimes(1)
    expect(h.stitchFormSubmitIdentity).toHaveBeenCalledWith({
      personId: PERSON_ID,
      email: EMAIL,
      rrVid: RR_VID,
      sessionId: undefined,
    })
    expect(h.getCookie).toHaveBeenCalledWith('rr_vid')
    expect(h.sendEvent).toHaveBeenCalled()
    expect(h.canonicallyTagLead).toHaveBeenCalled()
    expect(h.createNativeTask).toHaveBeenCalled()
    expect(h.upsertListingAlert).toHaveBeenCalledWith(
      expect.objectContaining({
        email: EMAIL,
        crmPersonId: PERSON_ID,
      }),
    )
  })

  it('passes a valid uuid v4 sessionId through to stitch', async () => {
    const result = await signup({ sessionId: SESSION_ID })

    expect(result).toEqual({ ok: true })
    expect(h.stitchFormSubmitIdentity).toHaveBeenCalledTimes(1)
    expect(h.stitchFormSubmitIdentity).toHaveBeenCalledWith({
      personId: PERSON_ID,
      email: EMAIL,
      rrVid: RR_VID,
      sessionId: SESSION_ID,
    })
  })

  it('does not stitch when the honeypot is filled', async () => {
    const result = await signup({ company: 'Acme Bot Farm' })

    expect(result).toEqual({ ok: true })
    expect(h.sendEvent).not.toHaveBeenCalled()
    expect(h.stitchFormSubmitIdentity).not.toHaveBeenCalled()
    expect(h.upsertListingAlert).not.toHaveBeenCalled()
  })

  it('still succeeds when stitch throws', async () => {
    h.stitchFormSubmitIdentity.mockRejectedValue(new Error('identity graph down'))

    const result = await signup({ sessionId: SESSION_ID })

    expect(result).toEqual({ ok: true })
    expect(h.upsertListingAlert).toHaveBeenCalled()
  })

  // FUNNEL-4 / FUNNEL-1 (2026-09-23): the door is the source, and a submit the
  // intake screen flags keeps its alert row but none of the machinery.
  it('writes the door label, not the host, as source', async () => {
    await signup()
    expect(h.sendEvent.mock.calls[0][0]).toMatchObject({ source: 'idx-registration' })
  })

  it('a suspect signup keeps its alert row and gets no task, tagging, stitch or GA4 lead', async () => {
    h.sendEvent.mockResolvedValueOnce({ ok: true, status: 200, personId: PERSON_ID, suspect: true })

    const result = await signup({ sessionId: SESSION_ID })

    expect(result).toEqual({ ok: true })
    expect(h.upsertListingAlert).toHaveBeenCalledWith(expect.objectContaining({ email: EMAIL, crmPersonId: PERSON_ID }))
    expect(h.canonicallyTagLead).not.toHaveBeenCalled()
    expect(h.createNativeTask).not.toHaveBeenCalled()
    expect(h.stitchFormSubmitIdentity).not.toHaveBeenCalled()
    expect(h.fireLeadGenerated).not.toHaveBeenCalled()
    expect(h.sendAlertConfirmation).not.toHaveBeenCalled()
  })

  it('does not stitch when sendEvent returns no person', async () => {
    h.sendEvent.mockResolvedValueOnce({ ok: false, status: 500 })

    const result = await signup({ sessionId: SESSION_ID })

    expect(result).toEqual({ ok: true })
    expect(h.stitchFormSubmitIdentity).not.toHaveBeenCalled()
    expect(h.upsertListingAlert).toHaveBeenCalled()
  })

  it('defaults generate_lead to search_alert / search-alert for existing callers', async () => {
    await signup()
    expect(h.fireLeadGenerated).toHaveBeenCalledWith(
      expect.objectContaining({
        lp_variant: 'search-alert',
        lead_type: 'buyer_alerts',
        form_id: 'search_alert',
      }),
    )
  })

  it('accepts formId, lpVariant, and lpContext and writes UTM CRM tags', async () => {
    await signup({
      formId: 'buyer_alerts_lp',
      lpVariant: 'buy-alerts',
      lpContext: {
        lp_source: 'facebook',
        lp_medium: 'paid_social',
        lp_campaign: 'buyer-price-drops',
        lp_content: 'reloc-h3-v1',
        gclid: 'G1',
        fbclid: 'F1',
      },
    })
    expect(h.fireLeadGenerated).toHaveBeenCalledWith(
      expect.objectContaining({
        lp_variant: 'buy-alerts',
        lead_type: 'buyer_alerts',
        form_id: 'buyer_alerts_lp',
        attribution: expect.objectContaining({
          lp_source: 'facebook',
          lp_medium: 'paid_social',
          gclid: 'G1',
          fbclid: 'F1',
        }),
      }),
    )
    const sent = h.sendEvent.mock.calls[0][0] as { sourceUrl: string; campaign?: { source?: string } }
    expect(sent.sourceUrl).toContain('utm_source=facebook')
    expect(sent.sourceUrl).toContain('gclid=G1')
    expect(sent.campaign).toMatchObject({ source: 'facebook', medium: 'paid_social' })
    expect(h.canonicallyTagLead).toHaveBeenCalledWith(
      expect.objectContaining({
        extraTags: expect.arrayContaining(['channel:fb-ads', 'campaign:buyer-price-drops', 'ad-content:reloc-h3-v1']),
        originContext: expect.objectContaining({
          utmSource: 'facebook',
          utmMedium: 'paid_social',
          utmCampaign: 'buyer-price-drops',
          utmContent: 'reloc-h3-v1',
        }),
      }),
    )
  })

  it('defaults buyer_leverage_lp to buy-leverage and fires that form_id with buyer_alerts', async () => {
    await signup({ formId: 'buyer_leverage_lp' })
    expect(h.fireLeadGenerated).toHaveBeenCalledWith(
      expect.objectContaining({
        lp_variant: 'buy-leverage',
        lead_type: 'buyer_alerts',
        form_id: 'buyer_leverage_lp',
      }),
    )
  })
})
