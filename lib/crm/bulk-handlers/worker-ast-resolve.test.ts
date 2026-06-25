import { describe, expect, it, vi } from 'vitest'

// The worker route imports the handler registry (side effects), the service
// client, and NextResponse. We only exercise the pure paging math via an injected
// fetcher, so the service client is never actually called — but mock it so the
// module imports cleanly under vitest.
vi.mock('@/lib/supabase/service', () => ({ createServiceClient: () => ({}) }))

import {
  resolveAstToIds,
  AST_RESOLVE_PAGE,
  clampChunkToScope,
} from '@/app/api/cron/crm-bulk-worker/route'

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

describe('clampChunkToScope — defensive worker re-clamp (blocker 1, second wall)', () => {
  it('is a no-op for a superuser (null scope) — never hits the database', async () => {
    const fetcher = vi.fn()
    const out = await clampChunkToScope([1, 2, 3], null, fetcher)
    expect(out).toEqual({ allowed: [1, 2, 3], excluded: 0 })
    expect(fetcher).not.toHaveBeenCalled()
  })

  it('is a no-op on an empty chunk', async () => {
    const fetcher = vi.fn()
    const out = await clampChunkToScope([], 'paul', fetcher)
    expect(out).toEqual({ allowed: [], excluded: 0 })
    expect(fetcher).not.toHaveBeenCalled()
  })

  it('drops foreign ids and counts them excluded, preserving chunk order', async () => {
    // The scope read returns only the in-scope subset (1, 3); id 2 + 9 are foreign.
    const fetcher = vi.fn(async (_chunk: number[], _scope: string) => [3, 1])
    const out = await clampChunkToScope([1, 2, 3, 9], 'paul', fetcher)
    expect(out.allowed).toEqual([1, 3]) // original chunk order kept
    expect(out.excluded).toBe(2)
    expect(fetcher).toHaveBeenCalledWith([1, 2, 3, 9], 'paul')
  })

  it('keeps the whole chunk when every id is in scope', async () => {
    const fetcher = vi.fn(async () => [1, 2, 3])
    const out = await clampChunkToScope([1, 2, 3], 'rebecca', fetcher)
    expect(out).toEqual({ allowed: [1, 2, 3], excluded: 0 })
  })

  it('excludes the whole chunk when nothing is in scope', async () => {
    const fetcher = vi.fn(async () => [])
    const out = await clampChunkToScope([1, 2], 'paul', fetcher)
    expect(out).toEqual({ allowed: [], excluded: 2 })
  })
})
