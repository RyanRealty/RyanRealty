import { describe, expect, it } from 'vitest'
import { extractContactsFromCycleRaw, extractPartiesFromCycleRaw } from './cycle-contacts'

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

describe('extractPartiesFromCycleRaw', () => {
  it('keeps a seller email and skips a buyer with no contact point', () => {
    const rows = extractPartiesFromCycleRaw({
      buyers: [{ firstName: 'Tyler', lastName: 'Nicoll', email: '' }],
      sellers: [{ firstName: 'Mary', lastName: 'Bowman', email: 'msbrilliantdisguise@gmail.com', phoneNumber: '7143376028' }],
    })
    expect(rows).toEqual([
      { role: 'buyer', name: 'Tyler Nicoll', email: null, phone: null },
      {
        role: 'seller',
        name: 'Mary Bowman',
        email: 'msbrilliantdisguise@gmail.com',
        phone: '7143376028',
      },
    ])
  })
})
