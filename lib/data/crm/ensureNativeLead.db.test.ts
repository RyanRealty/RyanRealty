import { describe, it, expect, vi, beforeEach } from 'vitest'

// CLUSTER C (FUB cutover). These DB-touching tests lock the native enrichment
// paths that replaced the dead FUB enrichment chain:
//   - ensureNativeLead REUSE merges the caller's tags + refreshes source/broker
//   - enrichNativeLead unions tags, merges custom jsonb, sets assigned_broker,
//     and writes a crm_timeline origin note
//   - createNativeTask inserts a crm_tasks row
// The query builder is faked so no Supabase connection is needed.

// ── Lead-routing: keep the create path deterministic (round-robin → matt). ──
vi.mock('@/lib/crm/lead-routing', () => ({
  pickRoutedBroker: vi.fn(async () => 'matt'),
}))

// ── Fake Supabase query builder ──────────────────────────────────────────────
type Row = Record<string, unknown>

// Per-table canned read responses + captured writes for assertions.
const state: {
  contactPointPersonId: number | null
  personRow: Row | null
  inserts: Array<{ table: string; payload: unknown }>
  updates: Array<{ table: string; payload: Row; eqId: number | null }>
} = { contactPointPersonId: null, personRow: null, inserts: [], updates: [] }

function makeBuilder(table: string) {
  let lastEqId: number | null = null
  const builder: Record<string, unknown> = {}
  builder.select = () => builder
  builder.eq = (col: string, val: unknown) => {
    if (col === 'id') lastEqId = Number(val)
    return builder
  }
  builder.limit = () => builder
  builder.maybeSingle = async () => {
    if (table === 'crm_contact_points') {
      return state.contactPointPersonId === null
        ? { data: null, error: null }
        : { data: { person_id: state.contactPointPersonId }, error: null }
    }
    if (table === 'crm_people') {
      return { data: state.personRow, error: null }
    }
    return { data: null, error: null }
  }
  builder.single = async () => {
    // create path: crm_people insert(...).select('id').single()
    return { data: { id: 9001 }, error: null }
  }
  builder.insert = (payload: unknown) => {
    state.inserts.push({ table, payload })
    // chainable for .select().single() (crm_people create) and awaitable for the rest
    const insertResult: Record<string, unknown> = {
      select: () => ({ single: builder.single }),
      then: (resolve: (v: { error: null }) => unknown) => resolve({ error: null }),
    }
    return insertResult
  }
  builder.update = (payload: Row) => {
    const upd = {
      eq: async (_col: string, val: unknown) => {
        state.updates.push({ table, payload, eqId: Number(val) })
        return { error: null }
      },
    }
    return upd
  }
  void lastEqId
  return builder
}

vi.mock('@/lib/supabase/service', () => ({
  createServiceClient: () => ({ from: (table: string) => makeBuilder(table) }),
}))

import { ensureNativeLead, enrichNativeLead, createNativeTask, cleanTags } from './ensureNativeLead'

beforeEach(() => {
  state.contactPointPersonId = null
  state.personRow = null
  state.inserts = []
  state.updates = []
})

describe('cleanTags', () => {
  it('trims, dedupes, drops empties and over-long tags', () => {
    expect(cleanTags(['  a ', 'a', '', undefined, null, 'b'])).toEqual(['a', 'b'])
    expect(cleanTags(['x'.repeat(81)])).toEqual([])
  })
})

