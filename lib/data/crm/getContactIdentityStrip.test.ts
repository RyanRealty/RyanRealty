import { describe, it, expect } from 'vitest'
import { pickPrimary, mapCmaRow } from './getContactIdentityStrip'

describe('getContactIdentityStrip pure helpers (2.7)', () => {
  describe('pickPrimary', () => {
    it('returns the isPrimary=1 value', () => {
      expect(pickPrimary([{ value: 'a@x.com' }, { value: 'b@x.com', isPrimary: 1 }])).toBe('b@x.com')
    })
    it('accepts isPrimary=true', () => {
      expect(pickPrimary([{ value: 'a@x.com', isPrimary: true }])).toBe('a@x.com')
    })
    it('falls back to the first when none is primary', () => {
      expect(pickPrimary([{ value: 'first@x.com' }, { value: 'second@x.com' }])).toBe('first@x.com')
    })
    it('trims and rejects blank/missing values', () => {
      expect(pickPrimary([{ value: '  pat@x.com  ' }])).toBe('pat@x.com')
      expect(pickPrimary([{ value: '   ' }])).toBeNull()
      expect(pickPrimary([{}])).toBeNull()
    })
    it('handles empty / nullish input', () => {
      expect(pickPrimary([])).toBeNull()
      expect(pickPrimary(null)).toBeNull()
      expect(pickPrimary(undefined)).toBeNull()
    })
  })

  describe('mapCmaRow', () => {
    it('maps a finalized cma row with numeric coercion', () => {
      const r = mapCmaRow({
        slug: 'cma-123-main',
        subject_address: '123 Main St',
        status: 'finalized',
        recommended_list: '895000',
        value_low: 850000,
        value_high: 940000,
        created_at: '2026-06-01T00:00:00Z',
        preview_url: 'https://ryan-realty.com/cmas/cma-123-main',
      })
      expect(r).toEqual({
        slug: 'cma-123-main',
        subjectAddress: '123 Main St',
        status: 'finalized',
        recommendedList: 895000,
        valueLow: 850000,
        valueHigh: 940000,
        createdAt: '2026-06-01T00:00:00Z',
        previewUrl: 'https://ryan-realty.com/cmas/cma-123-main',
      })
    })
    it('defaults status to draft and nulls missing numerics', () => {
      const r = mapCmaRow({ slug: 's', subject_address: 'a' })
      expect(r.status).toBe('draft')
      expect(r.recommendedList).toBeNull()
      expect(r.valueLow).toBeNull()
      expect(r.previewUrl).toBeNull()
    })
  })
})
