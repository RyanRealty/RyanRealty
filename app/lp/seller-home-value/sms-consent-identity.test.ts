/**
 * The seller form's SMS box records consent only for a person the submit proves
 * (consent integrity, 2026-10-14).
 *
 * A submit with an email records the box for the person those typed details name
 * or create: first-party consent given with the form's own disclosure. A submit
 * with NO email falls back to the rr_pid cookie, and the box then counts only
 * when that cookie's identity is VERIFIED. A claimed cookie (a browser known only
 * because someone once typed an email into a form on it), a legacy one or a bare
 * id would let a stranger opt someone else in to texts, so the box records as
 * not given there.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { personCookieValue } from '@/lib/identity/person-cookie'

const h = vi.hoisted(() => ({
  cookies: {} as Record<string, string>,
  autoEnroll: vi.fn(async () => ({ enrolled: true })),
  emailPerson: null as number | null,
  enrich: vi.fn(async (_args: { personId: number; custom?: Record<string, unknown> }) => ({ ok: true })),
}))

vi.mock('next/headers', () => ({
  cookies: async () => ({
    get: (name: string) => (name in h.cookies ? { value: h.cookies[name] } : undefined),
    set: vi.fn(),
  }),
  headers: async () => new Headers({ 'user-agent': 'Mozilla/5.0', host: 'ryan-realty.com' }),
}))
vi.mock('@/lib/crm/enroll', () => ({ autoEnrollByPersonId: h.autoEnroll }))
vi.mock('@/lib/data/cma/crm', () => ({ findCrmPersonIdByEmail: async () => h.emailPerson }))
vi.mock('@/lib/crm/send-event', () => ({
  // Native capture returns the person it wrote to: the id it was given, else a new one.
  sendEvent: async (e: { person: { id?: number } }) => ({ ok: true, personId: e.person.id ?? 90001 }),
}))
vi.mock('@/lib/data/crm/ensureNativeLead', () => ({
  ensureNativeLead: async () => ({ personId: 90001 }),
  enrichNativeLead: h.enrich,
  createNativeTask: async () => ({ ok: true }),
}))
vi.mock('@/lib/data/crm/recordMarketingAssignment', () => ({ recordMarketingAssignment: async () => ({ ok: true }) }))
vi.mock('@/lib/cma-request', () => ({ createCmaRequest: async () => ({ ok: true }) }))
vi.mock('@/lib/visitor-backfill', () => ({ stitchFormSubmitIdentity: async () => undefined }))
vi.mock('@/lib/lead-geocode', () => ({ geocodeAndTagLead: async () => ({ ok: false, tags: [] }) }))
vi.mock('@/lib/canonical-lead-tagger', () => ({ isHardStopped: async () => false }))
vi.mock('@/app/actions/agent-attribution-read', () => ({ readAttributedAgentServer: async () => null }))
vi.mock('@/lib/seller-lead-alert', () => ({ sendSellerLeadAlertEmail: async () => undefined }))
vi.mock('@/lib/lead-tracking', () => ({
  fireLeadGenerated: async () => undefined,
  persistGaClientIdFromCookies: async () => undefined,
}))
vi.mock('@/lib/meta-capi-visitor', () => ({ visitorCapiConsent: async () => ({ allowed: false, ldu: true }) }))

import { submitSellerLPForm } from './actions'

const PERSON = 64115
const ADDRESS = '61200 Elm St, Bend, OR 97702'

beforeEach(() => {
  delete process.env.NEXT_PUBLIC_SUPABASE_URL
  delete process.env.SUPABASE_SERVICE_ROLE_KEY
  h.cookies = {}
  h.emailPerson = null
  h.autoEnroll.mockClear()
  h.enrich.mockClear()
})

/** The custom fields the submit wrote onto the contact. */
function enrichedCustom(): Record<string, unknown> {
  const call = h.enrich.mock.calls.find(([args]) => args.custom)
  return (call?.[0].custom ?? {}) as Record<string, unknown>
}

/** What the submit recorded for the SMS box: the person and the consent flag. */
function recordedSms(): { personId: number; smsConsent: boolean | 'unproven' | undefined } | null {
  const call = h.autoEnroll.mock.calls[0] as unknown as [number, { smsConsent?: boolean | 'unproven' }] | undefined
  return call ? { personId: call[0], smsConsent: call[1]?.smsConsent } : null
}

describe('same-submit consent: the person typed their own details', () => {
  it('a ticked box records consent for the person the typed email names', async () => {
    h.emailPerson = PERSON
    // even on a browser whose cookie is only claimed: the typed email decides
    h.cookies.rr_pid = personCookieValue(PERSON, 'claimed')
    await submitSellerLPForm({ address: ADDRESS, email: 'owner@example.com', phone: '5415550100', smsConsent: true })
    expect(recordedSms()).toEqual({ personId: PERSON, smsConsent: true })
  })

  it('a ticked box records consent for the person a new email creates', async () => {
    await submitSellerLPForm({ address: ADDRESS, email: 'new@example.com', phone: '5415550100', smsConsent: true })
    expect(recordedSms()).toEqual({ personId: 90001, smsConsent: true })
  })

  it('an unticked box records no consent, as before', async () => {
    h.emailPerson = PERSON
    await submitSellerLPForm({ address: ADDRESS, email: 'owner@example.com', smsConsent: false })
    expect(recordedSms()).toEqual({ personId: PERSON, smsConsent: false })
  })
})

describe('no email: the person comes from the rr_pid cookie', () => {
  it('a VERIFIED cookie (they came in on our link) records the ticked box', async () => {
    h.cookies.rr_pid = personCookieValue(PERSON, 'verified')
    await submitSellerLPForm({ address: ADDRESS, smsConsent: true })
    expect(recordedSms()).toEqual({ personId: PERSON, smsConsent: true })
  })

  it('a CLAIMED cookie (someone typed this email into a form here) records nothing about consent', async () => {
    h.cookies.rr_pid = personCookieValue(PERSON, 'claimed')
    const res = await submitSellerLPForm({ address: ADDRESS, smsConsent: true, adMatchConsent: true })
    // the lead still lands on the contact: lead capture is not broken...
    expect(res.success).toBe(true)
    // ...but the box is not that person's consent: no opt-in, and no overwrite of one they gave
    expect(recordedSms()).toEqual({ personId: PERSON, smsConsent: 'unproven' })
    // nor is the EU/UK ad-matching box
    expect(enrichedCustom()).not.toHaveProperty('adMatchConsent')
  })

  it('an unticked box on a claimed cookie does not revoke consent the person gave either', async () => {
    h.cookies.rr_pid = personCookieValue(PERSON, 'claimed')
    await submitSellerLPForm({ address: ADDRESS, smsConsent: false })
    expect(recordedSms()).toEqual({ personId: PERSON, smsConsent: 'unproven' })
  })

  it('a VERIFIED cookie records the ad-matching box too', async () => {
    h.cookies.rr_pid = personCookieValue(PERSON, 'verified')
    await submitSellerLPForm({ address: ADDRESS, adMatchConsent: true })
    expect(enrichedCustom()).toMatchObject({ adMatchConsent: 'granted' })
  })

  it('a bare legacy id (anyone can type one into their browser) names nobody', async () => {
    h.cookies.rr_pid = String(PERSON)
    const res = await submitSellerLPForm({ address: ADDRESS, smsConsent: true })
    expect(res.success).toBe(false)
    expect(recordedSms()).toBeNull()
  })
})
