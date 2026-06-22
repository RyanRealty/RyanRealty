import { describe, it, expect } from 'vitest'
import { normalizeTo10, toE164 } from './twilio'

// Phone normalization gates the SMS/TCPA path (lookup + opt-out matching), so it
// must be exact across formatting variants. Audit p3.2.
describe('phone normalizers (SMS/TCPA path)', () => {
  describe('normalizeTo10', () => {
    it('strips formatting to the last 10 digits', () => {
      expect(normalizeTo10('(541) 213-6706')).toBe('5412136706')
      expect(normalizeTo10('541.213.6706')).toBe('5412136706')
      expect(normalizeTo10('+1 541 213 6706')).toBe('5412136706')
      expect(normalizeTo10('15412136706')).toBe('5412136706')
    })
    it('returns null for empty/nullish', () => {
      expect(normalizeTo10('')).toBeNull()
      expect(normalizeTo10(null)).toBeNull()
      expect(normalizeTo10(undefined)).toBeNull()
    })
  })

  describe('toE164', () => {
    it('produces +1XXXXXXXXXX', () => {
      expect(toE164('(541) 213-6706')).toBe('+15412136706')
      expect(toE164('15412136706')).toBe('+15412136706')
    })
    it('returns null for empty/nullish', () => {
      expect(toE164(null)).toBeNull()
      expect(toE164('')).toBeNull()
    })
  })
})
