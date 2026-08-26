import { describe, expect, it } from 'vitest'
import { formBindingFactKey, formBlankIsReserved } from './oref-form-bindings'

// Every name here is the real AcroForm widget name off the live OREF 001
// (Released 01/2026), read from the rendered blank rather than guessed.
const REAL_001_NAMES = {
  buyers: '1 PARTIESPROPERTY DESCRIPTIONPRICE Buyer insert names',
  sellers: 'offers to purchase from Seller insert names',
  county: 'the following described real property the Property situated in the State of Oregon County of',
  address: 'a Street Address',
  taxId: 'b Tax Identification Numbers',
  purchasePrice: 'A',
  deposit: 'B',
  additionalDeposit: 'C',
  downPayment: 'D',
  balance: 'E',
  escrow: '29 ESCROW This transaction will be Closed at identify',
  closing: '35 CLOSING Closing will occur on a date mutually agreed on between Buyer and Seller on or before insert date',
}

describe('formBindingFactKey on the live OREF 001', () => {
  it('binds the terms the contract turns on', () => {
    expect(formBindingFactKey('001', REAL_001_NAMES.buyers)).toBe('buyers')
    expect(formBindingFactKey('001', REAL_001_NAMES.sellers)).toBe('sellers')
    expect(formBindingFactKey('001', REAL_001_NAMES.address)).toBe('address')
    expect(formBindingFactKey('001', REAL_001_NAMES.purchasePrice)).toBe('salePrice')
    expect(formBindingFactKey('001', REAL_001_NAMES.deposit)).toBe('earnestMoneyAmount')
    expect(formBindingFactKey('001', REAL_001_NAMES.escrow)).toBe('escrowCompany')
    expect(formBindingFactKey('001', REAL_001_NAMES.closing)).toBe('escrowClosingDate')
  })

  it('leaves the money lines we do not hold blank rather than inventing them', () => {
    // C, D and E are derived financing figures. A blank line is honest.
    expect(formBindingFactKey('001', REAL_001_NAMES.additionalDeposit)).toBeNull()
    expect(formBindingFactKey('001', REAL_001_NAMES.downPayment)).toBeNull()
    expect(formBindingFactKey('001', REAL_001_NAMES.balance)).toBeNull()
  })

  it('does not write the city into the county line', () => {
    // We hold Bend. The line asks for Deschutes. Wrong is worse than empty.
    expect(formBindingFactKey('001', REAL_001_NAMES.county)).toBeNull()
  })

  it('leaves the tax identification line to the broker', () => {
    expect(formBindingFactKey('001', REAL_001_NAMES.taxId)).toBeNull()
  })

  it('is scoped per form, so a bare letter on another form binds nothing', () => {
    expect(formBindingFactKey('022A', 'A')).toBeNull()
    expect(formBindingFactKey('020', 'A')).toBeNull()
    expect(formBindingFactKey(null, 'A')).toBeNull()
  })

  it('accepts the form number however it is written', () => {
    expect(formBindingFactKey('OREF 001', REAL_001_NAMES.address)).toBe('address')
    expect(formBindingFactKey(' 001 ', REAL_001_NAMES.address)).toBe('address')
  })
})

describe('the page-1 agency acknowledgment block', () => {
  it('keeps typed names off the signature lines', () => {
    // Lines 33-40: "Buyer ______ Date ____" with "Print ______" beneath.
    // The bare widget is where the signature goes.
    expect(formBlankIsReserved('001', 'Buyer')).toBe(true)
    expect(formBlankIsReserved('001', 'Buyer_2')).toBe(true)
    expect(formBlankIsReserved('001', 'Seller')).toBe(true)
    expect(formBlankIsReserved('001', 'Seller_2')).toBe(true)
  })

  it('puts the name on the print line underneath, where it belongs', () => {
    expect(formBindingFactKey('001', 'Print')).toBe('buyers')
    expect(formBindingFactKey('001', 'Print_2')).toBe('buyers')
    expect(formBindingFactKey('001', 'Print_3')).toBe('sellers')
    expect(formBindingFactKey('001', 'Print_4')).toBe('sellers')
  })

  it('reserves nothing on a form with no table', () => {
    expect(formBlankIsReserved('022A', 'Buyer')).toBe(false)
    expect(formBlankIsReserved(null, 'Buyer')).toBe(false)
  })
})

describe('OREF 060 contingency removal', () => {
  it('keeps the header name lines binding', () => {
    // Lines 1-3 really are named Buyers / Sellers / Property Address or Tax ID,
    // so the generic matcher handles them and must not be reserved away.
    expect(formBlankIsReserved('060', 'Buyers')).toBe(false)
    expect(formBlankIsReserved('060', 'Sellers')).toBe(false)
  })

  it('reserves every signature line on page 2', () => {
    for (const name of ['Buyer', 'Buyer_2', 'Buyer_3', 'Buyer 1', 'Seller_3', 'Seller_4', 'Seller 1']) {
      expect(formBlankIsReserved('060', name)).toBe(true)
    }
  })

  it('puts buyer names on the first four print lines and sellers on the next four', () => {
    expect(formBindingFactKey('060', 'Print')).toBe('buyers')
    expect(formBindingFactKey('060', 'Print_4')).toBe('buyers')
    expect(formBindingFactKey('060', 'Print_5')).toBe('sellers')
    expect(formBindingFactKey('060', 'Print_8')).toBe('sellers')
  })
})

describe('OREF 059 delivery addendum needs no table', () => {
  it('signs by Delivering and Receiving Party, which never collide with the aliases', () => {
    // Either side can deliver, so those print lines stay unbound on purpose.
    expect(formBindingFactKey('059', 'Delivering Party')).toBeNull()
    expect(formBindingFactKey('059', 'Receiving Party')).toBeNull()
    expect(formBlankIsReserved('059', 'Delivering Party')).toBe(false)
  })
})

describe('the repair addendums', () => {
  it('binds the standard addendum header on both', () => {
    // Lines 1-3 on 022A and 022B, same layout as 060 but Text<n>-named.
    expect(formBindingFactKey('022A', 'Text125')).toBe('buyers')
    expect(formBindingFactKey('022A', 'Text126')).toBe('sellers')
    expect(formBindingFactKey('022A', 'Text127')).toBe('address')
    expect(formBindingFactKey('022B', 'Text60')).toBe('buyers')
    expect(formBindingFactKey('022B', 'Text61')).toBe('sellers')
    expect(formBindingFactKey('022B', 'Text62')).toBe('address')
  })

  it('does not cross the two forms, whose numbering differs', () => {
    expect(formBindingFactKey('022A', 'Text60')).toBeNull()
    expect(formBindingFactKey('022B', 'Text125')).toBeNull()
  })

  it('reserves nothing, because their signature blocks are anonymous', () => {
    expect(formBlankIsReserved('022A', 'Text159')).toBe(false)
    expect(formBlankIsReserved('022B', 'Text95')).toBe(false)
  })
})
