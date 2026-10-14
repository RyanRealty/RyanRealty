import { describe, expect, it } from 'vitest'
import {
  classifyParcel,
  describeMatch,
  ownerNamesContact,
  parseContactName,
  parseOwnerOfRecord,
  parseStreetLine,
  parseStructuredOwner,
  sameOwnerOfRecord,
  samePlace,
  sameStreet,
  type ContactAddress,
} from './county-owner-match'

// Every name below is invented for the test.

const named = (owner: string, order: 'comma' | 'surname-first', person: { first_name?: string; last_name?: string; name?: string }) =>
  ownerNamesContact(parseOwnerOfRecord(owner, order), parseContactName(person)) !== null

describe('parseOwnerOfRecord, Deschutes order', () => {
  it('reads a couple sharing a family name', () => {
    const o = parseOwnerOfRecord('PELLWORTH, JOHN A & JANE B', 'comma')
    expect(o.kind).toBe('person')
    expect(o.parties.map((p) => [p.first, p.middles[0], p.surnames])).toEqual([
      ['JOHN', 'A', ['PELLWORTH']],
      ['JANE', 'B', ['PELLWORTH']],
    ])
  })

  it('reads joint owners with two family names', () => {
    expect(named('GARRAWAY, JAMES M & OKONTA, RUTH R', 'comma', { first_name: 'Ruth', last_name: 'Okonta' })).toBe(true)
    expect(named('GARRAWAY, JAMES M & OKONTA, RUTH R', 'comma', { first_name: 'Ruth', last_name: 'Garraway' })).toBe(false)
  })

  it('allows a trailing word after "&" to be a second family name or a middle name', () => {
    const owner = 'HALVERSEN, TOMAS & KATRINE BELLWOOD'
    expect(named(owner, 'comma', { first_name: 'Katrine', last_name: 'Bellwood' })).toBe(true)
    expect(named(owner, 'comma', { first_name: 'Katrine', last_name: 'Halversen' })).toBe(true)
  })

  it('reads a trust titled with first names before the family name', () => {
    const o = parseOwnerOfRecord('DORIAN & MAREN QUILLFELD TRUST', 'comma')
    expect(o.kind).toBe('trust')
    expect(named('DORIAN & MAREN QUILLFELD TRUST', 'comma', { first_name: 'Maren', last_name: 'Quillfeld' })).toBe(true)
    expect(named('DORIAN & MAREN QUILLFELD TRUST', 'comma', { first_name: 'Dorian', last_name: 'Quillfeld' })).toBe(true)
  })

  it('reads a revocable trust with middle initials', () => {
    const owner = 'JOHN A & JANE B PELLWORTH REV TRUST'
    expect(named(owner, 'comma', { first_name: 'Jane', last_name: 'Pellworth' })).toBe(true)
    expect(named(owner, 'comma', { name: 'John C Pellworth' })).toBe(false)
  })

  it('a trust titled only by a family name names nobody', () => {
    const o = parseOwnerOfRecord('QUILLFELD FAMILY TRUST', 'comma')
    expect(o.kind).toBe('trust')
    expect(o.parties).toEqual([])
    expect(o.familyNames).toEqual(['QUILLFELD'])
    expect(named('QUILLFELD FAMILY TRUST', 'comma', { first_name: 'Maren', last_name: 'Quillfeld' })).toBe(false)
  })

  it('a company names no person', () => {
    const o = parseOwnerOfRecord('2258 NW 6TH ST LLC', 'comma')
    expect(o.kind).toBe('entity')
    expect(o.parties).toEqual([])
    expect(parseOwnerOfRecord('HIGH DESERT RENTALS', 'comma').kind).toBe('entity')
  })

  it('a company contact matches only the same company text', () => {
    expect(named('LARKSPUR LANE HOLDINGS LLC', 'comma', { name: 'Larkspur Lane Holdings, LLC' })).toBe(true)
    expect(named('LARKSPUR LANE HOLDINGS LLC', 'comma', { name: 'Larkspur Holdings LLC' })).toBe(false)
  })

  it('does not read a full last word into the shared family name', () => {
    const owner = 'JOHN PELLWORTH & JANE ODERMATT TRUST'
    expect(named(owner, 'comma', { first_name: 'John', last_name: 'Pellworth' })).toBe(true)
    expect(named(owner, 'comma', { first_name: 'Jane', last_name: 'Odermatt' })).toBe(true)
    expect(named(owner, 'comma', { first_name: 'John', last_name: 'Odermatt' })).toBe(false)
  })
})

