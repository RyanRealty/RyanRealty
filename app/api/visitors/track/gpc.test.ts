/**
 * /api/visitors/track and Global Privacy Control (docs/TRACKING_POLICY.md, the GPC
 * tier): nothing is recorded, and a contact the browser was ALREADY identified as
 * gets a durable channel='all' suppression.
 *
 * Since 2026-09-30 the trackers write no identifier under GPC and post no event:
 * one notice per page load, `{ gpc: true }`, with no session id, address or campaign
 * in it (review of 2026-09-30: the site tracker used to mint a session id and post
 * every event with its session, address and campaign, while the document tracker
 * sent nothing at all, so a known contact reading a report under GPC was never
 * suppressed). The route therefore finds the contact from what the browser already
 * carries on every request to this site: the signed rr_pid cookie, else its rr_vid
 * in the identity map; a tracker from before the change still names its session.
 */
import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createFakeVisitorDb } from '@/test/fake-visitor-db'
import { personCookieValue } from '@/lib/identity/person-cookie'

const store = createFakeVisitorDb()
const gpc = vi.hoisted(() => ({ suppress: vi.fn(async (_personId: number) => ({ ok: true as const, recorded: true })) }))

vi.mock('@supabase/supabase-js', () => ({ createClient: () => store.client }))
vi.mock('@/lib/data/crm/recordGpcSuppression', () => ({ recordGpcSuppression: gpc.suppress }))
vi.mock('@/lib/data/leads/listingAlerts', () => ({ stampListingAlertsCrmPerson: vi.fn() }))
vi.mock('@/lib/data/crm/personExistsById', () => ({ personExistsById: vi.fn(async () => true) }))
vi.mock('@/lib/ga4-measurement-protocol', () => ({
  fireGa4Event: vi.fn(async () => undefined),
  clientIdFromGaCookie: () => null,
  clientIdFromSessionId: (s: string) => s,
}))
vi.mock('@/lib/crm/broker-alerts', () => ({ queueReturnVisitAlert: vi.fn(async () => true) }))
vi.mock('@/lib/crm/cma-engagement', () => ({ queueCmaOpenedAlert: vi.fn(async () => true), cmaSlugFromDocumentUrl: () => null }))

import { POST } from './route'

const PERSON = 64115
const MAPPED = 70001
const SESSION_PERSON = 80002
const VID = '9a1b2c3d-4e5f-4a6b-8c7d-0e1f2a3b4c5d'
const SID = '00000000-0000-4000-8000-000000000001'

function track(body: Record<string, unknown>, opts: { cookies?: Record<string, string>; secGpc?: boolean } = {}) {
  const cookie = Object.entries(opts.cookies ?? {})
    .map(([k, v]) => `${k}=${v}`)
    .join('; ')
  return POST(
    new NextRequest('https://ryan-realty.com/api/visitors/track', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        origin: 'https://ryan-realty.com',
        'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15',
        ...(opts.secGpc ? { 'sec-gpc': '1' } : {}),
        ...(cookie ? { cookie } : {}),
      },
      body: JSON.stringify(body),
    }),
  )
}

const nothingWritten = () => {
  expect(store.db.visitor_sessions.filter((r) => r.session_id !== SID)).toEqual([])
  expect(store.db.visitor_events).toEqual([])
}

beforeEach(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co'
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-key'
  store.reset()
  gpc.suppress.mockClear()
})

describe('the GPC notice: no session id, nothing identifying in it', () => {
  it('records the suppression for the contact on the signed rr_pid cookie, and writes nothing else', async () => {
    const res = await track({ gpc: true }, { cookies: { rr_pid: personCookieValue(PERSON), rr_vid: VID } })
    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ ok: true, dropped: true, reason: 'gpc_opt_out', suppressionRecorded: true })
    expect(gpc.suppress).toHaveBeenCalledTimes(1)
    expect(gpc.suppress).toHaveBeenCalledWith(PERSON)
    nothingWritten()
  })

  it('with no cookie, the contact this browser\'s rr_vid is mapped to', async () => {
    store.db.visitor_identity_map.push({ rr_vid: VID, crm_person_id: MAPPED })
    const res = await track({ gpc: true }, { cookies: { rr_vid: VID } })
    expect(await res.json()).toMatchObject({ dropped: true, reason: 'gpc_opt_out' })
    expect(gpc.suppress).toHaveBeenCalledWith(MAPPED)
    nothingWritten()
  })

  it('a browser nobody knows: nothing suppressed, nothing written', async () => {
    const res = await track({ gpc: true }, { cookies: { rr_vid: VID } })
    expect(await res.json()).toMatchObject({ dropped: true, reason: 'gpc_opt_out', suppressionRecorded: false })
    expect(gpc.suppress).not.toHaveBeenCalled()
    nothingWritten()
  })

  it('an unsigned rr_pid cookie names nobody', async () => {
    await track({ gpc: true }, { cookies: { rr_pid: String(PERSON) } })
    expect(gpc.suppress).not.toHaveBeenCalled()
  })

  it('a decline does not stop the opt-out being recorded for a contact we know', async () => {
    await track({ gpc: true, consent: 'declined' }, { cookies: { rr_pid: personCookieValue(PERSON) } })
    expect(gpc.suppress).toHaveBeenCalledWith(PERSON)
    nothingWritten()
  })
})

describe('the other shapes GPC arrives in', () => {
  it('a tracker from before 2026-09-30 still names its session: that session\'s contact', async () => {
    store.db.visitor_sessions.push({ session_id: SID, crm_person_id: SESSION_PERSON, identified_at: '2026-09-01T00:00:00Z' })
    const res = await track({
      sessionId: SID,
      eventType: 'page_view',
      pageUrl: 'https://ryan-realty.com/homes-for-sale',
      consent: 'essential',
      gpc: true,
    })
    expect(await res.json()).toMatchObject({ dropped: true, reason: 'gpc_opt_out' })
    expect(gpc.suppress).toHaveBeenCalledWith(SESSION_PERSON)
    expect(store.db.visitor_events).toEqual([])
  })

  it('the Sec-GPC header alone drops an ordinary event before any write', async () => {
    await track(
      { sessionId: '00000000-0000-4000-8000-000000000002', eventType: 'page_view', pageUrl: 'https://ryan-realty.com/sell', consent: 'all' },
      { secGpc: true, cookies: { rr_pid: personCookieValue(PERSON) } },
    )
    expect(gpc.suppress).toHaveBeenCalledWith(PERSON)
    nothingWritten()
  })
})
