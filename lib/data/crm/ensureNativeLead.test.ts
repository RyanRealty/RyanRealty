import { describe, it, expect } from 'vitest'
import { decideNativeLeadAction, nativeLeadName } from './ensureNativeLead'
import { reuseSourcePatch } from '@/lib/crm/lead-source'
import { isPlaceholderLeadName } from '@/lib/crm/merge'
import { normalizeEmail, normalizePhone } from './resolvePersonIdentity'

// Native CRM capture: ensureNativeLead find-or-creates a crm_* row so a lead
// is never dropped. These tests lock the pure find-or-create DECISION + the
// email/phone normalization that drives it (email-first match, phone fallback,
// create-on-miss, skip-on-no-key) without standing up Supabase. The .from()
// side stays in the DAL module.

describe('ensureNativeLead decision helpers', () => {
  describe('decideNativeLeadAction (email-first match, phone fallback, create-on-miss)', () => {
    it('reuses on an email match (email-first wins) and never creates', () => {
      const d = decideNativeLeadAction({
        emailMatchPersonId: 42,
        phoneMatchPersonId: null,
        normalizedEmail: 'lead@example.com',
        normalizedPhone: '5415550100',
      })
      expect(d).toEqual({ action: 'reuse', personId: 42 })
    })

    it('email match wins even when a different phone match also exists', () => {
      // The email lead owns the identity. We must not create, and we must reuse
      // the EMAIL-matched person, not the phone-matched one.
      const d = decideNativeLeadAction({
        emailMatchPersonId: 42,
        phoneMatchPersonId: 99,
        normalizedEmail: 'lead@example.com',
        normalizedPhone: '5415550100',
      })
      expect(d).toEqual({ action: 'reuse', personId: 42 })
    })

    it('falls back to a phone match when there is no email match', () => {
      const d = decideNativeLeadAction({
        emailMatchPersonId: null,
        phoneMatchPersonId: 99,
        normalizedEmail: null,
        normalizedPhone: '5415550100',
      })
      expect(d).toEqual({ action: 'reuse', personId: 99 })
    })

    it('creates on a miss with an email, marking the email primary', () => {
      const d = decideNativeLeadAction({
        emailMatchPersonId: null,
        phoneMatchPersonId: null,
        normalizedEmail: 'new.lead@example.com',
        normalizedPhone: null,
      })
      expect(d).toEqual({
        action: 'create',
        contactPoints: [{ kind: 'email', value: 'new.lead@example.com', is_primary: true }],
      })
    })

    it('creates on a miss with email + phone, email primary and phone secondary', () => {
      const d = decideNativeLeadAction({
        emailMatchPersonId: null,
        phoneMatchPersonId: null,
        normalizedEmail: 'new.lead@example.com',
        normalizedPhone: '5415550100',
      })
      expect(d).toEqual({
        action: 'create',
        contactPoints: [
          { kind: 'email', value: 'new.lead@example.com', is_primary: true },
          { kind: 'phone', value: '5415550100', is_primary: false },
        ],
      })
    })

    it('creates on a phone-only miss, marking the phone primary', () => {
      const d = decideNativeLeadAction({
        emailMatchPersonId: null,
        phoneMatchPersonId: null,
        normalizedEmail: null,
        normalizedPhone: '5415550100',
      })
      expect(d).toEqual({
        action: 'create',
        contactPoints: [{ kind: 'phone', value: '5415550100', is_primary: true }],
      })
    })

    it('skips when there is neither a match nor any usable normalized key', () => {
      const d = decideNativeLeadAction({
        emailMatchPersonId: null,
        phoneMatchPersonId: null,
        normalizedEmail: null,
        normalizedPhone: null,
      })
      expect(d).toEqual({ action: 'skip' })
    })
  })

  describe('decision end to end via the reused normalizers', () => {
    it('a formatted email + phone normalize then drive a create on a miss', () => {
      const normalizedEmail = normalizeEmail('  New.Lead@Example.COM ')
      const normalizedPhone = normalizePhone('+1 (541) 555-0100')
      expect(normalizedEmail).toBe('new.lead@example.com')
      expect(normalizedPhone).toBe('5415550100')
      const d = decideNativeLeadAction({
        emailMatchPersonId: null,
        phoneMatchPersonId: null,
        normalizedEmail,
        normalizedPhone,
      })
      expect(d).toEqual({
        action: 'create',
        contactPoints: [
          { kind: 'email', value: 'new.lead@example.com', is_primary: true },
          { kind: 'phone', value: '5415550100', is_primary: false },
        ],
      })
    })

    it('an empty email + an un-normalizable phone normalize to null and skip', () => {
      const normalizedEmail = normalizeEmail('   ')
      const normalizedPhone = normalizePhone('no-digits')
      expect(normalizedEmail).toBeNull()
      expect(normalizedPhone).toBeNull()
      const d = decideNativeLeadAction({
        emailMatchPersonId: null,
        phoneMatchPersonId: null,
        normalizedEmail,
        normalizedPhone,
      })
      expect(d).toEqual({ action: 'skip' })
    })
  })

  describe('nativeLeadName (explicit name vs key-derived placeholder)', () => {
    it('uses an explicit trimmed name when present', () => {
      expect(nativeLeadName('  Jane Seller  ', 'jane@example.com', '5415550100')).toBe('Jane Seller')
    })

    it('derives an email placeholder when the name is blank', () => {
      expect(nativeLeadName('', 'jane@example.com', '5415550100')).toBe('Lead jane@example.com')
      expect(nativeLeadName('   ', 'jane@example.com', null)).toBe('Lead jane@example.com')
    })

    it('derives a phone placeholder when there is no name and no email', () => {
      expect(nativeLeadName(null, null, '5415550100')).toBe('Lead 5415550100')
    })

    it('falls back to a generic label when nothing identifies the lead', () => {
      expect(nativeLeadName(null, null, null)).toBe('Website lead')
    })

    it('every placeholder it writes is one the merge refuses to greet (FUNNEL-8)', () => {
      for (const placeholder of [
        nativeLeadName('', 'jane@example.com', null),
        nativeLeadName(null, null, '5415550100'),
        nativeLeadName(null, null, null),
      ]) {
        expect(isPlaceholderLeadName(placeholder), placeholder).toBe(true)
      }
      expect(isPlaceholderLeadName(nativeLeadName('Jane Doe', 'jane@example.com', null))).toBe(false)
    })
  })

  // FUNNEL-4 (2026-09-23): crm_people.source is first-touch. An inbound caller
  // who later used the contact form used to lose 'inbound-call' to the form.
  describe('reuseSourcePatch (first-touch source on the reuse path)', () => {
    it('keeps the first door and tags the later one', () => {
      expect(reuseSourcePatch('inbound-call', 'contact-form')).toEqual({ tag: 'source:contact-form' })
      expect(reuseSourcePatch('expired-listing-cron', 'seller-lp')).toEqual({ tag: 'source:seller-lp' })
    })

    it('fills an empty source and leaves a repeat door alone', () => {
      expect(reuseSourcePatch(null, 'contact-form')).toEqual({ source: 'contact-form' })
      expect(reuseSourcePatch('  ', 'idx-registration')).toEqual({ source: 'idx-registration' })
      expect(reuseSourcePatch('Contact-Form', 'contact-form')).toEqual({})
    })

    it('does nothing without an incoming door', () => {
      expect(reuseSourcePatch('inbound-call', '')).toEqual({})
      expect(reuseSourcePatch('inbound-call', undefined)).toEqual({})
    })
  })
})
