import { describe, expect, it } from 'vitest'
import {
  defaultDealAddress,
  defaultDealRoleFromWho,
  dedupeParties,
  isDealPersonRole,
  parseCityFromAddress,
  namesByDealRole,
  propertyKeyForInhouseDeal,
  relatedPartiesForStartDeal,
  roleForRelated,
} from './deal-people'

describe('deal-people', () => {
  it('defaults seller from seller-side who labels', () => {
    expect(defaultDealRoleFromWho(['Expired listing'])).toBe('seller')
    expect(defaultDealRoleFromWho(['FSBO'])).toBe('seller')
    expect(defaultDealRoleFromWho(['Seller', 'Buyer'])).toBe('seller')
    expect(defaultDealRoleFromWho(['Buyer'])).toBe('buyer')
    expect(defaultDealRoleFromWho([])).toBe('buyer')
  })

  it('keeps spouse and co-buyer on the same side', () => {
    expect(roleForRelated('spouse', 'seller')).toBe('seller')
    expect(roleForRelated('co-buyer', 'buyer')).toBe('buyer')
    expect(roleForRelated('agent', 'buyer')).toBe('other')
  })

  it('parses city after the first comma', () => {
    expect(parseCityFromAddress('20172 Soft Breeze Dr, Bend, OR 97702')).toBe('Bend')
    expect(parseCityFromAddress('12 Main St')).toBeNull()
  })

  it('builds a stable in-house property key', () => {
    const key = propertyKeyForInhouseDeal('20172 Soft Breeze Dr', 'a1b2c3d4-e5f6')
    expect(key).toBe('inhouse-20172-soft-breeze-dr-a1b2c3d4')
  })

  it('collects buyer and seller names and drops other and blanks', () => {
    expect(
      namesByDealRole([
        { role: 'buyer', name: 'Todd Chester' },
        { role: 'buyer', name: '  ' },
        { role: 'seller', name: 'PMA Investments LLC' },
        { role: 'other', name: 'Ada Agent' },
      ]),
    ).toEqual({
      buyers: ['Todd Chester'],
      sellers: ['PMA Investments LLC'],
    })
  })

  it('dedupes parties and drops bad ids', () => {
    expect(
      dedupeParties([
        { personId: 1, role: 'buyer' },
        { personId: 1, role: 'seller' },
        { personId: 2, role: 'seller' },
        { personId: 0, role: 'other' },
      ]),
    ).toEqual([
      { personId: 1, role: 'buyer' },
      { personId: 2, role: 'seller' },
    ])
  })

  it('guards role strings', () => {
    expect(isDealPersonRole('buyer')).toBe(true)
    expect(isDealPersonRole('cobroke')).toBe(false)
  })

  it('prefers prospect street and city over inbound parse', () => {
    expect(
      defaultDealAddress(
        [{ streetAddress: '20172 Soft Breeze Dr', city: 'Bend' }],
        '12 Main St, Redmond',
      ),
    ).toBe('20172 Soft Breeze Dr, Bend')
    expect(defaultDealAddress([{ streetAddress: null, city: 'Bend' }], '12 Main St')).toBe('12 Main St')
  })

  it('pre-checks related people once, same side for spouse', () => {
    expect(
      relatedPartiesForStartDeal(
        [
          { relatedPersonId: 9, name: 'Pat', label: 'Spouse', type: 'spouse' },
          { relatedPersonId: 9, name: 'Pat', label: 'Spouse', type: 'spouse' },
          { relatedPersonId: 1, name: 'Self', label: 'Spouse', type: 'spouse' },
          { relatedPersonId: 4, name: 'Ada', label: 'Agent', type: 'agent' },
        ],
        1,
        'seller',
      ),
    ).toEqual([
      { personId: 9, name: 'Pat', label: 'Spouse', role: 'seller' },
      { personId: 4, name: 'Ada', label: 'Agent', role: 'other' },
    ])
  })
})
