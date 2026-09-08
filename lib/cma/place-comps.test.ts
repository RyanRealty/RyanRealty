import { beforeEach, describe, expect, it, vi } from 'vitest'

const resolve = vi.fn()
const select = vi.fn()

vi.mock('@/lib/cma/subject', () => ({
  resolveCmaSubject: (...args: unknown[]) => resolve(...args),
}))
vi.mock('@/lib/pricing/select', () => ({
  selectCompsPreferringFacts: (...args: unknown[]) => select(...args),
}))

import { countCompsForAddress } from './place-comps'

describe('countCompsForAddress', () => {
  beforeEach(() => {
    resolve.mockReset()
    select.mockReset()
  })

  it('returns the comp count, the tiers, and a subject summary when the address resolves', async () => {
    resolve.mockResolvedValue({
      subject: { beds: 4, baths: 3, sqft: 2410, yearBuilt: 2006, city: 'Powell Butte' },
      trace: 'assessor facts for 123 Ranch House Ln',
    })
    select.mockResolvedValue({ comps: [{}, {}, {}, {}, {}, {}], tiersUsed: ['subdivision', 'competing-area'] })
    const r = await countCompsForAddress({ rawAddress: '123 Ranch House Ln', city: 'Powell Butte' })
    expect(resolve).toHaveBeenCalledWith({ rawAddress: '123 Ranch House Ln', city: 'Powell Butte', postalCode: null })
    expect(r.subjectFound).toBe(true)
    expect(r.count).toBe(6)
    expect(r.tiersUsed).toEqual(['subdivision', 'competing-area'])
    expect(r.subjectSummary).toBe('4 bed, 3 bath, 2,410 sq ft, built 2006')
    expect(r.trace).toContain('comps 6 via subdivision > competing-area')
  })

  it('reports an unresolved subject without running the ladder', async () => {
    resolve.mockResolvedValue({ subject: null, trace: 'no MLS or assessor match' })
    const r = await countCompsForAddress({ rawAddress: '1 Nowhere', city: 'Bend' })
    expect(select).not.toHaveBeenCalled()
    expect(r.subjectFound).toBe(false)
    expect(r.count).toBeNull()
    expect(r.subjectSummary).toBeNull()
    expect(r.trace).toBe('no MLS or assessor match')
  })

  it('leaves the summary null when the subject has no facts to summarize', async () => {
    resolve.mockResolvedValue({ subject: { beds: null, baths: null, sqft: null, yearBuilt: null }, trace: 't' })
    select.mockResolvedValue({ comps: [], tiersUsed: [] })
    const r = await countCompsForAddress({ rawAddress: '5 Somewhere Dr', city: 'Bend' })
    expect(r.count).toBe(0)
    expect(r.subjectSummary).toBeNull()
    expect(r.trace).toContain('via sale_pricing_facts')
  })
})
