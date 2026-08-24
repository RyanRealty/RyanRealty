import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, it, expect } from 'vitest'
import {
  SIGN_FIELD_TYPES,
  SIGN_FIELD_LABEL,
  isSenderAnnotation,
  resolveSigningInviteCopy,
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
  rowsForRecipientSave,
  recipientIdForMappedField,
  seedVendorEnvelopeRecipients,
  applyUniquePartyEmails,
  ENVELOPE_STATUSES,
  signingGroupForRole,
  signingGroupLabel,
  earlierSigningGroupPending,
} from './signing'

describe('SIGN_FIELD_TYPES', () => {
  it('includes Strike from the live DigiSign palette', () => {
    expect([...SIGN_FIELD_TYPES]).toContain('strike')
    expect([...SIGN_FIELD_TYPES]).toContain('highlight')
    expect(SIGN_FIELD_LABEL.strike).toBe('Strike')
  })
  it('includes Full Name and Time from the live DigiSign palette', () => {
    expect([...SIGN_FIELD_TYPES]).toContain('full_name')
    expect([...SIGN_FIELD_TYPES]).toContain('time_signed')
    expect(SIGN_FIELD_LABEL.full_name).toBe('Full Name')
    expect(SIGN_FIELD_LABEL.time_signed).toBe('Time')
    expect(isSenderAnnotation('strike')).toBe(true)
    expect(isSenderAnnotation('full_name')).toBe(false)
  })
  it('CHECK constraint and invite columns match the palette', () => {
    const sql = readFileSync(
      resolve(__dirname, '../../supabase/migrations/20260823260000_tc_envelope_fullname_time.sql'),
      'utf8',
    )
    expect(sql).toContain("'full_name'")
    expect(sql).toContain("'time_signed'")
    expect(sql).toContain('invite_subject')
    expect(sql).toContain('invite_body')
  })
  it('envelope status includes awaiting the other side signed PDF', () => {
    const sql = readFileSync(
      resolve(__dirname, '../../supabase/migrations/20260824010000_tc_envelope_awaiting_other_side.sql'),
      'utf8',
    )
    expect(sql).toContain('awaiting_other_side')
    expect(ENVELOPE_STATUSES).toContain('awaiting_other_side')
  })
})

describe('resolveSigningInviteCopy', () => {
  it('uses brokerage defaults when the broker left Edit message blank', () => {
    const copy = resolveSigningInviteCopy({ reminder: false, propertyAddress: '1 Beaumont Dr' })
    expect(copy.subject).toBe('Your signature is requested for 1 Beaumont Dr')
    expect(copy.body).toContain('1 Beaumont Dr')
    expect(copy.body).not.toMatch(/—/)
  })
  it('uses the broker Edit message when present', () => {
    const copy = resolveSigningInviteCopy({
      reminder: true,
      propertyAddress: '1 Beaumont Dr',
      customSubject: 'Please sign the listing agreement',
      customBody: 'Mary, tap to sign when you can.',
    })
    expect(copy.subject).toBe('Please sign the listing agreement')
    expect(copy.body).toBe('Mary, tap to sign when you can.')
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
    expect(rows.find((r) => r.role === 'Buyer')?.action_required).toBe('NeedsToSign')
    expect(rows.find((r) => r.role === 'Seller')?.action_required).toBe('NeedsToSign')
    expect(rows.find((r) => r.role === 'BuyerAgent')?.action_required).toBe('ReceivesACopy')
    expect(rows.map((r) => r.role)).not.toContain('cc')
  })
})

