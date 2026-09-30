import { afterEach, describe, expect, it, vi } from 'vitest'

/**
 * The current issue Matt approved is what a broker's one-click send delivers
 * and what the send panel names: sent (or going out) in the last 45 days,
 * newest send first, else the next scheduled; never a draft.
 */
type Row = {
  id: string
  status: string
  subject: string
  body_html: string | null
  body_text: string | null
  send_started_at: string | null
  send_finished_at: string | null
  scheduled_at: string | null
  list_send: boolean
  send_paused: boolean
  created_by: string | null
  /** citations->0->>fetched_at, the build a report email's figures came from. */
  stamp: string | null
}
let rows: Row[] = []
let editions: Record<string, { status: string; generated_at: string }> = {}
let failOn: string | null = null
const statusesAsked: string[][] = []

vi.mock('@/lib/data/client', () => ({
  createServiceClient: () => {
    let table = ''
    let statuses: string[] = []
    let listOnly = false
    let unpausedOnly = false
    let editionMonth = ''
    let since: string | null = null
    let orderCol = ''
    let ascending = true
    let limit = Infinity
    const hits = () =>
      rows
        .filter((r) => statuses.includes(r.status))
        .filter((r) => !listOnly || r.list_send)
        .filter((r) => !unpausedOnly || !r.send_paused)
        .filter((r) => r.body_html || r.body_text)
        .filter((r) => !since || (r.send_started_at != null && r.send_started_at >= since))
        .sort((a, b) => {
          const x = String((a as Record<string, unknown>)[orderCol] ?? '')
          const y = String((b as Record<string, unknown>)[orderCol] ?? '')
          return ascending ? x.localeCompare(y) : y.localeCompare(x)
        })
        .slice(0, limit)
    const builder: Record<string, unknown> = {
      // Each query starts clean.
      from: (t: string) => {
        table = t; statuses = []; listOnly = false; unpausedOnly = false; editionMonth = ''
        since = null; orderCol = ''; ascending = true; limit = Infinity
        return builder
      },
      select: () => builder,
      in: (_col: string, vals: string[]) => { statuses = vals; statusesAsked.push(vals); return builder },
      eq: (col: string, val: string | boolean) => {
        if (col === 'list_send') listOnly = val === true
        else if (col === 'send_paused') unpausedOnly = val === false
        else if (col === 'edition_month') editionMonth = String(val)
        else { statuses = [String(val)]; statusesAsked.push([String(val)]) }
        return builder
      },
      gte: (_col: string, val: string) => { since = val; return builder },
      or: () => builder,
      order: (col: string, opts: { ascending: boolean }) => { orderCol = col; ascending = opts.ascending; return builder },
      limit: (n: number) => { limit = n; return builder },
      maybeSingle: () => {
        if (table === 'market_report_editions') {
          if (failOn === 'editions') return Promise.resolve({ data: null, error: { message: 'editions timeout' } })
          return Promise.resolve({ data: editions[editionMonth] ?? null, error: null })
        }
        return Promise.resolve({ data: hits()[0] ?? null, error: null })
      },
      then: (resolve: (v: unknown) => unknown, reject: (e: unknown) => unknown) => {
        if (failOn && statuses.includes(failOn)) return Promise.resolve({ data: null, error: { message: 'timeout' } }).then(resolve, reject)
        return Promise.resolve({ data: hits(), error: null }).then(resolve, reject)
      },
    }
    return builder
  },
}))

const getNewsletter = vi.fn(async (id: string) => {
  const r = rows.find((x) => x.id === id)
  return r ? { ...r, full: true } : null
})
vi.mock('@/lib/data/newsletter', () => ({ getNewsletter: (id: string) => getNewsletter(id) }))

import { CURRENT_DAYS, getCurrentNewsletterIssue, getCurrentNewsletterIssueRef } from './current-issue'

const NOW = new Date('2026-10-10T12:00:00Z')
const row = (id: string, status: string, over: Partial<Row> = {}): Row => ({
  id, status, subject: id, body_html: '<p>x</p>', body_text: null,
  send_started_at: null, send_finished_at: null, scheduled_at: null,
  list_send: status === 'sent' || status === 'sending', send_paused: false,
  created_by: 'matt@ryan-realty.com', stamp: null, ...over,
})

const BUILD = '2026-09-25T13:48:04.422Z'
const REPORT = 'cron:market-report-edition:2026-08'

afterEach(() => {
  rows = []
  editions = {}
  failOn = null
  statusesAsked.length = 0
  getNewsletter.mockClear()
})

