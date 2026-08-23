import { describe, expect, it } from 'vitest'
import {
  LISTING_STANDARD_FORM_NUMBERS,
  SALE_STANDARD_FORM_NUMBERS,
  duplicatePropertyKey,
  duplicatedDocumentPath,
  fileShapeForRepresentation,
  nextDuplicatePropertyKey,
  partyNamesFromJson,
  todayIsoDate,
} from './listing-actions'

describe('duplicatePropertyKey', () => {
  it('appends -copy once', () => {
    expect(duplicatePropertyKey('5663-impala')).toBe('5663-impala-copy')
    expect(duplicatePropertyKey('5663-impala-copy')).toBe('5663-impala-copy')
    expect(duplicatePropertyKey('5663-impala-copy-2')).toBe('5663-impala-copy')
  })
})

describe('nextDuplicatePropertyKey', () => {
  it('increments when -copy is taken', () => {
    expect(nextDuplicatePropertyKey(['5663-impala'], '5663-impala')).toBe('5663-impala-copy')
    expect(nextDuplicatePropertyKey(['5663-impala', '5663-impala-copy'], '5663-impala')).toBe(
      '5663-impala-copy-2',
    )
  })
})

describe('todayIsoDate', () => {
  it('is YYYY-MM-DD', () => {
    expect(todayIsoDate(new Date('2026-08-23T18:00:00Z'))).toBe('2026-08-23')
  })
})

describe('fileShapeForRepresentation', () => {
  it('Seller opens a listing file with Residential — Standard', () => {
    expect(fileShapeForRepresentation('seller')).toEqual({
      stage: 'active_listing',
      stageDetail: 'Active listing',
      kind: 'listing',
      status: 'Active',
      checklistType: 'Residential — Standard',
      partyRole: 'seller',
    })
  })
  it('Buyer opens an accepted-offer sale file', () => {
    expect(fileShapeForRepresentation('buyer').kind).toBe('sale')
    expect(fileShapeForRepresentation('buyer').stage).toBe('pending')
    expect(fileShapeForRepresentation('buyer').partyRole).toBe('buyer')
  })
})

describe('listing vs sale packets', () => {
  it('listing packet is listing agreement + agency + EFA + SPDS, not the sale agreement', () => {
    expect([...LISTING_STANDARD_FORM_NUMBERS]).toEqual(['015', '042', '043', '020'])
    expect([...LISTING_STANDARD_FORM_NUMBERS]).not.toContain('001')
    expect([...SALE_STANDARD_FORM_NUMBERS]).toContain('001')
  })
})

describe('partyNamesFromJson', () => {
  it('reads string names and { name } objects', () => {
    expect(partyNamesFromJson(['Mary Bowman', { name: 'Tyler Nicoll' }, '', { name: '  ' }])).toEqual([
      'Mary Bowman',
      'Tyler Nicoll',
    ])
  })
})

describe('duplicatedDocumentPath', () => {
  it('keeps the copy on the new cycle inbox path', () => {
    expect(duplicatedDocumentPath('cyc', 'Beaumont Offer 1.pdf', 2)).toBe(
      'inbox/cyc/dup-2-Beaumont_Offer_1.pdf',
    )
  })
})
