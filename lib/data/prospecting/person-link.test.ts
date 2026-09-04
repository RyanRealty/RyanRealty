/**
 * Farm-stub send person gate (Pine Vista / John Arzner class).
 * outreach_crm_person_id alone is not enough — empty CRM emails/phones
 * must paint as unlinked (Link contact), same as personId == null.
 */
import { describe, expect, it } from 'vitest'
import { crmPersonHasOutboundContact, effectiveProspectPersonId } from './person-link'

describe('crmPersonHasOutboundContact', () => {
  it('is false for null/undefined/non-arrays', () => {
    expect(crmPersonHasOutboundContact(null)).toBe(false)
    expect(crmPersonHasOutboundContact(undefined)).toBe(false)
    expect(crmPersonHasOutboundContact({})).toBe(false)
    expect(crmPersonHasOutboundContact({ emails: null, phones: null })).toBe(false)
  })

  it('is false for empty arrays (farm stub)', () => {
    expect(crmPersonHasOutboundContact({ emails: [], phones: [] })).toBe(false)
  })

  it('is true when email or phone is present', () => {
    expect(crmPersonHasOutboundContact({ emails: ['a@b.co'], phones: [] })).toBe(true)
    expect(crmPersonHasOutboundContact({ emails: [], phones: ['5415551212'] })).toBe(true)
  })
})

describe('effectiveProspectPersonId', () => {
  it('returns null when unlinked', () => {
    expect(effectiveProspectPersonId(null, { emails: ['a@b.co'], phones: [] })).toBe(null)
  })

  it('returns null for contactless farm stub (Pine Vista)', () => {
    expect(effectiveProspectPersonId(20397, { emails: [], phones: [] })).toBe(null)
    expect(effectiveProspectPersonId(20397, undefined)).toBe(null)
  })

  it('keeps id when CRM has outbound contact', () => {
    expect(effectiveProspectPersonId(18198, { emails: ['owner@example.com'], phones: [] })).toBe(18198)
  })
})
