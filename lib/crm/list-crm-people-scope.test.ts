import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * Broker-RBAC scope coverage for listCrmPeople (the primary contacts read).
 * A restricted broker must be constrained to their OWN assigned_broker no matter
 * what filters.broker the page passes; a superuser sees the requested book.
 *
 * The action's heavy dependencies (auth, admin-roles, followupboss, supabase,
 * meta) are mocked so the test exercises only the scope logic. The supabase
 * double captures every .eq(column,value) applied to crm_people so the test can
 * assert which assigned_broker filter was enforced.
 */

// Session + role gate — tests flip the signed-in user.
let sessionEmail: string | null = 'matt@ryan-realty.com'
let role: { role: 'superuser' | 'broker' | 'report_viewer' } | null = { role: 'superuser' }
vi.mock('@/app/actions/auth', () => ({
  getSession: () => Promise.resolve(sessionEmail ? { user: { email: sessionEmail } } : null),
}))
vi.mock('@/app/actions/admin-roles', () => ({
  getAdminRoleForEmail: () => Promise.resolve(role),
}))

// Pull-in-free stubs for the side-effect deps the module imports at top.
vi.mock('@/lib/followupboss', () => ({
  addPersonNote: vi.fn(),
  addPersonTags: vi.fn(),
  assignPersonToUser: vi.fn(),
  completeFubTask: vi.fn(),
  replacePersonTags: vi.fn(),
  updatePersonAutomationState: vi.fn(),
}))
vi.mock('@/lib/meta/qualifiedEvent', () => ({
  isQualifyingStage: () => false,
  fireQualifiedLeadEvent: vi.fn(),
}))
vi.mock('next/cache', () => ({
  revalidatePath: () => undefined,
  unstable_cache: (fn: unknown) => fn,
}))

// Supabase double — captures the eq() filters applied to crm_people and returns
// a canned page. The crm_people query is terminated by .range().
type EqCall = { col: string; val: unknown }
let crmPeopleEqs: EqCall[] = []
let cannedRows: Array<Record<string, unknown>> = []
let cannedCount = 0

function makeChain(table: string) {
  const chain: Record<string, unknown> = {}
  const ret = () => chain
  chain.select = ret
  chain.eq = (col: string, val: unknown) => {
    if (table === 'crm_people') crmPeopleEqs.push({ col, val })
    return chain
  }
  chain.overlaps = ret
  chain.ilike = ret
  chain.in = ret
  chain.order = ret
  chain.limit = ret
  chain.maybeSingle = () => Promise.resolve({ data: null, error: null })
  // .range() terminates the crm_people read.
  chain.range = () => Promise.resolve({ data: cannedRows, count: cannedCount, error: null })
  return chain
}
vi.mock('@/lib/supabase/service', () => ({
  createServiceClient: () => ({ from: (t: string) => makeChain(t) }),
}))

import { listCrmPeople } from '@/app/actions/crm'

beforeEach(() => {
  sessionEmail = 'matt@ryan-realty.com'
  role = { role: 'superuser' }
  crmPeopleEqs = []
  cannedRows = []
  cannedCount = 0
})
afterEach(() => vi.clearAllMocks())

/** The assigned_broker value the query was constrained to (or undefined). */
function appliedBrokerFilter(): unknown {
  return crmPeopleEqs.find((e) => e.col === 'assigned_broker')?.val
}

describe('listCrmPeople — broker scope (Option A)', () => {
  it('a restricted broker is constrained to their OWN slug even when the page asks for another', async () => {
    // Rebecca (a non-superuser) explicitly passes broker=paul. Scope must win.
    sessionEmail = 'rebeccapeterson@ryan-realty.com'
    role = { role: 'broker' }
    await listCrmPeople({ broker: 'paul' })
    expect(appliedBrokerFilter()).toBe('rebecca')
  })

  it('a restricted broker with no broker filter is still scoped to their own slug', async () => {
    sessionEmail = 'paul@ryan-realty.com'
    role = { role: 'broker' }
    await listCrmPeople({})
    expect(appliedBrokerFilter()).toBe('paul')
  })

  it('a superuser sees the requested book (broker filter passes through)', async () => {
    sessionEmail = 'matt@ryan-realty.com'
    role = { role: 'superuser' }
    await listCrmPeople({ broker: 'rebecca' })
    expect(appliedBrokerFilter()).toBe('rebecca')
  })

  it('a superuser with no broker filter applies no assigned_broker constraint (all brokers)', async () => {
    role = { role: 'superuser' }
    await listCrmPeople({})
    expect(appliedBrokerFilter()).toBeUndefined()
  })

  it('always filters out soft-deleted contacts', async () => {
    role = { role: 'superuser' }
    await listCrmPeople({})
    expect(crmPeopleEqs.some((e) => e.col === 'deleted' && e.val === false)).toBe(true)
  })

  it('a caller with no CRM access gets an empty result (sees nothing)', async () => {
    sessionEmail = null
    role = null
    const res = await listCrmPeople({ broker: 'all' })
    expect(res.rows).toEqual([])
    expect(res.total).toBe(0)
    // No crm_people read was even attempted.
    expect(crmPeopleEqs).toHaveLength(0)
  })
})
