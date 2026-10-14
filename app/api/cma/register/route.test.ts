/**
 * POST /api/cma/register: the CMA report's consent bar records SMS and email
 * consent only for a visitor PROVEN to be the document's person (consent
 * integrity, 2026-10-14).
 *
 * Proof is the VERIFIED rr_pid cookie the tracked link in our email set, or a
 * sign-in whose email is already on the person. A CLAIMED cookie is what a
 * stranger gets by typing the person's email into any form on their own browser
 * and coming back: before this fix it passed, and the bar recorded consent in
 * that person's name. A legacy cookie (minted before provenance existed) is
 * unverified too, fail closed. Consent stays optional: a refused answer just
 * goes back to the report.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { personCookieValue } from '@/lib/identity/person-cookie'

const h = vi.hoisted(() => ({
  cookies: {} as Record<string, string>,
  session: null as null | { user: { email: string } },
  identity: null as null | Record<string, unknown>,
  updates: [] as Array<Record<string, unknown>>,
  inserts: [] as Array<Record<string, unknown>>,
}))

vi.mock('next/headers', () => ({
  cookies: async () => ({
    get: (name: string) => (name in h.cookies ? { value: h.cookies[name] } : undefined),
  }),
}))
vi.mock('@/app/actions/auth', () => ({
  getSession: async () => h.session,
  getSignInUrl: async () => ({ url: 'https://accounts.example/oauth' }),
}))
vi.mock('@/lib/data', () => ({ getCmaAccessIdentity: async () => h.identity }))
vi.mock('@/lib/supabase/service', () => ({
  createServiceClient: () => ({
    from: (table: string) => ({
      select: () => ({
        eq: () => ({ maybeSingle: async () => ({ data: { id: PERSON, custom: {}, emails: h.identity?.personEmails ? (h.identity.personEmails as string[]).map((value) => ({ value })) : [] } }) }),
      }),
      update: (patch: Record<string, unknown>) => ({
        eq: async () => {
          h.updates.push({ table, ...patch })
          return { error: null }
        },
      }),
      insert: async (row: Record<string, unknown>) => {
        h.inserts.push({ table, ...row })
        return { error: null }
      },
    }),
  }),
}))

const PERSON = 64115
const SLUG = 'cma-2566-keats-bend-97701'

import { POST } from './route'

function post(fields: Record<string, string>): Promise<Response> {
  const form = new FormData()
  for (const [k, v] of Object.entries(fields)) form.set(k, v)
  return POST(new Request('https://ryan-realty.com/api/cma/register', { method: 'POST', body: form }))
}

const barAnswer = { slug: SLUG, pid: String(PERSON), smsOptIn: '1', emailOptIn: '1' }

beforeEach(() => {
  h.cookies = {}
  h.session = null
  h.updates = []
  h.inserts = []
  h.identity = {
    personId: PERSON,
    clientEmail: 'owner@msn.com',
    clientName: 'Owner',
    subjectAddress: '2566 Keats, Bend, OR 97701',
    personEmails: ['owner@msn.com'],
    claimedBy: null,
    consentRecorded: false,
  }
})

function recordedConsent(): Record<string, unknown> | null {
  const update = h.updates.find((u) => u.table === 'crm_people')
  return update ? ((update.custom as Record<string, unknown>).cmaConsent as Record<string, unknown>) : null
}

describe('the consent bar (no sign-in)', () => {
  it('a VERIFIED cookie for the document\'s person records the answer', async () => {
    h.cookies.rr_pid = personCookieValue(PERSON, 'verified')
    const res = await post(barAnswer)
    expect(res.status).toBe(303)
    expect(recordedConsent()).toMatchObject({ sms: true, email: true, slug: SLUG })
    expect(h.inserts).toEqual([expect.objectContaining({ table: 'crm_timeline', person_id: PERSON })])
  })

  it('a CLAIMED cookie (the person\'s email typed into a form on this browser) records nothing', async () => {
    h.cookies.rr_pid = personCookieValue(PERSON, 'claimed')
    const res = await post(barAnswer)
    expect(res.status).toBe(307)
    expect(res.headers.get('location')).toBe(`https://ryan-realty.com/cma/${SLUG}`)
    expect(h.updates).toEqual([])
    expect(h.inserts).toEqual([])
  })

  it('a bare legacy id records nothing', async () => {
    h.cookies.rr_pid = String(PERSON)
    await post(barAnswer)
    expect(h.updates).toEqual([])
    expect(h.inserts).toEqual([])
  })

  it('a verified cookie for SOMEONE ELSE records nothing', async () => {
    h.cookies.rr_pid = personCookieValue(PERSON + 1, 'verified')
    await post({ ...barAnswer, pid: String(PERSON + 1) })
    await post(barAnswer)
    expect(h.updates).toEqual([])
  })

  it('no cookie records nothing', async () => {
    await post(barAnswer)
    expect(h.updates).toEqual([])
  })
})

describe('a signed-in visitor', () => {
  it('whose email is on the person records the answer, cookie or no cookie', async () => {
    h.session = { user: { email: 'Owner@msn.com' } }
    const res = await post({ slug: SLUG, smsOptIn: '1' })
    expect(res.status).toBe(303)
    expect(recordedConsent()).toMatchObject({ sms: true, viewer: 'owner@msn.com' })
  })

  it('with a different email records nothing (wrong person)', async () => {
    h.session = { user: { email: 'stranger@gmail.com' } }
    h.cookies.rr_pid = personCookieValue(PERSON, 'claimed')
    await post({ slug: SLUG, smsOptIn: '1' })
    expect(h.updates).toEqual([])
  })

  describe('on a phone-only lead (no email on file, bind-on-first-register)', () => {
    beforeEach(() => {
      h.identity = { ...h.identity, clientEmail: null, personEmails: [] }
      h.session = { user: { email: 'signer@gmail.com' } }
    })

    it('a sign-in alone proves the signer\'s email, not that they are this lead: no claim, no consent', async () => {
      const res = await post({ slug: SLUG, smsOptIn: '1' })
      expect(res.status).toBe(307)
      expect(h.updates).toEqual([])
      expect(h.inserts).toEqual([])
    })

    it('nor does a claimed cookie', async () => {
      h.cookies.rr_pid = personCookieValue(PERSON, 'claimed')
      await post({ slug: SLUG, smsOptIn: '1' })
      expect(h.updates).toEqual([])
    })

    it('with the verified cookie our link set, the signer claims the lead and the answer is recorded', async () => {
      h.cookies.rr_pid = personCookieValue(PERSON, 'verified')
      const res = await post({ slug: SLUG, smsOptIn: '1' })
      expect(res.status).toBe(303)
      const update = h.updates.find((u) => u.table === 'crm_people')!
      expect((update.custom as Record<string, unknown>).cmaClaimedBy).toBe('signer@gmail.com')
      expect(recordedConsent()).toMatchObject({ sms: true, viewer: 'signer@gmail.com' })
    })
  })
})
