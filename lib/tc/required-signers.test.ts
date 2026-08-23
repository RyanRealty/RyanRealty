import { describe, expect, it } from 'vitest'
import {
  envelopeCoversChecklistItem,
  inFlightCompletionBlock,
  inFlightEnvelopeBlocksCompletion,
  missingRequiredSignerRoles,
  missingRequiredSignersMessage,
  requiredSignerRolesFromForm,
  unionRequiredSignerRoles,
} from './required-signers'

describe('requiredSignerRolesFromForm', () => {
  it('reads signature fields on the form before guessing from the number', () => {
    expect(
      requiredSignerRolesFromForm({
        formNumber: '015',
        fieldMap: [
          { type: 'signature', signerRole: 'buyer', optional: false },
          { type: 'signature', signerRole: 'seller', optional: false },
          { type: 'text', signerRole: 'buyer' },
        ],
      }),
    ).toEqual(['Buyer', 'Seller'])
  })

  it('sale agreement 001 is Buyer and Seller; listing 015 is Seller only', () => {
    expect(requiredSignerRolesFromForm({ formNumber: 'OREF 001' })).toEqual(['Buyer', 'Seller'])
    expect(requiredSignerRolesFromForm({ formNumber: '015' })).toEqual(['Seller'])
    expect(requiredSignerRolesFromForm({ formNumber: '050' })).toEqual(['Buyer'])
  })

  it('mutual profile without a map is both sides; unreadable forms stay empty', () => {
    expect(requiredSignerRolesFromForm({ signerProfile: 'mutual' })).toEqual(['Buyer', 'Seller'])
    expect(requiredSignerRolesFromForm({ formNumber: '999', signerProfile: 'single_party' })).toEqual([])
  })
})

describe('missingRequiredSignerRoles', () => {
  it('treats Receives a copy as not a signer', () => {
    const missing = missingRequiredSignerRoles(['Buyer', 'Seller'], [
      { role: 'Buyer', actionRequired: 'NeedsToSign' },
      { role: 'Seller', actionRequired: 'ReceivesACopy' },
    ])
    expect(missing).toEqual(['Seller'])
    expect(missingRequiredSignersMessage(missing)).toMatch(/Seller signature/)
    expect(missingRequiredSignersMessage(missing)).toMatch(/not fully executed/)
  })
})

describe('unionRequiredSignerRoles', () => {
  it('unions a listing form and a sale form', () => {
    expect(
      unionRequiredSignerRoles([{ formNumber: '015' }, { formNumber: '001' }]),
    ).toEqual(['Seller', 'Buyer'])
  })
})

describe('inFlightEnvelopeBlocksCompletion', () => {
  it('blocks while one party has signed and the other has not', () => {
    expect(inFlightEnvelopeBlocksCompletion('partially_signed')).toBe(true)
    expect(inFlightEnvelopeBlocksCompletion('sent')).toBe(true)
    expect(inFlightEnvelopeBlocksCompletion('completed')).toBe(false)
    expect(inFlightEnvelopeBlocksCompletion('draft')).toBe(false)
  })
})

describe('envelopeCoversChecklistItem', () => {
  it('matches OREF number on the checklist row', () => {
    expect(
      envelopeCoversChecklistItem({
        envelopeName: 'Beaumont sale packet',
        formNumbers: ['001'],
        itemName: 'Residential Real Estate Sale Agreement',
        typeName: 'OREF 001',
      }),
    ).toBe(true)
  })
})

describe('inFlightCompletionBlock', () => {
  it('refuses complete while the sale agreement is only partly signed', () => {
    const block = inFlightCompletionBlock({
      envelopes: [
        { name: 'Sale agreement', status: 'partially_signed', formNumbers: ['001'] },
      ],
      itemName: 'Residential Real Estate Sale Agreement',
      typeName: 'OREF 001',
    })
    expect(block?.status).toBe('partially_signed')
  })
})
