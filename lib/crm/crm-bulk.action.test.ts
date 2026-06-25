import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// ── Mocks ────────────────────────────────────────────────────────────────────

// getCrmAccess is the gate. Tests swap its return per case.
let access: { email: string; role: string; brokerSlug: string | null } | null = {
  email: 'matt@ryan-realty.com',
  role: 'superuser',
  brokerSlug: 'matt',
}
vi.mock('@/app/actions/crm', () => ({
  getCrmAccess: () => Promise.resolve(access),
}))

// Capture every enqueue so tests assert kind / selection / scope / params.
type Enqueued = {
  kind: string
  selection: unknown
  params: Record<string, unknown>
  actorEmail: string
  brokerScope: string | null
}
const enqueued: Enqueued[] = []
let nextJobId = 100
let enqueueThrows = false
vi.mock('@/lib/crm/bulk-jobs', () => ({
  enqueueBulkJob: (args: Enqueued) => {
    if (enqueueThrows) throw new Error('db down')
    enqueued.push(args)
    return Promise.resolve(nextJobId++)
  },
}))

// A tiny thenable Supabase double for the preflight counts. The last filter in
// the chain decides which canned count comes back: an .overlaps() call (the
// suppression sub-query) returns suppressedCount; otherwise totalCount.
//
// It ALSO serves the ids-mode enqueue pre-clamp, which routes through
// resolveAudienceIds -> buildCrmPeopleQuery as a ROW read (.select('id') then
// await -> { data: [...] }). When `clampReturnsIds` is set the row read returns
// those ids (the in-scope subset); otherwise it echoes back the .in() ids (a
// superuser / no-op clamp). The discriminator: a query that ever called
// .select('id') as a NON-count read resolves to { data } not { count }.
let totalCount = 0
let suppressedCount = 0
let countError: string | null = null
const seenIn: number[][] = []
let sawOverlaps = false
// When non-null, the ids-mode pre-clamp row read returns exactly these ids
// (simulating a scope intersection that drops foreign ids). Null = echo the
// requested ids back (no clamp / superuser).
let clampReturnsIds: number[] | null = null

function makeCountQuery(isSupp: boolean) {
  const result = {
    count: isSupp ? suppressedCount : totalCount,
    error: countError ? { message: countError } : null,
  }
  const chain: Record<string, unknown> = {}
  let isCountHead = false
  let isIdRowRead = false
  let lastIn: number[] | null = null
  const ret = () => chain
  chain.select = (_cols?: unknown, opts?: { head?: boolean }) => {
    // countOnly path passes { head: true }; a bare .select('id') is the row read.
    if (opts?.head) isCountHead = true
    else isIdRowRead = true
    return chain
  }
  chain.eq = ret
  chain.order = ret
  chain.range = ret
  chain.or = ret
  chain.in = (_c: string, ids: number[]) => {
    seenIn.push(ids)
    lastIn = ids
    return chain
  }
  chain.overlaps = () => {
    sawOverlaps = true
    return makeCountQuery(true)
  }
  // Thenable: a count-head read resolves to { count }; an id row read resolves to
  // { data: [{id}] } (the resolveAudienceIds pre-clamp path).
  ;(chain as { then: unknown }).then = (resolve: (v: unknown) => unknown) => {
    if (isIdRowRead && !isCountHead) {
      if (countError) return resolve({ data: null, error: { message: countError } })
      const ids = clampReturnsIds ?? lastIn ?? []
      return resolve({ data: ids.map((id) => ({ id })), error: null })
    }
    return resolve(result)
  }
  return chain
}
// The saved-view row resolveBulkSelection({mode:'view'}) reads. Tests set it.
let savedViewRow: { id?: number; ast?: unknown; filter?: unknown } | null = null
let savedViewError: string | null = null
function makeSavedViewQuery() {
  const chain: Record<string, unknown> = {}
  chain.select = () => chain
  chain.eq = () => chain
  chain.maybeSingle = () =>
    Promise.resolve(
      savedViewError
        ? { data: null, error: { message: savedViewError } }
        : { data: savedViewRow, error: null },
    )
  return chain
}
vi.mock('@/lib/supabase/service', () => ({
  createServiceClient: () => ({
    from: (table: string) =>
      table === 'crm_saved_views' ? makeSavedViewQuery() : makeCountQuery(false),
  }),
}))

