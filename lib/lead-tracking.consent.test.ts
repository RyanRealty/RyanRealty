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
}))

vi.mock('next/headers', () => ({
  cookies: () => Promise.resolve({ get: (n: string) => (n in h.cookies ? { name: n, value: h.cookies[n] } : undefined) }),
  headers: () => Promise.resolve({ get: (n: string) => h.headers[n.toLowerCase()] ?? null }),
}))
vi.mock('@/lib/ga4-measurement-protocol', () => ({
  fireGa4Event: (...args: unknown[]) => h.fireGa4Event(...args),
  readGa4ClientIdFromCookies: () => '123.456',
}))

import { fireLeadGenerated, fireNonLeadEvent } from '@/lib/lead-tracking'
import { CONSENT_COOKIE } from '@/lib/identity/consent'

const LEAD = { lp_variant: 'contact', lead_type: 'buyer_question', form_id: 'contact' } as const

beforeEach(() => {
  h.cookies = {}
  h.headers = { referer: 'https://ryan-realty.com/sell?utm_source=fb&gclid=G1&fbclid=F1' }
  h.fireGa4Event.mockReset()
  h.fireGa4Event.mockResolvedValue(undefined)
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
})
