import { describe, expect, it } from 'vitest'
import { cityStagePoster } from './city-opening'

describe('cityStagePoster', () => {
  it('lets the live place row win, then the geo-strict library still', () => {
    expect(cityStagePoster('https://cdn.example/live.jpg', 'https://cdn.example/library.jpg')).toBe(
      'https://cdn.example/live.jpg',
    )
    expect(cityStagePoster(null, 'https://cdn.example/library.jpg')).toBe('https://cdn.example/library.jpg')
    expect(cityStagePoster(null, null)).toBeNull()
    expect(cityStagePoster('  ', '')).toBeNull()
  })

  it('uses the registered Imagine place still over a leftover live crop', () => {
    expect(
      cityStagePoster(
        'https://cdn.example/monument-crop.jpg',
        'https://cdn.example/imagine-place-city-redmond.png',
      ),
    ).toBe('https://cdn.example/imagine-place-city-redmond.png')
    expect(
      cityStagePoster('https://cdn.example/photos/grok-imagine/imagine-place-city-bend.png', null),
    ).toBe('https://cdn.example/photos/grok-imagine/imagine-place-city-bend.png')
  })
})
