import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// ── Mocks ────────────────────────────────────────────────────────────────────

// Access gate. Default = authorized superuser; a test can null it out.
let access: { ok: true; access: unknown } | { ok: false; error: string } = {
  ok: true,
  access: { email: 'matt@ryan-realty.com', role: 'superuser', brokerSlug: 'matt' },
}
vi.mock('@/app/actions/crm', () => ({
  requireCrmAccess: () => Promise.resolve(access),
}))

// revalidatePath is a no-op in test.
vi.mock('next/cache', () => ({ revalidatePath: () => undefined }))

// Template admin list — tests set which keys are live.
let liveTemplates: Array<{ key: string; isActive: boolean }> = []
vi.mock('@/lib/data/crm/getCrmTemplatesAdmin', () => ({
  getCrmTemplatesAdmin: () => Promise.resolve(liveTemplates),
  CRM_TEMPLATES_ADMIN_TAG: 'crm-templates-admin',
}))

// ── Supabase service-client double ────────────────────────────────────────────
//
// A per-table thenable chain. Each test seeds canned rows / counts / errors and
// asserts on the captured operations.

type Captured = {
  deletes: number
  inserts: unknown[]
  updates: unknown[]
}
const captured: Captured = { deletes: 0, inserts: [], updates: [] }

// Per-table canned responses the chain resolves to.
let seqRow: Record<string, unknown> | null = null // crm_sequences single/maybeSingle read
let seqReadError: string | null = null
let insertedId = 500
let insertError: string | null = null
let enrollmentCount = 0
let enrollmentCountError: string | null = null

function makeChain(table: string) {
  // The terminal value depends on the operation built up on the chain.
  const state: {
    op: 'select' | 'insert' | 'update' | 'delete' | null
    head: boolean
    insertPayload: unknown
    updatePayload: unknown
  } = { op: null, head: false, insertPayload: undefined, updatePayload: undefined }

  const chain: Record<string, unknown> = {}
  const ret = () => chain

  chain.select = (_cols?: string, opts?: { head?: boolean }) => {
    if (!state.op) state.op = 'select'
    if (opts?.head) state.head = true
    return chain
  }
  chain.insert = (payload: unknown) => {
    state.op = 'insert'
    state.insertPayload = payload
    captured.inserts.push({ table, payload })
    return chain
  }
  chain.update = (payload: unknown) => {
    state.op = 'update'
    state.updatePayload = payload
    captured.updates.push({ table, payload })
    return chain
  }
  chain.delete = () => {
    state.op = 'delete'
    captured.deletes++
    return chain
  }
  chain.eq = ret
  chain.in = ret
  chain.order = ret

  // Terminal reads that return a single row.
  const singleResult = () => ({
    data: state.op === 'insert' ? { id: insertedId } : seqRow,
    error:
      state.op === 'insert'
        ? insertError
          ? { message: insertError }
          : null
        : seqReadError
          ? { message: seqReadError }
          : null,
  })
  chain.single = () => Promise.resolve(singleResult())
  chain.maybeSingle = () => Promise.resolve(singleResult())

  // Thenable: awaiting the chain resolves based on the operation.
  ;(chain as { then: unknown }).then = (resolve: (v: unknown) => unknown) => {
    if (table === 'crm_sequence_enrollments' && state.head) {
      return resolve({
        count: enrollmentCount,
        error: enrollmentCountError ? { message: enrollmentCountError } : null,
      })
    }
    if (state.op === 'delete') {
      return resolve({ error: insertError ? { message: insertError } : null })
    }
    if (state.op === 'update') {
      return resolve({ error: insertError ? { message: insertError } : null })
    }
    return resolve({ data: seqRow, error: null })
  }
  return chain
}

vi.mock('@/lib/supabase/service', () => ({
  createServiceClient: () => ({ from: (table: string) => makeChain(table) }),
}))

import {
  createCrmSequenceAction,
  deleteCrmSequenceAction,
  duplicateCrmSequenceAction,
  archiveCrmSequenceAction,
  updateCrmSequenceStepsAction,
  updateCrmSequenceSettingsAction,
} from '@/app/actions/crm-sequences'

beforeEach(() => {
  access = { ok: true, access: { email: 'matt@ryan-realty.com', role: 'superuser', brokerSlug: 'matt' } }
  liveTemplates = []
  captured.deletes = 0
  captured.inserts = []
  captured.updates = []
  seqRow = null
  seqReadError = null
  insertedId = 500
  insertError = null
  enrollmentCount = 0
  enrollmentCountError = null
})
afterEach(() => vi.clearAllMocks())