describe('ensureNativeLead REUSE merges tags', () => {
  it('unions the new tags onto an existing person and refreshes source + broker', async () => {
    // Existing person resolves by email; current tags lack the new audience tag.
    state.contactPointPersonId = 555
    state.personRow = { tags: ['source:old', 'existing:tag'] }

    const res = await ensureNativeLead({
      name: 'Jane Seller',
      email: 'jane@example.com',
      source: 'seller-lp',
      assignedBroker: 'rebecca',
      tags: ['audience:seller', 'seller:hot', 'existing:tag'],
    })

    expect(res).toEqual({ personId: 555, created: false })
    // It must NOT create a new person on reuse.
    expect(state.inserts.find((i) => i.table === 'crm_people')).toBeUndefined()
    // It must update the existing person with the unioned tags + source + broker.
    const update = state.updates.find((u) => u.table === 'crm_people')
    expect(update).toBeDefined()
    expect(update!.eqId).toBe(555)
    expect(update!.payload.source).toBe('seller-lp')
    expect(update!.payload.assigned_broker).toBe('rebecca')
    const tags = update!.payload.tags as string[]
    // union preserves existing + adds new, deduped
    expect(tags).toEqual(expect.arrayContaining(['source:old', 'existing:tag', 'audience:seller', 'seller:hot']))
    // no duplicate of existing:tag
    expect(tags.filter((t) => t === 'existing:tag')).toHaveLength(1)
  })

  it('skips the update when nothing changes (incoming already present, no canonical add)', async () => {
    state.contactPointPersonId = 77
    // a non-signal tag → canonical tagger derives nothing → true no-op.
    state.personRow = { tags: ['source:manual-import'] }
    const res = await ensureNativeLead({ email: 'a@b.com', source: '', tags: ['source:manual-import'] })
    expect(res).toEqual({ personId: 77, created: false })
    expect(state.updates.find((u) => u.table === 'crm_people')).toBeUndefined()
  })

  it('canonicalizes on reuse — an audience:seller lead gains segment:seller so it lands in the Sellers list', async () => {
    state.contactPointPersonId = 88
    state.personRow = { tags: ['audience:seller'] }
    const res = await ensureNativeLead({ email: 'c@d.com', source: '', tags: ['audience:seller'] })
    expect(res).toEqual({ personId: 88, created: false })
    const update = state.updates.find((u) => u.table === 'crm_people')
    expect(update).toBeDefined()
    expect(update!.payload.tags as string[]).toEqual(expect.arrayContaining(['audience:seller', 'segment:seller']))
  })
})

describe('enrichNativeLead native enrichment', () => {
  it('unions tags, merges custom jsonb, sets broker, and writes an origin note', async () => {
    state.personRow = { tags: ['source:seller-lp'], custom: { existingKey: 'keep' } }

    await enrichNativeLead({
      personId: 9001,
      tags: ['audience:seller', 'seller:hot'],
      custom: { leadTier: 'hot', sellerPropertyAddress: '123 Main St' },
      assignedBroker: 'paul',
      originNote: { title: 'Seller LP lead', body: 'Why this lead came in.' },
    })

    const update = state.updates.find((u) => u.table === 'crm_people')
    expect(update).toBeDefined()
    expect(update!.eqId).toBe(9001)
    expect(update!.payload.assigned_broker).toBe('paul')
    const tags = update!.payload.tags as string[]
    expect(tags).toEqual(expect.arrayContaining(['source:seller-lp', 'audience:seller', 'seller:hot']))
    const custom = update!.payload.custom as Record<string, unknown>
    // existing custom key preserved + new keys merged
    expect(custom).toMatchObject({ existingKey: 'keep', leadTier: 'hot', sellerPropertyAddress: '123 Main St' })

    // origin note written to crm_timeline
    const note = state.inserts.find((i) => i.table === 'crm_timeline')
    expect(note).toBeDefined()
    const payload = note!.payload as Row
    expect(payload.person_id).toBe(9001)
    expect(payload.kind).toBe('note')
    expect(payload.broker).toBe('paul')
    expect(payload.body).toBe('Why this lead came in.')
  })

  it('is a no-op on an invalid person id', async () => {
    await enrichNativeLead({ personId: 0, tags: ['x'] })
    expect(state.updates).toHaveLength(0)
    expect(state.inserts).toHaveLength(0)
  })
})

describe('createNativeTask', () => {
  it('inserts a crm_tasks row with a future due date and the assigned broker', async () => {
    await createNativeTask({
      personId: 42,
      name: 'Hot seller LP lead - call within 5 min',
      type: 'Call',
      dueInMinutes: 5,
      assignedBroker: 'matt',
    })
    const task = state.inserts.find((i) => i.table === 'crm_tasks')
    expect(task).toBeDefined()
    const payload = task!.payload as Row
    expect(payload.person_id).toBe(42)
    expect(payload.type).toBe('Call')
    expect(payload.assigned_broker).toBe('matt')
    expect(payload.origin).toBe('lp-form')
    expect(typeof payload.due_at).toBe('string')
    expect(new Date(payload.due_at as string).getTime()).toBeGreaterThan(Date.now())
  })

  it('is a no-op without a name or a valid person id', async () => {
    await createNativeTask({ personId: 0, name: 'x' })
    await createNativeTask({ personId: 5, name: '   ' })
    expect(state.inserts.find((i) => i.table === 'crm_tasks')).toBeUndefined()
  })
})
