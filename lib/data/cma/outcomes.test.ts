import { describe, expect, it, beforeEach, vi } from 'vitest'

/**
 * Outcome-per-document and the per-lane funnel, over fixture rows.
 *
 * The three behaviours worth pinning are the ones a wrong answer would make a
 * broker act on: a reply must belong to the document that was sent BEFORE it
 * (a contact with two CMAs must not have the second credited with the first's
 * conversation), a rate over zero sends is unknown rather than 0%, and a
 * bounce must survive to the row instead of being smoothed into "no activity".
 */

type EmailRow = { email_key: string; event: string; occurred_at: string }
type ViewRow = { page_url: string; event_at: string; page_category: string; event_type: string }

/** A document page view as the tracker actually writes it. */
function view(slug: string, at: string): ViewRow {
  return {
    page_url: `https://ryan-realty.com/cma/${slug}`,
    event_at: at,
    page_category: 'client-document',
    event_type: 'page_view',
  }
}

/**
 * A tap on a link INSIDE the document, as it lands: on a listing/place page,
 * with the document's slug carried in `utm_campaign` by `trackedDocLink`, and
 * with no `_pid` (the track route strips identity before storing the URL).
 */
function tap(slug: string, path: string, at: string): ViewRow {
  return {
    page_url: `https://ryan-realty.com${path}?agent=matt&utm_source=cma&utm_medium=document&utm_campaign=${slug}`,
    event_at: at,
    page_category: 'listing',
    event_type: 'page_view',
  }
}

const state = {
  cmas: [] as Array<Record<string, unknown>>,
  timeline: [] as Array<{ person_id: number; kind: string; ts: string }>,
  people: [] as Array<{ id: number; stage: string | null }>,
  emailEvents: [] as EmailRow[],
  views: [] as ViewRow[],
  queueRows: [] as Array<Record<string, unknown>>,
}

vi.mock('next/cache', () => ({
  unstable_cache: <A extends unknown[], T>(fn: (...a: A) => Promise<T>) => fn,
}))

/**
 * A fake PostgREST builder: every filter is recorded, and awaiting the chain
 * applies them to the fixture table. Thenable rather than a Promise so the
 * `.select().in().gte().order()` shape the reader uses works unchanged.
 */
function table(rows: Array<Record<string, unknown>>) {
  const filters: Array<(r: Record<string, unknown>) => boolean> = []
  let order: { col: string; asc: boolean } | null = null
  const api = {
    select: () => api,
    eq: (col: string, val: unknown) => {
      filters.push((r) => r[col] === val)
      return api
    },
    in: (col: string, vals: unknown[]) => {
      filters.push((r) => vals.includes(r[col] as never))
      return api
    },
    gte: (col: string, val: string) => {
      filters.push((r) => String(r[col]) >= val)
      return api
    },
    or: () => api,
    order: (col: string, opts?: { ascending?: boolean }) => {
      order = { col, asc: opts?.ascending !== false }
      return api
    },
    then(resolve: (v: { data: unknown[]; error: null }) => unknown) {
      let out = rows.filter((r) => filters.every((f) => f(r)))
      if (order) {
        const o = order
        out = [...out].sort((a, b) =>
          String(a[o.col]) < String(b[o.col]) ? (o.asc ? -1 : 1) : String(a[o.col]) > String(b[o.col]) ? (o.asc ? 1 : -1) : 0,
        )
      }
      return resolve({ data: out, error: null })
    },
  }
  return api
}

vi.mock('@/lib/supabase/service', () => ({
  createServiceClient: () => ({
    from(name: string) {
      switch (name) {
        case 'cmas':
          return table(state.cmas)
        case 'crm_timeline':
          return table(state.timeline as unknown as Array<Record<string, unknown>>)
        case 'crm_people':
          return table(state.people as unknown as Array<Record<string, unknown>>)
        case 'email_events':
          return table(state.emailEvents as unknown as Array<Record<string, unknown>>)
        case 'visitor_events':
          return table(state.views as unknown as Array<Record<string, unknown>>)
        default:
          return table([])
      }
    },
  }),
}))

