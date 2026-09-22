import { describe, expect, it } from 'vitest'
import { ownersPolicyPremium } from '@/lib/pricing/owners-policy'

describe('ownersPolicyPremium — OTIRO Schedule One, standard owner policy', () => {
  it('is the flat minimum through $25,000', () => {
    expect(ownersPolicyPremium(25_000)).toBe(200)
  })

  it('counts a fraction of the next thousand', () => {
    expect(ownersPolicyPremium(25_000.01)).toBe(204)
    expect(ownersPolicyPremium(26_000)).toBe(204)
    expect(ownersPolicyPremium(26_000.01)).toBe(208)
  })

  it('meets the next bracket exactly at its floor', () => {
    expect(ownersPolicyPremium(50_000)).toBe(300)
    expect(ownersPolicyPremium(100_000)).toBe(450)
    expect(ownersPolicyPremium(300_000)).toBe(950)
    expect(ownersPolicyPremium(500_000)).toBe(1_350)
  })

  it('rounds a half dollar up', () => {
    // $100,000.01 is one fraction into the $2.50 band: 450 + 2.50.
    expect(ownersPolicyPremium(100_000.01)).toBe(453)
    // $1,473,000 is 973 thousands over $500,000: 1,350 + 1,459.50.
    expect(ownersPolicyPremium(1_473_000)).toBe(2_810)
  })

  it('is $1,674 on a $716,000 sale', () => {
    expect(ownersPolicyPremium(716_000)).toBe(1_674)
  })

  it('is null without a price', () => {
    expect(ownersPolicyPremium(0)).toBeNull()
    expect(ownersPolicyPremium(Number.NaN)).toBeNull()
  })
})
