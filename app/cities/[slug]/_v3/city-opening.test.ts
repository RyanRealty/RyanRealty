import { describe, expect, it } from 'vitest'
import { cityStagePoster } from './city-opening'
import { cityAboutItems } from './city-sections'

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

describe('cityAboutItems', () => {
  it('prints one open paragraph, folds the rest, and states place facts as facts', () => {
    const items = cityAboutItems(
      'Bend sits east of the Cascades.\n\nA second paragraph stays under a disclosure.',
      { population: '100,000', county: 'Deschutes' },
      'Bend',
    )
    expect(items[0]).toEqual({ kind: 'prose', body: 'Bend sits east of the Cascades.' })
    expect(items[1]).toEqual({
      kind: 'fold',
      term: 'More about Bend',
      body: ['A second paragraph stays under a disclosure.'],
    })
    expect(items.slice(2)).toEqual([
      { kind: 'fact', term: 'Population', value: '100,000' },
      { kind: 'fact', term: 'County', value: 'Deschutes County' },
    ])
  })
})
