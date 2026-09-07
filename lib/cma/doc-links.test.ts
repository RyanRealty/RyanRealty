import { describe, expect, it } from 'vitest'
import { trackedDocLink } from '@/lib/cma/doc-links'

const ctx = { brokerSlug: 'matthew-ryan', personId: 538, cmaSlug: 'cma-2465-7th-redmond-97756' }

describe('trackedDocLink', () => {
  it('builds a listing URL through the canonical builder, carrying identity', () => {
    const url = trackedDocLink(
      'listing',
      {
        listingKey: '20260608003413366966000000',
        listNumber: '220222913',
        streetNumber: '730',
        streetName: 'Quince',
        city: 'Redmond',
        subdivisionName: 'Diamond Bar Ranch',
      },
      ctx,
    )
    expect(url).toContain('https://ryan-realty.com/homes-for-sale/redmond/diamond-bar-ranch/730-quince-220222913')
    expect(url).toContain('agent=matthew-ryan')
    expect(url).toContain('_pid=538')
    expect(url).toContain('utm_source=cma')
    expect(url).toContain('utm_medium=document')
    expect(url).toContain('utm_campaign=cma-2465-7th-redmond-97756')
  })

  it('degrades a bare listing id to the still-valid form, never a 404', () => {
    expect(trackedDocLink('listing', '220222913', ctx)).toContain('/homes-for-sale/listing/220222913')
  })

  it('links the city search, the city market page, and the booking page', () => {
    expect(trackedDocLink('search', 'Redmond', ctx)).toContain('/homes-for-sale/redmond?')
    expect(trackedDocLink('market', 'Redmond', ctx)).toContain('/housing-market/redmond?')
    expect(trackedDocLink('book', '', ctx)).toContain('/book?')
  })

  it('takes a resolved place path as it is', () => {
    expect(trackedDocLink('place', '/cities/redmond/diamond-bar-ranch', ctx)).toContain(
      'https://ryan-realty.com/cities/redmond/diamond-bar-ranch?',
    )
  })

  it('still builds a usable URL with no identity to carry', () => {
    const url = trackedDocLink('book', '')
    expect(url).toBe('https://ryan-realty.com/book?utm_source=cma&utm_medium=document')
  })
})
