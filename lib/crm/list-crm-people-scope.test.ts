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

// Supabase double — captures the filters applied to crm_people and returns a
// canned page. listCrmPeople now compiles through buildCrmPeopleQuery, so a
// broker constraint arrives one of two ways: the restricted-broker SCOPE CLAMP is
// a chained .eq('assigned_broker', slug), while a superuser's requested-book
// filter is an AST condition the compiler emits as .or('assigned_broker.eq.<slug>').
// The double records both, and the builder is a thenable that also chains (mirrors
// the real PostgrestFilterBuilder — filter methods work after .range()).
type EqCall = { col: string; val: unknown }
let crmPeopleEqs: EqCall[] = []
let crmPeopleOrs: string[] = []
let cannedRows: Array<Record<string, unknown>> = []
let cannedCount = 0
let cannedView: Record<string, unknown> | null = null

function makeChain(table: string) {
  const chain: Record<string, unknown> = {}
  const ret = () => chain
  chain.select = ret
  chain.eq = (col: string, val: unknown) => {
    if (table === 'crm_people') crmPeopleEqs.push({ col, val })
    return chain
  }
  chain.or = (arg: unknown) => {
    if (table === 'crm_people') crmPeopleOrs.push(String(arg))
    return chain
  }
  chain.overlaps = ret
  chain.ilike = ret
  chain.in = ret
  chain.order = ret
  chain.limit = ret
  chain.range = ret
  // The saved-view lookup (crm_saved_views) resolves to the canned view row.
  chain.maybeSingle = () =>
    Promise.resolve({ data: table === 'crm_saved_views' ? cannedView : null, error: null })
  // The compiled crm_people query is a thenable — awaiting it yields the page.
  chain.then = (resolve: (v: { data: unknown; count: number; error: null }) => unknown) =>
    resolve({ data: cannedRows, count: cannedCount, error: null })
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
  crmPeopleOrs = []
  cannedRows = []
  cannedCount = 0
  cannedView = null
})
afterEach(() => vi.clearAllMocks())

/**
 * The assigned_broker value the query was constrained to (or undefined) —
 * whether applied as the scope-clamp .eq or the compiler's .or condition.
 */
function appliedBrokerFilter(): unknown {
  const eq = crmPeopleEqs.find((e) => e.col === 'assigned_broker')
  if (eq) return eq.val
  const or = crmPeopleOrs.find((s) => /^assigned_broker\.eq\./.test(s))
  return or ? or.replace(/^assigned_broker\.eq\./, '') : undefined
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

describe('listCrmPeople — saved-view resolution (ast/filter drift closed)', () => {
  it('resolves a view through its AST, not the legacy filter bag, when the two disagree', async () => {
    // The exact drift the streamline audit hit: the list read the `filter` bag
    // while the counts resolved the `ast`. Give a view whose ast and filter point
    // at DIFFERENT tags — the list must now compile the ast (segment:seller), the
    // same shape getCrmSavedViews / getCrmStageCounts count, so the sidebar count
    // and the list can never show two different cohorts again.
    role = { role: 'superuser' }
    cannedView = {
      id: 27,
      name: 'Sellers',
      description: null,
      position: 0,
      ast: { type: 'group', op: 'and', nodes: [{ field: 'tag', op: 'has', value: 'segment:seller' }] },
      filter: { tagsAny: ['segment:buyer'] },
    }
    await listCrmPeople({ view: '27' })
    // ast wins: the compiled query contains the seller tag membership (the
    // compiler quotes the ':' value, e.g. tags.cs.{"segment:seller"}) …
    expect(crmPeopleOrs.some((s) => s.includes('tags.cs') && s.includes('segment:seller'))).toBe(true)
    // … and never the stale filter-bag buyer tag.
    expect(crmPeopleOrs.some((s) => s.includes('segment:buyer'))).toBe(false)
  })

  it('falls back to the legacy filter bag for a pre-ast view (no ast column)', async () => {
    role = { role: 'superuser' }
    cannedView = {
      id: 99,
      name: 'Legacy',
      description: null,
      position: 0,
      ast: null,
      filter: { tagsAny: ['segment:expired'] },
    }
    await listCrmPeople({ view: '99' })
    expect(crmPeopleOrs.some((s) => s.includes('tags.cs') && s.includes('segment:expired'))).toBe(true)
  })
})
