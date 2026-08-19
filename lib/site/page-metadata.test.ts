import { describe, expect, it } from 'vitest'
import { pageMetadata, publishPlaceHomesTitle } from './page-metadata'

describe('publishPlaceHomesTitle', () => {
  it('does not emit Central Oregon, Oregon', () => {
    expect(publishPlaceHomesTitle('8th Street Cottages', 'Central Oregon')).toBe(
      'Homes for Sale in 8th Street Cottages | Central Oregon',
    )
  })

  it('keeps a real city with Oregon', () => {
    expect(publishPlaceHomesTitle('Tetherow', 'Bend')).toBe('Homes for Sale in Tetherow | Bend, Oregon')
  })

  it('does not emit Central Oregon, Oregon from a duplicated region', () => {
    expect(publishPlaceHomesTitle('1925 Townhomes', 'Central Oregon, Oregon')).toBe(
      'Homes for Sale in 1925 Townhomes | Central Oregon',
    )
    expect(publishPlaceHomesTitle('1925 Townhomes', 'Oregon')).toBe(
      'Homes for Sale in 1925 Townhomes | Central Oregon',
    )
  })
})

describe('pageMetadata title cap', () => {
  it('does not leave a dangling comma before the brand suffix', () => {
    const meta = pageMetadata({
      title: 'Homes for Sale in 8th Street Cottages | Central Oregon, Oregon',
      description: 'Active homes in 8th Street Cottages.',
      path: '/subdivisions/8th-street-cottages',
    })
    expect(String(meta.title)).not.toMatch(/,\s*$/)
    expect(String(meta.title)).not.toContain('Oregon, Oregon')
  })
})
