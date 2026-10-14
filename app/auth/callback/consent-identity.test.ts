/**
 * The sign-in callback and consent integrity (2026-10-14).
 *
 *  - The rr_pid cookie it mints is `verified` only when the provider confirmed
 *    the email (lib/identity/person-cookie.ts signInProvenance).
 *  - Signing in with ?next=/cma/<slug> no longer marks THAT document's person as
 *    having answered the consent ask (and binds the signer's email to a
 *    phone-only lead) unless this browser holds the verified cookie our link
 *    set for that person. A sign-in proves the signer's own email only, and a
 *    CMA slug is a street address anyone can type.
 *  - The Google comms-door choices are one sign-in's answer: the cookie that
 *    carries them is cleared once applied, so a second account signing in on the
 *    same browser is not handed the first person's consent.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { personCookieValue, readPersonCookie } from '@/lib/identity/person-cookie'
import { serializeGoogleCommsConsent } from '@/lib/auth/google-comms-consent'

const SIGNER = 70001
const DOC_PERSON = 64115
const SLUG = 'cma-2566-keats-bend-97701'

const h = vi.hoisted(() => ({
  cookies: {} as Record<string, string>,
  user: null as null | Record<string, unknown>,
  enrich: vi.fn(async (_args: { personId: number; custom?: Record<string, unknown> }) => ({ ok: true })),
}))

vi.mock('next/headers', () => ({
  cookies: async () => ({
    get: (name: string) => (name in h.cookies ? { value: h.cookies[name] } : undefined),
  }),
  headers: async () => new Headers({ host: 'ryan-realty.com', 'x-forwarded-proto': 'https' }),
}))
vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    auth: { exchangeCodeForSession: async () => ({ data: { user: h.user }, error: null }) },
  }),
}))
vi.mock('@/lib/supabase/service', () => ({ createServiceClient: () => ({}) }))
vi.mock('@/lib/crm/send-event', () => ({ trackSignedInUser: async () => ({ ok: true }) }))
vi.mock('@/lib/visitor-backfill', () => ({ stitchVisitorIdentity: async () => undefined }))
vi.mock('@/lib/data/savedSearches', () => ({ claimGuestSavedSearches: async () => undefined }))
vi.mock('@/lib/data/crm/personByEmailCi', () => ({ personIdsByEmailCi: async () => [SIGNER] }))
vi.mock('@/lib/crm/absorb-guest-capture', () => ({ absorbGuestCaptureOnSignIn: async () => ({ merged: false }) }))
vi.mock('@/lib/crm/mirror', () => ({ saveOauthAvatarByEmail: async () => undefined }))
vi.mock('@sentry/nextjs', () => ({ captureException: () => undefined }))
vi.mock('@/app/actions/admin-roles', () => ({ getAdminRoleForEmail: async () => null }))
vi.mock('@/app/actions/agent-attribution-read', () => ({ readAttributedAgentServer: async () => null }))
vi.mock('@/lib/data/crm/ensureNativeLead', () => ({
  ensureNativeLead: async () => ({ personId: SIGNER }),
  enrichNativeLead: h.enrich,
}))
vi.mock('@/lib/crm/suppressions', () => ({ addSuppression: async () => undefined, removeSuppression: async () => undefined }))
vi.mock('@/lib/data/newsletter', () => ({ subscribeToNewsletter: async () => undefined }))
vi.mock('@/lib/data', () => ({
  // A phone-only lead: the signer's email is not on it.
  getCmaAccessIdentity: async () => ({
    personId: DOC_PERSON,
    clientEmail: null,
    clientName: null,
    subjectAddress: '2566 Keats',
    personEmails: [],
    claimedBy: null,
    consentRecorded: false,
  }),
}))

import { GET } from './route'

function signIn(): Promise<Response> {
  return GET(new Request(`https://ryan-realty.com/auth/callback?code=abc&next=${encodeURIComponent(`/cma/${SLUG}`)}`))
}

/** Set-Cookie values on the response, by name (an expiry clears the cookie). */
function setCookies(res: Response): Record<string, string> {
  const out: Record<string, string> = {}
  const all = (res.headers as Headers & { getSetCookie?: () => string[] }).getSetCookie?.() ?? []
  for (const line of all) {
    const [pair] = line.split(';')
    const i = pair.indexOf('=')
    out[pair.slice(0, i)] = line
  }
  return out
}

function docPersonMarked(): boolean {
  return h.enrich.mock.calls.some(([args]) => args.personId === DOC_PERSON && args.custom?.cmaConsent === true)
}

beforeEach(() => {
  h.cookies = {
    auth_next: `/cma/${SLUG}`,
    rr_google_comms: serializeGoogleCommsConsent({ emailOpt: true, smsOpt: true, phone: '5415550100' }),
  }
  h.user = { id: 'auth-1', email: 'signer@gmail.com', user_metadata: {}, email_confirmed_at: '2026-10-14T00:00:00Z' }
  h.enrich.mockClear()
})

describe('the rr_pid cookie a sign-in mints', () => {
  it('is verified when the provider confirmed the email', async () => {
    const res = await signIn()
    const pid = /rr_pid=([^;]+)/.exec(setCookies(res).rr_pid ?? '')?.[1]
    expect(readPersonCookie(decodeURIComponent(pid ?? ''))).toEqual({ personId: SIGNER, signed: true, provenance: 'verified' })
  })

  it('is only a claim when the email is unconfirmed', async () => {
    h.user = { ...h.user, email_confirmed_at: null }
    const res = await signIn()
    const pid = /rr_pid=([^;]+)/.exec(setCookies(res).rr_pid ?? '')?.[1]
    expect(readPersonCookie(decodeURIComponent(pid ?? ''))?.provenance).toBe('claimed')
  })
})

describe('signing in on another person\'s CMA', () => {
  it('without proof this browser is that person, their consent is not marked answered', async () => {
    await signIn()
    // the signer's own record still gets their own choices
    expect(h.enrich).toHaveBeenCalledWith(expect.objectContaining({ personId: SIGNER }))
    expect(docPersonMarked()).toBe(false)
  })

  it('a claimed cookie is no proof either', async () => {
    h.cookies.rr_pid = personCookieValue(DOC_PERSON, 'claimed')
    await signIn()
    expect(docPersonMarked()).toBe(false)
  })

  it('with the verified cookie our link set for that person, it is', async () => {
    h.cookies.rr_pid = personCookieValue(DOC_PERSON, 'verified')
    await signIn()
    expect(docPersonMarked()).toBe(true)
  })
})

describe('the comms-door choices', () => {
  it('are cleared once applied, so a second sign-in on this browser does not inherit them', async () => {
    const res = await signIn()
    const cleared = setCookies(res).rr_google_comms ?? ''
    expect(cleared).toMatch(/^rr_google_comms=;/)
    expect(cleared).toMatch(/Max-Age=0|Expires=Thu, 01 Jan 1970/i)
  })
})
