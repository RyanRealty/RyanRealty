import { describe, expect, it } from 'vitest'
import { ownerNameForEmail } from '@/lib/expired-owner-lookup'

describe('ownerNameForEmail (Matt 2026-10-14, the lead is filed under the person the email belongs to)', () => {
  it('429 Irving: the skip trace said Margo, the email is dkremers, the county trust names David', () => {
    const r = ownerNameForEmail('Margo E Degray Kremers', 'dkremers@hotmail.com', 'DAVID & MARGO KREMERS TRUST')
    expect(r.ownerName).toBe('David Kremers')
    expect(r.greetingNote).toMatch(/^Greeting: dkremers@hotmail\.com is David Kremers's \(/)
    expect(r.greetingNote).toContain('not Margo E Degray Kremers')
  })

  it('a couple on the deed and the other spouse\'s email', () => {
    expect(ownerNameForEmail('Jason Lafferty', 'aletakatra@gmail.com', 'LAFFERTY, JASON C & ALETA P').ownerName).toBe('Aleta Lafferty')
    expect(ownerNameForEmail('James Gross', 'roopal74@yahoo.com', 'GROSS, JAMES M & MEHTA, ROOPAL R').ownerName).toBe('Roopal Mehta')
  })

  it('keeps the name and writes nothing when the email carries it', () => {
    expect(ownerNameForEmail('Patricia J Clark', 'patlongclark@aol.com', 'THOMAS & MICHELE CARROLL TRUST')).toEqual({
      ownerName: 'Patricia J Clark',
      greetingNote: '',
    })
    expect(ownerNameForEmail('Megan Morrison', 'jaredrlyman@gmail.com', 'MORRISON, MEGAN')).toEqual({ ownerName: 'Megan Morrison', greetingNote: '' })
  })

  it('a multi-owner record and an email that names nobody keeps the name and says the letter opens Hi there', () => {
    const r = ownerNameForEmail('John Blanchard', 'simonblanchard239@gmail.com', 'BLANCHARD,JOHN M & SUSAN W')
    expect(r.ownerName).toBe('John Blanchard')
    expect(r.greetingNote).toMatch(/^Greeting: .*so the letter opens Hi there\.$/)
  })

  it('no email, or an entity name with no greeting, changes nothing', () => {
    expect(ownerNameForEmail('Margo Kremers', null, 'DAVID & MARGO KREMERS TRUST')).toEqual({ ownerName: 'Margo Kremers', greetingNote: '' })
    expect(ownerNameForEmail('KAUFMAN FAMILY REVOCABLE TRUST ET AL', 'info@example.com', 'KAUFMAN FAMILY REVOCABLE TRUST ET AL')).toEqual({
      ownerName: 'KAUFMAN FAMILY REVOCABLE TRUST ET AL',
      greetingNote: '',
    })
  })
})