import {
  buildBulkSelection,
  resolveBulkSelection,
  isProtectedBulkTag,
  EMAIL_SUPPRESS_TAGS,
  bulkAssignBrokerAction,
  bulkAddTagAction,
  bulkRemoveTagAction,
  bulkSetStageAction,
  bulkEnrollWorkflowAction,
  bulkEmailCohortAction,
  bulkPreflightCount,
} from '@/app/actions/crm-bulk'

beforeEach(() => {
  access = { email: 'matt@ryan-realty.com', role: 'superuser', brokerSlug: 'matt' }
  enqueued.length = 0
  nextJobId = 100
  enqueueThrows = false
  totalCount = 0
  suppressedCount = 0
  countError = null
  seenIn.length = 0
  sawOverlaps = false
  clampReturnsIds = null
  savedViewRow = null
  savedViewError = null
})
afterEach(() => vi.clearAllMocks())

// ── Pure: selection building ─────────────────────────────────────────────────

describe('buildBulkSelection', () => {
  it('ids mode dedupes and drops non-positive / non-integer ids', () => {
    const sel = buildBulkSelection({ mode: 'ids', ids: [3, 3, 0, -1, 2.5, 5] })
    expect(sel).toEqual({ ids: [3, 5] })
  })

  it('ids mode throws on an empty set (never enqueue a no-op)', () => {
    expect(() => buildBulkSelection({ mode: 'ids', ids: [] })).toThrow(/No contacts/)
    expect(() => buildBulkSelection({ mode: 'ids', ids: [0, -2] })).toThrow(/No contacts/)
  })

  it('matching mode upgrades legacy filters to a validated AST', () => {
    const sel = buildBulkSelection({ mode: 'matching', filters: { stage: 'Lead', broker: 'matt' } })
    expect(sel).toHaveProperty('ast')
    if ('ast' in sel) {
      expect((sel.ast as { type: string }).type).toBe('group')
      // stage + broker -> two AND conditions.
      expect((sel.ast as { nodes: unknown[] }).nodes).toHaveLength(2)
    }
  })

  it('matching mode with empty filters yields an "everyone" AST (resolver clamps to scope)', () => {
    const sel = buildBulkSelection({ mode: 'matching', filters: {} })
    expect(sel).toHaveProperty('ast')
    if ('ast' in sel) expect((sel.ast as { nodes: unknown[] }).nodes).toHaveLength(0)
  })
})

// ── Pure: protected-tag policy ───────────────────────────────────────────────

describe('isProtectedBulkTag', () => {
  it('flags every compliance/suppression tag (case-insensitive)', () => {
    expect(isProtectedBulkTag('compliance:hard-stop')).toBe(true)
    expect(isProtectedBulkTag('contact:do-not-text')).toBe(true)
    expect(isProtectedBulkTag('CONTACT:DO-NOT-CALL')).toBe(true)
    expect(isProtectedBulkTag('do_not_email')).toBe(true)
    expect(isProtectedBulkTag('unsubscribed')).toBe(true)
    expect(isProtectedBulkTag('bounced')).toBe(true)
  })
  it('flags broker: and compliance: prefixes', () => {
    expect(isProtectedBulkTag('broker:rebecca')).toBe(true)
    expect(isProtectedBulkTag('compliance:litigator')).toBe(true)
  })
  it('does NOT flag an ordinary marketing tag', () => {
    expect(isProtectedBulkTag('seller-lead')).toBe(false)
    expect(isProtectedBulkTag('open-house-2026')).toBe(false)
    expect(isProtectedBulkTag('')).toBe(false)
  })
})

// ── assign-broker superuser gate ─────────────────────────────────────────────

