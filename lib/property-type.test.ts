import { describe, it, expect } from 'vitest'
import {
  getPropertyTypeLabel,
  getPropertyTypeSegmentKey,
  propertyTypeFilterToCodes,
  PROPERTY_TYPES,
  REPORT_PROPERTY_TYPE_SEGMENTS,
  SUBTYPE_TO_CLASS,
} from './property-type'
import { searchFieldByKey } from './search/field-registry'

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

    it('maps farm (E) and commercial lease (G)', () => {
      expect(getPropertyTypeLabel('E')).toBe('Farm')
      expect(getPropertyTypeLabel('Farm')).toBe('Farm')
      expect(getPropertyTypeLabel('G')).toBe('Commercial lease')
      expect(getPropertyTypeLabel('Commercial Lease')).toBe('Commercial lease')
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

  describe('SUBTYPE_TO_CLASS (plan §4.5.3 class auto-narrow data)', () => {
    it('covers every propertySubTypes registry option, and nothing else', () => {
      const options = searchFieldByKey('propertySubTypes')!.options!
      for (const option of options) {
        expect(SUBTYPE_TO_CLASS[option], `${option} missing a class`).toMatch(/^[A-D]$/)
      }
      // No orphan keys: the map and the registry vocabulary are the same set.
      expect(Object.keys(SUBTYPE_TO_CLASS).sort()).toEqual([...options].sort())
    })

    it('assigns the classes measured in listing_search_mv (2026-07-30)', () => {
      expect(SUBTYPE_TO_CLASS['Single Family Residence']).toBe('A')
      expect(SUBTYPE_TO_CLASS['Manufactured On Land']).toBe('A')
      expect(SUBTYPE_TO_CLASS['In Park']).toBe('B')
      expect(SUBTYPE_TO_CLASS['On Leased Land']).toBe('B')
      expect(SUBTYPE_TO_CLASS.Duplex).toBe('C')
      expect(SUBTYPE_TO_CLASS.Triplex).toBe('C')
      expect(SUBTYPE_TO_CLASS.Quadruplex).toBe('C')
      expect(SUBTYPE_TO_CLASS['Multi Family']).toBe('C')
      expect(SUBTYPE_TO_CLASS['Residential Lots']).toBe('D')
      expect(SUBTYPE_TO_CLASS.Rangeland).toBe('D')
    })

    it('every class code is a code propertyTypeFilterToCodes understands', () => {
      for (const [subType, cls] of Object.entries(SUBTYPE_TO_CLASS)) {
        expect(propertyTypeFilterToCodes(cls), `${subType} class ${cls}`).toEqual([cls])
      }
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
      expect(propertyTypeFilterToCodes('Commercial')).toEqual(['F'])
      expect(propertyTypeFilterToCodes('farm')).toEqual(['E'])
      expect(propertyTypeFilterToCodes('lease')).toEqual(['G'])
      expect(propertyTypeFilterToCodes('business')).toEqual(['H'])
    })
    it('passes a raw code through unchanged', () => {
      expect(propertyTypeFilterToCodes('A')).toEqual(['A'])
      expect(propertyTypeFilterToCodes('d')).toEqual(['D'])
    })
    it('maps Multi-Family (and spellings) to C — the multi-family preset contract', () => {
      expect(propertyTypeFilterToCodes('Multi-Family')).toEqual(['C'])
      expect(propertyTypeFilterToCodes('multi-family')).toEqual(['C'])
      expect(propertyTypeFilterToCodes('multifamily')).toEqual(['C'])
      expect(propertyTypeFilterToCodes('Multi Family')).toEqual(['C'])
      expect(propertyTypeFilterToCodes('income')).toEqual(['C'])
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
