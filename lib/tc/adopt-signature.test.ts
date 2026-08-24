import { describe, expect, it } from 'vitest'
import {
  fieldNeedsAdoptedMark,
  initialsFromFullName,
  nextRequiredFieldId,
  stampPreparedSignerFields,
} from './adopt-signature'

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

describe('stampPreparedSignerFields', () => {
  it('fills name and date for this signer so they only tap Sign and Initials', () => {
    const stamped = stampPreparedSignerFields(
      [
        { id: 'n1', type: 'full_name', recipientId: 'buyer' },
        { id: 'd1', type: 'date_signed', recipientId: 'buyer' },
        { id: 's1', type: 'signature', recipientId: 'buyer' },
        { id: 'n2', type: 'full_name', recipientId: 'seller' },
      ],
      { recipientId: 'buyer', name: 'Vault Test Buyer', date: '8/24/2026', time: '8:15 AM' },
    )
    expect(stamped).toEqual([
      { fieldId: 'n1', value: { kind: 'text', text: 'Vault Test Buyer' } },
      { fieldId: 'd1', value: { kind: 'date_signed', text: '8/24/2026' } },
    ])
  })
})

describe('fieldNeedsAdoptedMark', () => {
  it('only signature and initials reuse the adopted mark', () => {
    expect(fieldNeedsAdoptedMark('signature')).toBe(true)
    expect(fieldNeedsAdoptedMark('initials')).toBe(true)
    expect(fieldNeedsAdoptedMark('date_signed')).toBe(false)
  })
})
