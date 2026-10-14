import { describe, expect, it } from 'vitest'
import {
  type HouseholdPerson,
  chooseGreetingForEmail,
  emailNameMatch,
  emailNamesSomeoneElse,
  ownerOfRecordFromNotes,
  ownerOfRecordNote,
  parseOwnerHousehold,
} from '@/lib/crm/household-names'

/** first and last only, so the given-name list does not clutter the parse expectations. */
function fl(people: readonly HouseholdPerson[]): Array<{ first: string; last: string | null }> {
  return people.map((p) => ({ first: p.first, last: p.last }))
}

describe('parseOwnerHousehold', () => {
  it('reads a trust named for a couple', () => {
    const h = parseOwnerHousehold('DAVID & MARGO KREMERS TRUST')
    expect(fl(h.people)).toEqual([
      { first: 'David', last: 'Kremers' },
      { first: 'Margo', last: 'Kremers' },
    ])
    expect(h.parties).toBe(2)
    expect(h.entity).toBe(true)
    expect(parseOwnerHousehold('TONY & CHRISTINE SPRANDO FAMILY TRUST').people.map((p) => p.first)).toEqual(['Tony', 'Christine'])
  })

  it('reads the county person forms', () => {
    expect(fl(parseOwnerHousehold('COLVIN, GREGORY P & LORI M').people)).toEqual([
      { first: 'Gregory', last: 'Colvin' },
      { first: 'Lori', last: 'Colvin' },
    ])
    expect(fl(parseOwnerHousehold('BLANCHARD,JOHN M & SUSAN W').people)).toEqual([
      { first: 'John', last: 'Blanchard' },
      { first: 'Susan', last: 'Blanchard' },
    ])
    expect(fl(parseOwnerHousehold('GROSS, JAMES M & MEHTA, ROOPAL R').people)).toEqual([
      { first: 'James', last: 'Gross' },
      { first: 'Roopal', last: 'Mehta' },
    ])
    expect(parseOwnerHousehold('MORRISON, MEGAN')).toMatchObject({ people: [{ first: 'Megan', last: 'Morrison', given: ['Megan'] }], parties: 1 })
  })

  it('counts ET AL as a party nobody named', () => {
    const h = parseOwnerHousehold('ROSTEN, ROBERT L ET AL')
    expect(fl(h.people)).toEqual([{ first: 'Robert', last: 'Rosten' }])
    expect(h.parties).toBe(2)
  })

  it('reads single-person and family-name trusts', () => {
    expect(fl(parseOwnerHousehold('CHARLES N SHEPARD LIV TRUST').people)).toEqual([{ first: 'Charles', last: 'Shepard' }])
    expect(fl(parseOwnerHousehold('MERRY C SHUCK TRUST').people)).toEqual([{ first: 'Merry', last: 'Shuck' }])
    expect(fl(parseOwnerHousehold('REBECCA WINEGAR TRUST').people)).toEqual([{ first: 'Rebecca', last: 'Winegar' }])
    expect(parseOwnerHousehold('LOPEZ, EUGENE ERIC & GLEIM, LAURA ANN').people.map((p) => p.given)).toEqual([['Eugene', 'Eric'], ['Laura', 'Ann']])
    expect(parseOwnerHousehold('STULC, ERIN C').people[0]?.given).toEqual(['Erin', 'C'])
    const fam = parseOwnerHousehold('KAUFMAN FAMILY REVOCABLE TRUST ET AL')
    expect(fam.people).toEqual([])
    expect(fam.surnames).toEqual(['Kaufman'])
    expect(fam.parties).toBe(2)
    const two = parseOwnerHousehold('CARTER & MORSE TRUST')
    expect(two.people).toEqual([])
    expect(two.surnames).toEqual(['Carter', 'Morse'])
    expect(two.parties).toBe(2)
  })

  it('a company owner names nobody', () => {
    const h = parseOwnerHousehold('PAHLISCH HOMES AT PETROSA LP')
    expect(h.people).toEqual([])
    expect(h.entity).toBe(true)
  })

  it('empty input is an empty household', () => {
    expect(parseOwnerHousehold(null)).toEqual({ raw: '', people: [], surnames: [], parties: 0, entity: false })
  })
})