describe('access gate', () => {
  it('every action refuses an unauthorized caller', async () => {
    access = { ok: false, error: 'Unauthorized' }
    expect((await createCrmSequenceAction({ name: 'X' })).ok).toBe(false)
    expect((await deleteCrmSequenceAction(1)).ok).toBe(false)
    expect((await duplicateCrmSequenceAction(1)).ok).toBe(false)
    expect((await archiveCrmSequenceAction(1)).ok).toBe(false)
    expect((await updateCrmSequenceStepsAction(1, [])).ok).toBe(false)
    expect((await updateCrmSequenceSettingsAction({ id: 1, name: 'X', stopOnReply: true })).ok).toBe(false)
  })

  it('every action refuses a restricted (non-superuser) broker', async () => {
    // An authenticated broker who is NOT a superuser must not author workflows.
    access = { ok: true, access: { email: 'rebecca@ryan-realty.com', role: 'broker', brokerSlug: 'rebecca' } }
    const create = await createCrmSequenceAction({ name: 'X' })
    expect(create.ok).toBe(false)
    if (!create.ok) expect(create.error.toLowerCase()).toContain('owner')
    expect((await deleteCrmSequenceAction(1)).ok).toBe(false)
    expect((await duplicateCrmSequenceAction(1)).ok).toBe(false)
    expect((await archiveCrmSequenceAction(1)).ok).toBe(false)
    expect((await updateCrmSequenceStepsAction(1, [])).ok).toBe(false)
    expect((await updateCrmSequenceSettingsAction({ id: 1, name: 'X', stopOnReply: true })).ok).toBe(false)
    // Nothing was written for any of the refused calls.
    expect(captured.inserts).toHaveLength(0)
    expect(captured.updates).toHaveLength(0)
    expect(captured.deletes).toBe(0)
  })
})

describe('createCrmSequenceAction', () => {
  it('creates a PAUSED sequence and returns its id', async () => {
    const r = await createCrmSequenceAction({ name: '  New flow  ', stopOnReply: false })
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.id).toBe(insertedId)
    const ins = captured.inserts[0] as { table: string; payload: Record<string, unknown> }
    expect(ins.table).toBe('crm_sequences')
    expect(ins.payload.status).toBe('paused')
    expect(ins.payload.name).toBe('New flow') // trimmed
    expect(ins.payload.stop_on_reply).toBe(false)
  })

  it('refuses a blank name', async () => {
    const r = await createCrmSequenceAction({ name: '   ' })
    expect(r.ok).toBe(false)
    expect(captured.inserts).toHaveLength(0)
  })

  it('refuses malformed steps (never inserts)', async () => {
    const r = await createCrmSequenceAction({ name: 'X', steps: [{ channel: 'task' }] })
    expect(r.ok).toBe(false)
    expect(captured.inserts).toHaveLength(0)
  })
})

describe('updateCrmSequenceStepsAction — templateKey validation', () => {
  it('refuses a step referencing an unknown template (never writes)', async () => {
    liveTemplates = [{ key: 'welcome-1', isActive: true }]
    seqRow = { id: 7 }
    const r = await updateCrmSequenceStepsAction(7, [{ channel: 'email', templateKey: 'ghost' }])
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error).toContain('ghost')
    expect(captured.updates).toHaveLength(0)
  })

  it('refuses a step referencing an INACTIVE template', async () => {
    liveTemplates = [{ key: 'welcome-1', isActive: false }]
    seqRow = { id: 7 }
    const r = await updateCrmSequenceStepsAction(7, [{ channel: 'email', templateKey: 'welcome-1' }])
    expect(r.ok).toBe(false)
    expect(captured.updates).toHaveLength(0)
  })

  it('writes when every templateKey resolves to a live template', async () => {
    liveTemplates = [{ key: 'welcome-1', isActive: true }]
    seqRow = { id: 7 }
    const r = await updateCrmSequenceStepsAction(7, [
      { channel: 'email', templateKey: 'welcome-1', delayDays: 1 },
      { channel: 'tag', addTags: ['audience:buyer'] },
    ])
    expect(r.ok).toBe(true)
    expect(captured.updates).toHaveLength(1)
    const upd = captured.updates[0] as { payload: { steps: unknown[] } }
    expect(upd.payload.steps).toHaveLength(2)
  })

  it('writes inline-body steps with no template lookup needed', async () => {
    seqRow = { id: 7 }
    const r = await updateCrmSequenceStepsAction(7, [{ channel: 'email', body: 'hello' }])
    expect(r.ok).toBe(true)
    expect(captured.updates).toHaveLength(1)
  })

  it('refuses malformed steps before any template check', async () => {
    seqRow = { id: 7 }
    const r = await updateCrmSequenceStepsAction(7, [{ channel: 'tag' }])
    expect(r.ok).toBe(false)
    expect(captured.updates).toHaveLength(0)
  })
})