describe('bulkAssignBrokerAction superuser gate', () => {
  const sel = { mode: 'ids' as const, ids: [1, 2, 3] }

  it('superuser (Matt) may bulk reassign — enqueues with frozen scope null', async () => {
    access = { email: 'matt@ryan-realty.com', role: 'superuser', brokerSlug: 'matt' }
    const res = await bulkAssignBrokerAction(sel, 'rebecca')
    expect(res).toEqual({ ok: true, jobId: 100 })
    expect(enqueued).toHaveLength(1)
    expect(enqueued[0].kind).toBe('crm:assign-broker')
    expect(enqueued[0].params).toEqual({ brokerSlug: 'rebecca' })
    expect(enqueued[0].brokerScope).toBeNull()
    expect(enqueued[0].selection).toEqual({ ids: [1, 2, 3] })
  })

  it('a restricted broker is REFUSED and nothing is enqueued', async () => {
    access = { email: 'rebeccapeterson@ryan-realty.com', role: 'broker', brokerSlug: 'rebecca' }
    const res = await bulkAssignBrokerAction(sel, 'paul')
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.error).toMatch(/only an owner/i)
    expect(enqueued).toHaveLength(0)
  })

  it('rejects an unknown broker before any access work', async () => {
    const res = await bulkAssignBrokerAction(sel, 'nobody')
    expect(res.ok).toBe(false)
    expect(enqueued).toHaveLength(0)
  })

  it('unauthorized when there is no access', async () => {
    access = null
    const res = await bulkAssignBrokerAction(sel, 'rebecca')
    expect(res).toEqual({ ok: false, error: 'Unauthorized' })
  })
})

// ── scope freeze for a restricted broker on a non-owner op ───────────────────

describe('broker scope is frozen at enqueue', () => {
  it('a restricted broker enqueues a tag job with their own slug as scope', async () => {
    access = { email: 'paul@ryan-realty.com', role: 'broker', brokerSlug: 'paul' }
    const res = await bulkAddTagAction({ mode: 'matching', filters: { stage: 'Lead' } }, 'follow-up')
    expect(res.ok).toBe(true)
    expect(enqueued[0].brokerScope).toBe('paul')
    expect(enqueued[0].kind).toBe('crm:add-tag')
    expect(enqueued[0].params).toEqual({ tag: 'follow-up' })
    expect(enqueued[0].selection).toHaveProperty('ast')
  })
})

// ── ids-mode scope clamp at ENQUEUE (Cluster B blocker 1) ────────────────────

describe('ids-mode selection is scope-clamped at enqueue', () => {
  it('a restricted broker enqueuing an ids set freezes ONLY the in-scope ids', async () => {
    access = { email: 'paul@ryan-realty.com', role: 'broker', brokerSlug: 'paul' }
    // The selection includes id 99 which is OUTSIDE paul's book; the scope read
    // returns only the in-scope subset (1, 2). The frozen job must carry [1, 2].
    clampReturnsIds = [1, 2]
    const res = await bulkAddTagAction({ mode: 'ids', ids: [1, 2, 99] }, 'follow-up')
    expect(res.ok).toBe(true)
    expect(enqueued).toHaveLength(1)
    expect(enqueued[0].brokerScope).toBe('paul')
    // 99 is dropped — the foreign id never lands on the frozen job.
    expect(enqueued[0].selection).toEqual({ ids: [1, 2] })
  })

  it('refuses the job when NONE of the ids are in the caller book', async () => {
    access = { email: 'paul@ryan-realty.com', role: 'broker', brokerSlug: 'paul' }
    clampReturnsIds = [] // every requested id is outside paul's book
    const res = await bulkAddTagAction({ mode: 'ids', ids: [99, 100] }, 'follow-up')
    expect(res.ok).toBe(false)
    expect(enqueued).toHaveLength(0)
  })

  it('a superuser ids set passes through unchanged (echoed back)', async () => {
    access = { email: 'matt@ryan-realty.com', role: 'superuser', brokerSlug: 'matt' }
    const res = await bulkSetStageAction({ mode: 'ids', ids: [5, 6, 7] }, 'Pending')
    expect(res.ok).toBe(true)
    expect(enqueued[0].brokerScope).toBeNull()
    expect(enqueued[0].selection).toEqual({ ids: [5, 6, 7] })
  })
})

