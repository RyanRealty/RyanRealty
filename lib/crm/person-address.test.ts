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

describe('a state alone is not an address', () => {
  it('drops the quick-add default state when nothing else was entered', () => {
    // The form pre-fills State with "OR"; on its own that rendered a header
    // line reading just "OR" on every addressless contact.
    expect(personAddressFromFields({ state: 'OR' })).toBeNull()
    expect(firstPersonAddress([{ street: '', city: '', state: 'OR', zip: '' }])).toBeNull()
  })

  it('keeps the state once a street, city or zip is present', () => {
    expect(personAddressFromFields({ city: 'Bend', state: 'OR' })).toEqual({
      street: '', city: 'Bend', state: 'OR', zip: '', country: 'US',
    })
    expect(personAddressFromFields({ zip: '97703', state: 'OR' })?.state).toBe('OR')
    expect(personAddressFromFields({ street: '123 NW Bond St', state: 'OR' })?.state).toBe('OR')
  })
})
