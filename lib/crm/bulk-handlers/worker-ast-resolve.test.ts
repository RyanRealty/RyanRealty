import { describe, expect, it, vi } from 'vitest'

// The worker route imports the handler registry (side effects), the service
// client, and NextResponse. We only exercise the pure paging math via an injected
// fetcher, so the service client is never actually called — but mock it so the
// module imports cleanly under vitest.
vi.mock('@/lib/supabase/service', () => ({ createServiceClient: () => ({}) }))

import { resolveAstToIds, AST_RESOLVE_PAGE } from '@/app/api/cron/crm-bulk-worker/route'

const EMPTY_AST = { type: 'group', op: 'and', nodes: [] }

describe('resolveAstToIds — paging math', () => {
  it('returns an empty list when the first page is empty', async () => {
    const fetcher = vi.fn().mockResolvedValue([])
    const ids = await resolveAstToIds(EMPTY_AST, null, { pageSize: 3, fetcher })
    expect(ids).toEqual([])
    expect(fetcher).toHaveBeenCalledTimes(1)
  })

  it('stops on the first short (under-full) page', async () => {
    const fetcher = vi.fn().mockResolvedValueOnce([1, 2, 3]).mockResolvedValueOnce([4, 5])
    const ids = await resolveAstToIds(EMPTY_AST, null, { pageSize: 3, fetcher })
    expect(ids).toEqual([1, 2, 3, 4, 5])
    expect(fetcher).toHaveBeenCalledTimes(2)
  })

  it('keeps paging while pages are full, then stops on the empty trailing page', async () => {
    // Full page exactly fills pageSize -> must request the next page; that one is
    // empty (under-full) -> stop. Total must accumulate across all pages.
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce([1, 2])
      .mockResolvedValueOnce([3, 4])
      .mockResolvedValueOnce([])
    const ids = await resolveAstToIds(EMPTY_AST, null, { pageSize: 2, fetcher })
    expect(ids).toEqual([1, 2, 3, 4])
    expect(fetcher).toHaveBeenCalledTimes(3)
  })

  it('advances the offset by pageSize each page and forwards the scope', async () => {
    const calls: Array<{ offset: number; limit: number; scope: string | null }> = []
    const fetcher = vi.fn(async (_ast: unknown, scope: string | null, page: { limit: number; offset: number }) => {
      calls.push({ offset: page.offset, limit: page.limit, scope })
      return page.offset === 0 ? [10, 11] : []
    })
    await resolveAstToIds(EMPTY_AST, 'rebecca', { pageSize: 2, fetcher })
    expect(calls).toEqual([
      { offset: 0, limit: 2, scope: 'rebecca' },
      { offset: 2, limit: 2, scope: 'rebecca' },
    ])
  })

  it('throws on a malformed AST before any fetch', async () => {
    const fetcher = vi.fn()
    await expect(resolveAstToIds({ not: 'a group' }, null, { fetcher })).rejects.toThrow()
    expect(fetcher).not.toHaveBeenCalled()
  })

  it('exposes a sane default page size', () => {
    expect(AST_RESOLVE_PAGE).toBeGreaterThanOrEqual(100)
  })
})