// ── protected-tag refusal at the action boundary ─────────────────────────────

describe('bulk tag actions refuse protected tags', () => {
  const sel = { mode: 'ids' as const, ids: [1] }
  it('add refuses a compliance tag', async () => {
    const res = await bulkAddTagAction(sel, 'compliance:hard-stop')
    expect(res.ok).toBe(false)
    expect(enqueued).toHaveLength(0)
  })
  it('remove refuses an unsubscribe tag (never lift a suppression in bulk)', async () => {
    const res = await bulkRemoveTagAction(sel, 'unsubscribed')
    expect(res.ok).toBe(false)
    expect(enqueued).toHaveLength(0)
  })
  it('add accepts an ordinary tag', async () => {
    const res = await bulkAddTagAction(sel, 'Seller-Lead')
    expect(res.ok).toBe(true)
    expect(enqueued[0].params).toEqual({ tag: 'seller-lead' }) // lowercased
  })
})

// ── stage + workflow + email validation ──────────────────────────────────────

describe('other bulk actions validate input', () => {
  const sel = { mode: 'ids' as const, ids: [1] }
  it('set-stage refuses an unknown stage', async () => {
    expect((await bulkSetStageAction(sel, 'Bogus')).ok).toBe(false)
    expect(enqueued).toHaveLength(0)
  })
  it('set-stage accepts a known stage', async () => {
    const res = await bulkSetStageAction(sel, 'Pending')
    expect(res.ok).toBe(true)
    expect(enqueued[0].params).toEqual({ stage: 'Pending' })
  })
  it('enroll refuses a non-positive sequence id', async () => {
    expect((await bulkEnrollWorkflowAction(sel, 0)).ok).toBe(false)
  })
  it('email refuses an empty payload', async () => {
    expect((await bulkEmailCohortAction(sel, {})).ok).toBe(false)
    expect((await bulkEmailCohortAction(sel, { templateId: 'welcome' })).ok).toBe(true)
  })

  it('enqueue failure surfaces a stable error', async () => {
    enqueueThrows = true
    const res = await bulkSetStageAction(sel, 'Pending')
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.error).toBe('db down')
  })
})

// ── preflight count shape ────────────────────────────────────────────────────

describe('bulkPreflightCount', () => {
  it('returns total with zero suppressed for a non-send kind', async () => {
    totalCount = 412
    const res = await bulkPreflightCount({ mode: 'matching', filters: { stage: 'Lead' } }, 'crm:add-tag')
    expect(res).toEqual({ ok: true, total: 412, suppressedEstimate: 0 })
    expect(sawOverlaps).toBe(false) // no suppression sub-query for a non-send kind
  })

  it('returns a suppression estimate for a send kind (email cohort)', async () => {
    totalCount = 412
    suppressedCount = 38
    const res = await bulkPreflightCount({ mode: 'matching', filters: {} }, 'email-cohort')
    expect(res).toEqual({ ok: true, total: 412, suppressedEstimate: 38 })
    expect(sawOverlaps).toBe(true)
  })

  it('ids-mode constrains the count to the explicit id set', async () => {
    totalCount = 2
    const res = await bulkPreflightCount({ mode: 'ids', ids: [7, 9] }, 'crm:set-stage')
    expect(res).toEqual({ ok: true, total: 2, suppressedEstimate: 0 })
    expect(seenIn).toContainEqual([7, 9])
  })

  it('surfaces a count error', async () => {
    countError = 'permission denied'
    const res = await bulkPreflightCount({ mode: 'ids', ids: [1] }, 'crm:add-tag')
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.error).toBe('permission denied')
  })

  it('unauthorized without access', async () => {
    access = null
    const res = await bulkPreflightCount({ mode: 'ids', ids: [1] }, 'crm:add-tag')
    expect(res).toEqual({ ok: false, error: 'Unauthorized' })
  })

  it('rejects an empty selection', async () => {
    const res = await bulkPreflightCount({ mode: 'ids', ids: [] }, 'crm:add-tag')
    expect(res.ok).toBe(false)
  })

  it('EMAIL_SUPPRESS_TAGS includes the all-channel hard stop and email opt-outs', () => {
    expect(EMAIL_SUPPRESS_TAGS).toContain('compliance:hard-stop')
    expect(EMAIL_SUPPRESS_TAGS).toContain('do_not_email')
    expect(EMAIL_SUPPRESS_TAGS).toContain('unsubscribed')
  })
})

