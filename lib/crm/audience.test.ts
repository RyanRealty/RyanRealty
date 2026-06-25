import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// ── Suppression mock ─────────────────────────────────────────────────────────
// isSuppressed is the chokepoint resolveSendableAudience drops through. Tests
// drive its verdict per person id.
let suppressedIds: Record<number, string[]> = {}
let suppressThrowsFor: number | null = null
vi.mock('@/lib/crm/suppressions', () => ({
  isSuppressed: (personId: number, _channel: string) => {
    if (suppressThrowsFor === personId) throw new Error('table down')
    const reasons = suppressedIds[personId]
    return Promise.resolve(
      reasons ? { suppressed: true, reasons } : { suppressed: false, reasons: [] },
    )
  },
}))

// ── buildCrmPeopleQuery mock ─────────────────────────────────────────────────
// The real builder is unit-tested elsewhere. Here we record the (ast, scope,
// opts) it was called with and return a thenable that yields a page of {id} rows
// from a configurable population, honoring an optional .in('id', ids) constraint
// and the limit/offset paging the resolver uses.
type BuildCall = { ast: unknown; scope: string | null; opts: { limit?: number; offset?: number } }
const buildCalls: BuildCall[] = []
// The population the compiled query "matches" before any .in() constraint.
let population: number[] = []
let queryError: string | null = null

vi.mock('@/lib/data/crm/buildCrmPeopleQuery', () => ({
  buildCrmPeopleQuery: (
    _sb: unknown,
    ast: unknown,
    scope: string | null,
    opts: { limit?: number; offset?: number } = {},
  ) => {
    buildCalls.push({ ast, scope, opts })
    let restrict: number[] | null = null
    const chain: Record<string, unknown> = {}
    chain.select = () => chain
    chain.in = (_col: string, ids: number[]) => {
      restrict = ids
      return chain
    }
    ;(chain as { then: unknown }).then = (resolve: (v: unknown) => unknown) => {
      if (queryError) return resolve({ data: null, error: { message: queryError } })
      let matched = population
      if (restrict) {
        const set = new Set(restrict)
        matched = population.filter((id) => set.has(id))
      }
      const from = opts.offset ?? 0
      const to = from + (opts.limit ?? matched.length)
      const page = matched.slice(from, to).map((id) => ({ id }))
      return resolve({ data: page, error: null })
    }
    return { query: chain }
  },
}))

// ── getSavedViewSegment mock ─────────────────────────────────────────────────
// resolveAudienceIds({viewId}) recovers the view's segment through the DAL reader.
// We drive its return per test (null = view not found). savedViewToSegment is the
// real PURE recovery (re-exported by the audience bus), tested directly below.
import { savedViewToSegment as realSavedViewToSegment } from '@/lib/data/crm/getSavedViewSegment'
let viewSegment: unknown | null = null
let viewSegmentThrows: string | null = null
vi.mock('@/lib/data/crm/getSavedViewSegment', async () => {
  const actual = await vi.importActual<typeof import('@/lib/data/crm/getSavedViewSegment')>(
    '@/lib/data/crm/getSavedViewSegment',
  )
  return {
    savedViewToSegment: actual.savedViewToSegment,
    getSavedViewSegment: (_viewId: number) => {
      if (viewSegmentThrows) throw new Error(viewSegmentThrows)
      return Promise.resolve(viewSegment)
    },
  }
})

import {
  resolveAudienceIds,
  resolveSendableAudience,
  savedViewToSegment,
  cleanIds,
  isIdsSelection,
  isAstSelection,
  isViewSelection,
} from '@/lib/crm/audience'
import { EMPTY_SEGMENT } from '@/lib/crm/segment-ast'

// The audience bus is not given a real Supabase client in these tests — every
// person read is the mocked buildCrmPeopleQuery, the view read is the mocked
// getSavedViewSegment. A bare object stand-in suffices.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = () => ({}) as any

beforeEach(() => {
  suppressedIds = {}
  suppressThrowsFor = null
  buildCalls.length = 0
  population = []
  queryError = null
  viewSegment = null
  viewSegmentThrows = null
})
afterEach(() => vi.clearAllMocks())

// ── Pure helpers ─────────────────────────────────────────────────────────────

describe('cleanIds', () => {
  it('dedupes and drops non-positive / non-integer ids', () => {
    expect(cleanIds([3, 3, 0, -1, 2.5, 5])).toEqual([3, 5])
    expect(cleanIds(null)).toEqual([])
    expect(cleanIds(undefined)).toEqual([])
  })
})

describe('selection type guards', () => {
  it('discriminate the three shapes', () => {
    expect(isIdsSelection({ ids: [1] })).toBe(true)
    expect(isAstSelection({ ast: EMPTY_SEGMENT })).toBe(true)
    expect(isViewSelection({ viewId: 7 })).toBe(true)
    expect(isIdsSelection({ viewId: 7 } as never)).toBe(false)
    expect(isViewSelection({ ids: [1] } as never)).toBe(false)
  })
})

