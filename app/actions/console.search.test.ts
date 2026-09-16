import { afterEach, describe, expect, it, vi } from 'vitest'

const getCrmAccess = vi.fn()
const searchCrmPeople = vi.fn()
const checkAdminAction = vi.fn()

vi.mock('@/lib/data/crm/getCrmAccess', () => ({
  getCrmAccess: (...args: unknown[]) => getCrmAccess(...args),
}))
vi.mock('@/lib/data/crm/searchCrmPeople', () => ({
  searchCrmPeople: (...args: unknown[]) => searchCrmPeople(...args),
}))
vi.mock('@/lib/admin/require-admin', () => ({
  checkAdminAction: (...args: unknown[]) => checkAdminAction(...args),
  getAdminCapabilityContext: vi.fn(),
}))
vi.mock('@/lib/data/tc/closings', () => ({
  closingMatchesQuery: vi.fn(),
  getClosingsBoard: vi.fn(),
}))
vi.mock('@/lib/tc/deal-scope', () => ({
  dealVisibleToBroker: vi.fn(),
}))

import { consoleSearchLeads } from './console'

afterEach(() => {
  getCrmAccess.mockReset()
  searchCrmPeople.mockReset()
  checkAdminAction.mockReset()
})

describe('consoleSearchLeads', () => {
  it('returns nothing for a short query', async () => {
    await expect(consoleSearchLeads('a')).resolves.toEqual([])
    expect(searchCrmPeople).not.toHaveBeenCalled()
  })

  it('scopes a superuser to every book (brokerScope null)', async () => {
    getCrmAccess.mockResolvedValue({ email: 'matt@ryan-realty.com', role: 'superuser', brokerSlug: 'matt' })
    checkAdminAction.mockResolvedValue({ ok: true })
    searchCrmPeople.mockResolvedValue([
      { id: 9, name: 'Ada', stage: 'New', source: 'web', assigned_broker: 'rebecca' },
    ])
    await expect(consoleSearchLeads('ada')).resolves.toEqual([
      { id: 9, name: 'Ada', stage: 'New', source: 'web' },
    ])
    expect(searchCrmPeople).toHaveBeenCalledWith({ q: 'ada', brokerScope: null, limit: 8 })
  })

  it('scopes a broker to their own slug', async () => {
    getCrmAccess.mockResolvedValue({ email: 'rebecca@ryan-realty.com', role: 'broker', brokerSlug: 'rebecca' })
    checkAdminAction.mockResolvedValue({ ok: true })
    searchCrmPeople.mockResolvedValue([])
    await consoleSearchLeads('lead')
    expect(searchCrmPeople).toHaveBeenCalledWith({ q: 'lead', brokerScope: 'rebecca', limit: 8 })
  })
})
