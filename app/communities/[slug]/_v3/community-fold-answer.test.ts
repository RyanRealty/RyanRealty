import { describe, expect, it } from 'vitest'
import {
  communityFoldAnswer,
  communityFoldDaysToContract,
  communityFoldSource,
  communityHomesForSaleHeading,
} from './community-fold-answer'

const TETHEROW = {
  place: 'Tetherow',
  asOfLabel: 'Oct 13, 2026',
  active: 16,
  medianList: 2_372_500,
  medianSale12: 2_257_500,
  daysToContract: 51,
  daysToContractWindow: '90 days' as const,
}

describe('communityHomesForSaleHeading', () => {
  it('is Title Case Homes for Sale and does not invent a place', () => {
    expect(communityHomesForSaleHeading('Tetherow')).toBe('Tetherow Homes for Sale')
    expect(communityHomesForSaleHeading('Northwest Crossing')).toBe(
      'Northwest Crossing Homes for Sale',
    )
    expect(communityHomesForSaleHeading('  ')).toBe('Homes for Sale')
  })
})

describe('communityFoldAnswer', () => {
  it('prints live active, list, 12-month sale, and days to contract', () => {
    const out = communityFoldAnswer(TETHEROW)
    expect(out.sentences).toEqual([
      'Tetherow has 16 single-family homes for sale at a median list price of $2,372,500.',
      'Over the last 12 months, the median sale price was $2,257,500.',
      'Homes that went under contract in the last 90 days spent a median of 51 days to contract.',
    ])
    expect(out.source).toBe('Oregon Data Share MLS, as of Oct 13, 2026')
    expect(out.fallback).toBeNull()
    expect(out.sentences.join(' ')).not.toMatch(/\$0\b/)
    expect(out.sentences.join(' ')).not.toMatch(/\b0 single-family/)
  })

  it('drops a missing figure instead of inventing one', () => {
    const noDays = communityFoldAnswer({ ...TETHEROW, daysToContract: null, daysToContractWindow: null })
    expect(noDays.sentences).toHaveLength(2)
    expect(noDays.sentences.join(' ')).not.toMatch(/days to contract/)

    const listOnly = communityFoldAnswer({
      ...TETHEROW,
      active: null,
      medianSale12: null,
      daysToContract: null,
      daysToContractWindow: null,
    })
    expect(listOnly.sentences).toEqual([
      'Homes for sale in Tetherow have a median list price of $2,372,500.',
    ])
    expect(listOnly.source).toBe('Oregon Data Share MLS, as of Oct 13, 2026')
  })

  it('treats zero and non-finite as missing, never as a printed zero', () => {
    const out = communityFoldAnswer({
      place: 'Tetherow',
      asOfLabel: 'Oct 13, 2026',
      active: 0,
      medianList: 0,
      medianSale12: Number.NaN,
      daysToContract: -4,
      daysToContractWindow: '90 days',
    })
    expect(out.sentences).toEqual([])
    expect(out.source).toBeNull()
    expect(out.fallback).toMatch(/did not load/)
    expect(out.fallback).not.toMatch(/\$0|0 homes|0 days/)
  })

  it('fallback names the place and prints no figure when every cell is withheld', () => {
    const out = communityFoldAnswer({
      place: 'Caldera Springs',
      asOfLabel: null,
      active: null,
      medianList: null,
      medianSale12: null,
      daysToContract: null,
      daysToContractWindow: null,
    })
    expect(out.sentences).toEqual([])
    expect(out.source).toBeNull()
    expect(out.fallback).toMatch(/Caldera Springs/)
    expect(out.fallback).not.toMatch(/\d/)
  })

  it('names the 12-month days-to-contract window when that is the live cell', () => {
    const out = communityFoldAnswer({
      ...TETHEROW,
      daysToContract: 63,
      daysToContractWindow: '12 months',
    })
    expect(out.sentences[2]).toBe('Over the last 12 months, the median days to contract was 63.')
  })
})

describe('communityFoldDaysToContract', () => {
  it('prefers the 90-day leftover cell and falls back to 12 months', () => {
    expect(communityFoldDaysToContract(51, 63)).toEqual({
      daysToContract: 51,
      daysToContractWindow: '90 days',
    })
    expect(communityFoldDaysToContract(null, 63)).toEqual({
      daysToContract: 63,
      daysToContractWindow: '12 months',
    })
    expect(communityFoldDaysToContract(0, Number.NaN)).toEqual({
      daysToContract: null,
      daysToContractWindow: null,
    })
  })
})

describe('communityFoldSource', () => {
  it('cites Oregon Data Share MLS and omits an empty date', () => {
    expect(communityFoldSource('Oct 13, 2026')).toBe('Oregon Data Share MLS, as of Oct 13, 2026')
    expect(communityFoldSource('  ')).toBe('Oregon Data Share MLS')
    expect(communityFoldSource(null)).toBe('Oregon Data Share MLS')
  })
})
