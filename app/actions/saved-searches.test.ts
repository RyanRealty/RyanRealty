/**
 * A signed-in saved search is a buyer lead, tagged like the guest doors (Matt
 * 2026-10-09, "Visit they signed up in"): the search page's link, else the
 * campaign the visit arrived with, else nothing. Mocks only: never create a
 * live CRM person, never hit production.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

const h = vi.hoisted(() => ({
  getSession: vi.fn(),
  sendEvent: vi.fn(),
  canonicallyTagLead: vi.fn(),
  upsertListingAlert: vi.fn(),
  stampListingAlertsCrmPerson: vi.fn(),
  readVisitCampaign: vi.fn(),
  getCookie: vi.fn(),
  headerGet: vi.fn((_name?: string) => null as string | null),
}))

vi.mock('next/headers', () => ({
  cookies: () => Promise.resolve({ get: h.getCookie }),
  headers: () => Promise.resolve({ get: (name: string) => h.headerGet(name) }),
}))
vi.mock('@/app/actions/auth', () => ({ getSession: () => h.getSession() }))
vi.mock('@/app/actions/search-cache', () => ({
  prewarmSearchCache: () => Promise.resolve({ cacheKey: 'k', totalCount: 3, listingKeys: [] }),
}))
vi.mock('@/lib/supabase/server', () => ({ createClient: () => Promise.reject(new Error('no DB in unit tests')) }))
vi.mock('@/lib/supabase/service', () => ({
  createServiceClient: () => {
    throw new Error('no DB in unit tests')
  },
}))
vi.mock('@/lib/data/leads/listingAlerts', () => ({
  upsertListingAlert: (...args: unknown[]) => h.upsertListingAlert(...args),
  stampListingAlertsCrmPerson: (...args: unknown[]) => h.stampListingAlertsCrmPerson(...args),
}))
vi.mock('@/lib/crm/send-event', () => ({ sendEvent: (...args: unknown[]) => h.sendEvent(...args) }))
vi.mock('@/lib/canonical-lead-tagger', () => ({
  canonicallyTagLead: (...args: unknown[]) => h.canonicallyTagLead(...args),
}))
vi.mock('@/lib/data/identity/visitCampaign', () => ({
  readVisitCampaign: (...args: unknown[]) => h.readVisitCampaign(...args),
}))

import { createSavedSearch } from '@/app/actions/saved-searches'

const PERSON_ID = 42
const SESSION_ID = '550e8400-e29b-41d4-a716-446655440000'
const RR_VID = '9b2d6c1e-3f4a-4b5c-8d7e-0a1b2c3d4e5f'
const tagCall = () => h.canonicallyTagLead.mock.calls[0][0] as { extraTags?: string[]; originContext: Record<string, unknown> }

beforeEach(() => {
  for (const fn of Object.values(h)) fn.mockReset()
  h.getSession.mockResolvedValue({ user: { id: 'user-1', email: 'Buyer@Example.com' } })
  h.sendEvent.mockResolvedValue({ ok: true, status: 200, personId: PERSON_ID, suspect: false })
  h.canonicallyTagLead.mockResolvedValue(undefined)
  h.upsertListingAlert.mockResolvedValue({ ok: true })
  h.stampListingAlertsCrmPerson.mockResolvedValue(undefined)
  h.readVisitCampaign.mockResolvedValue(null)
  h.getCookie.mockImplementation((name: string) => (name === 'rr_vid' ? { value: RR_VID } : undefined))
  h.headerGet.mockReturnValue(null)
})

describe('createSavedSearch attribution', () => {
  it('carries the visit’s campaign when the search page has no link', async () => {
    h.readVisitCampaign.mockResolvedValue({ source: 'facebook', medium: 'paid_social', campaign: 'buyer-price-drops', content: 'reloc-h3-v1' })

    const out = await createSavedSearch('Bend under 700', { city: 'Bend', maxPrice: 700000 }, { sessionId: SESSION_ID })

    expect(out).toEqual({ error: null })
    expect(h.readVisitCampaign).toHaveBeenCalledWith({ sessionId: SESSION_ID, rrVid: RR_VID })
    expect(tagCall().extraTags).toEqual(['channel:fb-ads', 'campaign:buyer-price-drops', 'ad-content:reloc-h3-v1'])
    expect(tagCall().originContext).toMatchObject({
      source: 'saved-search',
      utmSource: 'facebook',
      utmMedium: 'paid_social',
      utmCampaign: 'buyer-price-drops',
      utmContent: 'reloc-h3-v1',
    })
  })

  it('the search page’s own link wins over the visit', async () => {
    h.headerGet.mockImplementation((name?: string) =>
      name === 'referer' ? 'https://ryan-realty.com/homes-for-sale/bend?utm_source=google&utm_medium=cpc&utm_campaign=bend-homes' : null,
    )

    await createSavedSearch('Bend', { city: 'Bend' })

    expect(h.readVisitCampaign).not.toHaveBeenCalled()
    expect(tagCall().extraTags).toEqual(['channel:google-ads', 'campaign:bend-homes'])
  })

  it('no campaign either way: no channel tags, and the save still lands', async () => {
    const out = await createSavedSearch('Bend', { city: 'Bend' })

    expect(out).toEqual({ error: null })
    expect(tagCall().extraTags).toEqual([])
    expect(tagCall().originContext.utmSource).toBeUndefined()
    expect(h.upsertListingAlert).toHaveBeenCalledWith(expect.objectContaining({ email: 'buyer@example.com', crmPersonId: PERSON_ID }))
  })

  it('signed out: nothing is read or written', async () => {
    h.getSession.mockResolvedValue(null)

    await expect(createSavedSearch('Bend', { city: 'Bend' })).resolves.toEqual({ error: 'Not signed in' })
    expect(h.readVisitCampaign).not.toHaveBeenCalled()
    expect(h.sendEvent).not.toHaveBeenCalled()
  })
})
