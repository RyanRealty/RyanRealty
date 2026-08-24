import { describe, expect, it } from 'vitest'
import {
  EMPTY_PROPERTY_FACTS,
  brokerRoleFromDealParties,
  seedChecklistItems,
  anticipateDocuments,
  missingChecklistSeeds,
  missingReferralW9,
  presentNamesForAnticipate,
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

  it('adds well paperwork only when the fact is true and it is not already on the file', () => {
    const withWell = { ...EMPTY_PROPERTY_FACTS, hasWell: true }
    const already = seedChecklistItems('buyer', EMPTY_PROPERTY_FACTS).map((r) => r.name)
    const missing = missingChecklistSeeds('buyer', withWell, already)
    expect(missing.some((r) => /well/i.test(r.name))).toBe(true)
    expect(missingChecklistSeeds('buyer', withWell, [...already, ...missing.map((r) => r.name)])).toEqual([])
  })

  it('requires team disclosure only when the file is a licensed team', () => {
    const solo = seedChecklistItems('listing', EMPTY_PROPERTY_FACTS).map((r) => r.name)
    expect(solo.some((n) => /team disclosure/i.test(n))).toBe(false)
    const team = seedChecklistItems('listing', { ...EMPTY_PROPERTY_FACTS, hasTeam: true }).map((r) => r.name)
    expect(team.some((n) => /team disclosure/i.test(n))).toBe(true)
  })

  it('adds a W-9 row when a referral fee exists and skips it if already named', () => {
    expect(missingReferralW9([], 2500).map((r) => r.name)).toEqual(['Referral payee W-9'])
    expect(missingReferralW9(['Referral payee W-9'], 2500)).toEqual([])
    expect(missingReferralW9([], 0)).toEqual([])
  })

  it('does not treat a seeded empty checklist row as a live document on file', () => {
    expect(
      presentNamesForAnticipate(
        [],
        [{ name: 'Exclusive Listing Agreement', status: 'required' }],
      ),
    ).toEqual([])
    expect(
      presentNamesForAnticipate(
        [{ name: 'Listing Agreement - Exclusive - 015 OREF', archived: false }],
        [{ name: 'Exclusive Listing Agreement', status: 'required' }],
      ),
    ).toEqual(['Listing Agreement - Exclusive - 015 OREF'])
    expect(
      presentNamesForAnticipate(
        [{ name: 'archived.pdf', archived: true }],
        [{ name: 'Exclusive Listing Agreement', status: 'completed', assignedDocumentCount: 1 }],
      ),
    ).toEqual(['Exclusive Listing Agreement'])
  })
})
