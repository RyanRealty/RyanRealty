import { describe, expect, it } from 'vitest'
import { firstPersonAddress, formatPersonAddress, personAddressFromFields } from './person-address'

describe('person-address', () => {
  it('reads the first structured address and accepts zip or code', () => {
    expect(
      firstPersonAddress([{ street: '123 NW Bond St', city: 'Bend', state: 'OR', code: '97703' }]),
    ).toEqual({ street: '123 NW Bond St', city: 'Bend', state: 'OR', zip: '97703' })
  })

  it('returns null for empty or missing addresses', () => {
    expect(firstPersonAddress(null)).toBeNull()
    expect(firstPersonAddress([])).toBeNull()
    expect(firstPersonAddress([{ street: '', city: '' }])).toBeNull()
  })

  it('formats street, city, state, and zip as one line', () => {
    expect(
      formatPersonAddress({ street: '123 NW Bond St', city: 'Bend', state: 'OR', zip: '97703' }),
    ).toBe('123 NW Bond St, Bend, OR 97703')
  })

  it('builds a US address from form fields and skips a blank row', () => {
    expect(personAddressFromFields({ street: '1 Main', city: 'Redmond' })).toEqual({
      street: '1 Main',
      city: 'Redmond',
      state: '',
      zip: '',
      country: 'US',
    })
    expect(personAddressFromFields({})).toBeNull()
  })
})