describe('deleteCrmSequenceAction — refuses when unsafe', () => {
  it('refuses when the workflow has live enrollments', async () => {
    seqRow = { id: 9, fub_legacy_plan_id: null }
    enrollmentCount = 3
    const r = await deleteCrmSequenceAction(9)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error.toLowerCase()).toContain('enrollment')
    expect(captured.deletes).toBe(0)
  })

  it('refuses an auto-enroll master (has fub_legacy_plan_id)', async () => {
    seqRow = { id: 9, fub_legacy_plan_id: 69 }
    enrollmentCount = 0
    const r = await deleteCrmSequenceAction(9)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error.toLowerCase()).toContain('auto-enroll')
    expect(captured.deletes).toBe(0)
  })

  it('fails CLOSED when the enrollment count cannot be read', async () => {
    seqRow = { id: 9, fub_legacy_plan_id: null }
    enrollmentCountError = 'db down'
    const r = await deleteCrmSequenceAction(9)
    expect(r.ok).toBe(false)
    expect(captured.deletes).toBe(0)
  })

  it('refuses a missing workflow', async () => {
    seqRow = null
    const r = await deleteCrmSequenceAction(9)
    expect(r.ok).toBe(false)
    expect(captured.deletes).toBe(0)
  })

  it('deletes when no live enrollments and not a master', async () => {
    seqRow = { id: 9, fub_legacy_plan_id: null }
    enrollmentCount = 0
    const r = await deleteCrmSequenceAction(9)
    expect(r.ok).toBe(true)
    expect(captured.deletes).toBe(1)
  })
})

describe('archiveCrmSequenceAction', () => {
  it('soft-archives (status=archived) without touching enrollments', async () => {
    const r = await archiveCrmSequenceAction(9)
    expect(r.ok).toBe(true)
    const upd = captured.updates[0] as { table: string; payload: Record<string, unknown> }
    expect(upd.table).toBe('crm_sequences')
    expect(upd.payload.status).toBe('archived')
  })
})

describe('duplicateCrmSequenceAction', () => {
  it('deep-copies into a new PAUSED sequence without the master plan id', async () => {
    seqRow = {
      name: 'Seller flow',
      description: 'd',
      stop_on_reply: true,
      steps: [{ channel: 'email', templateKey: 'a' }],
    }
    const r = await duplicateCrmSequenceAction(3)
    expect(r.ok).toBe(true)
    const ins = captured.inserts[0] as { payload: Record<string, unknown> }
    expect(ins.payload.status).toBe('paused')
    expect(ins.payload.name).toBe('Seller flow (copy)')
    expect(ins.payload).not.toHaveProperty('fub_legacy_plan_id')
    expect(ins.payload.steps).toEqual([{ channel: 'email', templateKey: 'a' }])
  })

  it('refuses a missing source', async () => {
    seqRow = null
    const r = await duplicateCrmSequenceAction(3)
    expect(r.ok).toBe(false)
    expect(captured.inserts).toHaveLength(0)
  })
})

describe('updateCrmSequenceSettingsAction', () => {
  it('updates name/description/stop_on_reply', async () => {
    const r = await updateCrmSequenceSettingsAction({
      id: 4,
      name: '  Renamed  ',
      description: '  desc  ',
      stopOnReply: false,
    })
    expect(r.ok).toBe(true)
    const upd = captured.updates[0] as { payload: Record<string, unknown> }
    expect(upd.payload.name).toBe('Renamed')
    expect(upd.payload.description).toBe('desc')
    expect(upd.payload.stop_on_reply).toBe(false)
  })

  it('refuses a blank name', async () => {
    const r = await updateCrmSequenceSettingsAction({ id: 4, name: '  ', stopOnReply: true })
    expect(r.ok).toBe(false)
    expect(captured.updates).toHaveLength(0)
  })
})
