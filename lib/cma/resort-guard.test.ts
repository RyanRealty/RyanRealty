/**
 * Resort-community comp guard (Matt 2026-08-05): premium-enclave sales and
 * plain-town sales never price each other. Registry-driven, symmetric.
 */
import { describe, expect, it } from 'vitest'
import { resortCommunityCompatible, resortSlugForSubdivision } from './resort-guard'

describe('resortSlugForSubdivision', () => {
  it('maps registry aliases case-insensitively', () => {
    expect(resortSlugForSubdivision('Crosswater')).toBeTruthy()
    expect(resortSlugForSubdivision('crosswater')).toBeTruthy()
    expect(resortSlugForSubdivision('Caldera Springs')).toBeTruthy()
    expect(resortSlugForSubdivision('Tetherow')).toBe('tetherow')
  })
  it('plain subdivisions map to nothing', () => {
    expect(resortSlugForSubdivision('Kenwood')).toBeNull()
    expect(resortSlugForSubdivision(null)).toBeNull()
    expect(resortSlugForSubdivision('')).toBeNull()
  })
  it('keeps a phase suffix on the same resort (RPR legal descriptions)', () => {
    expect(resortSlugForSubdivision('Caldera Springs Phase One')).toBe('caldera-springs')
    expect(resortSlugForSubdivision('Caldera Springs Phase 1')).toBe('caldera-springs')
    expect(resortSlugForSubdivision('Kenwood Phase One')).toBeNull()
  })
})

describe('resortCommunityCompatible', () => {
  it("Matt's case: a Crosswater or Caldera comp never prices a plain subject", () => {
    expect(resortCommunityCompatible('Deschutes River Recreation Homesites', 'Crosswater')).toBe(false)
    expect(resortCommunityCompatible('Deschutes River Recreation Homesites', 'Caldera Springs')).toBe(false)
  })
  it('symmetric: a plain comp never prices a resort subject', () => {
    expect(resortCommunityCompatible('Caldera Springs', 'Kenwood')).toBe(false)
  })
  it('same resort on both sides is fine', () => {
    expect(resortCommunityCompatible('Caldera Springs', 'Caldera Springs')).toBe(true)
  })
  it('two different resorts never price each other', () => {
    expect(resortCommunityCompatible('Crosswater', 'Tetherow')).toBe(false)
  })
  it('plain against plain is fine', () => {
    expect(resortCommunityCompatible('Kenwood', 'Starlight Estate')).toBe(true)
    expect(resortCommunityCompatible(null, null)).toBe(true)
  })
})