describe('emailNameMatch', () => {
  const david = { first: 'David', last: 'Kremers' }
  const margo = { first: 'Margo', last: 'Kremers' }
  it('first initial plus surname is the person', () => {
    expect(emailNameMatch('dkremers@hotmail.com', david)).toBe('strong')
    expect(emailNameMatch('dkremers@hotmail.com', margo)).toBe('none')
  })
  it('a whole first name is the person', () => {
    expect(emailNameMatch('aletakatra@gmail.com', { first: 'Aleta', last: 'Lafferty' })).toBe('weak')
    expect(emailNameMatch('roopal74@yahoo.com', { first: 'Roopal', last: 'Mehta' })).toBe('strong')
    expect(emailNameMatch('terry_l_mead@hotmail.com', { first: 'Terry', last: 'Mead' })).toBe('strong')
    expect(emailNameMatch('maryjo.kaufman@gmail.com', { first: 'Mary', last: 'Kaufman' })).toBe('weak')
  })
  it('a short form with the surname is a weak match', () => {
    expect(emailNameMatch('patlongclark@aol.com', { first: 'Patricia', last: 'Clark' })).toBe('weak')
    expect(emailNameMatch('camehner@aol.com', { first: 'Christine', last: 'Mehner' })).toBe('weak')
  })
  it('a handle with nobody in it is none', () => {
    expect(emailNameMatch('onefastimpala@gmail.com', { first: 'Brian', last: "O'hickey" })).toBe('none')
    expect(emailNameMatch('jswinn@hotmail.com', { first: 'Shawn', last: 'Barrett' })).toBe('none')
    expect(emailNameMatch(null, david)).toBe('none')
  })
})

describe('emailNamesSomeoneElse', () => {
  it('the family name with a stranger in front is another household member', () => {
    expect(emailNamesSomeoneElse('nrugani@yahoo.com', [{ first: 'Dominic', last: 'Rugani' }], ['Rugani'])).toBe(true)
    expect(
      emailNamesSomeoneElse('simonblanchard239@gmail.com', [{ first: 'John', last: 'Blanchard' }, { first: 'Susan', last: 'Blanchard' }], ['Blanchard']),
    ).toBe(true)
    expect(emailNamesSomeoneElse('rosaliewilson@comcast.net', [{ first: 'Katherine', last: 'Wilson' }], ['Wilson'])).toBe(true)
  })
  it('the family name with a listed first name or initial is not', () => {
    expect(emailNamesSomeoneElse('dkremers@hotmail.com', [{ first: 'David', last: 'Kremers' }], ['Kremers'])).toBe(false)
    expect(emailNamesSomeoneElse('camehner@aol.com', [{ first: 'Christine', last: 'Mehner' }], ['Mehner'])).toBe(false)
    expect(emailNamesSomeoneElse('travislamb@hotmail.com', [{ first: 'Travis', last: 'Lamb' }], ['Lamb'])).toBe(false)
    expect(emailNamesSomeoneElse('jaredrlyman@gmail.com', [{ first: 'Megan', last: 'Morrison' }], ['Morrison'])).toBe(false)
  })
})

