/**
 * pickLibraryPhotos — the rule that decides which library frames a place page
 * may show of itself: approved, tagged, graded A/B, captioned, unwatermarked,
 * A before B, one frame per scene, credit only when the frame is not ours.
 */
import { describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

const { pickLibraryPhotos } = await import('./place-photos')

const base = {
  type: 'photo',
  approval: 'approved',
  geo_tags: ['tetherow'],
  file_url: 'https://x/storage/a.jpg',
  license: 'owned',
  vision_quality: 'B',
  vision_caption: 'A fairway at dusk',
  vision_scene: 'golf',
  vision_watermark: false,
}

describe('pickLibraryPhotos', () => {
  it('keeps only approved, tagged, graded, captioned, unwatermarked photographs (never a generated still)', () => {
    const out = pickLibraryPhotos(
      [
        base,
        { ...base, file_url: 'https://x/b.jpg', approval: 'intake', vision_scene: 'b' },
        { ...base, file_url: 'https://x/c.jpg', geo_tags: ['bend'], vision_scene: 'c' },
        { ...base, file_url: 'https://x/d.jpg', vision_quality: null, vision_scene: 'd' },
        { ...base, file_url: 'https://x/e.jpg', vision_quality: 'C', vision_scene: 'e' },
        { ...base, file_url: 'https://x/f.jpg', vision_caption: '  ', vision_scene: 'f' },
        { ...base, file_url: 'https://x/g.jpg', vision_watermark: true, vision_scene: 'g' },
        { ...base, file_url: 'https://x/h.jpg', type: 'video', vision_scene: 'h' },
        { ...base, file_url: 'https://x/i.jpg', source: 'grok-imagine', vision_scene: 'i' },
      ],
      'tetherow',
    )
    expect(out.map((p) => p.src)).toEqual(['https://x/storage/a.jpg'])
  })

  it('puts A frames before B and shows one frame per scene', () => {
    const out = pickLibraryPhotos(
      [
        { ...base, file_url: 'https://x/b1.jpg', vision_quality: 'B', vision_scene: 'entrance-sign' },
        { ...base, file_url: 'https://x/a1.jpg', vision_quality: 'A', vision_scene: 'aerial-golf' },
        { ...base, file_url: 'https://x/b2.jpg', vision_quality: 'B', vision_scene: 'entrance-sign' },
        { ...base, file_url: 'https://x/b3.jpg', vision_quality: 'B', vision_scene: null },
      ],
      'tetherow',
    )
    expect(out.map((p) => p.src)).toEqual(['https://x/a1.jpg', 'https://x/b1.jpg', 'https://x/b3.jpg'])
  })

  it('uses the caption as alt and credits only a frame that is not ours', () => {
    const out = pickLibraryPhotos(
      [
        base,
        { ...base, file_url: 'https://x/p.jpg', license: 'pexels', creator: 'Jane Doe', vision_scene: 'lake' },
      ],
      'tetherow',
    )
    expect(out[0]).toEqual({ src: 'https://x/storage/a.jpg', alt: 'A fairway at dusk', credit: null })
    expect(out[1]!.credit).toBe('Jane Doe')
  })
})