vi.mock('@/lib/data/cma/unified-queue', () => ({
  listCmaQueue: async () => ({ rows: state.queueRows, total: state.queueRows.length }),
}))

const { getCmaOutcomes, getCmaLaneFunnel } = await import('./outcomes')

beforeEach(() => {
  state.cmas = []
  state.timeline = []
  state.people = []
  state.emailEvents = []
  state.views = []
  state.queueRows = []
})

describe('getCmaOutcomes — one row-level answer per document', () => {
  it('rolls email, document and reply signals onto the row', async () => {
    state.cmas = [
      { id: 'c1', slug: 'cma-101-main', person_id: 7, client_email: 'a@b.com', delivered_at: '2026-09-01T10:00:00Z' },
    ]
    state.emailEvents = [
      { email_key: 'cma:cma-101-main', event: 'sent', occurred_at: '2026-09-01T10:00:00Z' },
      { email_key: 'cma:cma-101-main', event: 'delivered', occurred_at: '2026-09-01T10:00:05Z' },
      { email_key: 'cma:cma-101-main', event: 'open', occurred_at: '2026-09-01T12:00:00Z' },
      { email_key: 'cma:cma-101-main', event: 'open', occurred_at: '2026-09-02T12:00:00Z' },
      { email_key: 'cma:cma-101-main', event: 'click', occurred_at: '2026-09-01T12:01:00Z' },
    ]
    state.views = [
      view('cma-101-main', '2026-09-01T12:01:30Z'),
      view('cma-101-main', '2026-09-03T09:00:00Z'),
    ]
    state.timeline = [{ person_id: 7, kind: 'email_in', ts: '2026-09-01T15:00:00Z' }]
    state.people = [{ id: 7, stage: 'Engaged' }]

    const map = await getCmaOutcomes(['c1'])
    expect(map.c1).toMatchObject({
      sentAt: '2026-09-01T10:00:00Z',
      deliveredAt: '2026-09-01T10:00:05Z',
      opens: 2,
      firstOpenAt: '2026-09-01T12:00:00Z',
      clicks: 1,
      firstClickAt: '2026-09-01T12:01:00Z',
      visits: 2,
      firstVisitAt: '2026-09-01T12:01:30Z',
      lastVisitAt: '2026-09-03T09:00:00Z',
      repliedAt: '2026-09-01T15:00:00Z',
      bounced: false,
      unsubscribed: false,
      leadStage: 'Engaged',
    })
  })

  it('never credits a document with a reply that predates its own send', async () => {
    // Same person, two documents. The conversation happened after the FIRST
    // send and before the second — only the first may claim it.
    state.cmas = [
      { id: 'c1', slug: 'doc-one', person_id: 7, client_email: 'a@b.com', delivered_at: '2026-09-01T10:00:00Z' },
      { id: 'c2', slug: 'doc-two', person_id: 7, client_email: 'a@b.com', delivered_at: '2026-09-05T10:00:00Z' },
    ]
    state.timeline = [{ person_id: 7, kind: 'sms_in', ts: '2026-09-02T10:00:00Z' }]

    const map = await getCmaOutcomes(['c1', 'c2'])
    expect(map.c1.repliedAt).toBe('2026-09-02T10:00:00Z')
    expect(map.c2.repliedAt).toBeNull()
  })

  it('claims no reply on a document that was never sent', async () => {
    state.cmas = [{ id: 'c1', slug: 'doc-one', person_id: 7, client_email: null, delivered_at: null }]
    state.timeline = [{ person_id: 7, kind: 'email_in', ts: '2026-09-02T10:00:00Z' }]
    const map = await getCmaOutcomes(['c1'])
    expect(map.c1.repliedAt).toBeNull()
    expect(map.c1.sentAt).toBeNull()
  })

  it('surfaces a bounce and an unsubscribe as exceptions, not as activity', async () => {
    state.cmas = [{ id: 'c1', slug: 'doc-one', person_id: null, client_email: 'x@y.com', delivered_at: '2026-09-01T10:00:00Z' }]
    state.emailEvents = [
      { email_key: 'cma:doc-one', event: 'sent', occurred_at: '2026-09-01T10:00:00Z' },
      { email_key: 'cma:doc-one', event: 'bounce', occurred_at: '2026-09-01T10:00:30Z' },
      { email_key: 'cma:doc-one', event: 'unsubscribe', occurred_at: '2026-09-01T11:00:00Z' },
    ]
    const map = await getCmaOutcomes(['c1'])
    expect(map.c1.bounced).toBe(true)
    expect(map.c1.unsubscribed).toBe(true)
    expect(map.c1.opens).toBe(0)
  })

  it('does not attribute another document’s events by slug prefix', async () => {
    state.cmas = [{ id: 'c1', slug: 'doc-one', person_id: null, client_email: null, delivered_at: '2026-09-01T10:00:00Z' }]
    state.emailEvents = [{ email_key: 'cma:doc-one-b', event: 'open', occurred_at: '2026-09-01T12:00:00Z' }]
    const map = await getCmaOutcomes(['c1'])
    expect(map.c1.opens).toBe(0)
  })

  it('returns an empty map for an empty id list without touching the database', async () => {
    expect(await getCmaOutcomes([])).toEqual({})
  })
})

