import { describe, expect, it } from 'vitest'
import { dealCalendarItems, slugFromBrokerName } from './deal-calendar'

describe('dealCalendarItems', () => {
  it('emits expiration, acceptance, and close', () => {
    const rows = dealCalendarItems({
      address: '5663 Impala',
      cycles: [
        { id: 'L', expiration_date: '2026-12-31', contract_acceptance_date: null, escrow_closing_date: null },
        { id: 'S', expiration_date: null, contract_acceptance_date: '2026-08-01', escrow_closing_date: '2026-09-15' },
      ],
    })
    expect(rows.map((r) => r.kind)).toEqual([
      'listing_expires',
      'contract_accepted',
      'earnest_money_due',
      'executed_copies_due',
      'spds_revocation_ends',
      'principal_review_due',
      'escrow_closes',
    ])
    expect(rows.find((r) => r.kind === 'earnest_money_due')?.date).toBe('2026-08-05')
    expect(rows.find((r) => r.kind === 'executed_copies_due')?.date).toBe('2026-08-04')
    expect(rows.find((r) => r.kind === 'spds_revocation_ends')?.date).toBe('2026-08-07')
    expect(rows[0].title).toContain('5663 Impala')
    const review = rows.find((r) => r.kind === 'principal_review_due')
    expect(review?.date).toBe('2026-08-11')
  })
})

describe('well contingency', () => {
  it('adds 90 calendar days only when the file has a well', () => {
    const rows = dealCalendarItems({
      address: 'Well House',
      cycles: [{ id: 'S', contract_acceptance_date: '2026-08-01', hasWell: true }],
    })
    expect(rows.find((r) => r.kind === 'well_contingency')?.date).toBe('2026-10-30')
  })
})

describe('slugFromBrokerName', () => {
  it('maps Paul Stevenson to paul', () => {
    expect(slugFromBrokerName('Paul Stevenson')).toBe('paul')
    expect(slugFromBrokerName('nope')).toBeNull()
  })
})
