import { describe, expect, it } from 'vitest'
import { pickSurfaceImage, type SurfaceImage } from './getSurfaceImages'

const pool: SurfaceImage[] = [
  { url: 'https://cdn.example/bend.jpg', geoTags: ['bend', 'central-oregon'], subjectTags: [] },
  { url: 'https://cdn.example/awbrey.jpg', geoTags: ['awbrey-butte', 'bend', 'central-oregon'], subjectTags: [] },
  { url: 'https://cdn.example/redmond.jpg', geoTags: ['redmond'], subjectTags: [] },
  { url: 'https://cdn.example/region.jpg', geoTags: ['central-oregon'], subjectTags: [] },
]

describe('pickSurfaceImage', () => {
  it('falls back to a regional then any photo when geoOnly is off', () => {
    const regionalOnly: SurfaceImage[] = [
      { url: 'https://cdn.example/region.jpg', geoTags: ['central-oregon'], subjectTags: [] },
      { url: 'https://cdn.example/redmond.jpg', geoTags: ['redmond'], subjectTags: [] },
    ]
    expect(
      pickSurfaceImage(regionalOnly, { geoTags: ['sisters'], seed: 'city:sisters', fallback: '/fallback.jpg' }),
    ).toBe('https://cdn.example/region.jpg')
  })

  it('never clones another place when geoOnly is on', () => {
    expect(
      pickSurfaceImage(pool, {
        geoTags: ['sisters'],
        seed: 'city:sisters',
        fallback: null,
        geoOnly: true,
      }),
    ).toBeNull()
    expect(
      pickSurfaceImage(pool, {
        geoTags: ['bend'],
        seed: 'city:bend',
        geoOnly: true,
      }),
    ).toBe('https://cdn.example/bend.jpg')
  })

  it('prefers the exact place still over a child-place photo that also carries the city tag', () => {
    expect(
      pickSurfaceImage(pool, {
        geoTags: ['bend'],
        seed: 'city:bend',
        geoOnly: true,
      }),
    ).toBe('https://cdn.example/bend.jpg')
  })
})
