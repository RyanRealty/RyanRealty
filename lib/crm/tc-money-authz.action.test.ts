/**
 * Authz guard tests for the money surfaces (audit HIGH, RC5 class): the
 * brokerage P&L (tc-financials) and the all-broker commission rollup
 * (tc-commissions) are superuser-only (D4). Before the fix these read/mutate
 * server actions had NO in-body auth (or admitted any broker), so a broker
 * could read every broker's compensation and edit splits by direct POST.
 *
 * Under lib/crm/ so vitest picks it up. checkAdminAction is mocked to the two
 * relevant outcomes; the point is that a non-superuser result short-circuits
 * BEFORE any service-role read/write.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'

const checkAdminAction = vi.fn()
vi.mock('@/lib/admin/require-admin', () => ({
  checkAdminAction: (...a: unknown[]) => checkAdminAction(...a),
}))

// Service client must NEVER be reached on a denied call — spy that fails the
// test if constructed.
const serviceClientBuilt = vi.fn()
vi.mock('@supabase/supabase-js', () => ({
  createClient: () => {
    serviceClientBuilt()
    // Minimal chainable stub so an ACCIDENTALLY-allowed call doesn't crash
    // before we can assert the guard should have blocked it.
    const b: Record<string, unknown> = {}
    for (const m of ['from', 'select', 'insert', 'update', 'eq', 'in', 'order', 'maybeSingle', 'single']) {
      b[m] = () => b
    }
    b.maybeSingle = () => Promise.resolve({ data: null })
    b.then = undefined
    return b
  },
}))

vi.mock('next/cache', () => ({ revalidatePath: () => {} }))
vi.mock('@/lib/tc/commission-math', () => ({ computeCommissionNets: () => ({ agent_net: 0, brokerage_net: 0 }) }))

const OLD_ENV = { ...process.env }
process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://x.supabase.co'
process.env.SUPABASE_SERVICE_ROLE_KEY = 'svc'

import { getCommissionsRollup, updateTcCommission } from '@/app/actions/tc-commissions'
import { getTcFinancials, addTcExpense } from '@/app/actions/tc-financials'

afterEach(() => {
  vi.clearAllMocks()
  process.env = { ...OLD_ENV, NEXT_PUBLIC_SUPABASE_URL: 'https://x.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'svc' }
})

const DENY = { ok: false as const, error: 'You do not have access to this action.', code: 'forbidden' as const }
const ALLOW = { ok: true as const, ctx: { email: 'matt@ryan-realty.com', role: 'superuser', brokerId: null, brokerSlug: null, flags: { canExport: true, pauseLeads: false } } }

describe('tc money surfaces are superuser-only (audit HIGH)', () => {
  it('getCommissionsRollup returns [] and reads NOTHING when the caller lacks commissions.view', async () => {
    checkAdminAction.mockResolvedValue(DENY)
    const rows = await getCommissionsRollup()
    expect(rows).toEqual([])
    expect(checkAdminAction).toHaveBeenCalledWith('commissions.view')
    expect(serviceClientBuilt).not.toHaveBeenCalled()
  })

  it('updateTcCommission refuses (no write) when the caller lacks commissions.view', async () => {
    checkAdminAction.mockResolvedValue(DENY)
    const r = await updateTcCommission('c1', { split_percent: 99 })
    expect(r.ok).toBe(false)
    expect(checkAdminAction).toHaveBeenCalledWith('commissions.view')
    expect(serviceClientBuilt).not.toHaveBeenCalled()
  })

  it('getTcFinancials returns empty and reads NOTHING when the caller lacks financials.view', async () => {
    checkAdminAction.mockResolvedValue(DENY)
    const r = await getTcFinancials()
    expect(r).toEqual({ years: [], expenses: [] })
    expect(checkAdminAction).toHaveBeenCalledWith('financials.view')
    expect(serviceClientBuilt).not.toHaveBeenCalled()
  })

  it('addTcExpense refuses (no write) when the caller lacks financials.view', async () => {
    checkAdminAction.mockResolvedValue(DENY)
    const r = await addTcExpense({ category: 'marketing', description: 'x', amount: 10, incurred_on: '2026-07-17' })
    expect(r.ok).toBe(false)
    expect(checkAdminAction).toHaveBeenCalledWith('financials.view')
    expect(serviceClientBuilt).not.toHaveBeenCalled()
  })

  it('a superuser passes the guard (checkAdminAction is consulted, then the read proceeds)', async () => {
    checkAdminAction.mockResolvedValue(ALLOW)
    const rows = await getCommissionsRollup()
    expect(Array.isArray(rows)).toBe(true)
    expect(checkAdminAction).toHaveBeenCalledWith('commissions.view')
    expect(serviceClientBuilt).toHaveBeenCalled() // superuser DOES reach the data
  })
})
