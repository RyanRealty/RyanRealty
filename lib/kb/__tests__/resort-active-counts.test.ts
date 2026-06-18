import { describe, it, expect } from 'vitest'
import { resortActiveSfrCounts, resortLabelToSlug } from '../resort-active-counts'

// These assert the ALIAS-AWARE behavior against the real registry: Widgi Creek's
// homes are tagged under alias subdivisions, never literally "Widgi Creek".
describe('resortActiveSfrCounts', () => {
  it('counts Widgi Creek via its alias subdivisions, not the literal name', () => {
    const tiles = [
      { subdivisionName: 'Inn Of The 7th Mountain', propertyType: 'A' },
      { subdivisionName: '7th Mtn Golf Village', propertyType: 'A' },
      { subdivisionName: 'Elkai Woods', propertyType: 'A' },
      { subdivisionName: 'Widgi Creek', propertyType: 'A' }, // literal, also counts
    ]
    const counts = resortActiveSfrCounts('bend', tiles)
    expect(counts.get('widgi-creek')).toBe(4)
  })

  it('only counts SFR (PropertyType A), skipping condos/land', () => {
    const tiles = [
      { subdivisionName: 'Tetherow', propertyType: 'A' },
      { subdivisionName: 'Tetherow', propertyType: 'C' }, // condo — skip
      { subdivisionName: 'Tetherow', propertyType: null }, // unknown — skip
    ]
    expect(resortActiveSfrCounts('bend', tiles).get('tetherow')).toBe(1)
  })

  it('assigns each tile to at most one resort (longest alias prefix wins)', () => {
    // "Parks At Broken Top" is a Broken Top alias; "Broken Top" is the generic one.
    const tiles = [
      { subdivisionName: 'Parks At Broken Top Phase 2', propertyType: 'A' },
      { subdivisionName: 'Broken Top', propertyType: 'A' },
    ]
    // both belong to broken-top; neither is dropped or double-counted elsewhere
    expect(resortActiveSfrCounts('bend', tiles).get('broken-top')).toBe(2)
  })

  it('returns 0 for a registered resort with no active tiles (drops, no stale number)', () => {
    const counts = resortActiveSfrCounts('bend', [{ subdivisionName: 'Somewhere Else', propertyType: 'A' }])
    expect(counts.get('vandevert-ranch')).toBe(0)
  })

  it('excludes is_resort:false registry rows (Three Rivers and its generic over-matching aliases)', () => {
    // "Sun Dance"/"Oww" are Three Rivers aliases; it is is_resort:false so it must
    // not appear in the counts at all, regardless of matching tiles.
    const counts = resortActiveSfrCounts('bend', [{ subdivisionName: 'Sun Dance Estates', propertyType: 'A' }])
    expect(counts.has('three-rivers')).toBe(false)
  })

  it('resortLabelToSlug maps the resort display name to its slug', () => {
    const m = resortLabelToSlug('bend')
    expect(m.get('widgi creek')).toBe('widgi-creek')
    expect(m.get('tetherow')).toBe('tetherow')
  })
})