describe('chooseGreetingForEmail (Matt 2026-10-14, the greeting names the person at the address)', () => {
  it('429 Irving: the trust names David and Margo, the email is dkremers, so the letter greets David', () => {
    const pick = chooseGreetingForEmail({
      baseFirstName: 'Margo',
      clientName: 'Margo E Degray Kremers',
      email: 'dkremers@hotmail.com',
      ownerOfRecord: 'DAVID & MARGO KREMERS TRUST',
    })
    expect(pick.firstName).toBe('David')
  })

  it('moves to the co-owner the email carries', () => {
    expect(
      chooseGreetingForEmail({ baseFirstName: 'Jason', clientName: 'Jason Lafferty', email: 'aletakatra@gmail.com', ownerOfRecord: 'LAFFERTY, JASON C & ALETA P' }).firstName,
    ).toBe('Aleta')
    expect(
      chooseGreetingForEmail({ baseFirstName: 'James', clientName: 'James Gross', email: 'roopal74@yahoo.com', ownerOfRecord: 'GROSS, JAMES M & MEHTA, ROOPAL R' }).firstName,
    ).toBe('Roopal')
    expect(
      chooseGreetingForEmail({ baseFirstName: 'Anthony', clientName: 'Anthony Daniel Sprando', email: 'tonysprando@gmail.com', ownerOfRecord: 'TONY & CHRISTINE SPRANDO FAMILY TRUST' }).firstName,
    ).toBe('Tony')
  })

  it('keeps the stored name when the email carries it', () => {
    expect(
      chooseGreetingForEmail({ baseFirstName: 'Patricia', clientName: 'Patricia J Clark', email: 'patlongclark@aol.com', ownerOfRecord: 'THOMAS & MICHELE CARROLL TRUST' }).firstName,
    ).toBe('Patricia')
    expect(
      chooseGreetingForEmail({ baseFirstName: 'Christine', clientName: 'Christine Mehner', email: 'camehner@aol.com', ownerOfRecord: 'MEHNER, CHRISTINE A' }).firstName,
    ).toBe('Christine')
    expect(
      chooseGreetingForEmail({ baseFirstName: 'Saaid', clientName: 'Saaid M Moezzi', email: 'smoezzi@yahoo.com', ownerOfRecord: 'COHEN IRREVOCABLE TRUST' }).firstName,
    ).toBe('Saaid')
    expect(chooseGreetingForEmail({ baseFirstName: 'Sean', clientName: 'Sean V Fannin', email: 'sean@traditionalhealtharts.com', ownerOfRecord: 'THERRIEN LIVING TRUST' }).firstName).toBe('Sean')
  })

  it('two or more parties and an email that names none of them is Hi there', () => {
    expect(
      chooseGreetingForEmail({ baseFirstName: 'John', clientName: 'John Blanchard', email: 'simonblanchard239@gmail.com', ownerOfRecord: 'BLANCHARD,JOHN M & SUSAN W' }).firstName,
    ).toBeNull()
    expect(
      chooseGreetingForEmail({ baseFirstName: 'Shawn', clientName: 'Shawn Barrett', email: 'jswinn@hotmail.com', ownerOfRecord: 'BARRETT, SHAWN ADRIAN & CARRIE ANN' }).firstName,
    ).toBeNull()
    expect(
      chooseGreetingForEmail({ baseFirstName: 'Ross', clientName: 'Ross Martinka', email: 'lucchesi22@gmail.com', ownerOfRecord: 'MARTINKA,ROSS EDWARD & AVA RAEANN' }).firstName,
    ).toBeNull()
    expect(
      chooseGreetingForEmail({ baseFirstName: 'Robert', clientName: 'Robert Rosten', email: 'msjesswarren@gmail.com', ownerOfRecord: 'ROSTEN, ROBERT L ET AL' }).firstName,
    ).toBeNull()
    expect(
      chooseGreetingForEmail({ baseFirstName: 'Alexis', clientName: 'Alexis Ann Heath', email: 'alsdoghouse@yahoo.com', ownerOfRecord: 'REBECCA WINEGAR TRUST' }).firstName,
    ).toBeNull()
  })

  it('the family name with a stranger in front is Hi there, whatever the party count', () => {
    expect(chooseGreetingForEmail({ baseFirstName: 'Dominic', clientName: 'Dominic Rugani', email: 'nrugani@yahoo.com', ownerOfRecord: 'RUGANI, DOMINIC' }).firstName).toBeNull()
    expect(chooseGreetingForEmail({ baseFirstName: 'Katherine', clientName: 'Katherine Wilson', email: 'rosaliewilson@comcast.net', ownerOfRecord: 'WILSON, KATHERINE KRISTINE' }).firstName).toBeNull()
  })

  it('one owner on record with a handle that names nobody keeps the name', () => {
    expect(chooseGreetingForEmail({ baseFirstName: 'Megan', clientName: 'Megan Morrison', email: 'jaredrlyman@gmail.com', ownerOfRecord: 'MORRISON, MEGAN' }).firstName).toBe('Megan')
    expect(chooseGreetingForEmail({ baseFirstName: 'Richard', clientName: 'Richard Naylor', email: 'sflowbiesf@gmail.com', ownerOfRecord: 'NAYLOR, RICHARD SCOTT' }).firstName).toBe('Richard')
    expect(chooseGreetingForEmail({ baseFirstName: 'Brian', clientName: "Brian O'hickey", email: 'onefastimpala@gmail.com', ownerOfRecord: null }).firstName).toBe('Brian')
  })

  it('no email, or no name, changes nothing', () => {
    expect(chooseGreetingForEmail({ baseFirstName: 'Margo', clientName: 'Margo Kremers', email: null, ownerOfRecord: 'DAVID & MARGO KREMERS TRUST' }).firstName).toBe('Margo')
    expect(chooseGreetingForEmail({ baseFirstName: null, clientName: 'Jan North & Bea North Rev Liv Trust', email: 'info@example.com', ownerOfRecord: null }).firstName).toBeNull()
  })

  it('a trust client name with no greeting of its own still greets the owner the email names', () => {
    expect(
      chooseGreetingForEmail({ baseFirstName: null, clientName: 'David & Margo Kremers Trust', email: 'dkremers@hotmail.com', ownerOfRecord: 'DAVID & MARGO KREMERS TRUST' }).firstName,
    ).toBe('David')
  })
})

