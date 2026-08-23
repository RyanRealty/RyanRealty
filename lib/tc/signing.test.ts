import { describe, it, expect } from 'vitest'
import {
  SIGN_FIELD_TYPES,
  SIGN_FIELD_LABEL,
  RECIPIENT_ROLES,
  RECIPIENT_ROLE_LABEL,
  COPY_ONLY_ROLE,
  ACTION_REQUIRED,
  ACTION_REQUIRED_LABEL,
  normalizeRecipientRole,
  coerceRecipientPickerRole,
  coerceActionRequired,
  storedRecipientRole,
  recipientRoleLabel,
  isSignableRole,
  brokerEnvelopeRole,
  recipientMatchesSigner,
  seedPartyEnvelopeRecipients,
  seedVendorEnvelopeRecipients,
  applyUniquePartyEmails,
} from './signing'

describe('SIGN_FIELD_TYPES', () => {
  it('includes Strike from the live DigiSign palette', () => {
    expect([...SIGN_FIELD_TYPES]).toContain('strike')
    expect(SIGN_FIELD_LABEL.strike).toBe('Strike')
  })
})

describe('Forms File Details recipient roles (live 2026-08-23)', () => {
  it('picker is the nine stored SkySlope roles, not invented Buyer2 / listing_broker / lender', () => {
    expect([...RECIPIENT_ROLES]).toEqual([
      'Buyer',
      'Seller',
      'EscrowOfficer',
      'TitleOfficer',
      'LoanOfficer',
      'BuyerAgent',
      'SellerAgent',
      'Broker',
      'Other',
    ])
    expect(RECIPIENT_ROLES).not.toContain('buyer1')
    expect(RECIPIENT_ROLES).not.toContain('listing_broker')
    expect(RECIPIENT_ROLES).not.toContain('lender')
    expect(RECIPIENT_ROLES).not.toContain('cc')
  })

  it('labels match the live listbox, including Loan Officer not Lender', () => {
    expect(RECIPIENT_ROLE_LABEL.LoanOfficer).toBe('Loan Officer')
    expect(RECIPIENT_ROLE_LABEL.BuyerAgent).toBe('Buyer Agent')
    expect(RECIPIENT_ROLE_LABEL.SellerAgent).toBe('Seller Agent')
  })
})

describe('normalizeRecipientRole', () => {
  it('passes live codes through', () => {
    for (const role of RECIPIENT_ROLES) expect(normalizeRecipientRole(role)).toBe(role)
  })
  it('maps legacy stored codes onto the live enum', () => {
    expect(normalizeRecipientRole('buyer1')).toBe('Buyer')
    expect(normalizeRecipientRole('buyer2')).toBe('Buyer')
    expect(normalizeRecipientRole('seller1')).toBe('Seller')
    expect(normalizeRecipientRole('listing_broker')).toBe('SellerAgent')
    expect(normalizeRecipientRole('buyer_broker')).toBe('BuyerAgent')
    expect(normalizeRecipientRole('escrow')).toBe('EscrowOfficer')
    expect(normalizeRecipientRole('title')).toBe('TitleOfficer')
    expect(normalizeRecipientRole('lender')).toBe('LoanOfficer')
    expect(normalizeRecipientRole('cc')).toBe(COPY_ONLY_ROLE)
  })
  it('empty becomes Other, unknown strings survive for display', () => {
    expect(normalizeRecipientRole('')).toBe('Other')
    expect(normalizeRecipientRole(null)).toBe('Other')
    expect(normalizeRecipientRole('Inspector')).toBe('Inspector')
  })
  it('picker coerce maps unknown onto Other so the Select always has a value', () => {
    expect(coerceRecipientPickerRole('Inspector')).toBe('Other')
    expect(coerceRecipientPickerRole('cc')).toBe('cc')
    expect(coerceRecipientPickerRole('buyer1')).toBe('Buyer')
  })
})

describe('recipientRoleLabel / isSignableRole', () => {
  it('labels copy-only as Receives a copy, not a Forms role', () => {
    expect(recipientRoleLabel('cc')).toBe('Receives a copy')
    expect(recipientRoleLabel('buyer1')).toBe('Buyer')
    expect(isSignableRole('Buyer')).toBe(true)
    expect(isSignableRole('buyer1')).toBe(true)
    expect(isSignableRole('cc')).toBe(false)
    expect(isSignableRole('')).toBe(false)
  })
})

