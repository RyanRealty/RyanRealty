import { describe, expect, it } from 'vitest'
import {
  VIDEO_FREEZE_MESSAGE,
  VIDEO_PUBLISH_FROZEN,
  isVideoMedia,
  rowMediaFacts,
  rowVideoFreezeRefusal,
  splitVideoFrozen,
  videoFreezeRefusal,
} from './video-freeze'

const STUDIO_MP4 = 'https://x.supabase.co/storage/v1/object/public/banners/studio/d1/final.mp4'
const STUDIO_JPG = 'https://x.supabase.co/storage/v1/object/public/banners/studio/d2/hero.jpg'

describe('video freeze switch and message', () => {
  it('is on, with Matt’s wording', () => {
    expect(VIDEO_PUBLISH_FROZEN).toBe(true)
    expect(VIDEO_FREEZE_MESSAGE).toBe(
      'Video publishing is frozen until the content process is live (Matt 2026-10-14). Videos go through the content process (docs/plans/STUDIO_ONE_FACTORY.md) and need a server-signed certificate.',
    )
  })
})

describe('isVideoMedia', () => {
  it('reads the publish route media types', () => {
    expect(isVideoMedia({ mediaType: 'video' })).toBe(true)
    expect(isVideoMedia({ mediaType: 'reel' })).toBe(true)
    expect(isVideoMedia({ mediaType: 'REEL' })).toBe(true)
    expect(isVideoMedia({ mediaType: 'image' })).toBe(false)
  })

  it('reads the studio media kind and format media', () => {
    expect(isVideoMedia({ kind: 'video' })).toBe(true)
    expect(isVideoMedia({ kind: 'image' })).toBe(false)
  })

  it('reads a video file extension even past a query string', () => {
    expect(isVideoMedia({ url: STUDIO_MP4 })).toBe(true)
    expect(isVideoMedia({ url: `${STUDIO_MP4}?token=abc` })).toBe(true)
    expect(isVideoMedia({ url: 'https://cdn.test/a/clip.MOV' })).toBe(true)
    expect(isVideoMedia({ url: STUDIO_JPG })).toBe(false)
  })

  it('reads MIME types', () => {
    expect(isVideoMedia({ mimeType: 'video/mp4' })).toBe(true)
    expect(isVideoMedia({ mimeType: 'application/vnd.apple.mpegurl' })).toBe(true)
    expect(isVideoMedia({ mimeType: 'image/jpeg' })).toBe(false)
  })

  it('a video signal beats an image signal: an "image" whose file is an mp4 is video', () => {
    expect(isVideoMedia({ mediaType: 'image', url: STUDIO_MP4 })).toBe(true)
    expect(isVideoMedia({ kind: 'image', format: 'content:listing_video' })).toBe(true)
  })

  it('a format name only ever adds a video signal', () => {
    expect(isVideoMedia({ mediaType: 'image', format: 'listing_film' })).toBe(true)
    expect(isVideoMedia({ mediaType: 'image', format: 'trend_reactive' })).toBe(false)
    expect(isVideoMedia({ mediaType: 'image', format: 'blog_market_update' })).toBe(false)
  })

  it('fails closed: unknown media is video', () => {
    expect(isVideoMedia({})).toBe(true)
    expect(isVideoMedia({ mediaType: undefined, url: 'https://cdn.test/asset/abc123' })).toBe(true)
    expect(isVideoMedia({ mediaType: 'carousel' })).toBe(true)
    expect(isVideoMedia({ mediaType: '', url: '' })).toBe(true)
    expect(isVideoMedia({ mediaType: 42 as unknown, url: null })).toBe(true)
  })

  it('an image with an extensionless URL is still an image when its type says so', () => {
    expect(isVideoMedia({ mediaType: 'image', url: 'https://images.test/photo-123?w=1080' })).toBe(false)
  })

  it('takes lists: any video item makes the set video', () => {
    expect(isVideoMedia({ url: [STUDIO_JPG, STUDIO_MP4] })).toBe(true)
    expect(isVideoMedia({ url: [STUDIO_JPG, 'https://cdn.test/b.png'] })).toBe(false)
  })
})

