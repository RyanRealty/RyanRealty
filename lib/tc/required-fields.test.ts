import { describe, expect, it } from 'vitest'
import {
  fieldValueIsComplete,
  incompleteFormMessage,
  incompletePrepareMessage,
  missingCompleteFields,
  missingPrepareFields,
} from './required-fields'

describe('fieldValueIsComplete', () => {
  it('treats empty, blank text, and unchecked required boxes as incomplete', () => {
    expect(fieldValueIsComplete('text', null)).toBe(false)
    expect(fieldValueIsComplete('text', { kind: 'text', text: '  ' })).toBe(false)
    expect(fieldValueIsComplete('text', { kind: 'text', text: '$435,000' })).toBe(true)
    expect(fieldValueIsComplete('checkbox', { kind: 'checkbox', checked: false })).toBe(false)
    expect(fieldValueIsComplete('checkbox', { kind: 'checkbox', checked: true })).toBe(true)
    expect(fieldValueIsComplete('signature', { kind: 'signature', png: '' })).toBe(false)
    expect(fieldValueIsComplete('signature', { kind: 'signature', png: 'data:image/png;base64,xx' })).toBe(true)
  })
})

describe('missingPrepareFields', () => {
  it('requires deal blanks filled before send; signer fields may wait', () => {
    const fields = [
      { type: 'text', required: true, recipientId: null, value: null, label: 'Sale price' },
      { type: 'signature', required: true, recipientId: 'buyer-1', value: null, label: 'Buyer' },
      { type: 'strike', required: true, recipientId: null, value: null },
    ]
    expect(missingPrepareFields(fields).map((f) => f.label)).toEqual(['Sale price'])
    expect(incompletePrepareMessage(fields)).toMatch(/Sale price/)
    expect(incompletePrepareMessage(fields)).toMatch(/completed as required/)
  })

  it('lets optional blanks stay empty', () => {
    expect(
      missingPrepareFields([
        { type: 'text', required: false, recipientId: null, value: null, label: 'Note' },
      ]),
    ).toEqual([])
  })
})

describe('missingCompleteFields', () => {
  it('will not mark the form complete while a required signature is still empty', () => {
    const fields = [
      { type: 'text', required: true, recipientId: null, value: { kind: 'text' as const, text: '218 SW 4th' } },
      { type: 'signature', required: true, recipientId: 'seller-1', value: null, label: 'Seller' },
    ]
    expect(missingCompleteFields(fields)).toHaveLength(1)
    expect(incompleteFormMessage(fields)).toMatch(/Seller/)
    expect(incompleteFormMessage(fields)).toMatch(/not complete/)
  })
})