describe('action_required (live Forms File Details 2026-08-23)', () => {
  it('is NeedsToSign / ReceivesACopy / NoAction — DigiSign has no No action', () => {
    expect([...ACTION_REQUIRED]).toEqual(['NeedsToSign', 'ReceivesACopy', 'NoAction'])
    expect(ACTION_REQUIRED_LABEL.NeedsToSign).toBe('Needs to sign')
    expect(ACTION_REQUIRED_LABEL.ReceivesACopy).toBe('Receives a copy')
    expect(ACTION_REQUIRED_LABEL.NoAction).toBe('No action')
  })

  it('coerces live wire, DigiSign Signer, and the old cc stand-in', () => {
    expect(coerceActionRequired('NeedsToSign')).toBe('NeedsToSign')
    expect(coerceActionRequired('ReceivesACopy')).toBe('ReceivesACopy')
    expect(coerceActionRequired('NoAction')).toBe('NoAction')
    expect(coerceActionRequired('Signer')).toBe('NeedsToSign')
    expect(coerceActionRequired(null, 'cc')).toBe('ReceivesACopy')
    expect(coerceActionRequired(undefined, 'Buyer')).toBe('NeedsToSign')
    expect(coerceActionRequired('', 'Seller')).toBe('NeedsToSign')
  })

  it('explicit action wins over a stored cc role', () => {
    expect(isSignableRole('Buyer', 'ReceivesACopy')).toBe(false)
    expect(isSignableRole('Buyer', 'NoAction')).toBe(false)
    expect(isSignableRole('Other', 'NeedsToSign')).toBe(true)
    expect(isSignableRole('cc', 'NeedsToSign')).toBe(true)
  })

  it('writes Forms roles, never cc, and defaults parties to NeedsToSign', () => {
    expect(storedRecipientRole('cc')).toBe('Other')
    expect(storedRecipientRole('buyer1')).toBe('Buyer')
    const rows = seedPartyEnvelopeRecipients({
      envelopeId: 'e1',
      buyers: ['Pat'],
      sellers: ['Lee'],
      brokerName: 'Matt Ryan',
      brokerEmail: 'matt@ryan-realty.com',
      cycleKind: 'sale',
    })
    expect(rows.every((r) => r.action_required === 'NeedsToSign')).toBe(true)
    expect(rows.map((r) => r.role)).not.toContain('cc')
  })
})

describe('brokerEnvelopeRole', () => {
  it('listing cycle → Seller Agent; anything else → Buyer Agent', () => {
    expect(brokerEnvelopeRole('listing')).toBe('SellerAgent')
    expect(brokerEnvelopeRole('sale')).toBe('BuyerAgent')
    expect(brokerEnvelopeRole(null)).toBe('BuyerAgent')
  })
})

describe('seedPartyEnvelopeRecipients', () => {
  it('writes live roles and repeats Buyer/Seller instead of buyer2', () => {
    const rows = seedPartyEnvelopeRecipients({
      envelopeId: 'e1',
      buyers: ['Pat', 'Sam'],
      sellers: ['Lee'],
      brokerName: 'Matt Ryan',
      brokerEmail: 'matt@ryan-realty.com',
      cycleKind: 'listing',
    })
    expect(rows.map((r) => r.role)).toEqual(['Buyer', 'Buyer', 'Seller', 'SellerAgent'])
    expect(rows.filter((r) => r.role === 'Buyer')).toHaveLength(2)
  })
})

describe('seedVendorEnvelopeRecipients', () => {
  it('maps title and escrow to Forms roles as Receives a copy', () => {
    const rows = seedVendorEnvelopeRecipients({
      envelopeId: 'e1',
      contacts: [
        { role: 'title', name: 'Yvonne Ward', email: 'yvonne.ward@westerntitle.com' },
        { role: 'escrow', name: null, email: null },
        { role: 'transaction_coordinator', name: 'Jeanette Argyle', email: 'a@b.com' },
      ],
    })
    expect(rows).toEqual([
      {
        envelope_id: 'e1',
        role: 'TitleOfficer',
        name: 'Yvonne Ward',
        email: 'yvonne.ward@westerntitle.com',
        signing_order: 4,
        action_required: 'ReceivesACopy',
      },
    ])
  })
})

describe('applyUniquePartyEmails', () => {
  it('fills a blank email only when the CRM name is unique', () => {
    const rows = [
      { name: 'Mary Bowman', email: '' },
      { name: 'Paul Stevenson', email: '' },
      { name: 'Matt Ryan', email: 'matt@ryan-realty.com' },
    ]
    const people = [
      { name: 'Mary Bowman', email: 'mary@example.com' },
      { name: 'Paul Stevenson', email: 'paul@a.com' },
      { name: 'Paul Stevenson', email: 'paul@b.com' },
    ]
    const out = applyUniquePartyEmails(rows, people)
    expect(out[0].email).toBe('mary@example.com')
    expect(out[1].email).toBe('')
    expect(out[2].email).toBe('matt@ryan-realty.com')
  })
})

describe('recipientMatchesSigner', () => {
  it('binds field-map signer tokens to live stored roles, including legacy rows', () => {
    expect(recipientMatchesSigner('Buyer', 'buyer')).toBe(true)
    expect(recipientMatchesSigner('buyer1', 'buyer')).toBe(true)
    expect(recipientMatchesSigner('SellerAgent', 'listing_agent')).toBe(true)
    expect(recipientMatchesSigner('listing_broker', 'listing_agent')).toBe(true)
    expect(recipientMatchesSigner('BuyerAgent', 'buyer_agent')).toBe(true)
    expect(recipientMatchesSigner('SellerAgent', 'buyer')).toBe(false)
    expect(recipientMatchesSigner('Broker', 'listing_agent')).toBe(false)
    expect(recipientMatchesSigner('cc', 'buyer')).toBe(false)
  })
})
