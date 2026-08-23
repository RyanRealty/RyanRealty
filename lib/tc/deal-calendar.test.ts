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
    expect(rows.map((r) => r.kind)).toEqual(['listing_expires', 'contract_accepted', 'escrow_closes'])
    expect(rows[0].title).toContain('5663 Impala')
  })
})

describe('slugFromBrokerName', () => {
  it('maps Paul Stevenson to paul', () => {
    expect(slugFromBrokerName('Paul Stevenson')).toBe('paul')
    expect(slugFromBrokerName('nope')).toBeNull()
  })
})
