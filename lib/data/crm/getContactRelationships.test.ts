import { describe, it, expect } from 'vitest'
import { humanizeRelationshipType } from './getContactRelationships'
import { RELATIONSHIP_TYPES, RELATIONSHIP_LABELS } from '@/lib/crm/relationships'

// humanizeRelationshipType drives the Badge text on every relationship row. It
// must be total: a known kind humanizes to its label, a dirty/legacy/empty kind
// falls back to 'Other' (never an unknown string, never a throw).
describe('humanizeRelationshipType', () => {
  it('humanizes every canonical type to its label', () => {
    for (const t of RELATIONSHIP_TYPES) {
      expect(humanizeRelationshipType(t)).toBe(RELATIONSHIP_LABELS[t])
    }
  })

  it('humanizes the marriage case to Spouse', () => {
    expect(humanizeRelationshipType('spouse')).toBe('Spouse')
  })

  it('lowercases and trims a messy known kind', () => {
    expect(humanizeRelationshipType('  Spouse ')).toBe('Spouse')
    expect(humanizeRelationshipType('CO-BUYER')).toBe('Co-buyer')
  })

  it('falls back to Other for legacy, empty, or nullish kinds', () => {
    expect(humanizeRelationshipType('married')).toBe('Other')
    expect(humanizeRelationshipType('')).toBe('Other')
    expect(humanizeRelationshipType(null)).toBe('Other')
    expect(humanizeRelationshipType(undefined)).toBe('Other')
  })
})