describe('getCmaOutcomes — a tap on a comp is a visit to THAT document', () => {
  it('counts a campaign-tagged site arrival as a visit and names the pages', async () => {
    state.cmas = [
      { id: 'c1', slug: 'cma-101-main', person_id: 7, client_email: 'a@b.com', delivered_at: '2026-09-01T10:00:00Z' },
    ]
    state.views = [
      view('cma-101-main', '2026-09-01T12:00:00Z'),
      tap('cma-101-main', '/homes-for-sale/bend/newport-gardens/1299-ogden-220225388', '2026-09-01T12:05:00Z'),
      tap('cma-101-main', '/subdivisions/newport-gardens', '2026-09-01T12:07:00Z'),
    ]

    const o = (await getCmaOutcomes(['c1'])).c1
    expect(o.visits).toBe(3)
    expect(o.firstVisitAt).toBe('2026-09-01T12:00:00Z')
    expect(o.lastVisitAt).toBe('2026-09-01T12:07:00Z')
    expect(o.visitedPages.count).toBe(2)
    expect(o.visitedPages.recent).toEqual([
      '/subdivisions/newport-gardens',
      '/homes-for-sale/bend/newport-gardens/1299-ogden-220225388',
    ])
  })

  it('marks a document VISITED even when only a comp was opened', async () => {
    state.cmas = [
      { id: 'c1', slug: 'cma-101-main', person_id: null, client_email: 'a@b.com', delivered_at: '2026-09-01T10:00:00Z' },
    ]
    state.views = [tap('cma-101-main', '/homes-for-sale/bend/x-220000001', '2026-09-02T09:00:00Z')]

    const o = (await getCmaOutcomes(['c1'])).c1
    expect(o.visits).toBe(1)
    expect(o.firstVisitAt).toBe('2026-09-02T09:00:00Z')
    expect(o.visitedPages.recent).toEqual(['/homes-for-sale/bend/x-220000001'])
  })

  it('keeps only the three most recent DISTINCT paths', async () => {
    state.cmas = [
      { id: 'c1', slug: 'cma-101-main', person_id: null, client_email: null, delivered_at: '2026-09-01T10:00:00Z' },
    ]
    state.views = [
      tap('cma-101-main', '/a', '2026-09-01T10:01:00Z'),
      tap('cma-101-main', '/b', '2026-09-01T10:02:00Z'),
      tap('cma-101-main', '/c', '2026-09-01T10:03:00Z'),
      tap('cma-101-main', '/d', '2026-09-01T10:04:00Z'),
      tap('cma-101-main', '/d', '2026-09-01T10:05:00Z'),
    ]
    const o = (await getCmaOutcomes(['c1'])).c1
    expect(o.visits).toBe(5)
    expect(o.visitedPages.recent).toEqual(['/d', '/c', '/b'])
  })

  it('never lets one document borrow another document’s taps', async () => {
    state.cmas = [
      { id: 'c1', slug: 'cma-101', person_id: null, client_email: null, delivered_at: '2026-09-01T10:00:00Z' },
      { id: 'c2', slug: 'cma-101-main', person_id: null, client_email: null, delivered_at: '2026-09-01T10:00:00Z' },
    ]
    state.views = [tap('cma-101-main', '/homes-for-sale/bend/x-220000001', '2026-09-02T09:00:00Z')]
    const map = await getCmaOutcomes(['c1', 'c2'])
    expect(map.c1.visits).toBe(0)
    expect(map.c1.visitedPages).toEqual({ count: 0, recent: [] })
    expect(map.c2.visits).toBe(1)
  })

  it('ignores a campaign that is not one of ours', async () => {
    state.cmas = [
      { id: 'c1', slug: 'cma-101-main', person_id: null, client_email: null, delivered_at: '2026-09-01T10:00:00Z' },
    ]
    state.views = [
      {
        page_url: 'https://ryan-realty.com/homes-for-sale/bend?utm_campaign=spring-sale',
        event_at: '2026-09-02T09:00:00Z',
        page_category: 'search',
        event_type: 'page_view',
      },
    ]
    const o = (await getCmaOutcomes(['c1'])).c1
    expect(o.visits).toBe(0)
  })
})

