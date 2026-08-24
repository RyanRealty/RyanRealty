import { describe, expect, it } from 'vitest'
import {
  NOT_SIGNATURE_FORM_MESSAGE,
  UNREAD_FORM_MESSAGE,
  envelopeCoversChecklistItem,
  inFlightCompletionBlock,
  inFlightEnvelopeBlocksCompletion,
  missingRequiredSignerRoles,
  missingRequiredSignersMessage,
  readRequiredSigners,
  requiredSignerRolesFromForm,
  sendBlockedBySignerKnowledge,
  unionRequiredSignerReads,
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

  it('reads listing vs buyer-rep vs vacant-land from the held library name', () => {
    expect(
      requiredSignerRolesFromForm({
        formNumber: '008',
        documentName: 'Vacant Land SA (SAMPLE — replace with subscriber blank)',
      }),
    ).toEqual(['Buyer', 'Seller'])
    expect(
      requiredSignerRolesFromForm({
        formNumber: '050',
        documentName: 'Buyer Representation Agreement Exclusive',
      }),
    ).toEqual(['Buyer', 'BuyerAgent'])
  })

  it('sale agreement 001 is Buyer and Seller; listing 015 is Seller and listing broker', () => {
    expect(requiredSignerRolesFromForm({ formNumber: 'OREF 001' })).toEqual(['Buyer', 'Seller'])
    expect(requiredSignerRolesFromForm({ formNumber: '015' })).toEqual(['Seller', 'SellerAgent'])
    expect(requiredSignerRolesFromForm({ formNumber: '050' })).toEqual(['Buyer', 'BuyerAgent'])
  })

  it('property disclosure 020 needs seller disclosure and buyer acknowledgment', () => {
    expect(requiredSignerRolesFromForm({ formNumber: '020' })).toEqual(['Seller', 'Buyer'])
  })

  it('lead-based paint 021 needs both sides and both agents', () => {
    expect(requiredSignerRolesFromForm({ formNumber: '021' })).toEqual([
      'Buyer',
      'Seller',
      'SellerAgent',
      'BuyerAgent',
    ])
  })

  it('mutual profile without a map is both sides; unreadable forms stay empty', () => {
    expect(requiredSignerRolesFromForm({ signerProfile: 'mutual' })).toEqual(['Buyer', 'Seller'])
    expect(requiredSignerRolesFromForm({ formNumber: '999', signerProfile: 'single_party' })).toEqual([])
    expect(readRequiredSigners({ formNumber: '999' }).identified).toBe(false)
  })

  it('reads the document name and page text when there is no field map', () => {
    expect(
      requiredSignerRolesFromForm({
        documentName: '20702Beaumont_X_001_Residential Real Estate Sale Agreement.pdf',
      }),
    ).toEqual(['Buyer', 'Seller'])
    expect(
      requiredSignerRolesFromForm({
        pageText: 'OREF 015 | Released 01/2026 | Exclusive Right to Sell',
        cycleKind: 'listing',
      }),
    ).toEqual(['Seller', 'SellerAgent'])
  })
})

describe('sendBlockedBySignerKnowledge', () => {
  it('refuses send when the form has not been read', () => {
    expect(sendBlockedBySignerKnowledge({ roles: [], identified: false, signatureForm: false }, [])).toBe(
      UNREAD_FORM_MESSAGE,
    )
  })

  it('refuses send of a title report that is not a signature form', () => {
    expect(
      sendBlockedBySignerKnowledge({ roles: [], identified: true, signatureForm: false }, []),
    ).toBe(NOT_SIGNATURE_FORM_MESSAGE)
  })

  it('refuses send when a required role is only Receives a copy', () => {
    const missing = missingRequiredSignerRoles(['Buyer', 'Seller'], [
      { role: 'Buyer', actionRequired: 'NeedsToSign' },
      { role: 'Seller', actionRequired: 'ReceivesACopy' },
    ])
    expect(missing).toEqual(['Seller'])
    expect(missingRequiredSignersMessage(missing)).toMatch(/Seller signature/)
    expect(
      sendBlockedBySignerKnowledge(
        { roles: ['Buyer', 'Seller'], identified: true, signatureForm: true },
        [
          { role: 'Buyer', actionRequired: 'NeedsToSign' },
          { role: 'Seller', actionRequired: 'ReceivesACopy' },
        ],
      ),
    ).toMatch(/not fully executed/)
  })

  it('listing packet with 020 does not require Buyer until a buyer is on our file', () => {
    const listingPacket = {
      roles: ['Seller', 'SellerAgent', 'Buyer'],
      identified: true,
      signatureForm: true,
    }
    expect(
      sendBlockedBySignerKnowledge(
        listingPacket,
        [
          { role: 'Seller', actionRequired: 'NeedsToSign' },
          { role: 'SellerAgent', actionRequired: 'NeedsToSign' },
        ],
        'listing',
      ),
    ).toBeNull()
    expect(
      sendBlockedBySignerKnowledge(
        listingPacket,
        [{ role: 'SellerAgent', actionRequired: 'NeedsToSign' }],
        'listing',
      ),
    ).toMatch(/Seller signature/)
    expect(
      sendBlockedBySignerKnowledge(
        listingPacket,
        [
          { role: 'Seller', actionRequired: 'NeedsToSign' },
          { role: 'SellerAgent', actionRequired: 'NeedsToSign' },
        ],
        'dual',
      ),
    ).toMatch(/Buyer/)
  })
})

describe('unionRequiredSignerRoles', () => {
  it('unions a listing form and a sale form', () => {
    expect(
      unionRequiredSignerRoles([{ formNumber: '015' }, { formNumber: '001' }]),
    ).toEqual(['Seller', 'SellerAgent', 'Buyer'])
  })

  it('marks the envelope unread if any document was not identified', () => {
    const read = unionRequiredSignerReads([
      { formNumber: '001' },
      { documentName: 'scan-of-something.pdf' },
    ])
    expect(read.identified).toBe(false)
    expect(read.roles).toEqual(['Buyer', 'Seller'])
  })
})

describe('inFlightEnvelopeBlocksCompletion', () => {
  it('blocks while one party has signed and the other has not', () => {
    expect(inFlightEnvelopeBlocksCompletion('partially_signed')).toBe(true)
    expect(inFlightEnvelopeBlocksCompletion('sent')).toBe(true)
    expect(inFlightEnvelopeBlocksCompletion('awaiting_other_side')).toBe(true)
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