describe('brokerEnvelopeRole', () => {
  it('listing cycle → Seller Agent; anything else → Buyer Agent', () => {
    expect(brokerEnvelopeRole('listing')).toBe('SellerAgent')
    expect(brokerEnvelopeRole('sale')).toBe('BuyerAgent')
    expect(brokerEnvelopeRole(null)).toBe('BuyerAgent')
  })
  it('pending sale on a listing file still seeds the listing broker as Seller Agent', () => {
    expect(brokerEnvelopeRole('sale', 'listing')).toBe('SellerAgent')
    expect(brokerEnvelopeRole('sale', 'dual')).toBe('SellerAgent')
    expect(brokerEnvelopeRole('sale', 'buyer')).toBe('BuyerAgent')
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

  it('listing form that only needs Seller keeps buyers as copy', () => {
    const rows = seedPartyEnvelopeRecipients({
      envelopeId: 'e1',
      buyers: ['Pat'],
      sellers: ['Lee'],
      brokerName: 'Matt Ryan',
      brokerEmail: 'matt@ryan-realty.com',
      cycleKind: 'listing',
      requiredRoles: ['Seller'],
    })
    expect(rows.find((r) => r.role === 'Seller')?.action_required).toBe('NeedsToSign')
    expect(rows.find((r) => r.role === 'Buyer')?.action_required).toBe('ReceivesACopy')
    expect(rows.find((r) => r.role === 'SellerAgent')?.action_required).toBe('ReceivesACopy')
  })

  it('dual sale agreement: buyers sign first as a group, then sellers', () => {
    const rows = seedPartyEnvelopeRecipients({
      envelopeId: 'e1',
      buyers: ['Pat', 'Sam'],
      sellers: ['Lee'],
      brokerName: 'Matt Ryan',
      brokerEmail: 'matt@ryan-realty.com',
      cycleKind: 'sale',
      ourRole: 'dual',
      requiredRoles: ['Buyer', 'Seller'],
    })
    expect(rows.filter((r) => r.role === 'Buyer').every((r) => r.action_required === 'NeedsToSign')).toBe(true)
    expect(rows.find((r) => r.role === 'Seller')?.action_required).toBe('NeedsToSign')
    expect(rows.filter((r) => r.role === 'Buyer').every((r) => r.signing_order === 1)).toBe(true)
    expect(rows.find((r) => r.role === 'Seller')?.signing_order).toBe(2)
  })

  it('listing sale agreement never sends a signing link to the buyer', () => {
    const rows = seedPartyEnvelopeRecipients({
      envelopeId: 'e1',
      buyers: ['Tyler Nicoll'],
      sellers: ['Mary Bowman'],
      brokerName: 'Matt Ryan',
      brokerEmail: 'matt@ryan-realty.com',
      cycleKind: 'listing',
      ourRole: 'listing',
      requiredRoles: ['Buyer', 'Seller'],
    })
    expect(rows.find((r) => r.role === 'Seller')?.action_required).toBe('NeedsToSign')
    expect(rows.find((r) => r.role === 'Buyer')?.action_required).toBe('ReceivesACopy')
  })

  it('does not email the listing broker until the form says they sign', () => {
    const unread = seedPartyEnvelopeRecipients({
      envelopeId: 'e1',
      buyers: ['Pat'],
      sellers: ['Lee'],
      brokerName: 'Matt Ryan',
      brokerEmail: 'matt@ryan-realty.com',
      cycleKind: 'listing',
    })
    expect(unread.find((r) => r.role === 'SellerAgent')?.action_required).toBe('ReceivesACopy')
    const listing = seedPartyEnvelopeRecipients({
      envelopeId: 'e1',
      buyers: ['Pat'],
      sellers: ['Lee'],
      brokerName: 'Matt Ryan',
      brokerEmail: 'matt@ryan-realty.com',
      cycleKind: 'listing',
      requiredRoles: ['Seller', 'SellerAgent'],
    })
    expect(listing.find((r) => r.role === 'SellerAgent')?.action_required).toBe('NeedsToSign')
  })
})

describe('signing groups', () => {
  it('labels groups the way DigiSign does and keeps a group parallel', () => {
    expect(signingGroupLabel(1)).toBe('Who signs first')
    expect(signingGroupLabel(2)).toBe('Who signs second')
    expect(signingGroupForRole('Seller', ['Seller', 'SellerAgent'])).toBe(1)
    expect(signingGroupForRole('SellerAgent', ['Seller', 'SellerAgent'])).toBe(2)
    expect(signingGroupForRole('Buyer', ['Buyer', 'Seller'])).toBe(1)
    expect(signingGroupForRole('Seller', ['Buyer', 'Seller'])).toBe(2)
  })

  it('blocks a later group until every earlier signer is done', () => {
    const others = [
      { role: 'Buyer', action_required: 'NeedsToSign', signing_order: 1, completed_at: '2026-08-23' },
      { role: 'Buyer', action_required: 'NeedsToSign', signing_order: 1, completed_at: null },
    ]
    expect(earlierSigningGroupPending(2, others)).toBe(true)
    expect(earlierSigningGroupPending(1, others)).toBe(false)
    expect(
      earlierSigningGroupPending(2, [
        { role: 'Buyer', action_required: 'NeedsToSign', signing_order: 1, completed_at: '2026-08-23' },
      ]),
    ).toBe(false)
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

describe('rowsForRecipientSave', () => {
  it('gives every row an id so mixed new and existing signers upsert', () => {
    const rows = rowsForRecipientSave(
      'e1',
      [
        { id: 'kept', role: 'SellerAgent', name: 'Matt Ryan', email: 'matt@ryan-realty.com', signingOrder: 2 },
        { role: 'Seller', name: 'Vault Test Seller', email: 'marketing@ryan-realty.com', signingOrder: 1 },
      ],
      () => 'new-1',
    )
    expect(rows.map((r) => r.id)).toEqual(['kept', 'new-1'])
    expect(rows[1]?.role).toBe('Seller')
  })
})

describe('recipientIdForMappedField', () => {
  it('assigns an unassigned seller signature to the seller, not the listing broker', () => {
    const map = [{ type: 'signature', page: 6, x: 0.2, y: 0.8, signerRole: 'seller' as const }]
    const recipients = [
      { id: 'agent', role: 'SellerAgent' },
      { id: 'seller', role: 'Seller' },
    ]
    expect(
      recipientIdForMappedField(
        { recipientId: null, page: 6, x: 0.2, y: 0.8, type: 'signature' },
        map,
        recipients,
      ),
    ).toBe('seller')
    expect(
      recipientIdForMappedField(
        { recipientId: 'agent', page: 6, x: 0.2, y: 0.8, type: 'signature' },
        map,
        recipients,
      ),
    ).toBe('agent')
  })

  it('assigns from the map label when signerRole was stored null', () => {
    expect(
      recipientIdForMappedField(
        { recipientId: null, page: 6, x: 0.2, y: 0.8, type: 'signature' },
        [
          {
            type: 'signature',
            page: 6,
            x: 0.2,
            y: 0.8,
            signerRole: null,
            dataRef: 'sig1',
            label: 'Seller Signature',
          },
        ],
        [
          { id: 'agent', role: 'SellerAgent' },
          { id: 'seller', role: 'Seller' },
        ],
      ),
    ).toBe('seller')
  })
})
