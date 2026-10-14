/**
 * Which visit answers for a sign-up (Matt 2026-10-09, "Visit they signed up
 * in"), against an in-memory visitor_sessions. The fake applies the SAME
 * filters the code sends (eq / gte / order / limit), so these tests prove which
 * row answers, not just which calls were made.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

type Row = Record<string, unknown>
const db: { visitor_sessions: Row[] } = { visitor_sessions: [] }
const calls: { reads: number; throwOnFrom: boolean } = { reads: 0, throwOnFrom: false }

function builder(table: 'visitor_sessions') {
  const filters: Array<(r: Row) => boolean> = []
  let orderCol: string | null = null
  let ascending = true
  let limit = Infinity
  const b = {
    select() {
      return b
    },
    eq(col: string, val: unknown) {
      filters.push((r) => r[col] === val)
      return b
    },
    gte(col: string, val: string) {
      filters.push((r) => String(r[col]) >= val)
      return b
    },
    order(col: string, opts?: { ascending?: boolean }) {
      orderCol = col
      ascending = opts?.ascending !== false
      return b
    },
    limit(n: number) {
      limit = n
      return b
    },
    maybeSingle() {
      calls.reads += 1
      let hits = db[table].filter((r) => filters.every((f) => f(r)))
      if (orderCol) {
        const col = orderCol
        hits = [...hits].sort((a, z) => (String(a[col]) < String(z[col]) ? -1 : 1) * (ascending ? 1 : -1))
      }
      hits = hits.slice(0, limit)
      if (hits.length > 1) return Promise.resolve({ data: null, error: { message: 'multiple rows' } })
      return Promise.resolve({ data: hits[0] ?? null, error: null })
    },
  }
  return b
}

vi.mock('@/lib/data/client', () => ({
  createServiceClient: () => ({
    from: (table: 'visitor_sessions') => {
      if (calls.throwOnFrom) throw new Error('supabase down')
      return builder(table)
    },
  }),
}))

import { readLiveVisit } from '@/lib/data/identity/visitCampaign'

const NOW = Date.parse('2026-10-14T18:00:00.000Z')
const MIN = 60 * 1000
const at = (minutesAgo: number) => new Date(NOW - minutesAgo * MIN).toISOString()

const SID = '550e8400-e29b-41d4-a716-446655440000'
const OTHER_SID = '6fa459ea-ee8a-4ca4-894e-db77e160355e'
const RR_VID = '9b2d6c1e-3f4a-4b5c-8d7e-0a1b2c3d4e5f'

/**
 * A visitor_sessions row the way the tracker writes it: `link` is the landing
 * page's utm_* (null = an untagged arrival). The utm_* columns hold what
 * captureSource recorded, which for an untagged arrival is a referrer guess or
 * direct / none, so a test can prove those columns never tag a lead.
 */
function session(row: Row & { link?: Record<string, string> | null; columns?: Record<string, string> }): Row {
  const { link, columns, ...rest } = row
  const query = link ? `?${new URLSearchParams(link).toString()}` : ''
  return {
    rr_vid: RR_VID,
    landing_page: `https://ryan-realty.com/homes-for-sale/bend${query}`,
    utm_source: link?.utm_source ?? columns?.utm_source ?? 'direct',
    utm_medium: link?.utm_medium ?? columns?.utm_medium ?? 'none',
    ...rest,
  }
}

beforeEach(() => {
  db.visitor_sessions = []
  calls.reads = 0
  calls.throwOnFrom = false
})

