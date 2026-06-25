import { describe, it, expect, beforeEach } from 'vitest'
import {
  BULK_CHUNK_SIZE,
  chunkIds,
  chunkCount,
  isDrained,
  mergeBreakdown,
  normalizeResult,
  selectionIds,
  buildBulkJobInsert,
  registerBulkHandler,
  getBulkHandler,
  listBulkHandlerKinds,
  type BulkContext,
} from './bulk-jobs'

describe('chunkIds', () => {
  const ids = Array.from({ length: 600 }, (_, i) => i + 1)

  it('returns the first chunk at offset 0', () => {
    const c = chunkIds(ids, 0)
    expect(c.length).toBe(BULK_CHUNK_SIZE)
    expect(c[0]).toBe(1)
    expect(c[BULK_CHUNK_SIZE - 1]).toBe(BULK_CHUNK_SIZE)
  })

  it('resumes from a mid offset', () => {
    const c = chunkIds(ids, 250)
    expect(c[0]).toBe(251)
    expect(c.length).toBe(250)
  })

  it('returns the partial last chunk', () => {
    const c = chunkIds(ids, 500)
    expect(c).toEqual(ids.slice(500, 600))
    expect(c.length).toBe(100)
  })

  it('returns empty when fully drained', () => {
    expect(chunkIds(ids, 600)).toEqual([])
    expect(chunkIds(ids, 9999)).toEqual([])
  })

  it('clamps negative offset to 0', () => {
    expect(chunkIds(ids, -5)[0]).toBe(1)
  })

  it('honors a custom size', () => {
    expect(chunkIds(ids, 0, 10).length).toBe(10)
  })

  it('handles an empty id list', () => {
    expect(chunkIds([], 0)).toEqual([])
  })

  it('the union of every chunk reconstructs the full list with no overlap', () => {
    const size = 250
    let offset = 0
    const seen: number[] = []
    let guard = 0
    while (offset < ids.length && guard < 100) {
      const c = chunkIds(ids, offset, size)
      if (c.length === 0) break
      seen.push(...c)
      offset += c.length
      guard++
    }
    expect(seen).toEqual(ids)
  })
})

describe('chunkCount', () => {
  it('computes ceil division', () => {
    expect(chunkCount(600, 250)).toBe(3)
    expect(chunkCount(500, 250)).toBe(2)
    expect(chunkCount(501, 250)).toBe(3)
    expect(chunkCount(0, 250)).toBe(0)
  })
  it('defaults to BULK_CHUNK_SIZE', () => {
    expect(chunkCount(18000)).toBe(Math.ceil(18000 / BULK_CHUNK_SIZE))
  })
  it('never divides by zero', () => {
    expect(chunkCount(100, 0)).toBe(100)
  })
})

describe('isDrained', () => {
  it('true once processed reaches total', () => {
    expect(isDrained(600, 600)).toBe(true)
    expect(isDrained(600, 601)).toBe(true)
  })
  it('false while rows remain', () => {
    expect(isDrained(600, 599)).toBe(false)
    expect(isDrained(600, 0)).toBe(false)
  })
  it('an empty job is drained', () => {
    expect(isDrained(0, 0)).toBe(true)
  })
})

describe('mergeBreakdown', () => {
  it('adds counters additively', () => {
    expect(mergeBreakdown({ a: 1, b: 2 }, { a: 3, c: 5 })).toEqual({ a: 4, b: 2, c: 5 })
  })
  it('ignores undefined add', () => {
    expect(mergeBreakdown({ a: 1 }, undefined)).toEqual({ a: 1 })
  })
  it('drops non-finite values', () => {
    expect(mergeBreakdown({}, { x: Number.NaN, y: Infinity, z: 2 })).toEqual({ z: 2 })
  })
  it('does not mutate the base', () => {
    const base = { a: 1 }
    mergeBreakdown(base, { a: 1 })
    expect(base).toEqual({ a: 1 })
  })
})

describe('normalizeResult', () => {
  it('fills missing fields', () => {
    expect(normalizeResult(undefined)).toEqual({ processed: 0, skipped: 0, breakdown: {} })
    expect(normalizeResult({ processed: 5 })).toEqual({ processed: 5, skipped: 0, breakdown: {} })
  })
  it('floors and clamps negatives', () => {
    expect(normalizeResult({ processed: -3, skipped: 2.9 })).toEqual({ processed: 0, skipped: 2, breakdown: {} })
  })
})

describe('selectionIds', () => {
  it('extracts an ids-mode list', () => {
    expect(selectionIds({ ids: [1, 2, 3] })).toEqual([1, 2, 3])
  })
  it('filters non-integers', () => {
    expect(selectionIds({ ids: [1, 2.5 as unknown as number, 3] })).toEqual([1, 3])
  })
  it('returns null for ast-mode', () => {
    expect(selectionIds({ ast: { stage: 'Lead' } })).toBeNull()
  })
  it('returns null for null/undefined', () => {
    expect(selectionIds(null)).toBeNull()
    expect(selectionIds(undefined)).toBeNull()
  })
})

describe('buildBulkJobInsert', () => {
  it('stamps total for ids-mode and freezes scope', () => {
    const row = buildBulkJobInsert({
      kind: 'noop',
      selection: { ids: [10, 20, 30] },
      actorEmail: 'matt@ryan-realty.com',
      brokerScope: 'matt',
      params: { foo: 'bar' },
    })
    expect(row.kind).toBe('noop')
    expect(row.total).toBe(3)
    expect(row.status).toBe('queued')
    expect(row.broker_scope).toBe('matt')
    expect(row.actor_email).toBe('matt@ryan-realty.com')
    expect(row.params).toEqual({ foo: 'bar' })
    expect(row.selection).toEqual({ ids: [10, 20, 30] })
  })

  it('leaves total null for ast-mode (resolved at first claim)', () => {
    const row = buildBulkJobInsert({
      kind: 'noop',
      selection: { ast: { stage: 'Lead' } },
      actorEmail: 'matt@ryan-realty.com',
      brokerScope: null,
    })
    expect(row.total).toBeNull()
    expect(row.broker_scope).toBeNull()
    expect(row.params).toEqual({})
  })
})

describe('handler registry', () => {
  beforeEach(() => {
    // noop is registered at module load; confirm it survives.
    expect(getBulkHandler('noop')).toBeTypeOf('function')
  })

  it('registers and resolves a handler', () => {
    const fn = async () => ({ processed: 1 })
    registerBulkHandler('test:kind', fn)
    expect(getBulkHandler('test:kind')).toBe(fn)
  })

  it('last registration wins (idempotent re-import)', () => {
    registerBulkHandler('test:dup', async () => ({ processed: 1 }))
    const second = async () => ({ processed: 2 })
    registerBulkHandler('test:dup', second)
    expect(getBulkHandler('test:dup')).toBe(second)
  })

  it('returns undefined for an unknown kind', () => {
    expect(getBulkHandler('does-not-exist')).toBeUndefined()
  })

  it('lists registered kinds sorted, including noop', () => {
    const kinds = listBulkHandlerKinds()
    expect(kinds).toContain('noop')
    expect([...kinds]).toEqual([...kinds].sort())
  })

  it('the noop reference handler counts the chunk rows', async () => {
    const ctx: BulkContext = { jobId: 1, actorEmail: 'matt@ryan-realty.com', brokerScope: null }
    const res = await getBulkHandler('noop')!([1, 2, 3, 4], {}, ctx)
    expect(res.processed).toBe(4)
    expect(res.skipped).toBe(0)
    expect(res.breakdown).toEqual({ counted: 4 })
  })
})
