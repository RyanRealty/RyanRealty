/**
 * Region defaults on the track route (Matt 2026-10-08): US no-answer stores geo;
 * DE/GB stay essential; GPC and decline deny; the MP mirror skips when the
 * browser is counting the view (`_ga` at an analytics-granted tier).
 */
import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createFakeVisitorDb } from '@/test/fake-visitor-db'
import { encodeConsent } from '@/test/consent-fixtures'

const store = createFakeVisitorDb()
const ga4 = vi.hoisted(() => ({ fire: vi.fn(async () => undefined) }))

vi.mock('@supabase/supabase-js', () => ({ createClient: () => store.client }))
vi.mock('@/lib/data/leads/listingAlerts', () => ({ stampListingAlertsCrmPerson: vi.fn() }))
vi.mock('@/lib/data/crm/personExistsById', () => ({ personExistsById: vi.fn(async () => true) }))
vi.mock('@/lib/data/crm/recordGpcSuppression', () => ({
  recordGpcSuppression: vi.fn(async () => ({ ok: true, recorded: false })),
}))
vi.mock('@/lib/ga4-measurement-protocol', () => ({
  fireGa4Event: ga4.fire,
  clientIdFromGaCookie: (v: string | undefined) => (v ? v.replace(/^GA\d+\.\d+\./, '') : null),
  clientIdFromSessionId: (s: string) => s,
}))
vi.mock('@/lib/crm/broker-alerts', () => ({ queueReturnVisitAlert: vi.fn(async () => true) }))
vi.mock('@/lib/crm/cma-engagement', () => ({
  queueCmaOpenedAlert: vi.fn(async () => true),
  cmaSlugFromDocumentUrl: () => null,
}))
vi.mock('@/lib/cma/doc-links', () => ({ cmaCampaignFromUrl: () => null }))

import { POST } from './route'

const HUMAN_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15'
const SESSION = '00000000-0000-4000-8000-000000000099'
const PAGE = 'https://ryan-realty.com/homes-for-sale/bend'
const GA_COOKIE = 'GA1.1.1234567890.1700000000'

function track(
  over: Record<string, unknown> = {},
  opts: { cookie?: string; country?: string; secGpc?: string } = {},
): Promise<Response> {
  return POST(
    new NextRequest('https://ryan-realty.com/api/visitors/track', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        origin: 'https://ryan-realty.com',
        'user-agent': HUMAN_UA,
        ...(opts.cookie ? { cookie: opts.cookie } : {}),
        ...(opts.country ? { 'x-vercel-ip-country': opts.country } : {}),
        ...(opts.secGpc ? { 'sec-gpc': opts.secGpc } : {}),
      },
      body: JSON.stringify({
        sessionId: SESSION,
        sourceDomain: 'ryan-realty.com',
        eventType: 'page_view',
        consent: 'essential',
        pageUrl: PAGE,
        pageCategory: 'search',
        ...over,
      }),
    }),
  )
}

beforeEach(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co'
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-key'
  store.reset()
  ga4.fire.mockClear()
})

describe('first-party geo follows the region default', () => {
  it('US visitor with no answer stores geo (analytics granted)', async () => {
    const res = await track({}, { country: 'US' })
    expect(res.status).toBe(200)
    expect(store.session(SESSION)).toMatchObject({ ip_country: 'US' })
  })

  it('DE and GB visitors with no answer stay essential (no geo)', async () => {
    await track({ sessionId: '00000000-0000-4000-8000-0000000000d1' }, { country: 'DE' })
    expect(store.session('00000000-0000-4000-8000-0000000000d1')?.ip_country).toBeUndefined()
    await track({ sessionId: '00000000-0000-4000-8000-0000000000d2' }, { country: 'GB' })
    expect(store.session('00000000-0000-4000-8000-0000000000d2')?.ip_country).toBeUndefined()
  })

  it('a client that posts analytics from DE is clamped to essential (no geo)', async () => {
    await track({ consent: 'analytics', sessionId: '00000000-0000-4000-8000-0000000000d3' }, { country: 'DE' })
    expect(store.session('00000000-0000-4000-8000-0000000000d3')?.ip_country).toBeUndefined()
  })
})

describe('GPC and decline', () => {
  it('Sec-GPC: 1 drops the event even for a US visitor', async () => {
    const res = await track({ consent: 'analytics' }, { country: 'US', secGpc: '1' })
    const json = (await res.json()) as { dropped?: boolean; reason?: string }
    expect(json.dropped).toBe(true)
    expect(json.reason).toBe('gpc_opt_out')
    expect(store.session(SESSION)).toBeUndefined()
    expect(ga4.fire).not.toHaveBeenCalled()
  })

  it('a stored decline drops analytics even in the US', async () => {
    const res = await track(
      { consent: 'analytics' },
      {
        country: 'US',
        cookie: `ryan_realty_cookie_consent=${encodeConsent({ analytics: false, marketing: false })}`,
      },
    )
    const json = (await res.json()) as { dropped?: boolean }
    expect(json.dropped).toBe(true)
    expect(store.session(SESSION)).toBeUndefined()
  })
})

describe('MP mirror double-count guard', () => {
  it('analytics tier without _ga is not mirrored (browser GA4 counts the first view)', async () => {
    await track({ consent: 'analytics' }, { country: 'US' })
    expect(ga4.fire).not.toHaveBeenCalled()
  })

  it('a granted US browser (region default, posted essential) without _ga is not mirrored', async () => {
    await track({ consent: 'essential' }, { country: 'US' })
    expect(ga4.fire).not.toHaveBeenCalled()
  })

  it('essential tier is still mirrored', async () => {
    await track({ consent: 'essential' }, { country: 'DE', cookie: `_ga=${GA_COOKIE}` })
    expect(ga4.fire).toHaveBeenCalledTimes(1)
  })

  it('a client document at the analytics tier is still mirrored (no gtag on the document)', async () => {
    await track({
      consent: 'analytics',
      pageUrl: 'https://ryan-realty.com/cma/cma-828-florida',
      pageCategory: 'client-document',
    })
    expect(ga4.fire).toHaveBeenCalledTimes(1)
  })
})
