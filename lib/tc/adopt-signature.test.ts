import { describe, expect, it } from 'vitest'
import { fieldNeedsAdoptedMark, initialsFromFullName, nextRequiredFieldId } from './adopt-signature'

describe('initialsFromFullName', () => {
  it('takes first and last letters of a legal name', () => {
    expect(initialsFromFullName('Matt Ryan')).toBe('MR')
    expect(initialsFromFullName('Marketing Test Lead')).toBe('ML')
    expect(initialsFromFullName('Vault')).toBe('VA')
    expect(initialsFromFullName('  ')).toBe('')
  })
})

describe('nextRequiredFieldId', () => {
  it('walks signature boxes first, then the rest of the required fields', () => {
    const fields = [
      { id: 'd1', required: true, type: 'date_signed' as const },
      { id: 's1', required: true, type: 'signature' as const },
      { id: 's2', required: true, type: 'signature' as const },
    ]
    expect(nextRequiredFieldId(fields, new Set())).toBe('s1')
    expect(nextRequiredFieldId(fields, new Set(['s1']))).toBe('s2')
    expect(nextRequiredFieldId(fields, new Set(['s1', 's2']))).toBe('d1')
    expect(nextRequiredFieldId(fields, new Set(['s1', 's2', 'd1']))).toBeNull()
  })
})

describe('fieldNeedsAdoptedMark', () => {
  it('only signature and initials reuse the adopted mark', () => {
    expect(fieldNeedsAdoptedMark('signature')).toBe(true)
    expect(fieldNeedsAdoptedMark('initials')).toBe(true)
    expect(fieldNeedsAdoptedMark('date_signed')).toBe(false)
  })
})
