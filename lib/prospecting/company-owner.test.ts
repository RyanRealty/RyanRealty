import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { companyOwnerSendHold, isCompanyOwnedEntity, legalEntityOwner } from './company-owner'

function notes(legal: string, human?: string): string {
  const contact = human ? ` Skip-trace resolved contact: ${human}.` : ''
  return [
    'Resolved via Deschutes County assessor records (taxlot 1, account 2).',
    `Legal owner (entity): ${legal}.${contact}`,
    'Mailing: 210 SW Wilson Ave, Bend, OR, 97702.',
    'Skip trace: 3 phone(s), 3 email(s).',
  ].join(' ')
}

describe('companyOwnerSendHold', () => {
  it('holds an LP, an LLC, and a dotted company, and names the county owner', () => {
    expect(companyOwnerSendHold(notes('PAHLISCH HOMES AT PETROSA LP', 'Someone Else'))).toBe(
      'County owner is a company (PAHLISCH HOMES AT PETROSA LP). Cold outreach stays held.',
    )
    expect(companyOwnerSendHold(notes('PAHLISCH HOMES AT COLLIER LLC'))).toMatch(/COLLIER LLC/)
    expect(companyOwnerSendHold(notes('LUCIA ST LLC', 'A Person'))).toMatch(/LUCIA ST LLC/)
    expect(companyOwnerSendHold(notes('HOMES, L.L.C.'))).toMatch(/L\.L\.C/)
    expect(companyOwnerSendHold(notes('HOMES, L.P.'))).toMatch(/L\.P/)
    expect(companyOwnerSendHold(notes('HOMES LLP'))).toMatch(/LLP/)
    expect(companyOwnerSendHold(notes('HOMES, L.L.P.'))).toMatch(/L\.L\.P/)
    expect(companyOwnerSendHold(notes('HOMES INC'))).toMatch(/INC/)
    expect(companyOwnerSendHold(notes('HOMES INCORPORATED'))).toMatch(/INCORPORATED/)
    expect(companyOwnerSendHold(notes('HOMES CORP'))).toMatch(/CORP/)
    expect(companyOwnerSendHold(notes('HOMES CORPORATION'))).toMatch(/CORPORATION/)
    expect(companyOwnerSendHold(notes('lucia st llc'))).toMatch(/lucia st llc/)
  })

  it('still sends a family trust, a trustee, and an estate', () => {
    expect(companyOwnerSendHold(notes('FRANK N SERBUS TRUST', 'Frank N Serbus'))).toBeNull()
    expect(companyOwnerSendHold(notes('SUSAN JOLLER FAMILY TRUST', 'Susan Lynn Joller'))).toBeNull()
    expect(companyOwnerSendHold(notes('1986 MACCRONE LIVING TRUST'))).toBeNull()
    expect(companyOwnerSendHold(notes('1998 PATTERSON REVOCABLE TRUST'))).toBeNull()
    expect(companyOwnerSendHold(notes('JANE DOE, TRUSTEE'))).toBeNull()
    expect(companyOwnerSendHold(notes('JOHN SMITH ESTATE'))).toBeNull()
  })

  it('reads the legal-owner sentence only', () => {
    const trustWithCompanyContact = notes('SUSAN JOLLER FAMILY TRUST', 'Acme LLC')
    expect(legalEntityOwner(trustWithCompanyContact)).toBe('SUSAN JOLLER FAMILY TRUST')
    expect(companyOwnerSendHold(trustWithCompanyContact)).toBeNull()

    const companyWithTrustContact = notes('LUCIA ST LLC', 'Frank Family Trust')
    expect(companyOwnerSendHold(companyWithTrustContact)).toMatch(/LUCIA ST LLC/)
  })

  it('does not hold a person, a missing note, or a company word that is not the legal owner', () => {
    expect(companyOwnerSendHold(null)).toBeNull()
    expect(companyOwnerSendHold('')).toBeNull()
    expect(
      companyOwnerSendHold(
        'Resolved via Deschutes County assessor records. Owner-occupied per mailing address. Skip trace: 1 phone(s), 1 email(s).',
      ),
    ).toBeNull()
    expect(companyOwnerSendHold('Skip-trace resolved contact: Something LLC.')).toBeNull()
    expect(legalEntityOwner('Legal owner (entity): . Mailing: 1 Main.')).toBeNull()
  })

  it('does not treat a longer word as Inc or Corp, and does treat LLP as a company', () => {
    expect(isCompanyOwnedEntity('INCLINE DRIVE TRUST')).toBe(false)
    expect(isCompanyOwnedEntity('SCORPION HOLDINGS')).toBe(false)
    expect(isCompanyOwnedEntity('HELPING HANDS')).toBe(false)
    expect(isCompanyOwnedEntity('SCORPION CORP')).toBe(true)
    expect(isCompanyOwnedEntity('ALPH LLP')).toBe(true)
    expect(isCompanyOwnedEntity('ALPH LP')).toBe(true)
  })

  it('both drains dequeue a company-owned refusal so the queue cannot stall', () => {
    for (const file of ['lib/data/prospecting/drip-drain.ts', 'lib/data/prospecting/drip-sunday-drain.ts']) {
      const src = readFileSync(join(process.cwd(), file), 'utf8')
      const set = src.slice(src.indexOf('const DEQUEUE_CODES'), src.indexOf('export async function'))
      expect(set, file).toContain("'company-owned'")
      expect(set, file).not.toContain("'in-progress'")
    }
  })
})
