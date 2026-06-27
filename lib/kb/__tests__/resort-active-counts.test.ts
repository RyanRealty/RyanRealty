import { describe, it, expect } from 'vitest'
import { resortActiveSfrCounts, resortLabelToSlug, resortTilesForSlug } from '../resort-active-counts'

// These assert the ALIAS-AWARE behavior against the real registry: Widgi Creek's
// homes are tagged under alias subdivisions, never literally "Widgi Creek".
describe('resortActiveSfrCounts', () => {
  it('counts Widgi Creek via its alias subdivisions, not the literal name', () => {
    const tiles = [
      { subdivisionName: 'PointsWest', propertyType: 'A' },
      { subdivisionName: 'Milepost 1', propertyType: 'A' },
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

  it('resortTilesForSlug returns the alias-matched tiles for one resort (count == tiles)', () => {
    const tiles = [
      { subdivisionName: 'PointsWest', propertyType: 'A', listingKey: '1' },
      { subdivisionName: 'Elkai Woods', propertyType: 'A', listingKey: '2' },
      { subdivisionName: 'Tetherow', propertyType: 'A', listingKey: '3' }, // different resort
      { subdivisionName: 'Milepost 1', propertyType: 'C', listingKey: '4' }, // condo, skip
      { subdivisionName: 'Somewhere Else', propertyType: 'A', listingKey: '5' },
    ]
    const widgi = resortTilesForSlug('bend', 'widgi-creek', tiles)
    expect(widgi.map((t) => t.listingKey).sort()).toEqual(['1', '2'])
    // the helper's tiles count agrees with the count helper (same alias assignment)
    expect(widgi.length).toBe(resortActiveSfrCounts('bend', tiles).get('widgi-creek'))
  })

  it('token-boundary match: a foreign subdivision sharing leading chars is NOT bucketed', () => {
    // "Tetherow" is a Tetherow alias; "Tetherowville" shares the prefix but has no
    // word boundary, so it must NOT count toward tetherow. A real phase ("Tetherow
    // Phase 2") still matches.
    const tiles = [
      { subdivisionName: 'Tetherowville Estates', propertyType: 'A' },
      { subdivisionName: 'Tetherow Phase 2', propertyType: 'A' },
      { subdivisionName: 'Tetherow', propertyType: 'A' },
    ]
    expect(resortActiveSfrCounts('bend', tiles).get('tetherow')).toBe(2)
  })

  it('resortTilesForSlug returns [] for a non-resort slug', () => {
    expect(resortTilesForSlug('bend', 'not-a-resort', [{ subdivisionName: 'Tetherow', propertyType: 'A' }])).toEqual([])
  })

  it('resortLabelToSlug maps the resort display name to its slug', () => {
    const m = resortLabelToSlug('bend')
    expect(m.get('widgi creek')).toBe('widgi-creek')
    expect(m.get('tetherow')).toBe('tetherow')
  })
})