describe('parseOwnerOfRecord, Crook order (family name first, no comma)', () => {
  it('reads a couple sharing a family name', () => {
    expect(named('PELLWORTH JOHN A & JANE B', 'surname-first', { first_name: 'Jane', last_name: 'Pellworth' })).toBe(true)
    expect(named('PELLWORTH JOHN A & JANE B', 'surname-first', { first_name: 'Pellworth', last_name: 'John' })).toBe(false)
  })

  it('reads a second owner who repeats the family name first', () => {
    expect(named('TREMONT RYAN M & TREMONT ROBERT', 'surname-first', { first_name: 'Robert', last_name: 'Tremont' })).toBe(true)
  })

  it('reads trustees with a Jr', () => {
    const owner = 'KNOLLWOOD WILLIAM JR & WINIFRED B TTEES'
    expect(parseOwnerOfRecord(owner, 'surname-first').kind).toBe('trust')
    expect(named(owner, 'surname-first', { first_name: 'William', last_name: 'Knollwood' })).toBe(true)
    expect(named(owner, 'surname-first', { name: 'William Knollwood Sr.' })).toBe(false)
    expect(named(owner, 'surname-first', { first_name: 'Winifred', last_name: 'Knollwood' })).toBe(true)
  })

  it('keeps a particle with the family name', () => {
    expect(named('VAN DOREN MARTA L', 'surname-first', { first_name: 'Marta', last_name: 'Van Doren' })).toBe(true)
  })
})

describe('name rules', () => {
  it('never matches across different family names', () => {
    expect(named('SMYTHE, JOHN', 'comma', { first_name: 'John', last_name: 'Smith' })).toBe(false)
  })

  it('a middle initial that disagrees is a different person; a missing one is not', () => {
    expect(named('PELLWORTH, JOHN A', 'comma', { name: 'John B Pellworth' })).toBe(false)
    expect(named('PELLWORTH, JOHN A', 'comma', { name: 'John Pellworth' })).toBe(true)
    expect(named('PELLWORTH, JOHN A', 'comma', { name: 'John Allen Pellworth' })).toBe(true)
  })

  it('Jr and Sr are different people when both are written', () => {
    expect(named('PELLWORTH, JOHN JR', 'comma', { name: 'John Pellworth Sr' })).toBe(false)
    expect(named('PELLWORTH, JOHN JR', 'comma', { name: 'John Pellworth Jr.' })).toBe(true)
    expect(named('PELLWORTH, JOHN JR', 'comma', { first_name: 'John', last_name: 'Pellworth' })).toBe(true)
    expect(named('PELLWORTH JR, JOHN', 'comma', { name: 'John Pellworth III' })).toBe(false)
  })

  it('a lone initial is not a first name, and nicknames are not equal', () => {
    expect(named('PELLWORTH, J', 'comma', { first_name: 'John', last_name: 'Pellworth' })).toBe(false)
    expect(named('PELLWORTH, ROBERT', 'comma', { first_name: 'Bob', last_name: 'Pellworth' })).toBe(false)
  })

  it('folds case, accents and apostrophes', () => {
    expect(named("O'DARRAGH, RENÉE", 'comma', { first_name: 'renee', last_name: 'ODarragh' })).toBe(true)
  })
})

describe('parseContactName', () => {
  it('splits "John & Jane" in the first-name field', () => {
    const c = parseContactName({ first_name: 'John & Jane', last_name: 'Pellworth' })
    expect(c.people.map((p) => `${p.first} ${p.last}`)).toEqual(['JOHN PELLWORTH', 'JANE PELLWORTH'])
  })

  it('reads a name-only contact with a title and a suffix', () => {
    const c = parseContactName({ name: 'Dr. John A. Pellworth Jr.' })
    expect(c.people).toEqual([{ first: 'JOHN', middles: ['A'], last: 'PELLWORTH', suffix: 'JR' }])
  })

  it('reads a couple in the name field', () => {
    const c = parseContactName({ name: 'John and Jane Pellworth' })
    expect(c.people.map((p) => p.first)).toEqual(['JOHN', 'JANE'])
    expect(c.people.every((p) => p.last === 'PELLWORTH')).toBe(true)
  })

  it('a single word names nobody', () => {
    expect(parseContactName({ name: 'Pellworth' }).people).toEqual([])
    expect(parseContactName({}).people).toEqual([])
  })

  it('a company contact carries an entity key, not people', () => {
    const c = parseContactName({ name: 'Bond Street Rentals LLC' })
    expect(c.people).toEqual([])
    expect(c.entityKey).toBe('BONDSTREETRENTALSLLC')
  })
})

