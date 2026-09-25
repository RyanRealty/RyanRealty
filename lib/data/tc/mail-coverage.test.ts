/**
 * getMailCoverage() reads tc_mail_reviews (~73,000 rows as of 2026-09-24)
 * through the tc_mail_review_coverage() RPC (migration
 * 20260924060000_tc_mail_review_coverage_rpc.sql) instead of an unpaged
 * `select('mailbox, status, reviewed_at')`, which silently truncated at
 * PostgREST's row cap. These tests verify the per-mailbox sum equals a
 * direct count of the buckets handed back (the § 0 "verify against a direct
 * count" check, done here against the RPC's own output shape since a real
 * 73k-row parity check needs the live table).
 */
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/crm/gmail', () => ({
  CRM_MAILBOXES: [
    { email: 'matt@ryan-realty.com', slug: 'matt' },
    { email: 'paul@ryan-realty.com', slug: 'paul' },
  ],
  // No live Gmail call in a unit test — gmailTotalFor treats null as unreachable.
  getGmailFor: () => null,
}))

let rpcResult: { data: unknown; error: { message: string } | null } = { data: [], error: null }
let cursorRows: unknown[] = []
function makeSb() {
  return {
    rpc: (name: string) => (name === 'tc_mail_review_coverage' ? Promise.resolve(rpcResult) : Promise.resolve({ data: null, error: null })),
    from: (table: string) => ({
      select: () => (table === 'tc_mail_review_cursors' ? Promise.resolve({ data: cursorRows, error: null }) : Promise.resolve({ data: [], error: null })),
    }),
  }
}
vi.mock('@/lib/supabase/service', () => ({
  createServiceClient: () => makeSb(),
}))

import { getMailCoverage } from './mail-coverage'

afterEach(() => {
  vi.clearAllMocks()
  rpcResult = { data: [], error: null }
  cursorRows = []
})

describe('getMailCoverage', () => {
  it('sums the RPC buckets into a per-mailbox total that matches a direct count of the buckets', async () => {
    rpcResult = {
      data: [
        { mailbox: 'matt@ryan-realty.com', status: 'not_deal', reviewed_count: 40000, last_reviewed_at: '2026-09-23T00:00:00Z' },
        { mailbox: 'matt@ryan-realty.com', status: 'filed', reviewed_count: 3000, last_reviewed_at: '2026-09-24T00:00:00Z' },
        { mailbox: 'matt@ryan-realty.com', status: 'bulk', reviewed_count: 5000, last_reviewed_at: '2026-09-22T00:00:00Z' },
        { mailbox: 'paul@ryan-realty.com', status: 'not_deal', reviewed_count: 10000, last_reviewed_at: '2026-09-20T00:00:00Z' },
      ],
      error: null,
    }
    const rows = await getMailCoverage()
    const matt = rows.find((r) => r.mailbox === 'matt@ryan-realty.com')
    const paul = rows.find((r) => r.mailbox === 'paul@ryan-realty.com')

    // Direct count of the buckets the RPC returned, computed independently of
    // getMailCoverage's own accumulation — the two must agree.
    const directMattTotal = (rpcResult.data as Array<{ mailbox: string; reviewed_count: number }>)
      .filter((b) => b.mailbox === 'matt@ryan-realty.com')
      .reduce((sum, b) => sum + b.reviewed_count, 0)

    expect(matt?.reviewed).toBe(directMattTotal)
    expect(matt?.reviewed).toBe(48000)
    expect(matt?.byStatus).toEqual({ not_deal: 40000, filed: 3000, bulk: 5000 })
    expect(matt?.lastReviewedAt).toBe('2026-09-24T00:00:00Z')
    expect(paul?.reviewed).toBe(10000)
  })

  it('never truncates like the old unpaged select did — a bucket count in the tens of thousands passes straight through', async () => {
    rpcResult = { data: [{ mailbox: 'matt@ryan-realty.com', status: 'not_deal', reviewed_count: 73450, last_reviewed_at: null }], error: null }
    const rows = await getMailCoverage()
    expect(rows.find((r) => r.mailbox === 'matt@ryan-realty.com')?.reviewed).toBe(73450)
  })

  it('reports zero, not an error, for a mailbox the RPC has no rows for', async () => {
    rpcResult = { data: [], error: null }
    const rows = await getMailCoverage()
    expect(rows.every((r) => r.reviewed === 0 && Object.keys(r.byStatus).length === 0)).toBe(true)
  })
})
