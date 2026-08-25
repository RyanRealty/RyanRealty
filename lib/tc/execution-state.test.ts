import { describe, expect, it } from 'vitest'
import {
  classifyExecutionState,
  classifyFromFormAndText,
  downgradeUnreadDocument,
  EXECUTION_STATE_LABEL,
  executionHintFromMail,
  executionStateFromClassification,
  inboundNeedsOurSignatures,
  signedRolesFromPdfText,
  shouldFileAsFullyExecuted,
} from './execution-state'

const buyerBlock = `DigiSign Verified
Pat Buyer
Buyer
2026-07-19 18:41:00 PST`

const sellerBlock = `DigiSign Verified
Lee Seller
Seller
2026-07-21 10:34:00 PST`

describe('signedRolesFromPdfText', () => {
  it('reads DigiSign role lines, not a marker count', () => {
    expect(signedRolesFromPdfText(buyerBlock)).toEqual(['Buyer'])
    expect(signedRolesFromPdfText(`${buyerBlock}\n\n${sellerBlock}`)).toEqual(['Buyer', 'Seller'])
  })
})

describe('classifyExecutionState', () => {
  it('001 listing: buyer-only offer still needs our sellers', () => {
    expect(
      classifyExecutionState({
        identified: true,
        signatureForm: true,
        requiredRoles: ['Buyer', 'Seller'],
        signedRoles: ['Buyer'],
        ourRole: 'listing',
      }),
    ).toBe('needs_our_signatures')
  })

  it('001 listing: our sellers signed, buyers have not — send PDF, not fully executed', () => {
    expect(
      classifyExecutionState({
        identified: true,
        signatureForm: true,
        requiredRoles: ['Buyer', 'Seller'],
        signedRoles: ['Seller'],
        ourRole: 'listing',
      }),
    ).toBe('our_side_signed')
  })

  it('001: both obligated parties signed is fully executed', () => {
    expect(
      classifyExecutionState({
        identified: true,
        signatureForm: true,
        requiredRoles: ['Buyer', 'Seller'],
        signedRoles: ['Buyer', 'Seller'],
        ourRole: 'listing',
      }),
    ).toBe('fully_executed')
  })

  it('043 electronic-funds: one party signing is fully executed', () => {
    expect(
      classifyExecutionState({
        identified: true,
        signatureForm: true,
        requiredRoles: ['Seller'],
        signedRoles: ['Buyer'],
        ourRole: 'listing',
        anyPartySufficient: true,
      }),
    ).toBe('fully_executed')
  })

  it('015 listing agreement: sellers only is fully executed', () => {
    expect(
      classifyExecutionState({
        identified: true,
        signatureForm: true,
        requiredRoles: ['Seller', 'SellerAgent'],
        signedRoles: ['Seller', 'SellerAgent'],
        ourRole: 'listing',
      }),
    ).toBe('fully_executed')
  })

  it('title report is not a signature form', () => {
    expect(
      classifyExecutionState({
        identified: true,
        signatureForm: false,
        requiredRoles: [],
        signedRoles: [],
        ourRole: 'listing',
      }),
    ).toBe('not_a_signature_form')
  })

  it('unread form stays unknown — do not invent executed', () => {
    expect(
      classifyExecutionState({
        identified: false,
        signatureForm: false,
        requiredRoles: [],
        signedRoles: ['Buyer'],
        ourRole: 'listing',
      }),
    ).toBe('unknown')
  })
})

describe('mail is a hint not proof', () => {
  it('an offer from the other agent still needs our signatures', () => {
    expect(executionHintFromMail('OFFER: 3480 SW 45th attached.pdf', true)).toBe('needs_our_signatures')
    expect(inboundNeedsOurSignatures('unknown', 'needs_our_signatures')).toBe(true)
    expect(inboundNeedsOurSignatures('fully_executed', 'needs_our_signatures')).toBe(false)
  })

  it('SkySlope envelope-completed mail is not other-side executed', () => {
    expect(
      executionHintFromMail('Envelope completed from noreply@skyslope.com', false),
    ).toBeNull()
  })

  it('reads the stamp a broker will see on the deal', () => {
    expect(executionStateFromClassification({ execution_state: 'needs_our_signatures' })).toBe(
      'needs_our_signatures',
    )
    expect(EXECUTION_STATE_LABEL.fully_executed).toBe('Fully executed')
    expect(executionStateFromClassification({ source: 'gmail_auto_file' })).toBeNull()
  })

  it('does not award fully executed from the word signed in a subject', () => {
    expect(shouldFileAsFullyExecuted('unknown')).toBe(false)
    expect(shouldFileAsFullyExecuted('needs_our_signatures')).toBe(false)
    expect(shouldFileAsFullyExecuted('our_side_signed')).toBe(false)
    expect(shouldFileAsFullyExecuted('fully_executed')).toBe(true)
  })
})

describe('a partial read may never claim a document is done', () => {
  // The signature pages of an OREF 001 are pages 13-15 of 15. Reading eight
  // pages and finding no signatures is not evidence that nobody signed.
  const agentBlocks = `DigiSign Verified
Matt Ryan
Seller Agent
2026-07-21 10:40:00 PST

DigiSign Verified
Matt Ryan
Buyer Agent
2026-07-21 10:41:00 PST`
  const fullyRead = `<<< Page 1 >>>
OREF 001 Residential Real Estate Sale Agreement
${buyerBlock}
${sellerBlock}
${agentBlocks}`
  const form = { documentName: 'Residential Real Estate Sale Agreement - 001 OREF.pdf' }

  it('a complete read of an all-signed 001 is fully executed', () => {
    expect(
      classifyFromFormAndText({ form, pageText: fullyRead, ourRole: 'listing', textComplete: true }),
    ).toBe('fully_executed')
  })

  it('the same text from a truncated read is unknown, never executed', () => {
    expect(
      classifyFromFormAndText({ form, pageText: fullyRead, ourRole: 'listing', textComplete: false }),
    ).toBe('unknown')
  })

  it('keeps a missing-signature verdict, which a partial read still supports', () => {
    expect(downgradeUnreadDocument('needs_our_signatures')).toBe('needs_our_signatures')
    expect(downgradeUnreadDocument('fully_executed')).toBe('unknown')
    expect(downgradeUnreadDocument('our_side_signed')).toBe('unknown')
    expect(downgradeUnreadDocument('unsigned')).toBe('unknown')
  })
})