describe('readLiveVisit', () => {
  it('the session the form names answers with its landing link while it is live', async () => {
    db.visitor_sessions.push(
      session({
        session_id: SID,
        last_seen_at: at(5),
        link: {
          utm_source: 'facebook',
          utm_medium: 'paid_social',
          utm_campaign: 'buyer-price-drops',
          utm_content: 'reloc-h3-v1',
        },
      }),
    )
    await expect(readLiveVisit({ sessionId: SID, now: NOW })).resolves.toEqual({
      campaign: {
        source: 'facebook',
        medium: 'paid_social',
        campaign: 'buyer-price-drops',
        content: 'reloc-h3-v1',
      },
    })
  })

  it('a live visit with no campaign says so, and never borrows another session', async () => {
    db.visitor_sessions.push(
      session({ session_id: SID, last_seen_at: at(2) }),
      session({ session_id: OTHER_SID, last_seen_at: at(1), link: { utm_source: 'facebook', utm_medium: 'paid_social' } }),
    )
    await expect(readLiveVisit({ sessionId: SID, rrVid: RR_VID, now: NOW })).resolves.toEqual({ campaign: null })
  })

  it('a session past the 30-minute idle window is no live visit', async () => {
    db.visitor_sessions.push(
      session({ session_id: SID, last_seen_at: at(31), link: { utm_source: 'facebook', utm_medium: 'paid_social' } }),
    )
    await expect(readLiveVisit({ sessionId: SID, rrVid: RR_VID, now: NOW })).resolves.toBeNull()
  })

  it('a stale or unwritten form session is no live visit: the browser’s other sessions are not asked', async () => {
    // A session the tracker started a moment ago has no row yet; the browser's
    // previous visit must not answer for it.
    db.visitor_sessions.push(
      session({
        session_id: OTHER_SID,
        last_seen_at: at(3),
        link: { utm_source: 'google', utm_medium: 'cpc', utm_campaign: 'bend-homes' },
      }),
    )
    await expect(readLiveVisit({ sessionId: SID, rrVid: RR_VID, now: NOW })).resolves.toBeNull()
    db.visitor_sessions.push(session({ session_id: SID, last_seen_at: at(240), link: { utm_source: 'newsletter', utm_medium: 'email' } }))
    await expect(readLiveVisit({ sessionId: SID, rrVid: RR_VID, now: NOW })).resolves.toBeNull()
  })

  it('with no session id, the browser’s most recent live session answers', async () => {
    db.visitor_sessions.push(
      session({ session_id: SID, last_seen_at: at(20), link: { utm_source: 'facebook', utm_medium: 'paid_social' } }),
      session({ session_id: OTHER_SID, last_seen_at: at(4) }),
    )
    // The newest live session arrived with no campaign: no credit, even though an
    // older session in the window had one.
    await expect(readLiveVisit({ rrVid: RR_VID, now: NOW })).resolves.toEqual({ campaign: null })
    db.visitor_sessions = [session({ session_id: SID, last_seen_at: at(40), link: { utm_source: 'facebook' } })]
    await expect(readLiveVisit({ rrVid: RR_VID, now: NOW })).resolves.toBeNull()
  })

  it('another browser’s session never answers', async () => {
    db.visitor_sessions.push(
      session({
        session_id: OTHER_SID,
        rr_vid: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
        last_seen_at: at(1),
        link: { utm_source: 'facebook' },
      }),
    )
    await expect(readLiveVisit({ rrVid: RR_VID, now: NOW })).resolves.toBeNull()
  })

  it('reads nothing for ids that are not uuid v4', async () => {
    await expect(readLiveVisit({ sessionId: 'not-a-uuid', rrVid: 'rr-vid-from-cookie', now: NOW })).resolves.toBeNull()
    expect(calls.reads).toBe(0)
  })

  it('a blank utm_source is no campaign, and a failed read is no live visit', async () => {
    db.visitor_sessions.push(session({ session_id: SID, last_seen_at: at(1), link: { utm_source: '  ', utm_medium: 'cpc' } }))
    await expect(readLiveVisit({ sessionId: SID, now: NOW })).resolves.toEqual({ campaign: null })
    calls.throwOnFrom = true
    await expect(readLiveVisit({ sessionId: SID, now: NOW })).resolves.toBeNull()
  })

  it('an untagged arrival is no campaign, whatever captureSource guessed into the columns', async () => {
    // direct / none: no referrer, no utm.
    db.visitor_sessions.push(session({ session_id: SID, last_seen_at: at(1) }))
    await expect(readLiveVisit({ sessionId: SID, now: NOW })).resolves.toEqual({ campaign: null })
    // A Google search result: captureSource writes google / organic from the referrer.
    db.visitor_sessions = [
      session({ session_id: SID, last_seen_at: at(1), referrer: 'https://www.google.com/', columns: { utm_source: 'google', utm_medium: 'organic' } }),
    ]
    await expect(readLiveVisit({ sessionId: SID, now: NOW })).resolves.toEqual({ campaign: null })
    // A Facebook post shared without tags: facebook / social from the referrer.
    db.visitor_sessions = [
      session({ session_id: SID, last_seen_at: at(1), referrer: 'https://m.facebook.com/', columns: { utm_source: 'facebook', utm_medium: 'social' } }),
    ]
    await expect(readLiveVisit({ sessionId: SID, now: NOW })).resolves.toEqual({ campaign: null })
  })

  it('reads the link off a landing page that also carries other query params', async () => {
    db.visitor_sessions.push(
      session({
        session_id: SID,
        last_seen_at: at(1),
        landing_page: 'https://ryan-realty.com/homes-for-sale/listing/220123456?fbclid=F1&utm_source=fb&utm_medium=paid_social&utm_content=tour%20reel',
      }),
    )
    await expect(readLiveVisit({ sessionId: SID, now: NOW })).resolves.toEqual({
      campaign: { source: 'fb', medium: 'paid_social', campaign: null, content: 'tour reel' },
    })
  })
})
