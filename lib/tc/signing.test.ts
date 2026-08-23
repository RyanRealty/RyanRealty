import { describe, it, expect } from 'vitest'
import {
  RECIPIENT_ROLES,
  RECIPIENT_ROLE_LABEL,
  COPY_ONLY_ROLE,
  normalizeRecipientRole,
  coerceRecipientPickerRole,
  recipientRoleLabel,
  isSignableRole,
  brokerEnvelopeRole,
  recipientMatchesSigner,
  seedPartyEnvelopeRecipients,
} from './signing'

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
