import { afterEach, describe, expect, it, vi } from 'vitest'

/**
 * The newest issue Matt approved is what a broker's one-click send delivers
 * and what the send panel names. A draft never qualifies, whoever wrote it.
 */
type Row = { id: string; status: string; subject: string; body_html: string | null; body_text: string | null; created_by: string | null }
let rows: Row[] = []
let failOn: string | null = null
const statusesAsked: string[][] = []

vi.mock('@/lib/data/client', () => ({
  createServiceClient: () => {
    let statuses: string[] = []
    const builder: Record<string, unknown> = {
      from: () => builder,
      select: () => builder,
      in: (_col: string, vals: string[]) => { statuses = vals; statusesAsked.push(vals); return builder },
      eq: (_col: string, val: string) => { statuses = [val]; statusesAsked.push([val]); return builder },
      order: () => builder,
      limit: () => builder,
      then: (resolve: (v: unknown) => unknown) =>
        resolve(
          failOn && statuses.includes(failOn)
            ? { data: null, error: { message: 'timeout' } }
            : { data: rows.filter((r) => statuses.includes(r.status)), error: null },
        ),
    }
    return builder
  },
}))

import { getCurrentNewsletterIssue } from './current-issue'

const row = (id: string, status: string, over: Partial<Row> = {}): Row => ({
  id, status, subject: id, body_html: '<p>x</p>', body_text: null, created_by: 'matt@ryan-realty.com', ...over,
})

afterEach(() => {
  rows = []
  failOn = null
  statusesAsked.length = 0
})

describe('getCurrentNewsletterIssue', () => {
  it('is the newest issue that went to the list', async () => {
    rows = [row('september', 'sent'), row('october', 'scheduled')]
    expect((await getCurrentNewsletterIssue())?.id).toBe('september')
  })

  it('is the scheduled issue when nothing has gone out yet', async () => {
    rows = [row('october', 'scheduled')]
    expect((await getCurrentNewsletterIssue())?.id).toBe('october')
  })

  it('is never a draft, a cron draft or one written under Matt\'s name', async () => {
    rows = [
      row('edition', 'draft', { created_by: 'cron:market-report-edition:2026-08' }),
      row('brief', 'draft', { created_by: 'cron:newsletter-monthly-draft' }),
      row('generated', 'draft', { created_by: 'matt@ryan-realty.com' }),
    ]
    expect(await getCurrentNewsletterIssue()).toBeNull()
    expect(statusesAsked.flat()).not.toContain('draft')
  })

  it('skips an issue with no body', async () => {
    rows = [row('empty', 'sent', { body_html: null, body_text: null }), row('real', 'sent')]
    expect((await getCurrentNewsletterIssue())?.id).toBe('real')
  })

  it('throws on a failed read rather than reading as "no issue"', async () => {
    failOn = 'sent'
    await expect(getCurrentNewsletterIssue()).rejects.toThrow('getCurrentNewsletterIssue: timeout')
  })
})
