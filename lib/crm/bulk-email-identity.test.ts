import { describe, expect, it } from 'vitest'
import {
  brokerSlugFromActorEmail,
  canSendFromMailbox,
  displayNameFromIdentity,
  freezeBulkEmailSendParams,
} from './bulk-email-identity'

describe('freezeBulkEmailSendParams', () => {
  it('defaults to the named Resend identity, real reply-to, and signature on', () => {
    const frozen = freezeBulkEmailSendParams('matt@ryan-realty.com')
    expect(frozen.includeSignature).toBe(true)
    expect(frozen.sendVia).toBe('resend')
    expect(frozen.fromIdentity).toBe('"Matt Ryan · Ryan Realty" <matt@mail.ryan-realty.com>')
    expect(frozen.replyTo).toBe('matt@ryan-realty.com')
    expect(frozen.fromIdentity.toLowerCase()).not.toContain('noreply')
  })

  it('keeps signature on unless the caller explicitly turns it off', () => {
    expect(freezeBulkEmailSendParams('matt@ryan-realty.com', { includeSignature: true }).includeSignature).toBe(true)
    expect(freezeBulkEmailSendParams('matt@ryan-realty.com', { includeSignature: null }).includeSignature).toBe(true)
    expect(freezeBulkEmailSendParams('matt@ryan-realty.com', { includeSignature: false }).includeSignature).toBe(false)
  })

  it('sends from the real mailbox only when the actor owns one', () => {
    const frozen = freezeBulkEmailSendParams('matt@ryan-realty.com', { sendVia: 'gmail' })
    expect(frozen.sendVia).toBe('gmail')
    expect(frozen.fromIdentity).toBe('matt@ryan-realty.com')
    expect(frozen.replyTo).toBe('matt@ryan-realty.com')
  })

  it('does not let a non-mailbox login pick the Gmail rail', () => {
    const frozen = freezeBulkEmailSendParams('marketing@ryan-realty.com', { sendVia: 'gmail' })
    expect(frozen.sendVia).toBe('resend')
    expect(frozen.fromIdentity).toContain('@mail.ryan-realty.com')
    expect(frozen.replyTo).toBe('matt@ryan-realty.com')
  })
})

describe('mailbox helpers', () => {
  it('recognizes the three CRM mailboxes', () => {
    expect(canSendFromMailbox('matt@ryan-realty.com')).toBe(true)
    expect(canSendFromMailbox('Paul@ryan-realty.com')).toBe(true)
    expect(canSendFromMailbox('rebeccapeterson@ryan-realty.com')).toBe(true)
    expect(canSendFromMailbox('marketing@ryan-realty.com')).toBe(false)
  })

  it('maps an actor email to the CRM broker slug', () => {
    expect(brokerSlugFromActorEmail('matt@ryan-realty.com')).toBe('matt')
    expect(brokerSlugFromActorEmail('paul@ryan-realty.com')).toBe('paul')
    expect(brokerSlugFromActorEmail('rebeccapeterson@ryan-realty.com')).toBe('rebecca')
    expect(brokerSlugFromActorEmail('nobody@example.com')).toBe('matt')
  })

  it('strips the RFC 5322 wrapper for the From caption', () => {
    expect(displayNameFromIdentity('"Matt Ryan · Ryan Realty" <matt@mail.ryan-realty.com>')).toBe(
      'Matt Ryan · Ryan Realty',
    )
  })
})
