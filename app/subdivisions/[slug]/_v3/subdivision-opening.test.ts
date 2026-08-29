import { describe, expect, it } from 'vitest'
import { subdivisionHeadline, subdivisionStagePoster } from './subdivision-opening'

describe('subdivisionStagePoster', () => {
  it('prefers an Imagine place still over a live crop', () => {
    expect(
      subdivisionStagePoster(
        'https://cdn.example/ridge-street.jpg',
        'https://cdn.example/photos/grok-imagine/imagine-place-eagle-crest.png',
        'eagle-crest',
      ),
    ).toBe('https://cdn.example/photos/grok-imagine/imagine-place-eagle-crest.png')
  })

  it('refuses Unsplash, Google pixels, and plat outlines', () => {
    expect(subdivisionStagePoster('https://images.unsplash.com/photo-123', null, null)).toBeNull()
    expect(
      subdivisionStagePoster('https://maps.googleapis.com/maps/api/staticmap?x=1', null, null),
    ).toBeNull()
    expect(
      subdivisionStagePoster('https://cdn.example/ridge-at-eagle-crest-plat-outline.png', null, null),
    ).toBeNull()
  })

  it('falls back to the owned Eagle Crest course still', () => {
    expect(subdivisionStagePoster(null, null, 'eagle-crest')).toBe(
      '/lp/central-oregon-golf/img/eagle-crest-01.jpg',
    )
  })
})

describe('subdivisionHeadline', () => {
  it('keeps the find-a-home H1', () => {
    expect(subdivisionHeadline('Ridge At Eagle Crest')).toBe(
      'Homes for sale in Ridge At Eagle Crest',
    )
  })
})
