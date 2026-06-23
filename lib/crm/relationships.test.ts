import { describe, it, expect } from 'vitest'
import {
  RELATIONSHIP_TYPES,
  RELATIONSHIP_LABELS,
  SYMMETRIC_TYPES,
  reciprocalType,
  isRelationshipType,
  normalizeRelationshipType,
  isSelfLink,
  validateLink,
  pairKey,
  type RelationshipType,
} from './relationships'

// The reciprocal map is load-bearing: every contact link writes BOTH directions
// to crm_relationships, so a hole or a non-round-tripping pair would leave a
// one-sided "married" that shows on one record but not the other.
describe('relationship vocabulary (CONTACT360 Phase 4.1)', () => {
  describe('reciprocalType — total + round-tripping', () => {
    it('maps every type to a known type', () => {
      for (const t of RELATIONSHIP_TYPES) {
        const r = reciprocalType(t)
        expect(isRelationshipType(r)).toBe(true)
      }
    })

    it('round-trips: reciprocalType(reciprocalType(t)) === t for every type', () => {
      for (const t of RELATIONSHIP_TYPES) {
        expect(reciprocalType(reciprocalType(t))).toBe(t)
      }
    })

    it('maps symmetric types to themselves', () => {
      for (const t of SYMMETRIC_TYPES) {
        expect(reciprocalType(t)).toBe(t)
      }
      expect(reciprocalType('spouse')).toBe('spouse')
      expect(reciprocalType('partner')).toBe('partner')
      expect(reciprocalType('sibling')).toBe('sibling')
      expect(reciprocalType('co-buyer')).toBe('co-buyer')
    })

    it('maps directional pairs to their inverse', () => {
      expect(reciprocalType('parent')).toBe('child')
      expect(reciprocalType('child')).toBe('parent')
      expect(reciprocalType('agent')).toBe('client')
      expect(reciprocalType('client')).toBe('agent')
      expect(reciprocalType('referrer')).toBe('referred')
      expect(reciprocalType('referred')).toBe('referrer')
      expect(reciprocalType('assistant')).toBe('principal')
      expect(reciprocalType('principal')).toBe('assistant')
    })

    it('treats other as symmetric (its own reciprocal)', () => {
      expect(reciprocalType('other')).toBe('other')
    })

    it('a directional reciprocal is never the same type (no accidental symmetry)', () => {
      const directional: RelationshipType[] = [
        'parent',
        'child',
        'agent',
        'client',
        'referrer',
        'referred',
        'assistant',
        'principal',
      ]
      for (const t of directional) {
        expect(reciprocalType(t)).not.toBe(t)
      }
    })
  })

  describe('label coverage', () => {
    it('has a label for every type', () => {
      for (const t of RELATIONSHIP_TYPES) {
        expect(typeof RELATIONSHIP_LABELS[t]).toBe('string')
        expect(RELATIONSHIP_LABELS[t].length).toBeGreaterThan(0)
      }
    })
  })

  describe('isRelationshipType', () => {
    it('accepts known types', () => {
      expect(isRelationshipType('spouse')).toBe(true)
      expect(isRelationshipType('co-buyer')).toBe(true)
    })
    it('rejects unknown / non-string values', () => {
      expect(isRelationshipType('married')).toBe(false)
      expect(isRelationshipType('')).toBe(false)
      expect(isRelationshipType(null)).toBe(false)
      expect(isRelationshipType(7)).toBe(false)
    })
  })

  describe('normalizeRelationshipType', () => {
    it('lowercases + trims a known type', () => {
      expect(normalizeRelationshipType('  Spouse ')).toBe('spouse')
      expect(normalizeRelationshipType('CO-BUYER')).toBe('co-buyer')
    })
    it('defaults dirty/legacy values to other', () => {
      expect(normalizeRelationshipType('married')).toBe('other')
      expect(normalizeRelationshipType(null)).toBe('other')
      expect(normalizeRelationshipType(undefined)).toBe('other')
      expect(normalizeRelationshipType('')).toBe('other')
    })
  })

  describe('isSelfLink', () => {
    it('flags the same person', () => {
      expect(isSelfLink(42, 42)).toBe(true)
    })
    it('passes distinct people', () => {
      expect(isSelfLink(42, 43)).toBe(false)
    })
  })

  describe('validateLink — self-link + duplicate guards', () => {
    it('rejects a self-link', () => {
      const r = validateLink({ fromPersonId: 9, toPersonId: 9, type: 'spouse' })
      expect(r.ok).toBe(false)
      if (!r.ok) expect(r.error).toMatch(/itself/i)
    })
    it('rejects a missing/invalid id', () => {
      expect(validateLink({ fromPersonId: 0, toPersonId: 5, type: 'spouse' }).ok).toBe(false)
      expect(validateLink({ fromPersonId: 5, toPersonId: -1, type: 'spouse' }).ok).toBe(false)
      expect(validateLink({ fromPersonId: 1.5, toPersonId: 5, type: 'spouse' }).ok).toBe(false)
    })
    it('rejects an unknown type', () => {
      const r = validateLink({ fromPersonId: 1, toPersonId: 2, type: 'married' })
      expect(r.ok).toBe(false)
      if (!r.ok) expect(r.error).toMatch(/type/i)
    })
    it('returns the canonical type on a valid link', () => {
      const r = validateLink({ fromPersonId: 1, toPersonId: 2, type: 'co-buyer' })
      expect(r.ok).toBe(true)
      if (r.ok) expect(r.type).toBe('co-buyer')
    })
  })

  describe('pairKey — order-independent duplicate key', () => {
    it('gives the same key regardless of argument order', () => {
      expect(pairKey(7, 12)).toBe(pairKey(12, 7))
      expect(pairKey(12, 7)).toBe('7:12')
    })
    it('distinguishes different pairs', () => {
      expect(pairKey(1, 2)).not.toBe(pairKey(1, 3))
    })
  })
})
