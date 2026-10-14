/**
 * Which link a buyer lead is credited to (Matt 2026-10-09, "Visit they signed up
 * in"): the landing link of the live visit, else the page's own link when there
 * is no live visit, else nothing. Mocks only: the visit read is stubbed, never
 * production.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

const h = vi.hoisted(() => ({
  readLiveVisit: vi.fn(),
  getCookie: vi.fn(),
  headerGet: vi.fn((_name?: string) => null as string | null),
  cookiesThrow: false,
}))

vi.mock('next/headers', () => ({
  cookies: () => (h.cookiesThrow ? Promise.reject(new Error('outside a request')) : Promise.resolve({ get: h.getCookie })),
  headers: () => Promise.resolve({ get: (name: string) => h.headerGet(name) }),
}))

vi.mock('@/lib/data/identity/visitCampaign', () => ({
  readLiveVisit: (...args: unknown[]) => h.readLiveVisit(...args),
}))

import { noSignupAttribution, pageLinkFromReferer, signupAttribution } from '@/lib/crm/visit-attribution'

const SID = '550e8400-e29b-41d4-a716-446655440000'
const RR_VID = '9b2d6c1e-3f4a-4b5c-8d7e-0a1b2c3d4e5f'
const FB_PAGE = { source: 'facebook', medium: 'paid_social', campaign: 'buyer-price-drops', content: 'reloc-h3-v1' }

beforeEach(() => {
  h.readLiveVisit.mockReset()
  h.readLiveVisit.mockResolvedValue(null)
  h.getCookie.mockReset()
  h.getCookie.mockImplementation((name: string) => (name === 'rr_vid' ? { value: RR_VID } : undefined))
  h.headerGet.mockReset()
  h.headerGet.mockReturnValue(null)
  h.cookiesThrow = false
})

describe('signupAttribution', () => {
  it('the live visit’s landing link answers', async () => {
    h.readLiveVisit.mockResolvedValue({ campaign: { source: 'google', medium: 'cpc', campaign: 'bend-homes', content: null } })
    const out = await signupAttribution({ sessionId: SID })
    expect(h.readLiveVisit).toHaveBeenCalledWith({ sessionId: SID, rrVid: RR_VID })
    expect(out).toEqual({
      tags: ['channel:google-ads', 'campaign:bend-homes'],
      utm: { source: 'google', medium: 'cpc', campaign: 'bend-homes', content: undefined },
    })
  })

  it('a link inside the site never outranks the visit (a CMA comp link carries utm_source=cma)', async () => {
    h.readLiveVisit.mockResolvedValue({ campaign: { source: 'crm', medium: 'sms', campaign: null, content: null } })
    const out = await signupAttribution({
      page: { source: 'cma', medium: 'document', campaign: 'cma-letter' },
      sessionId: SID,
    })
    expect(out.tags).toEqual(['channel:crm'])
    expect(out.utm?.source).toBe('crm')
  })

  it('a live visit that arrived untagged gives no credit, whatever the page carries', async () => {
    h.readLiveVisit.mockResolvedValue({ campaign: null })
    await expect(signupAttribution({ page: FB_PAGE, sessionId: SID })).resolves.toEqual({ tags: [], utm: null })
  })

  it('with no live visit, the page’s own link answers', async () => {
    const out = await signupAttribution({ page: FB_PAGE, sessionId: SID })
    expect(out.tags).toEqual(['channel:fb-ads', 'campaign:buyer-price-drops', 'ad-content:reloc-h3-v1'])
    expect(out.utm).toEqual(FB_PAGE)
  })

  it('an organic link keeps its channel without the -ads label', async () => {
    h.readLiveVisit.mockResolvedValue({ campaign: { source: 'facebook', medium: 'social', campaign: null, content: 'tour-reel' } })
    const out = await signupAttribution({ sessionId: SID })
    expect(out.tags).toEqual(['channel:facebook', 'ad-content:tour-reel'])
  })

  it('no live visit and no page link means no tags', async () => {
    await expect(signupAttribution({ page: { medium: 'cpc' } })).resolves.toEqual({ tags: [], utm: null })
    expect(h.readLiveVisit).toHaveBeenCalledWith({ sessionId: undefined, rrVid: RR_VID })
  })

  it('a cookie read that throws still asks for the session', async () => {
    h.cookiesThrow = true
    h.readLiveVisit.mockResolvedValue({ campaign: { source: 'newsletter', medium: 'email', campaign: null, content: null } })
    const out = await signupAttribution({ sessionId: SID })
    expect(h.readLiveVisit).toHaveBeenCalledWith({ sessionId: SID, rrVid: null })
    expect(out.tags).toEqual(['channel:newsletter'])
  })

  it('every no-credit answer is a fresh value', () => {
    const a = noSignupAttribution()
    a.tags.push('channel:x')
    expect(noSignupAttribution()).toEqual({ tags: [], utm: null })
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
