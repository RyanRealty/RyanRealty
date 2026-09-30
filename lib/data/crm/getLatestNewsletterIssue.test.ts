import { afterEach, describe, expect, it, vi } from 'vitest'

/**
 * The send panel shows the issue a one-click send would deliver. It must skip
 * a draft a cron wrote for Matt's approval, exactly as
 * resolveCurrentNewsletter does on the send side.
 */
type Row = { id: string; subject: string; body_html: string | null; body_text: string | null; created_by: string | null; sent_at?: string | null }
let sentRow: Row | null = null
let draftRows: Row[] = []

vi.mock('@/lib/supabase/service', () => ({
  createServiceClient: () => {
    let status = ''
    const builder: Record<string, unknown> = {
      from: () => builder,
      select: () => builder,
      eq: (col: string, val: string) => {
        if (col === 'status') status = val
        return builder
      },
      order: () => builder,
      limit: () => builder,
      maybeSingle: () => Promise.resolve({ data: status === 'sent' ? sentRow : (draftRows[0] ?? null) }),
      then: (resolve: (v: unknown) => unknown) => resolve({ data: status === 'draft' ? draftRows : [] }),
    }
    return builder
  },
}))

import { getLatestNewsletterIssue } from './getLatestNewsletterIssue'

afterEach(() => {
  sentRow = null
  draftRows = []
})

describe('getLatestNewsletterIssue', () => {
  it('shows the latest sent issue first', async () => {
    sentRow = { id: 's1', subject: 'September', body_html: '<p>x</p>', body_text: null, created_by: 'matt@ryan-realty.com', sent_at: '2026-09-03T16:00:00Z' }
    draftRows = [{ id: 'd1', subject: 'A draft', body_html: '<p>x</p>', body_text: null, created_by: 'matt@ryan-realty.com' }]
    expect(await getLatestNewsletterIssue()).toEqual({ id: 's1', subject: 'September', status: 'sent', sentAt: '2026-09-03T16:00:00Z' })
  })

  it('never offers a draft a cron wrote for Matt to approve', async () => {
    draftRows = [
      { id: 'edition', subject: 'Central Oregon market report: August 2026', body_html: '<p>x</p>', body_text: null, created_by: 'cron:market-report-edition:2026-08' },
      { id: 'brief', subject: 'The Bend Brief · September', body_html: '<p>x</p>', body_text: null, created_by: 'cron:newsletter-monthly-draft' },
    ]
    expect(await getLatestNewsletterIssue()).toBeNull()
  })

  it('offers the newest draft a person wrote, past the system drafts', async () => {
    draftRows = [
      { id: 'edition', subject: 'Central Oregon market report: August 2026', body_html: '<p>x</p>', body_text: null, created_by: 'cron:market-report-edition:2026-08' },
      { id: 'mine', subject: 'A note from Matt', body_html: '<p>x</p>', body_text: null, created_by: 'matt@ryan-realty.com' },
    ]
    expect(await getLatestNewsletterIssue()).toEqual({ id: 'mine', subject: 'A note from Matt', status: 'draft', sentAt: null })
  })
})
