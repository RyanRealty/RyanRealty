import { describe, expect, it } from 'vitest'
import { extractContactsFromCycleRaw } from './cycle-contacts'

describe('extractContactsFromCycleRaw', () => {
  it('pulls title, other-side agent, and TC from a SkySlope raw blob', () => {
    const rows = extractContactsFromCycleRaw({
      titleContact: {
        firstName: 'Yvonne',
        lastName: 'Ward',
        email: 'yvonne.ward@westerntitle.com',
        company: 'Western Title',
        phoneNumber: '',
      },
      escrowContact: null,
      otherSideAgentContact: { firstName: 'Tiany', lastName: 'Clark', email: '', company: null },
      transactionCoordinators: [{ fullName: 'Jeanette Argyle', email: 'Transactions@bridgetownfiles.com' }],
    })
    expect(rows.map((r) => r.role)).toEqual(['title', 'other_agent', 'transaction_coordinator'])
    expect(rows[0]).toMatchObject({
      name: 'Yvonne Ward',
      company: 'Western Title',
      email: 'yvonne.ward@westerntitle.com',
    })
    expect(rows[1].name).toBe('Tiany Clark')
    expect(rows[2].name).toBe('Jeanette Argyle')
  })
  it('returns empty on null raw', () => {
    expect(extractContactsFromCycleRaw(null)).toEqual([])
  })
})
