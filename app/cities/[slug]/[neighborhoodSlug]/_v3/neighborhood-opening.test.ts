import { describe, expect, it } from 'vitest'
import { neighborhoodStagePoster } from './neighborhood-opening'

describe('neighborhoodStagePoster', () => {
  it('prefers an Imagine place still over a live crop', () => {
    expect(
      neighborhoodStagePoster(
        'https://cdn.example/awbrey-street.jpg',
        'https://cdn.example/photos/grok-imagine/imagine-place-awbrey-butte.png',
      ),
    ).toBe('https://cdn.example/photos/grok-imagine/imagine-place-awbrey-butte.png')
  })

  it('refuses Unsplash, Google pixels, and plat outlines', () => {
    expect(
      neighborhoodStagePoster('https://images.unsplash.com/photo-123', null),
    ).toBeNull()
    expect(
      neighborhoodStagePoster('https://maps.googleapis.com/maps/api/staticmap?x=1', null),
    ).toBeNull()
    expect(
      neighborhoodStagePoster('https://cdn.example/awbrey-butte-plat-outline.png', null),
    ).toBeNull()
  })
})
