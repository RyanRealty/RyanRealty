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
})
