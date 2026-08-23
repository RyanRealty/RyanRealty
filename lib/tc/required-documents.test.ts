import { describe, expect, it } from 'vitest'
import {
  EMPTY_PROPERTY_FACTS,
  brokerRoleFromDealParties,
  seedChecklistItems,
  anticipateDocuments,
} from './required-documents'

describe('brokerRoleFromDealParties', () => {
  it('maps seller-only to listing, buyer-only to buyer, both to dual', () => {
    expect(brokerRoleFromDealParties(['seller'])).toBe('listing')
    expect(brokerRoleFromDealParties(['buyer'])).toBe('buyer')
    expect(brokerRoleFromDealParties(['buyer', 'seller'])).toBe('dual')
    expect(brokerRoleFromDealParties(['other'])).toBe('unknown')
  })
})

describe('seedChecklistItems', () => {
  it('seeds required Oregon docs on a buyer deal with unknown facts, including buyer-rep', () => {
    const rows = seedChecklistItems('buyer', EMPTY_PROPERTY_FACTS)
    const names = rows.map((r) => r.name)
    expect(names).toContain('Buyer Representation Agreement')
    expect(names).not.toContain('Exclusive Listing Agreement')
    expect(rows.find((r) => r.type_name === 'OREF 050')?.status).toBe('required')
    expect(rows.find((r) => r.type_name === 'OREF 050')?.group).toBe('Buyer Agreement')
    expect(rows.every((r, i) => r.sort_order === i)).toBe(true)
  })

  it('seeds listing agreement on listing role, not buyer-rep', () => {
    const rows = seedChecklistItems('listing', EMPTY_PROPERTY_FACTS)
    const names = rows.map((r) => r.name)
    expect(names).toContain('Exclusive Listing Agreement')
    expect(names).not.toContain('Buyer Representation Agreement')
  })

  it('does not seed well/septic conditionals until facts are true', () => {
    const empty = seedChecklistItems('buyer', EMPTY_PROPERTY_FACTS).map((r) => r.name)
    expect(empty.some((n) => /well/i.test(n))).toBe(false)
    const withWell = seedChecklistItems('buyer', { ...EMPTY_PROPERTY_FACTS, hasWell: true }).map((r) => r.name)
    expect(withWell.some((n) => /well/i.test(n))).toBe(true)
  })

  it('matches anticipated-docs applicable set (empty present names)', () => {
    const role = 'dual' as const
    const anticipated = anticipateDocuments(role, EMPTY_PROPERTY_FACTS, [])
    const seeded = seedChecklistItems(role, EMPTY_PROPERTY_FACTS)
    expect(seeded.map((r) => r.name).sort()).toEqual(anticipated.map((d) => d.label).sort())
  })
})
