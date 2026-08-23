import { describe, expect, it } from 'vitest'
import {
  duplicatePropertyKey,
  fileShapeForRepresentation,
  nextDuplicatePropertyKey,
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
