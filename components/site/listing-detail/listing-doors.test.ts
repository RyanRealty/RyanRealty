import { describe, expect, it } from 'vitest'
import { buildListingDoors, listingDoorsOrNull, listingRentalEligible } from './listing-doors'

describe('buildListingDoors', () => {
  it('omits a fact rather than inventing one', () => {
    const doors = buildListingDoors({
      neighborhood: { href: '/cities/bend/tetherow', name: 'Tetherow' },
      paymentHref: '#payment',
    })
    expect(doors).toHaveLength(2)
    expect(doors[0]?.fact).toBeUndefined()
    expect(doors[1]?.href).toBe('#payment')
    expect(doors[1]?.fact).toBeUndefined()
  })

  it('prints leftover count only when leftover published it', () => {
    const doors = buildListingDoors({
      neighborhood: { href: '/cities/bend/tetherow', name: 'Tetherow', homesForSale: 12 },
      highSchool: 'Summit High',
      paymentHref: '#payment',
    })
    expect(doors[0]?.fact).toBe('12 for sale')
    expect(doors.map((d) => d.kicker)).toEqual(['Place', 'Schools', 'Payment'])
  })

  it('caps at four and de-dupes hrefs', () => {
    const doors = buildListingDoors({
      neighborhood: { href: '/cities/bend/tetherow', name: 'Tetherow', homesForSale: 8 },
      highSchool: 'Summit High',
      plat: { href: '/subdivisions/tetherow', name: 'Tetherow', documentCount: 4 },
      paymentHref: '#payment',
      rental: true,
      cma: true,
    })
    expect(doors).toHaveLength(4)
    expect(new Set(doors.map((d) => d.href)).size).toBe(4)
  })

  it('skips MLS placeholder school names', () => {
    const doors = buildListingDoors({
      neighborhood: { href: '/cities/bend', name: 'Bend' },
      elementarySchool: '***',
      paymentHref: '#payment',
    })
    expect(doors.some((d) => d.kicker === 'Schools')).toBe(false)
  })
})

describe('listingDoorsOrNull', () => {
  it('needs two doors', () => {
    expect(listingDoorsOrNull(buildListingDoors({ paymentHref: '#payment' }))).toBeNull()
    expect(
      listingDoorsOrNull(
        buildListingDoors({
          neighborhood: { href: '/cities/bend', name: 'Bend' },
          paymentHref: '#payment',
        }),
      ),
    ).not.toBeNull()
  })
})

describe('listingRentalEligible', () => {
  it('matches the listing rental withhold', () => {
    expect(
      listingRentalEligible({ propertyType: 'A', beds: 3, wholePropertyPrice: 650_000 }),
    ).toBe(true)
    expect(
      listingRentalEligible({ propertyType: 'A', beds: 3, wholePropertyPrice: 2_500_000 }),
    ).toBe(false)
    expect(
      listingRentalEligible({ propertyType: 'G', beds: 0, wholePropertyPrice: 400_000 }),
    ).toBe(false)
    expect(
      listingRentalEligible({ propertyType: 'A', beds: null, wholePropertyPrice: 400_000 }),
    ).toBe(false)
  })
})
