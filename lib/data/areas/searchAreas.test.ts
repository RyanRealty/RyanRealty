import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * Unit tests for the search_areas DAL. A chainable Supabase double records
 * every filter so the tests assert the OWNER-SCOPING invariant: every
 * user-scoped read/write carries BOTH the row id and the user id in the same
 * WHERE chain (the same discipline as lib/data/leads/listingAlerts.ts).
 */

type Recorded = {
  table: string
  op: 'select' | 'insert' | 'update' | 'delete' | null
  eqs: Array<[string, unknown]>
  ins: Array<[string, unknown[]]>
  payload: unknown
}

let queries: Recorded[] = []
let nextData: unknown = null
let nextError: { code?: string; message: string } | null = null

function makeQuery(table: string) {
  const rec: Recorded = { table, op: null, eqs: [], ins: [], payload: null }
  queries.push(rec)
  const chain: Record<string, unknown> = {}
  const ret = () => chain
  chain.select = (_cols?: string) => {
    if (!rec.op) rec.op = 'select'
    return chain
  }
  chain.insert = (payload: unknown) => {
    rec.op = 'insert'
    rec.payload = payload
    return chain
  }
  chain.update = (payload: unknown) => {
    rec.op = 'update'
    rec.payload = payload
    return chain
  }
  chain.delete = () => {
    rec.op = 'delete'
    return chain
  }
  chain.eq = (col: string, value: unknown) => {
    rec.eqs.push([col, value])
    return chain
  }
  chain.in = (col: string, values: unknown[]) => {
    rec.ins.push([col, values])
    return chain
  }
  chain.not = ret
  chain.order = ret
  chain.limit = ret
  chain.maybeSingle = () => Promise.resolve({ data: nextData, error: nextError })
  chain.single = () => Promise.resolve({ data: nextData, error: nextError })
  // Awaiting the chain directly (list reads / deletes).
  chain.then = (resolve: (v: unknown) => unknown) =>
    Promise.resolve({ data: nextData, error: nextError }).then(resolve)
  return chain
}

vi.mock('@/lib/supabase/service', () => ({
  createServiceClient: () => ({ from: (table: string) => makeQuery(table) }),
}))

// unstable_cache passthrough so the public reads run their fetchers directly.
vi.mock('next/cache', () => ({
  unstable_cache: (fn: (...args: unknown[]) => unknown) => fn,
}))

import {
  listAreasForUser,
  getAreaForUser,
  getAreasByIds,
  createAreaForUser,
  updateAreaForUser,
  deleteAreaForUser,
  setAreaPublicById,
  getPublicAreaBySlug,
} from './searchAreas'
import type { AreaShape } from './validation'

const SHAPES: AreaShape[] = [
  { type: 'polygon', coords: [[-121.4, 44.0], [-121.25, 44.0], [-121.25, 44.12]] },
]

beforeEach(() => {
  queries = []
  nextData = null
  nextError = null
})

describe('owner scoping — id AND user_id on every user-scoped call', () => {
  it('listAreasForUser filters by owner_user_id and refuses a blank id', async () => {
    nextData = []
    await listAreasForUser('user-1')
    expect(queries[0]?.eqs).toContainEqual(['owner_user_id', 'user-1'])
    queries = []
    expect(await listAreasForUser('')).toEqual([])
    expect(queries).toHaveLength(0)
  })

  it('getAreaForUser carries both id and owner_user_id', async () => {
    await getAreaForUser('a1', 'user-1')
    expect(queries[0]?.eqs).toEqual(
      expect.arrayContaining([['id', 'a1'], ['owner_user_id', 'user-1']]),
    )
  })

  it('updateAreaForUser carries both id and owner_user_id', async () => {
    nextData = { id: 'a1' }
    await updateAreaForUser('a1', 'user-1', { name: 'Renamed' })
    const rec = queries[0]!
    expect(rec.op).toBe('update')
    expect(rec.eqs).toEqual(expect.arrayContaining([['id', 'a1'], ['owner_user_id', 'user-1']]))
  })

  it('updateAreaForUser reports not-found when the scoped row is missing', async () => {
    nextData = null
    const result = await updateAreaForUser('a1', 'somebody-else', { name: 'Hijack' })
    expect(result).toEqual({ ok: false, error: 'Area not found' })
  })

  it('deleteAreaForUser carries both id and owner_user_id', async () => {
    await deleteAreaForUser('a1', 'user-1')
    const rec = queries[0]!
    expect(rec.op).toBe('delete')
    expect(rec.eqs).toEqual(expect.arrayContaining([['id', 'a1'], ['owner_user_id', 'user-1']]))
  })
})

