/**
 * GPC or a banner decline turns analytics off (Matt 2026-10-08, PR #437), so the
 * server-side generate_lead is not sent to GA4 then. First-party click ids still
 * ride on the event when it is allowed. The CRM lead record is the caller's job
 * and is not affected.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

const h = vi.hoisted(() => ({
  cookies: {} as Record<string, string>,
  headers: {} as Record<string, string>,
  fireGa4Event: vi.fn(),
  rememberGaClientId: vi.fn(),
}))

vi.mock('next/headers', () => ({
  cookies: () => Promise.resolve({ get: (n: string) => (n in h.cookies ? { name: n, value: h.cookies[n] } : undefined) }),
  headers: () => Promise.resolve({ get: (n: string) => h.headers[n.toLowerCase()] ?? null }),
}))
vi.mock('@/lib/ga4-measurement-protocol', () => ({
  fireGa4Event: (args: unknown) => h.fireGa4Event(args),
  readGa4ClientIdFromCookies: () => '123.456',
  readGa4SessionFromCookies: () => ({ sessionId: '1760400000', sessionNumber: 4 }),
}))
vi.mock('@/lib/data/analytics/gaClientId', () => ({
  rememberGaClientId: (personId: unknown, clientId: unknown) => h.rememberGaClientId(personId, clientId),
}))

import { fireLeadGenerated, fireNonLeadEvent, persistGaClientIdFromCookies } from '@/lib/lead-tracking'
import { CONSENT_COOKIE } from '@/lib/identity/consent'

const LEAD = { lp_variant: 'contact', lead_type: 'buyer_question', form_id: 'contact' } as const

beforeEach(() => {
  h.cookies = {}
  h.headers = {
    referer: 'https://ryan-realty.com/sell?utm_source=fb&gclid=G1&fbclid=F1',
    'user-agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
  }
  h.fireGa4Event.mockReset()
  h.fireGa4Event.mockResolvedValue(undefined)
  h.rememberGaClientId.mockReset()
})

describe('server generate_lead honors GPC and a decline', () => {
  it('sends with first-party click ids when there is no answer and no GPC', async () => {
    await fireLeadGenerated(LEAD as never)
    expect(h.fireGa4Event).toHaveBeenCalledTimes(1)
    const p = h.fireGa4Event.mock.calls[0][0].eventParams
    expect(p).toMatchObject({ gclid: 'G1', fbclid: 'F1', lp_source: 'fb' })
  })

  it('sends nothing to GA4 under Sec-GPC: 1, even with a stored accept-all', async () => {
    h.headers['sec-gpc'] = '1'
    h.cookies[CONSENT_COOKIE] = encodeURIComponent(JSON.stringify({ analytics: true, marketing: true }))
    await fireLeadGenerated(LEAD as never)
    await fireNonLeadEvent({ event_name: 'newsletter_signup' as never, form_id: 'newsletter', lp_variant: 'x' })
    expect(h.fireGa4Event).not.toHaveBeenCalled()
  })

  it('sends nothing to GA4 after a banner decline', async () => {
    h.cookies[CONSENT_COOKIE] = encodeURIComponent(JSON.stringify({ analytics: false, marketing: false }))
    await fireLeadGenerated(LEAD as never)
    expect(h.fireGa4Event).not.toHaveBeenCalled()
  })

  it('persists the _ga client_id on the contact so later offline conversions can stitch', async () => {
    await fireLeadGenerated({ ...LEAD, crm_person_id: 64115 } as never)
    expect(h.rememberGaClientId).toHaveBeenCalledWith(64115, '123.456')
  })

  it('still persists the _ga client_id when analytics is declined so #543 can stitch later', async () => {
    h.cookies[CONSENT_COOKIE] = encodeURIComponent(JSON.stringify({ analytics: false, marketing: false }))
    await fireLeadGenerated({ ...LEAD, crm_person_id: 64115 } as never)
    expect(h.rememberGaClientId).toHaveBeenCalledWith(64115, '123.456')
    expect(h.fireGa4Event).not.toHaveBeenCalled()
  })

  it('still persists the _ga client_id under Sec-GPC: 1', async () => {
    h.headers['sec-gpc'] = '1'
    await fireLeadGenerated({ ...LEAD, crm_person_id: 64115 } as never)
    expect(h.rememberGaClientId).toHaveBeenCalledWith(64115, '123.456')
    expect(h.fireGa4Event).not.toHaveBeenCalled()
  })
})

describe('persistGaClientIdFromCookies — form actions write first-touch themselves', () => {
  it('reads the _ga cookie and remembers it on the person', async () => {
    await persistGaClientIdFromCookies(64115)
    expect(h.rememberGaClientId).toHaveBeenCalledWith(64115, '123.456')
  })

  it('no-ops a missing person without throwing', async () => {
    await persistGaClientIdFromCookies(null)
    expect(h.rememberGaClientId).toHaveBeenCalledWith(null, '123.456')
  })
})

describe('server events join the visitor GA4 session (2026-10-14)', () => {
  it('carries session_id, session_number and the page so GA4 credits the visit that produced the lead', async () => {
    await fireLeadGenerated(LEAD as never)
    const call = h.fireGa4Event.mock.calls[0][0]
    expect(call.clientId).toBe('123.456')
    expect(call.eventParams).toMatchObject({
      session_id: '1760400000',
      session_number: 4,
      page_location: 'https://ryan-realty.com/sell?utm_source=fb&gclid=G1&fbclid=F1',
    })
  })

  it('strips identity params from the page it sends', async () => {
    h.headers.referer = 'https://ryan-realty.com/sell?_pid=abc&rr_doc=cma-x&utm_source=fb'
    await fireLeadGenerated(LEAD as never)
    expect(h.fireGa4Event.mock.calls[0][0].eventParams.page_location).toBe('https://ryan-realty.com/sell?utm_source=fb')
  })

  it("sends nothing from a broker's own browser (rr_internal), the browser loader's rule", async () => {
    h.headers.cookie = 'rr_internal=1'
    await fireLeadGenerated(LEAD as never)
    await fireNonLeadEvent({ event_name: 'newsletter_signup' as never, form_id: 'newsletter', lp_variant: 'x' })
    expect(h.fireGa4Event).not.toHaveBeenCalled()
  })

  it('sends nothing from a non-production host or automation', async () => {
    h.headers.referer = 'http://localhost:3000/sell'
    await fireLeadGenerated(LEAD as never)
    h.headers.referer = 'https://ryan-realty.com/sell'
    h.headers['user-agent'] = 'Mozilla/5.0 HeadlessChrome/130.0.0.0'
    await fireLeadGenerated(LEAD as never)
    expect(h.fireGa4Event).not.toHaveBeenCalled()
  })

  it('a provider webhook (serverToServer) still sends, with no browser session', async () => {
    h.headers = {}
    await fireLeadGenerated({ ...LEAD, form_id: 'meta_lead_ad', lead_type: 'buyer_question', serverToServer: true } as never)
    expect(h.fireGa4Event).toHaveBeenCalledTimes(1)
    const p = h.fireGa4Event.mock.calls[0][0].eventParams
    expect(p.session_id).toBeUndefined()
    expect(p.page_location).toBeUndefined()
  })

  it('a provider webhook still honors a broker browser cookie', async () => {
    h.headers = { cookie: 'rr_internal=1' }
    await fireLeadGenerated({ ...LEAD, form_id: 'meta_lead_ad', serverToServer: true } as never)
    expect(h.fireGa4Event).not.toHaveBeenCalled()
  })
})
