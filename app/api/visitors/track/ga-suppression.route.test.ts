/**
 * The server GA4 mirror honors the same suppression decision as the browser's
 * Google tag loader (lib/analytics/ga-suppression.ts, Matt 2026-10-05): GA4
 * counts only real outside visitors. First-party tracking keeps recording,
 * flagged, except a non-production page, which records nothing.
 */
import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createFakeVisitorDb } from '@/test/fake-visitor-db'

const store = createFakeVisitorDb()
const ga4 = vi.hoisted(() => ({ fire: vi.fn(async () => undefined) }))

vi.mock('@supabase/supabase-js', () => ({ createClient: () => store.client }))
vi.mock('@/lib/data/leads/listingAlerts', () => ({ stampListingAlertsCrmPerson: vi.fn() }))
vi.mock('@/lib/data/crm/personExistsById', () => ({ personExistsById: vi.fn(async () => true) }))
vi.mock('@/lib/data/crm/recordGpcSuppression', () => ({ recordGpcSuppression: vi.fn(async () => ({ ok: true, recorded: false })) }))
vi.mock('@/lib/ga4-measurement-protocol', () => ({
  fireGa4Event: ga4.fire,
  clientIdFromGaCookie: () => null,
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
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
const SESSION = '00000000-0000-4000-8000-000000000077'
const PAGE = 'https://ryan-realty.com/homes-for-sale/bend'

function track(over: Record<string, unknown>, opts: { cookie?: string; ua?: string; origin?: string } = {}): Promise<Response> {
  const origin = opts.origin ?? 'https://ryan-realty.com'
  return POST(
    new NextRequest(`${origin}/api/visitors/track`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        origin,
        'user-agent': opts.ua ?? HUMAN_UA,
        ...(opts.cookie ? { cookie: opts.cookie } : {}),
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

describe('the GA4 mirror skips what the browser loader skips (Matt 2026-10-05)', () => {
  it('an outside visitor is mirrored and recorded unflagged (the control)', async () => {
    await track({})
    expect(ga4.fire).toHaveBeenCalledTimes(1)
    expect(store.session(SESSION)).toMatchObject({ is_automated: false, automation_reason: null })
  })

  it('a signed-in broker browser (rr_internal=1) is recorded, flagged internal, never mirrored', async () => {
    await track({}, { cookie: 'rr_vid=00000000-0000-4000-8000-0000000000aa; rr_internal=1' })
    expect(ga4.fire).not.toHaveBeenCalled()
    expect(store.session(SESSION)).toMatchObject({ is_automated: true, automation_reason: 'internal' })
  })

  it('our automation marker cookie is recorded, flagged marker, never mirrored, even behind a desktop user agent', async () => {
    await track({}, { cookie: 'rr_automation=1' })
    expect(ga4.fire).not.toHaveBeenCalled()
    expect(store.session(SESSION)).toMatchObject({ is_automated: true, automation_reason: 'marker' })
  })

  it('the marker on the page query works the same way', async () => {
    await track({ pageUrl: `${PAGE}?rr_automation=1` })
    expect(ga4.fire).not.toHaveBeenCalled()
    expect(store.session(SESSION)).toMatchObject({ is_automated: true, automation_reason: 'marker' })
  })

  it('navigator.webdriver and a headless user agent are never mirrored', async () => {
    await track({ webdriver: true })
    expect(ga4.fire).not.toHaveBeenCalled()
    store.reset()
    await track({}, { ua: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/146.0.0.0 Safari/537.36' })
    expect(ga4.fire).not.toHaveBeenCalled()
  })

  it('an /admin page is never mirrored', async () => {
    await track({ pageUrl: 'https://ryan-realty.com/admin/visitors/live' })
    expect(ga4.fire).not.toHaveBeenCalled()
  })

  it('a page on a local or preview host records nothing at all', async () => {
    for (const pageUrl of ['http://127.0.0.1:3000/', 'http://localhost:3199/cities/bend', 'https://ryanrealty-git-x.vercel.app/', 'http://192.168.1.20:3000/', 'http://[::1]:3000/']) { // staging-host-ok: an incoming page address the route must refuse
      const res = await track({ pageUrl })
      expect(await res.json()).toMatchObject({ ok: true, dropped: true, reason: 'non_production_host' })
    }
    expect(store.session(SESSION)).toBeUndefined()
    expect(ga4.fire).not.toHaveBeenCalled()
  })

  it('a local request Host drops even when pageUrl is spoofed as production', async () => {
    // NextRequest rewrites 127.0.0.1 → localhost on the request URL; Origin must
    // match that same-origin, or CORS 403s before the host check.
    const res = await POST(
      new NextRequest('http://127.0.0.1:8777/api/visitors/track', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          origin: 'http://localhost:8777',
          'user-agent': HUMAN_UA,
        },
        body: JSON.stringify({
          sessionId: SESSION,
          sourceDomain: 'ryan-realty.com',
          eventType: 'page_view',
          consent: 'essential',
          pageUrl: PAGE,
          pageCategory: 'search',
        }),
      }),
    )
    expect(await res.json()).toMatchObject({ ok: true, dropped: true, reason: 'non_production_host' })
    expect(store.session(SESSION)).toBeUndefined()
    expect(ga4.fire).not.toHaveBeenCalled()
  })
})