describe('savedViewToSegment', () => {
  it('prefers a stored ast', () => {
    const ast = { type: 'group', op: 'and', nodes: [{ field: 'stage', value: 'Lead' }] }
    expect(savedViewToSegment({ ast })).toEqual(ast)
  })
  it('falls back to upgrading the legacy filter bag', () => {
    const seg = savedViewToSegment({ filter: { stage: 'Pending' } })
    expect(seg.type).toBe('group')
    expect(seg.nodes).toEqual([{ field: 'stage', value: 'Pending' }])
  })
  it('returns the EMPTY_SEGMENT for a row with neither, and for null', () => {
    expect(savedViewToSegment({})).toEqual(EMPTY_SEGMENT)
    expect(savedViewToSegment(null)).toEqual(EMPTY_SEGMENT)
  })
  it('throws on a malformed stored ast (never compiles garbage)', () => {
    expect(() => savedViewToSegment({ ast: { type: 'group', op: 'bogus', nodes: [] } })).toThrow()
  })
})

// ── resolveAudienceIds: all three shapes ─────────────────────────────────────

describe('resolveAudienceIds', () => {
  it('{ids}: intersects the explicit set with the scoped population', async () => {
    // Restricted broker. Their book contains 1,2,3,4; the explicit ask is 2,3,99.
    population = [1, 2, 3, 4]
    const ids = await resolveAudienceIds(sb(), { ids: [2, 3, 99] }, 'rebecca')
    expect(ids.sort()).toEqual([2, 3])
    // It compiled an EMPTY ("everyone") segment under the broker scope.
    expect(buildCalls[0].scope).toBe('rebecca')
    expect(buildCalls[0].ast).toEqual(EMPTY_SEGMENT)
  })

  it('{ids}: an empty explicit set short-circuits to [] (no everyone scan)', async () => {
    population = [1, 2, 3]
    const ids = await resolveAudienceIds(sb(), { ids: [] }, null)
    expect(ids).toEqual([])
    expect(buildCalls).toHaveLength(0)
  })

  it('{ast}: resolves every matching contact under scope', async () => {
    population = [10, 20, 30]
    const ast = { type: 'group' as const, op: 'and' as const, nodes: [] }
    const ids = await resolveAudienceIds(sb(), { ast }, null)
    expect(ids).toEqual([10, 20, 30])
    expect(buildCalls[0].scope).toBeNull()
  })

  it('{viewId}: loads the view segment then resolves it under scope', async () => {
    population = [5, 6, 7]
    viewSegment = { type: 'group', op: 'and', nodes: [{ field: 'stage', value: 'Lead' }] }
    const ids = await resolveAudienceIds(sb(), { viewId: 42 }, 'paul')
    expect(ids).toEqual([5, 6, 7])
    expect(buildCalls[0].scope).toBe('paul')
    expect(buildCalls[0].ast).toEqual(viewSegment)
  })

  it('{viewId}: a legacy filter-only view resolves via the upgrade path', async () => {
    population = [8]
    // The DAL reader already returns the upgraded segment for a legacy view.
    viewSegment = realSavedViewToSegment({ filter: { stage: 'Pending' } })
    const ids = await resolveAudienceIds(sb(), { viewId: 1 }, null)
    expect(ids).toEqual([8])
    expect((buildCalls[0].ast as { nodes: unknown[] }).nodes).toEqual([
      { field: 'stage', value: 'Pending' },
    ])
  })

  it('{viewId}: a missing view throws', async () => {
    viewSegment = null
    await expect(resolveAudienceIds(sb(), { viewId: 999 }, null)).rejects.toThrow(/not found/)
  })

  it('pages a population larger than one page', async () => {
    population = Array.from({ length: 2500 }, (_, i) => i + 1)
    const ids = await resolveAudienceIds(sb(), { ast: EMPTY_SEGMENT }, null)
    expect(ids).toHaveLength(2500)
    // 1000-per-page → 3 build calls (1000, 1000, 500).
    expect(buildCalls).toHaveLength(3)
  })

  it('propagates a query error', async () => {
    queryError = 'permission denied'
    await expect(resolveAudienceIds(sb(), { ast: EMPTY_SEGMENT }, null)).rejects.toThrow(/permission denied/)
  })
})

// ── resolveSendableAudience: suppression drop, fail-closed ───────────────────

describe('resolveSendableAudience', () => {
  it('drops suppressed contacts and records the reasons', async () => {
    population = [1, 2, 3, 4]
    suppressedIds = { 2: ['tag:do_not_email'], 4: ['all:compliance:hard-stop'] }
    const res = await resolveSendableAudience(sb(), { ast: EMPTY_SEGMENT }, null, 'email')
    expect(res.ids.sort()).toEqual([1, 3])
    expect(res.skipped).toBe(2)
    expect(res.skippedReasons[2]).toEqual(['tag:do_not_email'])
    expect(res.skippedReasons[4]).toEqual(['all:compliance:hard-stop'])
  })

  it('fails CLOSED: a thrown suppression check marks the contact skipped', async () => {
    population = [1, 2]
    suppressThrowsFor = 2
    const res = await resolveSendableAudience(sb(), { ast: EMPTY_SEGMENT }, null, 'sms')
    expect(res.ids).toEqual([1])
    expect(res.skipped).toBe(1)
    expect(res.skippedReasons[2][0]).toMatch(/threw/)
  })

  it('respects scope through the underlying resolve', async () => {
    population = [1, 2, 3]
    await resolveSendableAudience(sb(), { ids: [1, 2] }, 'rebecca', 'email')
    expect(buildCalls[0].scope).toBe('rebecca')
  })
})
