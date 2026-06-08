import { describe, it, expect } from 'vitest'
import {
  getPropertyTypeLabel,
  getPropertyTypeSegmentKey,
  propertyTypeFilterToCodes,
  PROPERTY_TYPES,
  REPORT_PROPERTY_TYPE_SEGMENTS,
} from './property-type'

describe('property-type', () => {
  describe('getPropertyTypeLabel', () => {
    it('returns Property for null/undefined/empty', () => {
      expect(getPropertyTypeLabel(null)).toBe('Property')
      expect(getPropertyTypeLabel(undefined)).toBe('Property')
      expect(getPropertyTypeLabel('')).toBe('Property')
      expect(getPropertyTypeLabel('  ')).toBe('Property')
    })

    it('maps condo-like values', () => {
      expect(getPropertyTypeLabel('Condominium')).toBe('Condo & Townhouse')
      expect(getPropertyTypeLabel('Townhouse')).toBe('Condo & Townhouse')
      expect(getPropertyTypeLabel('Town Home')).toBe('Condo & Townhouse')
    })

    it('maps manufactured values', () => {
      expect(getPropertyTypeLabel('Manufactured')).toBe('Manufactured')
      expect(getPropertyTypeLabel('Mobile Home')).toBe('Manufactured')
    })

    it('maps acreage/land values', () => {
      expect(getPropertyTypeLabel('Acreage')).toBe('Acreage / Land')
      expect(getPropertyTypeLabel('Land')).toBe('Acreage / Land')
    })

    it('maps residential values', () => {
      expect(getPropertyTypeLabel('Residential')).toBe('Residential')
      expect(getPropertyTypeLabel('Single Family')).toBe('Residential')
    })

    it('maps commercial values', () => {
      expect(getPropertyTypeLabel('Commercial')).toBe('Commercial')
    })

    it('maps rental values', () => {
      expect(getPropertyTypeLabel('Rental')).toBe('Rental')
    })

    it('truncates unknown values over 30 chars', () => {
      const longName = 'A Very Long Property Type Name That Exceeds Limit'
      const result = getPropertyTypeLabel(longName)
      expect(result.length).toBeLessThanOrEqual(30)
      expect(result).toContain('…')
    })

    it('returns unknown values as-is if under 30 chars', () => {
      expect(getPropertyTypeLabel('Villa')).toBe('Villa')
    })
  })

  describe('getPropertyTypeSegmentKey', () => {
    it('returns residential for null/undefined/empty', () => {
      expect(getPropertyTypeSegmentKey(null)).toBe('residential')
      expect(getPropertyTypeSegmentKey(undefined)).toBe('residential')
      expect(getPropertyTypeSegmentKey('')).toBe('residential')
    })

    it('maps condo/town to condo_town', () => {
      expect(getPropertyTypeSegmentKey('Condominium')).toBe('condo_town')
      expect(getPropertyTypeSegmentKey('Townhouse')).toBe('condo_town')
    })

    it('maps manufactured/mobile to manufactured', () => {
      expect(getPropertyTypeSegmentKey('Manufactured')).toBe('manufactured')
      expect(getPropertyTypeSegmentKey('Mobile Home')).toBe('manufactured')
    })

    it('maps acreage/land to acreage', () => {
      expect(getPropertyTypeSegmentKey('Acreage')).toBe('acreage')
      expect(getPropertyTypeSegmentKey('Land')).toBe('acreage')
    })

    it('maps residential to residential', () => {
      expect(getPropertyTypeSegmentKey('Residential')).toBe('residential')
      expect(getPropertyTypeSegmentKey('Single Family')).toBe('residential')
    })
  })

  describe('constants', () => {
    it('PROPERTY_TYPES has All types as first option', () => {
      expect(PROPERTY_TYPES[0]).toEqual({ value: '', label: 'All types' })
    })

    it('REPORT_PROPERTY_TYPE_SEGMENTS has 4 segments', () => {
      expect(REPORT_PROPERTY_TYPE_SEGMENTS).toHaveLength(4)
      const keys = REPORT_PROPERTY_TYPE_SEGMENTS.map((s) => s.key)
      expect(keys).toContain('residential')
      expect(keys).toContain('condo_town')
      expect(keys).toContain('manufactured')
      expect(keys).toContain('acreage')
    })
  })

  describe('propertyTypeFilterToCodes', () => {
    // The MV / listings store the MLS PropertyType CODE (A-H), not a label.
    // Every search-UI option must map to the code set it filters, or the
    // property-type filter silently returns zero homes (the over-1-5m bug).
    it('returns null for empty / all (no constraint)', () => {
      expect(propertyTypeFilterToCodes(undefined)).toBeNull()
      expect(propertyTypeFilterToCodes('')).toBeNull()
      expect(propertyTypeFilterToCodes('  ')).toBeNull()
      expect(propertyTypeFilterToCodes('all')).toBeNull()
    })
    it('maps Residential to A/B/C (dwellings)', () => {
      expect(propertyTypeFilterToCodes('Residential')).toEqual(['A', 'B', 'C'])
      expect(propertyTypeFilterToCodes('residential')).toEqual(['A', 'B', 'C'])
    })
    it('maps Land to D and Commercial to E-H', () => {
      expect(propertyTypeFilterToCodes('Land')).toEqual(['D'])
      expect(propertyTypeFilterToCodes('Commercial')).toEqual(['E', 'F', 'G', 'H'])
    })
    it('passes a raw code through unchanged', () => {
      expect(propertyTypeFilterToCodes('A')).toEqual(['A'])
      expect(propertyTypeFilterToCodes('d')).toEqual(['D'])
    })
    it('every non-empty PROPERTY_TYPES option resolves to codes', () => {
      for (const opt of PROPERTY_TYPES) {
        if (!opt.value) continue
        const codes = propertyTypeFilterToCodes(opt.value)
        expect(codes, `option ${opt.value} must map to codes`).not.toBeNull()
        expect(codes!.length).toBeGreaterThan(0)
      }
    })
  })
})