// ── saved-view selection ({mode:'view'}) resolution ──────────────────────────

describe('resolveBulkSelection (saved view)', () => {
  it('view-mode loads the stored ast and returns { ast }', async () => {
    savedViewRow = {
      id: 7,
      ast: { type: 'group', op: 'and', nodes: [{ field: 'stage', value: 'Lead' }] },
    }
    const built = await resolveBulkSelection({ mode: 'view', viewId: 7 })
    expect(built).toEqual({ ast: savedViewRow.ast })
  })

  it('view-mode upgrades a legacy filter-only view to { ast }', async () => {
    savedViewRow = { id: 3, filter: { stage: 'Pending' } }
    const built = await resolveBulkSelection({ mode: 'view', viewId: 3 })
    expect(built).toHaveProperty('ast')
    if ('ast' in built) {
      expect((built.ast as { nodes: unknown[] }).nodes).toEqual([{ field: 'stage', value: 'Pending' }])
    }
  })

  it('view-mode throws on a missing view', async () => {
    savedViewRow = null
    await expect(resolveBulkSelection({ mode: 'view', viewId: 999 })).rejects.toThrow(/no longer exists/)
  })

  it('the pure builder refuses a view selection (must be resolved first)', () => {
    expect(() => buildBulkSelection({ mode: 'view', viewId: 1 })).toThrow(/resolved/)
  })
})

// ── {viewId} enqueue path stores { ast } on the job ──────────────────────────

describe('enqueue with a saved-view selection stores { ast }', () => {
  it('bulkEmailCohortAction(view) enqueues { ast } so the worker resolves it the same way', async () => {
    savedViewRow = {
      id: 9,
      ast: { type: 'group', op: 'and', nodes: [{ field: 'tag', op: 'has', value: 'seller-lead' }] },
    }
    const res = await bulkEmailCohortAction(
      { mode: 'view', viewId: 9 },
      { subject: 'Spring update', body: 'Hi' },
    )
    expect(res).toEqual({ ok: true, jobId: 100 })
    expect(enqueued).toHaveLength(1)
    expect(enqueued[0].kind).toBe('email-cohort')
    // Crucially: the job carries { ast }, NOT { viewId } — the worker is unchanged.
    expect(enqueued[0].selection).toEqual({ ast: savedViewRow.ast })
  })

  it('a restricted broker enqueuing a view job freezes their own scope', async () => {
    access = { email: 'paul@ryan-realty.com', role: 'broker', brokerSlug: 'paul' }
    savedViewRow = { id: 2, filter: { stage: 'Lead' } }
    const res = await bulkAddTagAction({ mode: 'view', viewId: 2 }, 'follow-up')
    expect(res.ok).toBe(true)
    expect(enqueued[0].brokerScope).toBe('paul')
    expect(enqueued[0].selection).toHaveProperty('ast')
  })

  it('a view-mode preflight count resolves the view ast under scope', async () => {
    totalCount = 55
    savedViewRow = { id: 4, ast: { type: 'group', op: 'and', nodes: [] } }
    const res = await bulkPreflightCount({ mode: 'view', viewId: 4 }, 'crm:add-tag')
    expect(res).toEqual({ ok: true, total: 55, suppressedEstimate: 0 })
  })

  it('a missing view surfaces a stable enqueue error (no job)', async () => {
    savedViewRow = null
    const res = await bulkEmailCohortAction({ mode: 'view', viewId: 404 }, { subject: 's', body: 'b' })
    expect(res.ok).toBe(false)
    expect(enqueued).toHaveLength(0)
  })
})
