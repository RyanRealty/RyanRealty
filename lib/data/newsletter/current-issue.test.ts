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
}
let rows: Row[] = []
let failOn: string | null = null
const statusesAsked: string[][] = []

vi.mock('@/lib/data/client', () => ({
  createServiceClient: () => {
    let statuses: string[] = []
    let listOnly = false
    let since: string | null = null
    let orderCol = ''
    let ascending = true
    const builder: Record<string, unknown> = {
      // Each query starts clean.
      from: () => { statuses = []; listOnly = false; since = null; orderCol = ''; ascending = true; return builder },
      select: () => builder,
      in: (_col: string, vals: string[]) => { statuses = vals; statusesAsked.push(vals); return builder },
      eq: (col: string, val: string | boolean) => {
        if (col === 'list_send') listOnly = val === true
        else { statuses = [String(val)]; statusesAsked.push([String(val)]) }
        return builder
      },
      gte: (_col: string, val: string) => { since = val; return builder },
      or: () => builder,
      order: (col: string, opts: { ascending: boolean }) => { orderCol = col; ascending = opts.ascending; return builder },
      limit: () => builder,
      maybeSingle: () => {
        if (failOn && statuses.includes(failOn)) return Promise.resolve({ data: null, error: { message: 'timeout' } })
        const hits = rows
          .filter((r) => statuses.includes(r.status))
          .filter((r) => !listOnly || r.list_send)
          .filter((r) => r.body_html || r.body_text)
          .filter((r) => !since || (r.send_started_at != null && r.send_started_at >= since))
          .sort((a, b) => {
            const x = String((a as Record<string, unknown>)[orderCol] ?? '')
            const y = String((b as Record<string, unknown>)[orderCol] ?? '')
            return ascending ? x.localeCompare(y) : y.localeCompare(x)
          })
        return Promise.resolve({ data: hits[0] ?? null, error: null })
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
  list_send: status === 'sent' || status === 'sending', ...over,
})

afterEach(() => {
  rows = []
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
})

describe('getCurrentNewsletterIssue', () => {
  it('loads the whole row of the current issue for the send, and nothing when there is none', async () => {
    rows = [row('september', 'sent', { send_started_at: '2026-09-03T16:00:00Z' })]
    expect(await getCurrentNewsletterIssue(NOW)).toMatchObject({ id: 'september', full: true })
    rows = []
    expect(await getCurrentNewsletterIssue(NOW)).toBeNull()
    expect(getNewsletter).toHaveBeenCalledTimes(1)
  })

  it('checks the row again: one pulled back to draft between the two reads is not sent', async () => {
    rows = [row('october', 'scheduled', { scheduled_at: '2026-10-12T16:00:00Z' })]
    getNewsletter.mockImplementationOnce(async (id: string) => ({ ...rows[0]!, id, status: 'draft', full: true }))
    expect(await getCurrentNewsletterIssue(NOW)).toBeNull()
  })
})
