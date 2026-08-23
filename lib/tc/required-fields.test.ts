import { describe, expect, it } from 'vitest'
import {
  fieldRequirement,
  fieldValueIsComplete,
  incompleteFactsMessage,
  incompleteFormMessage,
  incompletePrepareMessage,
  mapFieldIsRequired,
  missingCompleteFields,
  missingPrepareFields,
  missingRequiredFacts,
} from './required-fields'

describe('fieldRequirement', () => {
  it('does not treat unknown blanks as required', () => {
    expect(fieldRequirement({ type: 'text' })).toBe('unknown')
    expect(fieldRequirement({ type: 'checkbox' })).toBe('unknown')
    expect(mapFieldIsRequired({ type: 'text', dataRef: 'SomeRandomBlank' })).toBe(false)
  })

  it('honors the form marking a field optional or required', () => {
    expect(fieldRequirement({ type: 'text', isOptional: true })).toBe('optional')
    expect(fieldRequirement({ type: 'text', isOptional: false })).toBe('required')
    expect(fieldRequirement({ type: 'signature', isOptional: true, signerRole: 'buyer' })).toBe('optional')
  })

  it('requires signature lines tagged to a role; untagged sign lines stay unknown', () => {
    expect(fieldRequirement({ type: 'signature', signerRole: 'buyer' })).toBe('required')
    expect(fieldRequirement({ type: 'initials', signerRole: 'seller' })).toBe('required')
    expect(fieldRequirement({ type: 'signature' })).toBe('unknown')
  })

  it('requires 001 sale price / parties / address, not every 001 blank', () => {
    expect(mapFieldIsRequired({ type: 'text', dataRef: 'SalePrice', formNumber: '001' })).toBe(true)
    expect(mapFieldIsRequired({ type: 'text', dataRef: 'PropertyAddress', formNumber: '001' })).toBe(true)
    expect(mapFieldIsRequired({ type: 'text', dataRef: 'IncludedItemsNote', formNumber: '001' })).toBe(false)
    expect(mapFieldIsRequired({ type: 'checkbox', dataRef: 'FinancingVA', formNumber: '001' })).toBe(false)
  })

  it('requires 015 list price and sellers, not buyer facts', () => {
    expect(mapFieldIsRequired({ type: 'text', dataRef: 'ListingPrice', formNumber: '015' })).toBe(true)
    expect(mapFieldIsRequired({ type: 'text', dataRef: 'SalePrice', formNumber: '015' })).toBe(false)
  })
})

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
  it('only blocks unassigned required signature lines, not optional text', () => {
    const fields = [
      { type: 'text', required: true, recipientId: null, value: null, label: 'Note' },
      { type: 'signature', required: true, recipientId: null, value: null, label: 'Buyer' },
      { type: 'signature', required: true, recipientId: 'buyer-1', value: null, label: 'Buyer' },
      { type: 'strike', required: true, recipientId: null, value: null },
    ]
    expect(missingPrepareFields(fields).map((f) => f.label)).toEqual(['Buyer'])
    expect(incompletePrepareMessage(fields)).toMatch(/Buyer/)
  })

  it('lets optional and unmarked blanks stay empty', () => {
    expect(
      missingPrepareFields([
        { type: 'text', required: false, recipientId: null, value: null, label: 'Note' },
        { type: 'text', recipientId: null, value: null, label: 'Unknown blank' },
      ]),
    ).toEqual([])
    expect(incompletePrepareMessage([{ type: 'text', required: true, recipientId: null, value: null }])).toBeNull()
  })
})

describe('missingRequiredFacts', () => {
  it('knows 001 needs price and parties; a mystery form invents nothing', () => {
    expect(
      missingRequiredFacts(['001'], { address: '218 SW 4th', buyers: ['Pat'], sellers: ['Lee'] }),
    ).toEqual(['salePrice'])
    expect(incompleteFactsMessage(['salePrice'])).toMatch(/Sale price/)
    expect(missingRequiredFacts(['999'], {})).toEqual([])
    expect(missingRequiredFacts(['043'], {})).toEqual([])
  })
})

describe('missingCompleteFields', () => {
  it('will not mark the form complete while a required signature is still empty', () => {
    const fields = [
      { type: 'text', required: true, recipientId: null, value: null, label: 'Optional note' },
      { type: 'signature', required: true, recipientId: 'seller-1', value: null, label: 'Seller' },
    ]
    expect(missingCompleteFields(fields)).toHaveLength(1)
    expect(incompleteFormMessage(fields)).toMatch(/Seller/)
  })
})