describe('parseStructuredOwner (westside_parcels)', () => {
  it('reads two structured owners', () => {
    const o = parseStructuredOwner({ owner1_first: 'John A', owner1_last: 'Pellworth', owner2_first: 'Jane', owner2_last: 'Odermatt' })
    expect(ownerNamesContact(o, parseContactName({ first_name: 'Jane', last_name: 'Odermatt' }))).not.toBeNull()
    expect(ownerNamesContact(o, parseContactName({ first_name: 'Jane', last_name: 'Pellworth' }))).toBeNull()
  })

  it('reads a trust written whole into owner1_first', () => {
    const o = parseStructuredOwner({ owner1_first: 'Quillfeld Family Trust', owner1_last: '', all_owners: 'Quillfeld Family Trust' })
    expect(o.kind).toBe('trust')
    expect(o.parties).toEqual([])
  })

  it('reads a company written whole into owner1_first', () => {
    expect(parseStructuredOwner({ owner1_first: '2258 Nw 6th St LLC', owner1_last: '' }).kind).toBe('entity')
  })
})

describe('sameOwnerOfRecord', () => {
  it('matches the county string and the structured export for the same couple', () => {
    const live = parseOwnerOfRecord('PELLWORTH, JOHN A & JANE B', 'comma')
    const snap = parseStructuredOwner({ owner1_first: 'John', owner1_last: 'Pellworth', owner2_first: 'Jane', owner2_last: 'Pellworth' })
    expect(sameOwnerOfRecord(live, snap)).toBe(true)
  })

  it('a sale to a new owner is a different owner', () => {
    const live = parseOwnerOfRecord('ODERMATT, MARTA', 'comma')
    const snap = parseStructuredOwner({ owner1_first: 'John', owner1_last: 'Pellworth' })
    expect(sameOwnerOfRecord(live, snap)).toBe(false)
  })
})

describe('street addresses', () => {
  const p = (s: string, place?: { city?: string; zip?: string; unit?: string }) => parseStreetLine(s, place)!

  it('folds street types and keeps directionals', () => {
    expect(sameStreet(p('123 Bond Street'), p('123 NW BOND ST'))).toBe(true)
    expect(sameStreet(p('123 NW Bond St'), p('123 SW BOND ST'))).toBe(false)
    expect(sameStreet(p('123 Bond Ave'), p('123 BOND ST'))).toBe(false)
    expect(sameStreet(p('124 Bond St'), p('123 BOND ST'))).toBe(false)
    expect(sameStreet(p('67186 Harrington Loop'), p('67186 HARRINGTON LOOP RD'))).toBe(true)
    expect(sameStreet(p('1550 NE Bailey Way'), p('1550 NE BAILEY WAY  '))).toBe(true)
  })

  it('a unit on the parcel must be the unit on the address', () => {
    expect(sameStreet(p('900 Wall St'), p('900 WALL ST', { unit: '4' }))).toBe(false)
    expect(sameStreet(p('900 Wall St #4'), p('900 WALL ST', { unit: '4' }))).toBe(true)
    expect(sameStreet(p('900 Wall St Apt 5'), p('900 WALL ST', { unit: '4' }))).toBe(false)
    expect(sameStreet(p('900 Wall St Unit 4'), p('900 WALL ST'))).toBe(true)
  })

  it('does not read a street word as a unit, and a PO box is not a street address', () => {
    expect(p('15 Parking Lot Rd').core).toEqual(['PARKING', 'LOT', 'RD'])
    expect(parseStreetLine('PO Box 123')).toBeNull()
    expect(parseStreetLine('Bond Street')).toBeNull()
  })

  it('needs a place in common', () => {
    const contact = p('123 Bond St', { city: 'Bend', zip: '97703' })
    expect(samePlace(contact, p('123 BOND ST', { city: 'BEND', zip: '97701' }))).toBe(true)
    expect(samePlace(contact, p('123 BOND ST', { city: 'TUMALO', zip: '97703' }))).toBe(true)
    expect(samePlace(contact, p('123 BOND ST', { city: 'REDMOND', zip: '97756' }))).toBe(false)
    const crook = { cities: ['Prineville', 'Powell Butte'], zips: ['97754', '97753'] }
    expect(samePlace(contact, p('123 BOND ST'), crook)).toBe(false)
    expect(samePlace(p('123 Bond St', { city: 'Prineville' }), p('123 BOND ST'), crook)).toBe(true)
    expect(samePlace(p('123 Bond St'), p('123 BOND ST', { city: 'BEND' }))).toBe(false)
  })
})

