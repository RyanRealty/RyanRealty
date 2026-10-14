import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { CommunityFoldAnswer } from './CommunityFoldAnswer'
import { CommunityHomesGrid } from './CommunityHomesGrid'
import { communityFoldAnswer } from './community-fold-answer'

const TETHEROW = {
  place: 'Tetherow',
  asOfLabel: 'Oct 13, 2026',
  active: 16,
  medianList: 2_372_500,
  medianSale12: 2_257_500,
  daysToContract: 51,
  daysToContractWindow: '90 days' as const,
}

describe('CommunityFoldAnswer render', () => {
  it('prints live figures and the Oregon Data Share citation', () => {
    const html = renderToStaticMarkup(
      createElement(CommunityFoldAnswer, { answer: communityFoldAnswer(TETHEROW) }),
    )
    expect(html).toContain('id="answer"')
    expect(html).toContain('16')
    expect(html).toContain('$2,372,500')
    expect(html).toContain('$2,257,500')
    expect(html).toContain('51')
    expect(html).toContain('Oregon Data Share MLS, as of Oct 13, 2026')
    expect(html).not.toMatch(/\$0\b/)
  })

  it('renders the no-figure fallback without a digit or a false citation', () => {
    const html = renderToStaticMarkup(
      createElement(CommunityFoldAnswer, {
        answer: communityFoldAnswer({
          place: 'Tetherow',
          asOfLabel: 'Oct 13, 2026',
          active: null,
          medianList: null,
          medianSale12: null,
          daysToContract: null,
          daysToContractWindow: null,
        }),
      }),
    )
    expect(html).toContain('did not load')
    expect(html).not.toMatch(/\$0|0 homes|0 days/)
    expect(html).not.toContain('Oregon Data Share')
    expect(html).not.toContain('$0')
  })
})

describe('CommunityHomesGrid fallback', () => {
  it('renders nothing when every row is empty or not for sale', () => {
    expect(
      renderToStaticMarkup(createElement(CommunityHomesGrid, { placeName: 'Tetherow', homes: [] })),
    ).toBe('')
    expect(
      renderToStaticMarkup(
        createElement(CommunityHomesGrid, {
          placeName: 'Tetherow',
          homes: [
            {
              listingKey: 'pending-only',
              href: '/homes-for-sale/listing/1',
              price: 1_200_000,
              addressLine: '1 Fairway Dr',
              cityLine: 'Bend, OR',
              beds: 3,
              baths: 2,
              sqft: 2000,
              propertyType: 'A',
              propertySubType: 'Single Family Residence',
              subdivisionName: 'Tetherow',
              city: 'Bend',
              listNumber: '22000001',
              standardStatus: 'Pending',
            },
          ],
        }),
      ),
    ).toBe('')
  })
})
