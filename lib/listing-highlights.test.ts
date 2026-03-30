import { describe, it, expect } from 'vitest'
import { buildListingHighlights } from './listing-highlights'

describe('buildListingHighlights', () => {
  it('extracts sentences from PublicRemarks', () => {
    const result = buildListingHighlights({
      PublicRemarks: 'Beautiful home in Bend. Mountain views from every window. Updated kitchen.',
    })
    expect(result.highlights).toHaveLength(3)
    expect(result.highlights[0]).toBe('Beautiful home in Bend.')
    expect(result.highlights[1]).toBe('Mountain views from every window.')
  })

  it('limits highlights to 5 sentences', () => {
    const remarks = 'One. Two. Three. Four. Five. Six. Seven.'
    const result = buildListingHighlights({ PublicRemarks: remarks })
    expect(result.highlights.length).toBeLessThanOrEqual(5)
  })

  it('falls back to PrivateRemarks when PublicRemarks is missing', () => {
    const result = buildListingHighlights({
      PrivateRemarks: 'Private note. Another note.',
    })
    expect(result.highlights).toHaveLength(2)
  })

  it('returns empty highlights when no remarks', () => {
    const result = buildListingHighlights({})
    expect(result.highlights).toHaveLength(0)
  })

  it('generates lot size tag in acres for >= 1 acre', () => {
    const result = buildListingHighlights({ LotSizeAcres: 2.5 })
    expect(result.featureTags).toContain('2.5 acre lot')
  })

  it('generates lot size tag in sq ft for < 1 acre', () => {
    const result = buildListingHighlights({ LotSizeAcres: 0.25 })
    const tag = result.featureTags.find((t) => t.includes('sq ft lot'))
    expect(tag).toBeDefined()
  })

  it('generates garage tag with count', () => {
    const result = buildListingHighlights({ GarageSpaces: 2 })
    expect(result.featureTags).toContain('2-car garage')
  })

  it('generates garage tag without count when non-numeric', () => {
    const result = buildListingHighlights({ AttachedGarageYN: 'Yes' })
    expect(result.featureTags).toContain('Garage')
  })

  it('skips garage when value is "No" or "0"', () => {
    const result1 = buildListingHighlights({ GarageSpaces: 0 })
    expect(result1.featureTags.filter((t) => t.includes('arage'))).toHaveLength(0)

    const result2 = buildListingHighlights({ AttachedGarageYN: 'No' })
    expect(result2.featureTags.filter((t) => t.includes('arage'))).toHaveLength(0)
  })

  it('generates subdivision community tag', () => {
    const result = buildListingHighlights({ SubdivisionName: 'Northwest Crossing' })
    expect(result.featureTags).toContain('Northwest Crossing community')
  })

  it('generates sqft tag', () => {
    const result = buildListingHighlights({ BuildingAreaTotal: 2500 })
    expect(result.featureTags).toContain('2,500 sq ft')
  })

  it('generates year built tag', () => {
    const result = buildListingHighlights({ YearBuilt: 2020 })
    expect(result.featureTags).toContain('Built 2020')
  })

  it('limits feature tags to 5', () => {
    const result = buildListingHighlights({
      LotSizeAcres: 1,
      GarageSpaces: 2,
      SubdivisionName: 'Test',
      BuildingAreaTotal: 2000,
      YearBuilt: 2020,
      // Even with all fields, should cap at 5
    })
    expect(result.featureTags.length).toBeLessThanOrEqual(5)
  })

  it('handles all empty/null fields', () => {
    const result = buildListingHighlights({
      LotSizeAcres: null,
      GarageSpaces: null,
      SubdivisionName: '',
      BuildingAreaTotal: null,
      YearBuilt: null,
    })
    expect(result.featureTags).toHaveLength(0)
  })
})
