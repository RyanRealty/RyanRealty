import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * The history writer replaces a listing's stored history only with a whole
 * one. A partial answer (a later page failed, or a first page that cannot be
 * shown whole) used to replace it anyway and delete every event it lacked
 * (code review 2026-10-01).
 */

type Answer = { items: unknown[]; ok: boolean; partial?: boolean; status?: number }

const state = {
  history: { items: [], ok: true, partial: false } as Answer,
  price: { items: [], ok: true, partial: false } as Answer,
  replaced: [] as { key: string; rows: number }[],
  replaceFails: false,
}

vi.mock('@/lib/spark', () => ({
  fetchSparkListingHistory: vi.fn(async () => state.history),
  fetchSparkPriceHistory: vi.fn(async () => state.price),
}))
vi.mock('@/lib/listing-mapper', () => ({ sparkHistoryItemToRow: vi.fn((key: string, item: unknown) => ({ key, item })) }))
vi.mock('@/lib/data/sync/syncWrites', () => ({
  replaceListingHistoryForKey: vi.fn(async (key: string, rows: unknown[]) => {
    if (state.replaceFails) return { ok: false, inserted: 0, error: 'write failed' }
    state.replaced.push({ key, rows: rows.length })
    return { ok: true, inserted: rows.length }
  }),
}))

import { fetchAndInsertHistoryCore } from './fetchListingHistory'

beforeEach(() => {
  state.history = { items: [], ok: true, partial: false }
  state.price = { items: [], ok: true, partial: false }
  state.replaced = []
  state.replaceFails = false
})

describe('fetchAndInsertHistoryCore', () => {
  it('replaces the stored history with a whole one', async () => {
    state.history = { items: [1, 2, 3], ok: true, partial: false }
    const r = await fetchAndInsertHistoryCore('t', 'k')
    expect(state.replaced).toEqual([{ key: 'k', rows: 3 }])
    expect(r).toMatchObject({ inserted: 3, ok: true })
  })

  it('keeps the stored history when the answer is partial', async () => {
    state.history = { items: Array.from({ length: 200 }, (_, i) => i), ok: false, partial: true }
    const r = await fetchAndInsertHistoryCore('t', 'k')
    expect(state.replaced).toEqual([])
    expect(r).toMatchObject({ inserted: 0, ok: false })
    expect(r.items).toHaveLength(200)
  })

  it('falls back to the price history when the full history answers empty', async () => {
    state.price = { items: [1, 2], ok: true, partial: false }
    const r = await fetchAndInsertHistoryCore('t', 'k')
    expect(state.replaced).toEqual([{ key: 'k', rows: 2 }])
    expect(r).toMatchObject({ inserted: 2, ok: true })
  })

  it('falls back to the price history when the full history is not ours to read', async () => {
    state.history = { items: [], ok: false, status: 403 }
    state.price = { items: [1, 2], ok: true, partial: false }
    const r = await fetchAndInsertHistoryCore('t', 'k')
    expect(state.replaced).toEqual([{ key: 'k', rows: 2 }])
    expect(r).toMatchObject({ ok: true })
  })

  it('never swaps in the price history when the full history failed for a while', async () => {
    for (const status of [429, 500, undefined]) {
      state.history = { items: [], ok: false, status, partial: status === undefined ? true : undefined }
      state.price = { items: [1, 2], ok: true, partial: false }
      state.replaced = []
      const r = await fetchAndInsertHistoryCore('t', 'k')
      expect(state.replaced).toEqual([])
      expect(r).toMatchObject({ inserted: 0, ok: false })
    }
  })

  it('reports a history that did not save as not saved', async () => {
    state.history = { items: [1, 2, 3], ok: true, partial: false }
    state.replaceFails = true
    const r = await fetchAndInsertHistoryCore('t', 'k')
    expect(r).toMatchObject({ inserted: 0, ok: false })
  })
})
