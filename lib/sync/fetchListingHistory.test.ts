import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * The history writer replaces a listing's stored history only with a whole
 * one. A partial answer (a later page failed, or a first page that cannot be
 * shown whole) used to replace it anyway and delete every event it lacked
 * (code review 2026-10-01).
 */

const state = {
  history: { items: [] as unknown[], ok: true, partial: false as boolean | undefined },
  price: { items: [] as unknown[], ok: true, partial: false as boolean | undefined },
  replaced: [] as { key: string; rows: number }[],
}

vi.mock('@/lib/spark', () => ({
  fetchSparkListingHistory: vi.fn(async () => state.history),
  fetchSparkPriceHistory: vi.fn(async () => state.price),
}))
vi.mock('@/lib/listing-mapper', () => ({ sparkHistoryItemToRow: vi.fn((key: string, item: unknown) => ({ key, item })) }))
vi.mock('@/lib/data/sync/syncWrites', () => ({
  replaceListingHistoryForKey: vi.fn(async (key: string, rows: unknown[]) => {
    state.replaced.push({ key, rows: rows.length })
    return { ok: true, inserted: rows.length }
  }),
}))

import { fetchAndInsertHistoryCore } from './fetchListingHistory'

beforeEach(() => {
  state.history = { items: [], ok: true, partial: false }
  state.price = { items: [], ok: true, partial: false }
  state.replaced = []
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
})