describe('getCmaLaneFunnel — the per-lane shape of the funnel', () => {
  it('counts built/ready/sent per lane and rates only over sends', async () => {
    state.queueRows = [
      { id: 'c1', origin: 'expired', state: 'sent' },
      { id: 'c2', origin: 'expired', state: 'ready' },
      { id: 'c3', origin: 'expired', state: 'building' },
      { id: 'c4', origin: 'fsbo', state: 'ready' },
    ]
    state.cmas = [
      { id: 'c1', slug: 'doc-one', person_id: 7, client_email: null, delivered_at: '2026-09-01T10:00:00Z' },
    ]
    state.emailEvents = [{ email_key: 'cma:doc-one', event: 'open', occurred_at: '2026-09-01T12:00:00Z' }]
    state.timeline = [{ person_id: 7, kind: 'email_in', ts: '2026-09-01T15:00:00Z' }]

    const funnel = await getCmaLaneFunnel()
    const expired = funnel.lanes.find((l) => l.origin === 'expired')!
    expect(expired).toMatchObject({ built: 3, ready: 1, sent: 1, opened: 1, replied: 1 })
    expect(expired.openRate).toBe(1)
    expect(expired.replyRate).toBe(1)

    const fsbo = funnel.lanes.find((l) => l.origin === 'fsbo')!
    expect(fsbo).toMatchObject({ built: 1, ready: 1, sent: 0, opened: 0 })
    // A rate over zero sends is UNKNOWN. Rendering it as 0% would tell a broker
    // the lane is failing when nothing has been tried.
    expect(fsbo.openRate).toBeNull()
    expect(fsbo.replyRate).toBeNull()
  })

  it('totals every lane onto one row', async () => {
    state.queueRows = [
      { id: 'c1', origin: 'expired', state: 'ready' },
      { id: 'c2', origin: 'fsbo', state: 'ready' },
      { id: 'c3', origin: 'seller-valuation', state: 'building' },
    ]
    const funnel = await getCmaLaneFunnel()
    expect(funnel.totals.built).toBe(3)
    expect(funnel.totals.ready).toBe(2)
    expect(funnel.totals.sent).toBe(0)
    expect(funnel.totals.openRate).toBeNull()
    expect(funnel.lanes).toHaveLength(3)
  })
})