describe('videoFreezeRefusal', () => {
  it('refuses video and unknown media with the message, and passes an image', () => {
    expect(videoFreezeRefusal({ mediaType: 'reel', url: STUDIO_MP4 })).toBe(VIDEO_FREEZE_MESSAGE)
    expect(videoFreezeRefusal({})).toBe(VIDEO_FREEZE_MESSAGE)
    expect(videoFreezeRefusal({ mediaType: 'image', url: STUDIO_JPG })).toBeNull()
  })
})

describe('rowVideoFreezeRefusal (approve doors)', () => {
  const studioVideo = {
    action_type: 'place_map',
    format: 'place_map',
    executor_response: {
      media: { kind: 'video', url: STUDIO_MP4 },
      publish_payload: { mediaType: 'reel', mediaUrl: STUDIO_MP4, contentType: 'place_map' },
    },
  }
  const studioImage = {
    action_type: 'trend_reactive',
    format: 'trend_reactive',
    executor_response: {
      media: { kind: 'image', url: STUDIO_JPG },
      publish_payload: { mediaType: 'image', mediaUrl: STUDIO_JPG, contentType: 'trend_reactive' },
    },
  }

  it('refuses a studio video draft and passes a studio image draft', () => {
    expect(rowVideoFreezeRefusal(studioVideo)).toBe(VIDEO_FREEZE_MESSAGE)
    expect(rowVideoFreezeRefusal(studioImage)).toBeNull()
  })

  it('refuses an Imagine listing reel (media_type on the executor response)', () => {
    expect(
      rowVideoFreezeRefusal({
        action_type: 'content:imagine_listing',
        executor_response: { media_type: 'video', publish_payload: { mediaType: 'reel', mediaUrl: 'https://x/clip.mp4' } },
      }),
    ).toBe(VIDEO_FREEZE_MESSAGE)
  })

  it('fails closed on a row that carries media nobody can classify', () => {
    expect(
      rowVideoFreezeRefusal({
        action_type: 'content:ig_post',
        executor_response: { publish_payload: { mediaUrl: 'https://cdn.test/asset/abc123' } },
      }),
    ).toBe(VIDEO_FREEZE_MESSAGE)
  })

  it('does not freeze a row that posts nothing (a CMA, a blog post, an ops row)', () => {
    expect(rowVideoFreezeRefusal({ action_type: 'content:cma', executor_response: null })).toBeNull()
    expect(
      rowVideoFreezeRefusal({ action_type: 'ops:meta_budget', executor_response: { publish_payload: { platforms: [] } } }),
    ).toBeNull()
    expect(rowVideoFreezeRefusal({})).toBeNull()
  })

  it('freezes a no-media row whose name says video', () => {
    expect(rowVideoFreezeRefusal({ action_type: 'content:listing_video', executor_response: {} })).toBe(VIDEO_FREEZE_MESSAGE)
  })

  it('rowMediaFacts reads the publish payload, the media record, and the names', () => {
    expect(rowMediaFacts(studioVideo)).toEqual({
      mediaType: 'reel',
      kind: ['video', undefined],
      url: [STUDIO_MP4, STUDIO_MP4],
      format: ['place_map', 'place_map', 'place_map'],
    })
  })

  it('splitVideoFrozen keeps the image rows and holds the video and unknown ones', () => {
    const unknown = { action_type: 'x', executor_response: { publish_payload: { mediaUrl: 'https://cdn.test/a' } } }
    const cma = { action_type: 'content:cma', executor_response: null }
    const { allowed, frozen } = splitVideoFrozen([studioVideo, studioImage, unknown, cma])
    expect(allowed).toEqual([studioImage, cma])
    expect(frozen).toEqual([studioVideo, unknown])
  })
})