describe('owner-of-record note', () => {
  it('round-trips through the county notes', () => {
    const notes = `Resolved via Deschutes County assessor records (taxlot 1, account 2). ${ownerOfRecordNote('LAFFERTY, JASON C & ALETA P')} Mailing: 1 Main St. Owner-occupied per mailing address. Skip trace: 2 phone(s), 1 email(s).`
    expect(ownerOfRecordFromNotes(notes)).toBe('LAFFERTY, JASON C & ALETA P')
  })
  it('reads the entity sentence rows written before the marker', () => {
    expect(
      ownerOfRecordFromNotes(
        'Resolved via Deschutes County assessor records (taxlot 171233CB00203, account 240503). Legal owner (entity): DAVID & MARGO KREMERS TRUST. Skip-trace resolved contact: Margo E Degray Kremers. Mailing: 920 NORTHRIDGE DR, PRESCOTT, AZ, 86301.',
      ),
    ).toBe('DAVID & MARGO KREMERS TRUST')
    expect(ownerOfRecordFromNotes('Skip trace: 2 phone(s).')).toBeNull()
    expect(ownerOfRecordFromNotes(null)).toBeNull()
    expect(ownerOfRecordNote('')).toBe('')
  })
})

describe('the shapes the delivered-letter audit of 2026-10-14 surfaced', () => {
  it('a middle initial with the surname is the person (Erin C Stulc at cstulc@)', () => {
    expect(chooseGreetingForEmail({ baseFirstName: 'Erin', clientName: 'Erin C Stulc', email: 'cstulc@hotmail.com', ownerOfRecord: 'CARTER & MORSE TRUST' }).firstName).toBe('Erin')
  })
  it('a middle name the person goes by keeps the stored first name (EUGENE ERIC at ericlopez360@)', () => {
    expect(
      chooseGreetingForEmail({ baseFirstName: 'Eugene', clientName: 'Eugene Lopez', email: 'ericlopez360@gmail.com', ownerOfRecord: 'LOPEZ, EUGENE ERIC & GLEIM, LAURA ANN' }).firstName,
    ).toBe('Eugene')
  })
  it('short forms of the name with or without the surname keep the name', () => {
    expect(chooseGreetingForEmail({ baseFirstName: 'Miranda', clientName: 'Miranda Wells', email: 'randawells@gmail.com', ownerOfRecord: 'WELLS, MIRANDA' }).firstName).toBe('Miranda')
    expect(
      chooseGreetingForEmail({ baseFirstName: 'Margaret', clientName: 'Margaret Litzer', email: 'margoabaker@gmail.com', ownerOfRecord: 'LITZER, MARGARET ASHTON BAKER & DREW' }).firstName,
    ).toBe('Margaret')
    expect(
      chooseGreetingForEmail({ baseFirstName: 'Christopher', clientName: 'Christopher Connelly', email: 'lilchris2063@gmail.com', ownerOfRecord: 'CONNELLY, CHRISTOPHER JOHN & ANNA' }).firstName,
    ).toBe('Christopher')
    expect(chooseGreetingForEmail({ baseFirstName: 'Dallin', clientName: 'Dallin Christensen', email: 'dallywally00@gmail.com', ownerOfRecord: 'CHRISTENSEN, DALLIN & FAITH' }).firstName).toBe('Dallin')
    expect(chooseGreetingForEmail({ baseFirstName: 'Leah', clientName: 'Leah Vroman', email: 'vromanleah@gmail.com', ownerOfRecord: 'OMAN FAMILY TRUST' }).firstName).toBe('Leah')
  })
  it('a surname cut short behind an initial, and two bare initials, are the person', () => {
    expect(chooseGreetingForEmail({ baseFirstName: 'Zac', clientName: 'Zac Ludington', email: 'zludingt@hotmail.com', ownerOfRecord: 'LUDINGTON, KYLA M' }).firstName).toBe('Zac')
    expect(chooseGreetingForEmail({ baseFirstName: 'Ryan', clientName: 'Ryan Wood', email: 'rw021585@gmail.com', ownerOfRecord: 'WOOD, RYAN LEE & WOOD, TERRANCE L' }).firstName).toBe('Ryan')
  })
  it('a family trust in the client\'s own surname is one party', () => {
    expect(
      chooseGreetingForEmail({ baseFirstName: 'Christine', clientName: 'Christine M Maccrone', email: 'maccrone@yahoo.com', ownerOfRecord: '1986 MACCRONE LIVING TRUST' }).firstName,
    ).toBe('Christine')
  })
  it('two letters in front of the surname are not a stranger', () => {
    expect(chooseGreetingForEmail({ baseFirstName: 'Audree', clientName: 'Audree Yost', email: 'sk8yost60@comcast.net', ownerOfRecord: 'YOST, AUDREE MARIE' }).firstName).toBe('Audree')
  })
  it('still refuses the real strangers and the unreadable households', () => {
    expect(chooseGreetingForEmail({ baseFirstName: 'Alex', clientName: 'Alex Beck', email: 'albertbeck@charter.net', ownerOfRecord: 'BECK, ALEX THOMAS' }).firstName).toBeNull()
    expect(chooseGreetingForEmail({ baseFirstName: 'Joey', clientName: 'Joey Hensley', email: 'torrielisehensley@gmail.com', ownerOfRecord: 'HENSLEY, JOEY MICHAEL & FEBRA CAREEN' }).firstName).toBeNull()
    expect(chooseGreetingForEmail({ baseFirstName: 'Edward', clientName: 'Edward Ferrell', email: 'mariah.a.ferrell@gmail.com', ownerOfRecord: 'FERRELL, EDWARD M & ANGELA M' }).firstName).toBeNull()
    expect(chooseGreetingForEmail({ baseFirstName: 'Daniel', clientName: 'Daniel Willis', email: 'brynwillis@hotmail.com', ownerOfRecord: 'WILLIS, DANIEL L & BRYN H' }).firstName).toBe('Bryn')
    expect(chooseGreetingForEmail({ baseFirstName: 'Christopher', clientName: 'Christopher Muchmore', email: 'muchmoremusic1978@gmail.com', ownerOfRecord: 'MUCHMORE, CHRISTOPHER L & CASSIDY J' }).firstName).toBeNull()
  })
})

describe('a name that merely opens a longer word is not the person (code review 2026-10-14)', () => {
  it('annualreport is not Ann, maxwell is not Max, everything is not Eve', () => {
    expect(emailNameMatch('annualreport@gmail.com', { first: 'Ann', last: 'Smith' })).toBe('none')
    expect(emailNameMatch('maxwell@gmail.com', { first: 'Max', last: 'Smith' })).toBe('none')
    expect(emailNameMatch('everything@gmail.com', { first: 'Eve', last: 'Smith' })).toBe('none')
    expect(chooseGreetingForEmail({ baseFirstName: 'John', clientName: 'John Smith', email: 'annualreport@gmail.com', ownerOfRecord: 'SMITH, JOHN & ANN' }).firstName).toBeNull()
  })
  it('the name whole, followed by digits or a separator, still is', () => {
    expect(emailNameMatch('ann.smith@gmail.com', { first: 'Ann', last: 'Smith' })).toBe('strong')
    expect(emailNameMatch('ann74@gmail.com', { first: 'Ann', last: 'Smith' })).toBe('strong')
    expect(emailNameMatch('annsmith@gmail.com', { first: 'Ann', last: 'Smith' })).toBe('strong')
  })
})
