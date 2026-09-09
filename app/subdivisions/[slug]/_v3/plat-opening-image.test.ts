import { describe, expect, it } from 'vitest'
import { platListingPhoto, platOpeningPhoto } from './plat-opening-image'

const tile = (over: Partial<Parameters<typeof platListingPhoto>[0][number]> = {}) => ({
  listingKey: '1',
  photoUrl: 'https://cdn/a.jpg',
  listPrice: 500_000,
  streetNumber: '2623',
  streetName: '6th',
  streetSuffix: 'Drive',
  ...over,
})

describe('platListingPhoto', () => {
  it('is null when nothing is photographed', () => {
    expect(platListingPhoto([])).toBeNull()
    expect(platListingPhoto([tile({ photoUrl: null })])).toBeNull()
  })

  it('is null when the home cannot be named — an unnamed frame may not open a place', () => {
    expect(platListingPhoto([tile({ streetNumber: null, streetName: null, streetSuffix: null })])).toBeNull()
  })

  it('names the home in the frame', () => {
    expect(platListingPhoto([tile()])).toEqual({
      src: 'https://cdn/a.jpg',
      address: '2623 6th Drive',
    })
  })

  it('chooses the same home on every render: price first, then key', () => {
    const chosen = platListingPhoto([
      tile({ listingKey: 'b', listPrice: 400_000, streetNumber: '2' }),
      tile({ listingKey: 'a', listPrice: 900_000, streetNumber: '9' }),
      tile({ listingKey: 'c', listPrice: 900_000, streetNumber: '3' }),
    ])
    expect(chosen?.address).toBe('9 6th Drive')
  })
})

describe('platOpeningPhoto', () => {
  it('walks the ladder: own still, resort, one of its homes, its drawn ground', () => {
    const listing = { src: 'l.jpg', address: '2623 6th Drive' }
    expect(
      platOpeningPhoto({ ownPosterSrc: 'own.jpg', resortPosterSrc: 'r.jpg', resortLabel: 'Tetherow', listingPhoto: listing, groundSrc: 'g' }),
    ).toEqual({ kind: 'own', src: 'own.jpg' })
    expect(
      platOpeningPhoto({ resortPosterSrc: 'r.jpg', resortLabel: 'Tetherow', listingPhoto: listing, groundSrc: 'g' }),
    ).toEqual({ kind: 'resort', src: 'r.jpg', resortLabel: 'Tetherow' })
    expect(platOpeningPhoto({ listingPhoto: listing, groundSrc: 'g' })).toEqual({
      kind: 'listing',
      src: 'l.jpg',
      address: '2623 6th Drive',
    })
    expect(platOpeningPhoto({ groundSrc: 'g' })).toEqual({ kind: 'ground', src: 'g' })
    expect(platOpeningPhoto({})).toBeNull()
  })

  it('will not borrow a resort frame it cannot name', () => {
    expect(platOpeningPhoto({ resortPosterSrc: 'r.jpg', resortLabel: null, groundSrc: 'g' })).toEqual({
      kind: 'ground',
      src: 'g',
    })
  })
})
