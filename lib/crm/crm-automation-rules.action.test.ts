import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * RBAC refusal coverage for the automation-rule CRUD surface. Mutating an
 * automation rule (especially an assign_broker rule, which reassigns leads) is a
 * superuser-only operation. A restricted broker must be refused on every action
 * before any DB write happens.
 */

// Access gate — tests flip the returned role.
let access: { email: string; role: 'superuser' | 'broker' | 'report_viewer'; brokerSlug: string | null } | null = {
  email: 'matt@ryan-realty.com',
  role: 'superuser',
  brokerSlug: 'matt',
}
vi.mock('@/app/actions/crm', () => ({
  getCrmAccess: () => Promise.resolve(access),
}))

// Read-side import the passthrough action uses; harmless stub.
vi.mock('@/lib/data/crm/getCrmAutomationRules', () => ({
  CRM_AUTOMATION_RULES_TAG: 'crm-automation-rules',
  isActionType: (v: string) => ['enroll_sequence', 'add_tag', 'set_stage', 'assign_broker'].includes(v),
  isTriggerType: (v: string) => ['tag_added', 'stage_changed', 'source_is', 'inactivity'].includes(v),
  getCrmAutomationRules: () => Promise.resolve([]),
}))

vi.mock('next/cache', () => ({
  revalidatePath: () => undefined,
  revalidateTag: () => undefined,
}))

vi.mock('@/lib/crm/config-table', () => ({
  reorderPositions: () => [],
}))

vi.mock('@/lib/crm/constants', () => ({
  CRM_BROKERS: ['matt', 'rebecca', 'paul'],
}))

// Service-client double — records whether ANY write was attempted. A refused
// action must never reach here.
const writes = { inserts: 0, updates: 0, deletes: 0 }
function chain() {
  const c: Record<string, unknown> = {}
  const ret = () => c
  c.select = ret
  c.eq = ret
  c.order = ret
  c.limit = ret
  c.insert = () => { writes.inserts++; return c }
  c.update = () => { writes.updates++; return c }
  c.delete = () => { writes.deletes++; return c }
  c.maybeSingle = () => Promise.resolve({ data: null, error: null })
  ;(c as { then: unknown }).then = (resolve: (v: unknown) => unknown) =>
    resolve({ data: [], error: null })
  return c
}
vi.mock('@/lib/supabase/service', () => ({
  createServiceClient: () => ({ from: () => chain() }),
}))

import {
  createCrmAutomationRuleAction,
  updateCrmAutomationRuleAction,
  setCrmAutomationRuleActiveAction,
  deleteCrmAutomationRuleAction,
  reorderCrmAutomationRulesAction,
} from '@/app/actions/crm-automation-rules'

function fd(entries: Record<string, string>): FormData {
  const f = new FormData()
  for (const [k, v] of Object.entries(entries)) f.set(k, v)
  return f
}

beforeEach(() => {
  access = { email: 'matt@ryan-realty.com', role: 'superuser', brokerSlug: 'matt' }
  writes.inserts = 0
  writes.updates = 0
  writes.deletes = 0
})
afterEach(() => vi.clearAllMocks())

describe('automation-rule CRUD RBAC', () => {
  it('refuses every action for an unauthenticated caller (no write)', async () => {
    access = null
    expect((await createCrmAutomationRuleAction(fd({ name: 'X', triggerType: 'tag_added', triggerValue: 't', actionType: 'add_tag', actionValue: 'a' }))).ok).toBe(false)
    expect((await updateCrmAutomationRuleAction(fd({ id: '1', name: 'X', triggerType: 'tag_added', triggerValue: 't', actionType: 'add_tag', actionValue: 'a' }))).ok).toBe(false)
    expect((await setCrmAutomationRuleActiveAction(fd({ id: '1', isActive: '1' }))).ok).toBe(false)
    expect((await deleteCrmAutomationRuleAction(fd({ id: '1' }))).ok).toBe(false)
    expect((await reorderCrmAutomationRulesAction([1, 2])).ok).toBe(false)
    expect(writes).toEqual({ inserts: 0, updates: 0, deletes: 0 })
  })

  it('refuses every action for a restricted (non-superuser) broker (no write)', async () => {
    access = { email: 'rebecca@ryan-realty.com', role: 'broker', brokerSlug: 'rebecca' }
    const create = await createCrmAutomationRuleAction(
      fd({ name: 'Steal', triggerType: 'tag_added', triggerValue: 't', actionType: 'assign_broker', actionValue: 'rebecca' }),
    )
    expect(create.ok).toBe(false)
    if (!create.ok) expect(create.error.toLowerCase()).toContain('owner')
    expect((await updateCrmAutomationRuleAction(fd({ id: '1', name: 'X', triggerType: 'tag_added', triggerValue: 't', actionType: 'add_tag', actionValue: 'a' }))).ok).toBe(false)
    expect((await setCrmAutomationRuleActiveAction(fd({ id: '1', isActive: '1' }))).ok).toBe(false)
    expect((await deleteCrmAutomationRuleAction(fd({ id: '1' }))).ok).toBe(false)
    expect((await reorderCrmAutomationRulesAction([1, 2])).ok).toBe(false)
    // Not one write reached the DB.
    expect(writes).toEqual({ inserts: 0, updates: 0, deletes: 0 })
  })

  it('allows a superuser through the gate (write path reached)', async () => {
    access = { email: 'matt@ryan-realty.com', role: 'superuser', brokerSlug: 'matt' }
    const r = await setCrmAutomationRuleActiveAction(fd({ id: '5', isActive: '0' }))
    expect(r.ok).toBe(true)
    expect(writes.updates).toBe(1)
  })
})
