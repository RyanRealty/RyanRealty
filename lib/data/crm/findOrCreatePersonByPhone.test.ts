import { describe, it, expect } from 'vitest'
import { shouldCreatePerson, inboundLeadName } from './findOrCreatePersonByPhone'
import { normalizeTo10 } from '@/lib/crm/twilio'

// CONTACT360 Phase 0.1 closes the inbound-voice lead leak: an unknown caller used
// to create NO lead. The route now find-or-creates. These tests lock the pure
// decision + normalization helpers that drive the create-vs-reuse branch, so the
// "unknown -> create exactly one, known -> reuse, never duplicate" invariant holds
// without standing up Supabase.

describe('findOrCreatePersonByPhone decision helpers', () => {
  describe('shouldCreatePerson (create-vs-reuse branch)', () => {
    it('reuses a known caller (existing match) and never creates', () => {
      expect(shouldCreatePerson({ personId: 42 }, '5412136706')).toBe(false)
      // even a missing normalized number does not matter when the caller is known
      expect(shouldCreatePerson({ personId: 42 }, null)).toBe(false)
    })

    it('creates for an unknown caller with a usable normalized number', () => {
      expect(shouldCreatePerson(null, '5412136706')).toBe(true)
    })

    it('does NOT create when there is no usable normalized number to key on', () => {
      // an unknown, un-normalizable number (no digits) cannot anchor a contact
      // point, so we skip the create rather than orphan a lead
      expect(shouldCreatePerson(null, null)).toBe(false)
    })
  })

  describe('create decision end to end via normalizeTo10', () => {
    it('an unknown formatted number normalizes and triggers a create', () => {
      const ten = normalizeTo10('(541) 213-6706')
      expect(ten).toBe('5412136706')
      expect(shouldCreatePerson(null, ten)).toBe(true)
    })

    it('an unknown caller with no digits normalizes to null and is skipped', () => {
      const ten = normalizeTo10('anonymous')
      expect(ten).toBeNull()
      expect(shouldCreatePerson(null, ten)).toBe(false)
    })

    it('a known caller is reused even when the number is well formed', () => {
      const ten = normalizeTo10('+1 541 213 6706')
      expect(shouldCreatePerson({ personId: 7 }, ten)).toBe(false)
    })
  })

  describe('inboundLeadName (per-channel placeholder name)', () => {
    it('labels a call lead distinctly from a text lead', () => {
      expect(inboundLeadName('inbound-call', '+15412136706', '5412136706')).toBe('Call lead 5412136706')
      expect(inboundLeadName('inbound-sms', '+15412136706', '5412136706')).toBe('Text lead 5412136706')
    })

    it('falls back to the raw value when the normalized number is null', () => {
      expect(inboundLeadName('inbound-call', '+1 (541) 213-6706', null)).toBe('Call lead +1 (541) 213-6706')
    })
  })
})
