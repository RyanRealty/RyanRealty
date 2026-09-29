import { describe, expect, it } from 'vitest'
import { classifyCmaLink } from './link-kind'

const SLUG = 'cma-2465-7th-st'

describe('classifyCmaLink', () => {
  it('names the document itself as the report', () => {
    expect(classifyCmaLink(`https://ryan-realty.com/cma/${SLUG}?utm_campaign=${SLUG}`, SLUG)).toEqual({
      kind: 'letter',
      label: 'report',
    })
    expect(classifyCmaLink(`/cma/${SLUG}`, SLUG).kind).toBe('letter')
  })

  it('names a subdivision or city page as the area', () => {
    expect(classifyCmaLink('https://ryan-realty.com/subdivisions/diamond-bar-ranch', SLUG)).toEqual({
      kind: 'area',
      label: 'Diamond Bar Ranch',
    })
    expect(classifyCmaLink('https://ryan-realty.com/cities/redmond?utm_source=cma', SLUG)).toEqual({
      kind: 'area',
      label: 'Redmond',
    })
    expect(classifyCmaLink('/communities/sunriver', SLUG)).toEqual({
      kind: 'area',
      label: 'Sunriver',
    })
  })

  it('reads a listing path back as its address, MLS tail dropped', () => {
    expect(
      classifyCmaLink(
        'https://ryan-realty.com/homes-for-sale/bend/newport-gardens/1299-ogden-220225388',
        SLUG,
      ),
    ).toEqual({ kind: 'listing', label: '1299 Ogden' })
  })

  it('classifies book, reviews and about', () => {
    expect(classifyCmaLink('https://ryan-realty.com/book', SLUG)).toEqual({ kind: 'book', label: 'book' })
    expect(classifyCmaLink('https://ryan-realty.com/reviews', SLUG)).toEqual({
      kind: 'reviews',
      label: 'reviews',
    })
    expect(classifyCmaLink('https://ryan-realty.com/about', SLUG)).toEqual({ kind: 'about', label: 'about' })
  })

  it('treats other first-party paths as site and unknown hosts as other', () => {
    expect(classifyCmaLink('https://ryan-realty.com/how-we-get-our-numbers', SLUG)).toEqual({
      kind: 'site',
      label: 'How We Get Our Numbers',
    })
    expect(classifyCmaLink('https://example.com/steal', SLUG).kind).toBe('other')
  })
})