describe('getCurrentNewsletterIssueRef', () => {
  it('is the newest issue that went out in the last 45 days', async () => {
    rows = [
      row('september', 'sent', { send_started_at: '2026-09-03T16:00:00Z', send_finished_at: '2026-09-09T16:00:00Z' }),
      row('october', 'scheduled', { scheduled_at: '2026-10-12T16:00:00Z' }),
    ]
    expect((await getCurrentNewsletterIssueRef(NOW))?.id).toBe('september')
  })

  it('puts an issue still going out ahead of last month\'s finished one', async () => {
    rows = [
      row('september', 'sent', { send_started_at: '2026-09-03T16:00:00Z', send_finished_at: '2026-09-09T16:00:00Z' }),
      row('october', 'sending', { send_started_at: '2026-10-08T16:00:00Z' }),
    ]
    expect(await getCurrentNewsletterIssueRef(NOW)).toMatchObject({ id: 'october', status: 'sending' })
  })

  it('never counts a one-off send to a few inboxes (the July 2026 kind), however recent', async () => {
    rows = [
      row('october-test', 'sent', { send_started_at: '2026-10-09T10:00:00Z', list_send: false }),
      row('september', 'sent', { send_started_at: '2026-09-03T16:00:00Z' }),
    ]
    expect((await getCurrentNewsletterIssueRef(NOW))?.id).toBe('september')
  })

  it('does not count a send older than the window, and falls to the next scheduled issue', async () => {
    expect(CURRENT_DAYS).toBe(45)
    rows = [
      row('july', 'sent', { send_started_at: '2026-07-10T14:48:43Z', send_finished_at: '2026-07-10T14:50:00Z' }),
      row('october', 'scheduled', { scheduled_at: '2026-10-12T16:00:00Z' }),
    ]
    expect(await getCurrentNewsletterIssueRef(NOW)).toMatchObject({ id: 'october', status: 'scheduled' })
    rows = [row('july', 'sent', { send_started_at: '2026-07-10T14:48:43Z' })]
    expect(await getCurrentNewsletterIssueRef(NOW)).toBeNull()
  })

  it('is never a draft, whoever wrote it', async () => {
    rows = [row('edition', 'draft'), row('brief', 'draft'), row('generated', 'draft')]
    expect(await getCurrentNewsletterIssueRef(NOW)).toBeNull()
    expect(statusesAsked.flat()).not.toContain('draft')
  })

  it('skips an issue with no body', async () => {
    rows = [
      row('empty', 'sent', { body_html: null, send_started_at: '2026-10-01T10:00:00Z' }),
      row('real', 'sent', { send_started_at: '2026-09-20T10:00:00Z' }),
    ]
    expect((await getCurrentNewsletterIssueRef(NOW))?.id).toBe('real')
  })

  it('throws on a failed read rather than reading as "no issue"', async () => {
    failOn = 'sent'
    await expect(getCurrentNewsletterIssueRef(NOW)).rejects.toThrow('getCurrentNewsletterIssue: timeout')
  })

  it('passes over a send that is paused (by Matt or the deliverability breaker)', async () => {
    rows = [
      row('october', 'sending', { send_started_at: '2026-10-08T16:00:00Z', send_paused: true }),
      row('september', 'sent', { send_started_at: '2026-09-03T16:00:00Z' }),
      row('november', 'scheduled', { scheduled_at: '2026-11-01T16:00:00Z', send_paused: true }),
    ]
    expect((await getCurrentNewsletterIssueRef(NOW))?.id).toBe('september')
    rows = [rows[0]!, rows[2]!]
    expect(await getCurrentNewsletterIssueRef(NOW)).toBeNull()
  })

  it('offers a market report email only while its report is the build it was sent with', async () => {
    rows = [
      row('report', 'sent', { send_started_at: '2026-10-08T16:00:00Z', created_by: REPORT, stamp: BUILD }),
      row('brief', 'sent', { send_started_at: '2026-10-01T16:00:00Z' }),
    ]
    editions = { '2026-08-01': { status: 'published', generated_at: '2026-09-25T13:48:04.422+00:00' } }
    expect((await getCurrentNewsletterIssueRef(NOW))?.id).toBe('report')

    // Republished since it went out: it keeps the figures it was sent with, so it is not sent again.
    editions = { '2026-08-01': { status: 'published', generated_at: '2026-10-09T09:00:00+00:00' } }
    expect((await getCurrentNewsletterIssueRef(NOW))?.id).toBe('brief')

    // Its report no longer published: not offered either.
    editions = { '2026-08-01': { status: 'draft', generated_at: '2026-09-25T13:48:04.422+00:00' } }
    expect((await getCurrentNewsletterIssueRef(NOW))?.id).toBe('brief')
  })

  it('checks a scheduled market report email the same way', async () => {
    rows = [row('report', 'scheduled', { scheduled_at: '2026-10-12T16:00:00Z', created_by: REPORT, stamp: BUILD })]
    editions = { '2026-08-01': { status: 'published', generated_at: '2026-10-09T09:00:00+00:00' } }
    expect(await getCurrentNewsletterIssueRef(NOW)).toBeNull()
  })

  it('throws when a report email cannot be checked, rather than offering it unchecked', async () => {
    rows = [row('report', 'sent', { send_started_at: '2026-10-08T16:00:00Z', created_by: REPORT, stamp: BUILD })]
    failOn = 'editions'
    await expect(getCurrentNewsletterIssueRef(NOW)).rejects.toThrow('getCurrentNewsletterIssue: editions timeout')
  })
})

describe('getCurrentNewsletterIssue', () => {
  it('loads the whole row of the current issue for the send, and nothing when there is none', async () => {
    rows = [row('september', 'sent', { send_started_at: '2026-09-03T16:00:00Z' })]
    expect(await getCurrentNewsletterIssue(NOW)).toMatchObject({ id: 'september', full: true })
    rows = []
    expect(await getCurrentNewsletterIssue(NOW)).toBeNull()
    expect(getNewsletter).toHaveBeenCalledTimes(1)
  })

  it('checks the row again: one canceled or paused between the two reads is not sent', async () => {
    rows = [row('october', 'scheduled', { scheduled_at: '2026-10-12T16:00:00Z' })]
    getNewsletter.mockImplementationOnce(async (id: string) => ({ ...rows[0]!, id, status: 'canceled', full: true }))
    expect(await getCurrentNewsletterIssue(NOW)).toBeNull()
    getNewsletter.mockImplementationOnce(async (id: string) => ({ ...rows[0]!, id, send_paused: true, full: true }))
    expect(await getCurrentNewsletterIssue(NOW)).toBeNull()
  })
})
