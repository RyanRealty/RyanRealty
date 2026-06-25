import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// crm_saved_views read double. maybeSingle yields the configured row/error.
let row: { id?: number; ast?: unknown; filter?: unknown } | null = null
let readError: string | null = null
function makeQuery() {
  const chain: Record<string, unknown> = {}
  chain.select = () => chain
  chain.eq = () => chain
  chain.maybeSingle = () =>
    Promise.resolve(readError ? { data: null, error: { message: readError } } : { data: row, error: null })
  return chain
}
vi.mock('@/lib/supabase/service', () => ({
  createServiceClient: () => ({ from: () => makeQuery() }),
}))

import { savedViewToSegment, getSavedViewSegment } from '@/lib/data/crm/getSavedViewSegment'
import { EMPTY_SEGMENT } from '@/lib/crm/segment-ast'

beforeEach(() => {
  row = null
  readError = null
})
afterEach(() => vi.clearAllMocks())

describe('savedViewToSegment (pure)', () => {
  it('prefers a stored ast', () => {
    const ast = { type: 'group', op: 'and', nodes: [{ field: 'source', value: 'fub' }] }
    expect(savedViewToSegment({ ast })).toEqual(ast)
  })
  it('upgrades a legacy filter bag when there is no ast', () => {
    const seg = savedViewToSegment({ filter: { stage: 'Lead', tagsAny: ['a', 'b'] } })
    // stage condition + an OR group over the two tags.
    expect(seg.nodes).toHaveLength(2)
    expect(seg.nodes[0]).toEqual({ field: 'stage', value: 'Lead' })
  })
  it('returns EMPTY_SEGMENT for null / empty rows', () => {
    expect(savedViewToSegment(null)).toEqual(EMPTY_SEGMENT)
    expect(savedViewToSegment({})).toEqual(EMPTY_SEGMENT)
  })
  it('throws on a malformed stored ast', () => {
    expect(() => savedViewToSegment({ ast: { type: 'group', op: 'xor', nodes: [] } })).toThrow()
  })
})

describe('getSavedViewSegment (read)', () => {
  it('returns the recovered segment for an existing view', async () => {
    row = { id: 1, ast: { type: 'group', op: 'and', nodes: [] } }
    expect(await getSavedViewSegment(1)).toEqual(row.ast)
  })
  it('returns null for a non-existent view', async () => {
    row = null
    expect(await getSavedViewSegment(123)).toBeNull()
  })
  it('fails soft (null) on an unreadable table', async () => {
    readError = 'permission denied'
    expect(await getSavedViewSegment(1)).toBeNull()
  })
  it('rejects an invalid id without a read', async () => {
    expect(await getSavedViewSegment(0)).toBeNull()
    expect(await getSavedViewSegment(-5)).toBeNull()
    expect(await getSavedViewSegment(NaN)).toBeNull()
  })
})
