import { describe, expect, it } from 'vitest'
import {
  entriesFromDocumentText,
  extractOrefNumbers,
  formLibraryEntryByNumber,
  identifyFormFromName,
  identifyFormFromText,
  librarySignersToRoles,
} from './form-identity'

describe('identifyFormFromText', () => {
  it('reads the OREF stamp on page 1, not a guess after someone signs', () => {
    const page1 = 'OREF 001 | Released 01/2026 | Page 1 of 15\nResidential Real Estate Sale Agreement'
    expect(identifyFormFromText(page1)?.oref).toBe('001')
    expect(identifyFormFromText(page1)?.signers).toEqual(['buyer', 'seller', 'seller_broker', 'buyer_broker'])
  })

  it('reads listing 015 as seller + listing broker, not buyer', () => {
    const page1 = 'OREF 015 | Exclusive Right to Sell Listing Agreement'
    expect(identifyFormFromText(page1)?.signers).toEqual(['seller', 'seller_broker'])
  })

  it('does not invent a form from empty or unrelated text', () => {
    expect(identifyFormFromText('')).toBeNull()
    expect(identifyFormFromText('Invoice for HVAC repair Tyler Nicoll')).toBeNull()
  })
})

describe('entriesFromDocumentText', () => {
  it('unions every OREF stamp in a bundle so later pages are not ignored', () => {
    const text = [
      '<<< Page 1 >>>',
      'OREF 043 | Advisory Regarding Electronic Funds Transfer',
      '<<< Page 2 >>>',
      'OREF 021 | Lead-Based Paint Disclosure Addendum',
    ].join('\n')
    expect(extractOrefNumbers(text)).toEqual(['043', '021'])
    expect(entriesFromDocumentText(text).map((e) => e.oref)).toEqual(['043', '021'])
  })
})

describe('identifyFormFromName', () => {
  it('reads v4 filenames that stamp the form number', () => {
    expect(
      identifyFormFromName('20702Beaumont_X_001_Residential Real Estate Sale Agreement.pdf')?.oref,
    ).toBe('001')
    expect(identifyFormFromName('OREF-015__Listing_Agreement.pdf')?.oref).toBe('015')
  })
})

describe('librarySignersToRoles', () => {
  it('maps 042 acknowledger from the file kind, not from who happened to sign', () => {
    expect(
      librarySignersToRoles(['acknowledger'], { cycleKind: 'listing' }).roles,
    ).toEqual(['Seller'])
    expect(
      librarySignersToRoles(['acknowledger'], { cycleKind: 'sale' }).roles,
    ).toEqual(['Buyer'])
  })

  it('maps 043 single-party from the filename side when the form was read', () => {
    expect(
      librarySignersToRoles(['single_party'], { documentName: 'Electronic Funds Advisory - Seller' }).roles,
    ).toEqual(['Seller'])
  })

  it('marks a title report as identified and not a signature form', () => {
    const entry = formLibraryEntryByNumber('001')
    expect(entry?.signers).toEqual(['buyer', 'seller', 'seller_broker', 'buyer_broker'])
    expect(librarySignersToRoles(['not_applicable'], {}).signatureForm).toBe(false)
  })
})
