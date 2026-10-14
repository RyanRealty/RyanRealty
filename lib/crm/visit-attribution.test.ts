/**
 * Which link a buyer sign-up is credited to (Matt 2026-10-09, "Visit they
 * signed up in"): the page's own link, else the visit's recorded campaign, else
 * nothing. Mocks only: the visit read is stubbed, never production.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

const h = vi.hoisted(() => ({
  readVisitCampaign: vi.fn(),
  getCookie: vi.fn(),
  headerGet: vi.fn((_name?: string) => null as string | null),
  cookiesThrow: false,
}))

vi.mock('next/headers', () => ({
  cookies: () => (h.cookiesThrow ? Promise.reject(new Error('outside a request')) : Promise.resolve({ get: h.getCookie })),
  headers: () => Promise.resolve({ get: (name: string) => h.headerGet(name) }),
}))

vi.mock('@/lib/data/identity/visitCampaign', () => ({
  readVisitCampaign: (...args: unknown[]) => h.readVisitCampaign(...args),
}))

import { pageLinkFromReferer, signupAttribution } from '@/lib/crm/visit-attribution'

const SID = '550e8400-e29b-41d4-a716-446655440000'
const RR_VID = '9b2d6c1e-3f4a-4b5c-8d7e-0a1b2c3d4e5f'

beforeEach(() => {
  h.readVisitCampaign.mockReset()
  h.readVisitCampaign.mockResolvedValue(null)
  h.getCookie.mockReset()
  h.getCookie.mockImplementation((name: string) => (name === 'rr_vid' ? { value: RR_VID } : undefined))
  h.headerGet.mockReset()
  h.headerGet.mockReturnValue(null)
  h.cookiesThrow = false
})

describe('signupAttribution', () => {
  it('the page link wins and the visit is never read', async () => {
    const out = await signupAttribution({
      page: { source: 'facebook', medium: 'paid_social', campaign: 'buyer-price-drops', content: 'reloc-h3-v1' },
      sessionId: SID,
    })
    expect(out.from).toBe('page')
    expect(out.tags).toEqual(['channel:fb-ads', 'campaign:buyer-price-drops', 'ad-content:reloc-h3-v1'])
    expect(out.utm).toEqual({ source: 'facebook', medium: 'paid_social', campaign: 'buyer-price-drops', content: 'reloc-h3-v1' })
    expect(h.readVisitCampaign).not.toHaveBeenCalled()
  })

  it('without a page link, the visit the sign-up happened in answers', async () => {
    h.readVisitCampaign.mockResolvedValue({ source: 'google', medium: 'cpc', campaign: 'bend-homes', content: null })
    const out = await signupAttribution({ page: { source: undefined, medium: 'cpc' }, sessionId: SID })
    expect(h.readVisitCampaign).toHaveBeenCalledWith({ sessionId: SID, rrVid: RR_VID })
    expect(out).toEqual({
      tags: ['channel:google-ads', 'campaign:bend-homes'],
      utm: { source: 'google', medium: 'cpc', campaign: 'bend-homes', content: undefined },
      from: 'visit',
    })
  })

  it('an organic visit keeps its channel without the -ads label', async () => {
    h.readVisitCampaign.mockResolvedValue({ source: 'facebook', medium: 'social', campaign: null, content: 'tour-reel' })
    const out = await signupAttribution({ sessionId: SID })
    expect(out.tags).toEqual(['channel:facebook', 'ad-content:tour-reel'])
    expect(out.from).toBe('visit')
  })

  it('no campaign either way means no tags', async () => {
    const out = await signupAttribution({ page: null })
    expect(out).toEqual({ tags: [], utm: null, from: null })
    expect(h.readVisitCampaign).toHaveBeenCalledWith({ sessionId: undefined, rrVid: RR_VID })
  })

  it('a cookie read that throws still reads the session', async () => {
    h.cookiesThrow = true
    h.readVisitCampaign.mockResolvedValue({ source: 'newsletter', medium: 'email', campaign: null, content: null })
    const out = await signupAttribution({ sessionId: SID })
    expect(h.readVisitCampaign).toHaveBeenCalledWith({ sessionId: SID, rrVid: null })
    expect(out.tags).toEqual(['channel:newsletter'])
  })
})

describe('pageLinkFromReferer', () => {
  it('reads utm_* off the page the action was called from', async () => {
    h.headerGet.mockImplementation((name?: string) =>
      name === 'referer'
        ? 'https://ryan-realty.com/homes-for-sale/listing/220123456?utm_source=facebook&utm_medium=paid_social&utm_campaign=new-listings&fbclid=F1'
        : null,
    )
    await expect(pageLinkFromReferer()).resolves.toEqual({
      source: 'facebook',
      medium: 'paid_social',
      campaign: 'new-listings',
      content: undefined,
    })
  })

  it('is null without a Referer, without utm_source, or with a malformed Referer', async () => {
    await expect(pageLinkFromReferer()).resolves.toBeNull()
    h.headerGet.mockImplementation((name?: string) => (name === 'referer' ? 'https://ryan-realty.com/homes-for-sale?utm_medium=cpc' : null))
    await expect(pageLinkFromReferer()).resolves.toBeNull()
    h.headerGet.mockImplementation((name?: string) => (name === 'referer' ? 'not a url' : null))
    await expect(pageLinkFromReferer()).resolves.toBeNull()
  })
})
