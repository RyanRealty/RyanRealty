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
let totalCount = 0
let suppressedCount = 0
let countError: string | null = null
const seenIn: number[][] = []
let sawOverlaps = false

function makeCountQuery(isSupp: boolean) {
  const result = {
    count: isSupp ? suppressedCount : totalCount,
    error: countError ? { message: countError } : null,
  }
  const chain: Record<string, unknown> = {}
  const ret = () => chain
  chain.select = ret
  chain.eq = ret
  chain.order = ret
  chain.range = ret
  chain.or = ret
  chain.in = (_c: string, ids: number[]) => {
    seenIn.push(ids)
    return chain
  }
  chain.overlaps = () => {
    sawOverlaps = true
    return makeCountQuery(true)
  }
  // Thenable: awaiting the query resolves to { count, error }.
  ;(chain as { then: unknown }).then = (resolve: (v: unknown) => unknown) => resolve(result)
  return chain
}
vi.mock('@/lib/supabase/service', () => ({
  createServiceClient: () => ({ from: () => makeCountQuery(false) }),
}))

import {
  buildBulkSelection,
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
