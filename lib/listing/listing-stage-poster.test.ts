import { describe, expect, it } from 'vitest'
import { listingStagePosterUrl } from './listing-stage-poster'

describe('listingStagePosterUrl', () => {
  it('uses the registered Imagine place still over a leftover crop', () => {
    expect(
      listingStagePosterUrl(
        'https://cdn.example/street-house.jpg',
        'https://cdn.example/imagine-place-city-redmond.png',
      ),
    ).toBe('https://cdn.example/imagine-place-city-redmond.png')
  })

  it('keeps an Imagine still when it is the only candidate', () => {
    expect(
      listingStagePosterUrl('https://cdn.example/photos/grok-imagine/imagine-place-forked-horn-butte.png'),
    ).toBe('https://cdn.example/photos/grok-imagine/imagine-place-forked-horn-butte.png')
  })

  it('falls back to a library still when no Imagine file is registered', () => {
    expect(listingStagePosterUrl(null, 'https://cdn.example/library-redmond.jpg')).toBe(
      'https://cdn.example/library-redmond.jpg',
    )
  })

  it('returns null when no place still exists', () => {
    expect(listingStagePosterUrl(null, null)).toBeNull()
    expect(listingStagePosterUrl('  ', '')).toBeNull()
  })

  it('refuses a plat outline or lime plat on Stage', () => {
    expect(
      listingStagePosterUrl(
        'https://cdn.example/awbrey-butte-plat-outline.png',
        'https://cdn.example/lime-plat-parcel.png',
      ),
    ).toBeNull()
    expect(
      listingStagePosterUrl(
        'https://cdn.example/aerial-plat-outline.jpg',
        'https://cdn.example/photos/grok-imagine/imagine-place-awbrey-butte.png',
      ),
    ).toBe('https://cdn.example/photos/grok-imagine/imagine-place-awbrey-butte.png')
  })
})
