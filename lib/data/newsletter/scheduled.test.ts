import { afterEach, describe, expect, it, vi } from 'vitest'

/**
 * The writes behind the monthly market report email (lib/market-report/edition-email-draft.ts):
 * replace in one transaction, cancel only while the status is still the one
 * read, re-stamp only an open email still on the build it was read on, and
 * the months the daily backstop looks after.
 */
type Call = { table: string; op: string; payload?: unknown; filters: Array<[string, string, unknown]> }
const calls: Call[] = []
let rpcResult: { data: unknown; error: { message: string } | null } = { data: null, error: null }
const rpcCalls: Array<[string, Record<string, unknown>]> = []
let rowsBack: unknown[] = [{ id: 'nl-0' }]

vi.mock('@/lib/data/client', () => ({
  createServiceClient: () => {
    let call: Call
    const builder: Record<string, unknown> = {
      from: (table: string) => { call = { table, op: 'select', filters: [] }; calls.push(call); return builder },
      update: (payload: unknown) => { call.op = 'update'; call.payload = payload; return builder },
      select: () => builder,
      eq: (col: string, val: unknown) => { call.filters.push(['eq', col, val]); return builder },
      in: (col: string, val: unknown) => { call.filters.push(['in', col, val]); return builder },
      like: (col: string, val: unknown) => { call.filters.push(['like', col, val]); return builder },
      gte: (col: string, val: unknown) => { call.filters.push(['gte', col, val]); return builder },
      order: () => builder,
      limit: () => builder,
      maybeSingle: () => Promise.resolve({ data: rowsBack[0] ?? null, error: null }),
      then: (resolve: (v: unknown) => unknown) => resolve({ data: rowsBack, error: null }),
    }
    return {
      ...builder,
      rpc: (name: string, args: Record<string, unknown>) => { rpcCalls.push([name, args]); return Promise.resolve(rpcResult) },
    }
  },
}))

import {
  findReplacedNewsletter,
  listEditionEmailMonthRows,
  replaceNewsletterDraft,
  restampNewsletterCitations,
  retireNewsletterDraft,
} from './scheduled'

afterEach(() => {
  calls.length = 0
  rpcCalls.length = 0
  rowsBack = [{ id: 'nl-0' }]
  rpcResult = { data: null, error: null }
})

const input = {
  id: 'nl-0',
  expectedStatus: 'scheduled' as const,
  retiredCreatedBy: 'cron:market-report-edition:2026-08:replaced:nl-0',
  subject: 'Central Oregon market report: August 2026',
  previewText: 'p',
  bodyHtml: '<tr></tr>',
  bodyText: 't',
  citations: [],
}

describe('replaceNewsletterDraft', () => {
  it('replaces in one call and reports what the old email was', async () => {
    rpcResult = { data: { ok: true, id: 'nl-1', previous_status: 'scheduled', touched: true }, error: null }
    expect(await replaceNewsletterDraft(input)).toEqual({ ok: true, id: 'nl-1', previousStatus: 'scheduled', touched: true })
    expect(rpcCalls[0]![0]).toBe('replace_newsletter_draft')
    expect(rpcCalls[0]![1]).toMatchObject({ p_id: 'nl-0', p_expected_status: 'scheduled', p_retired_created_by: input.retiredCreatedBy, p_subject: input.subject })
  })

  it('says where the email is when it moved, and throws on a failed call', async () => {
    rpcResult = { data: { ok: false, status: 'sending' }, error: null }
    expect(await replaceNewsletterDraft(input)).toEqual({ ok: false, status: 'sending' })
    rpcResult = { data: null, error: { message: 'timeout' } }
    await expect(replaceNewsletterDraft(input)).rejects.toThrow('replaceNewsletterDraft: timeout')
  })
})

describe('retireNewsletterDraft', () => {
  it('cancels only while the email is still the status it was read as', async () => {
    expect(await retireNewsletterDraft('nl-0', 'draft', input.retiredCreatedBy)).toBe(true)
    expect(calls[0]!.payload).toMatchObject({ status: 'canceled', created_by: input.retiredCreatedBy })
    expect(calls[0]!.filters).toEqual([['eq', 'id', 'nl-0'], ['eq', 'status', 'draft']])
    rowsBack = []
    expect(await retireNewsletterDraft('nl-0', 'draft', input.retiredCreatedBy)).toBe(false)
  })
})

describe('restampNewsletterCitations', () => {
  it('moves only the trace, of an open email still on the build it was read on', async () => {
    expect(await restampNewsletterCitations('nl-0', '2026-09-25T13:48:04.422Z', [])).toBe(true)
    expect(calls[0]!.payload).toEqual({ citations: [] })
    expect(calls[0]!.filters).toEqual([
      ['eq', 'id', 'nl-0'],
      ['in', 'status', ['draft', 'scheduled']],
      ['eq', 'citations->0->>fetched_at', '2026-09-25T13:48:04.422Z'],
    ])
  })
})

describe('the months the backstop looks after', () => {
  it('reads open emails and emails replaced in the window', async () => {
    rowsBack = [{ id: 'nl-8', created_by: 'cron:market-report-edition:2026-08' }]
    const rows = await listEditionEmailMonthRows('cron:market-report-edition:', '2026-08-17T00:00:00.000Z')
    expect(rows).toHaveLength(2)
    expect(calls[0]!.filters).toEqual([
      ['like', 'created_by', 'cron:market-report-edition:%'],
      ['in', 'status', ['draft', 'scheduled', 'sending']],
    ])
    expect(calls[1]!.filters).toEqual([
      ['like', 'created_by', 'cron:market-report-edition:%:replaced:%'],
      ['eq', 'status', 'canceled'],
      ['gte', 'updated_at', '2026-08-17T00:00:00.000Z'],
    ])
  })

  it('finds a replaced email of a month by its live marker', async () => {
    expect(await findReplacedNewsletter('cron:market-report-edition:2026-08')).toEqual({ id: 'nl-0' })
    expect(calls[0]!.filters).toEqual([['like', 'created_by', 'cron:market-report-edition:2026-08:replaced:%']])
  })
})