describe('createAreaForUser', () => {
  it('inserts owner, kind, name, shapes', async () => {
    nextData = { id: 'new-id' }
    const result = await createAreaForUser({
      userId: 'user-1',
      name: 'Bend West Side',
      shapes: SHAPES,
      ownerKind: 'broker',
    })
    expect(result).toEqual({ ok: true, id: 'new-id' })
    expect(queries[0]?.payload).toMatchObject({
      owner_user_id: 'user-1',
      owner_kind: 'broker',
      name: 'Bend West Side',
      shapes: SHAPES,
    })
  })
  it('maps a unique violation to the duplicate-name message', async () => {
    nextError = { code: '23505', message: 'duplicate key value violates unique constraint "search_areas_owner_lower_name_key"' }
    const result = await createAreaForUser({ userId: 'user-1', name: 'Dup', shapes: SHAPES })
    expect(result).toEqual({ ok: false, error: 'You already have an area with that name.' })
  })
})

describe('setAreaPublicById', () => {
  it('publishing requires a slug and stamps owner_kind broker', async () => {
    expect(await setAreaPublicById('a1', { isPublic: true, slug: '' })).toEqual({
      ok: false,
      error: 'A public area needs a URL slug.',
    })
    nextData = { id: 'a1' }
    await setAreaPublicById('a1', { isPublic: true, slug: 'bend-west-side' })
    const rec = queries.at(-1)!
    expect(rec.payload).toEqual({ is_public: true, slug: 'bend-west-side', owner_kind: 'broker' })
  })
  it('unpublishing clears the slug so the URL is freed', async () => {
    nextData = { id: 'a1' }
    await setAreaPublicById('a1', { isPublic: false })
    expect(queries[0]?.payload).toEqual({ is_public: false, slug: null })
  })
  it('maps a slug collision to the taken-slug message', async () => {
    nextError = { code: '23505', message: 'duplicate key value violates unique constraint "search_areas_slug_key"' }
    const result = await setAreaPublicById('a1', { isPublic: true, slug: 'taken' })
    expect(result).toEqual({ ok: false, error: 'That URL slug is already taken.' })
  })
})

describe('public + engine reads', () => {
  it('getPublicAreaBySlug filters is_public=true and normalizes the slug', async () => {
    nextData = { id: 'a1', slug: 'bend-west-side' }
    await getPublicAreaBySlug('  Bend-West-Side ')
    expect(queries[0]?.eqs).toEqual(
      expect.arrayContaining([['slug', 'bend-west-side'], ['is_public', true]]),
    )
  })
  it('getAreasByIds dedupes, trims, drops blanks, and caps at 50', async () => {
    nextData = []
    await getAreasByIds([' a ', 'a', '', 'b', ...Array.from({ length: 60 }, (_, i) => `x${i}`)])
    const [col, values] = queries[0]!.ins[0]!
    expect(col).toBe('id')
    expect(values.slice(0, 2)).toEqual(['a', 'b'])
    expect(values.length).toBe(50)
    queries = []
    expect(await getAreasByIds([])).toEqual([])
    expect(queries).toHaveLength(0)
  })
})
