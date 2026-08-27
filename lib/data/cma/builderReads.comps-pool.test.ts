import { beforeEach, describe, expect, it, vi } from 'vitest'

type EqCall = [string, unknown]

function makeQueryBuilder(result: { data: unknown[] | null; error: null }) {
  const eqCalls: EqCall[] = []
  const builder: Record<string, unknown> = {}
  const self = () => builder
  builder.select = vi.fn(self)
  builder.ilike = vi.fn(self)
  builder.not = vi.fn(self)
  builder.gte = vi.fn(self)
  builder.gt = vi.fn(self)
  builder.lte = vi.fn(self)
  builder.eq = vi.fn((col: string, val: unknown) => {
    eqCalls.push([col, val])
    return builder
  })
  builder.order = vi.fn(self)
  builder.limit = vi.fn(() => Promise.resolve(result))
  return { builder, eqCalls }
}

const mockFrom = vi.fn()
vi.mock('@/lib/supabase/service', () => ({
  createServiceClient: () => ({ from: mockFrom }),
}))

import { selectCmaCompsPool } from './builderReads'

const BASE = {
  cityIlike: 'Bend',
  closeDateGte: '2025-08-01',
  sqftMin: 1500,
  sqftMax: 2500,
}

describe('selectCmaCompsPool — SQL property_sub_type follows the subject', () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_SUPABASE_URL ||= 'https://example.supabase.co'
    process.env.SUPABASE_SERVICE_ROLE_KEY ||= 'test-service-role-key'
    mockFrom.mockReset()
  })

  it('eqs Single Family Residence for a detached subject', async () => {
    const { builder, eqCalls } = makeQueryBuilder({ data: [], error: null })
    mockFrom.mockReturnValue(builder)
    await selectCmaCompsPool({ ...BASE, propertySubType: 'Single Family Residence' })
    expect(eqCalls).toContainEqual(['PropertyType', 'A'])
    expect(eqCalls).toContainEqual(['property_sub_type', 'Single Family Residence'])
  })

  it('eqs Townhouse for a townhouse subject and never SFR', async () => {
    const { builder, eqCalls } = makeQueryBuilder({ data: [], error: null })
    mockFrom.mockReturnValue(builder)
    await selectCmaCompsPool({ ...BASE, propertySubType: 'Townhouse' })
    expect(eqCalls).toContainEqual(['property_sub_type', 'Townhouse'])
    expect(eqCalls.some(([col, val]) => col === 'property_sub_type' && val === 'Single Family Residence')).toBe(
      false,
    )
  })

  it('does not default the SQL to SFR when the subject type is omitted', async () => {
    const { builder, eqCalls } = makeQueryBuilder({ data: [], error: null })
    mockFrom.mockReturnValue(builder)
    await selectCmaCompsPool(BASE)
    expect(eqCalls.some(([col]) => col === 'property_sub_type')).toBe(false)
    expect(eqCalls).toContainEqual(['PropertyType', 'A'])
  })

  it('pulls land from segment D, not the residential bucket', async () => {
    // docs/plans/MARKET_TRUTH/REGISTRY.md §1: land is PropertyType='D'. Pulled
    // against 'A' it returns zero rows, which reads as "no comparable sales".
    const { builder, eqCalls } = makeQueryBuilder({ data: [], error: null })
    mockFrom.mockReturnValue(builder)
    await selectCmaCompsPool({
      cityIlike: 'Bend',
      closeDateGte: '2025-08-01',
      propertyType: 'D',
      propertySubType: 'Residential Lots',
    })
    expect(eqCalls).toContainEqual(['PropertyType', 'D'])
    expect(eqCalls).toContainEqual(['property_sub_type', 'Residential Lots'])
    expect(eqCalls.some(([col, val]) => col === 'PropertyType' && val === 'A')).toBe(false)
  })

  it('applies NO living-area bound when the sqft band is omitted', async () => {
    // Land rows carry a null TotalLivingAreaSqFt, and a null fails every bound,
    // so a 0..0 band would return nothing rather than everything.
    const { builder } = makeQueryBuilder({ data: [], error: null })
    mockFrom.mockReturnValue(builder)
    await selectCmaCompsPool({ cityIlike: 'Bend', closeDateGte: '2025-08-01', propertyType: 'D' })
    const bounded = [
      ...(builder.gte as { mock: { calls: unknown[][] } }).mock.calls,
      ...(builder.lte as { mock: { calls: unknown[][] } }).mock.calls,
    ]
    expect(bounded.some((c) => c[0] === 'TotalLivingAreaSqFt')).toBe(false)
  })

  it('still bounds living area for an improved subject', async () => {
    const { builder } = makeQueryBuilder({ data: [], error: null })
    mockFrom.mockReturnValue(builder)
    await selectCmaCompsPool({ ...BASE, propertySubType: 'Single Family Residence' })
    const bounded = [
      ...(builder.gte as { mock: { calls: unknown[][] } }).mock.calls,
      ...(builder.lte as { mock: { calls: unknown[][] } }).mock.calls,
    ]
    expect(bounded.filter((c) => c[0] === 'TotalLivingAreaSqFt')).toHaveLength(2)
  })
})