describe('classifyParcel', () => {
  const home: ContactAddress = {
    label: 'mailing address on their record',
    address: parseStreetLine('2347 NW Larkspur Pl', { city: 'Bend', zip: '97703' })!,
  }
  const situs = parseStreetLine('2347 NW LARKSPUR PL', { city: 'BEND', zip: '97703' })
  const elsewhere = parseStreetLine('61000 BROOKSWOOD BLVD', { city: 'BEND', zip: '97702' })
  const contact = parseContactName({ first_name: 'Jane', last_name: 'Pellworth' })

  it('high: named owner at their address', () => {
    const c = classifyParcel(contact, [home], { owner: parseOwnerOfRecord('PELLWORTH, JOHN A & JANE B', 'comma'), situs, mailing: situs })
    expect(c?.strength).toBe('high')
    expect(c?.siteAddressLabel).toBe('mailing address on their record')
    expect(describeMatch(c!, 'PELLWORTH, JOHN A & JANE B', 'person')).toBe(
      'Owner of record: PELLWORTH, JOHN A & JANE B. The name matches Jane Pellworth, and this property is the mailing address on their record.',
    )
  })

  it('high: named owner whose tax statement goes to their address (a rental)', () => {
    const c = classifyParcel(contact, [home], { owner: parseOwnerOfRecord('PELLWORTH, JANE B', 'comma'), situs: elsewhere, mailing: situs })
    expect(c?.strength).toBe('high')
    expect(c?.siteAddressLabel).toBeNull()
    expect(c?.mailingAddressLabel).toBe('mailing address on their record')
  })

  it('medium: named owner, no address of theirs', () => {
    const c = classifyParcel(contact, [home], { owner: parseOwnerOfRecord('PELLWORTH, JANE', 'comma'), situs: elsewhere, mailing: elsewhere })
    expect(c?.strength).toBe('medium')
    expect(describeMatch(c!, 'PELLWORTH, JANE', 'person')).toContain('could be someone else with the same name')
  })

  it('resident: same address, a different owner of record (a renter)', () => {
    const c = classifyParcel(contact, [home], { owner: parseOwnerOfRecord('ODERMATT, MARTA', 'comma'), situs, mailing: elsewhere })
    expect(c?.strength).toBe('resident')
    expect(c?.sharesFamilyName).toBe(false)
    expect(describeMatch(c!, 'ODERMATT, MARTA', 'person')).toBe(
      'This property is the mailing address on their record. The owner of record is ODERMATT, MARTA, not them.',
    )
  })

  it('resident: a family trust carrying their last name is not ownership', () => {
    const c = classifyParcel(contact, [home], { owner: parseOwnerOfRecord('PELLWORTH FAMILY TRUST', 'comma'), situs, mailing: situs })
    expect(c?.strength).toBe('resident')
    expect(c?.sharesFamilyName).toBe(true)
    expect(describeMatch(c!, 'PELLWORTH FAMILY TRUST', 'trust')).toContain('a trust that does not name them. It carries their last name.')
  })

  it('resident: the owner of record names a linked contact', () => {
    const related = [{ label: 'Spouse', name: 'John Pellworth', identity: parseContactName({ name: 'John Pellworth' }) }]
    const c = classifyParcel(contact, [home], { owner: parseOwnerOfRecord('PELLWORTH, JOHN A', 'comma'), situs, mailing: situs }, related)
    expect(c?.strength).toBe('resident')
    expect(c?.namesRelated).toEqual({ label: 'Spouse', name: 'John Pellworth' })
  })

  it('resident: a company owner is shown as a company', () => {
    const c = classifyParcel(contact, [home], { owner: parseOwnerOfRecord('LARKSPUR RENTALS LLC', 'comma'), situs, mailing: elsewhere })
    expect(c?.strength).toBe('resident')
    expect(describeMatch(c!, 'LARKSPUR RENTALS LLC', 'entity')).toContain('a company')
  })

  it('nothing: not named and not their address', () => {
    expect(classifyParcel(contact, [home], { owner: parseOwnerOfRecord('ODERMATT, MARTA', 'comma'), situs: elsewhere, mailing: elsewhere })).toBeNull()
  })

  it('a trust that names them is ownership', () => {
    const c = classifyParcel(contact, [home], { owner: parseOwnerOfRecord('JOHN & JANE PELLWORTH REV TRUST', 'comma'), situs, mailing: situs })
    expect(c?.strength).toBe('high')
    expect(describeMatch(c!, 'JOHN & JANE PELLWORTH REV TRUST', 'trust')).toContain('a trust that names Jane Pellworth')
  })
})
