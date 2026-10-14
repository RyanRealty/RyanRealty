/**
 * /api/social/publish under the video freeze (Matt 2026-10-14): any request
 * whose media is video, or cannot be told apart from video, is refused 423
 * Locked before a platform client is touched, whatever approval it carries.
 * An approved image post still goes out.
 */
import { NextRequest } from 'next/server'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { VIDEO_FREEZE_MESSAGE } from '@/lib/content/video-freeze'

const platform = vi.hoisted(() => ({
  publishImage: vi.fn(async () => 'ig-image-1'),
  publishReel: vi.fn(async () => 'ig-reel-1'),
  publishFacebookPost: vi.fn(async () => 'fb-post-1'),
  publishFacebookPhoto: vi.fn(async () => 'fb-photo-1'),
  publishFacebookReel: vi.fn(async () => 'fb-reel-1'),
  directPostVideo: vi.fn(async () => ({ publishId: 'tt-1' })),
  uploadYouTubeVideoFromUrl: vi.fn(async () => 'yt-1'),
  publishLinkedInVideoFromUrl: vi.fn(async () => 'li-1'),
  uploadVideoToX: vi.fn(async () => 'x-media-1'),
  postXTweet: vi.fn(async () => 'x-1'),
  createPinterestVideoPin: vi.fn(async () => 'pin-1'),
  publishThreadsVideo: vi.fn(async () => 'th-1'),
  publishNextdoorPost: vi.fn(async () => 'nd-1'),
  publishGoogleBusinessLocalPost: vi.fn(async () => 'gbp-1'),
}))

vi.mock('@/lib/meta-env', () => ({ getMetaPageToken: () => 'page-token' }))
vi.mock('@/lib/meta-graph', () => ({
  publishImage: platform.publishImage,
  publishReel: platform.publishReel,
  publishFacebookPost: platform.publishFacebookPost,
  publishFacebookPhoto: platform.publishFacebookPhoto,
  publishFacebookReel: platform.publishFacebookReel,
}))
vi.mock('@/lib/tiktok', () => ({ directPostVideo: platform.directPostVideo, refreshAccessToken: vi.fn() }))
vi.mock('@/lib/youtube', () => ({
  getYouTubeAccessToken: vi.fn(async () => 'yt-token'),
  uploadYouTubeVideoFromUrl: platform.uploadYouTubeVideoFromUrl,
}))
vi.mock('@/lib/linkedin', () => ({
  getLinkedInAccessToken: vi.fn(async () => 'li-token'),
  getLinkedInPersonId: () => 'person',
  publishLinkedInVideoFromUrl: platform.publishLinkedInVideoFromUrl,
}))
vi.mock('@/lib/google-business-profile', () => ({
  getOrRefreshGoogleBusinessProfileAccessToken: vi.fn(async () => 'gbp-token'),
  publishGoogleBusinessLocalPost: platform.publishGoogleBusinessLocalPost,
}))
vi.mock('@/lib/x', () => ({
  getXAccessToken: vi.fn(async () => 'x-token'),
  uploadVideoToX: platform.uploadVideoToX,
  postXTweet: platform.postXTweet,
}))
vi.mock('@/lib/pinterest', () => ({
  getPinterestAccessToken: vi.fn(async () => 'pin-token'),
  getDefaultPinterestBoardId: vi.fn(async () => 'board'),
  createPinterestVideoPin: platform.createPinterestVideoPin,
}))
vi.mock('@/lib/threads', () => ({
  getThreadsAccessToken: vi.fn(async () => ({ accessToken: 'th-token', userId: 'u' })),
  publishThreadsVideo: platform.publishThreadsVideo,
}))
vi.mock('@/lib/nextdoor', () => ({ publishNextdoorPost: platform.publishNextdoorPost }))
vi.mock('@supabase/supabase-js', () => ({
  createClient: () => {
    throw new Error('unit test: no database')
  },
}))

const SECRET = 'unit-test-cron-secret'
let POST: (request: NextRequest) => Promise<Response>

beforeAll(async () => {
  // The route reads CRON_SECRET when the module loads.
  vi.stubEnv('CRON_SECRET', SECRET)
  vi.stubEnv('META_IG_BUSINESS_ACCOUNT_ID', 'ig-account')
  vi.stubEnv('META_FB_PAGE_ID', 'fb-page')
  ;({ POST } = await import('./route'))
})

afterAll(() => {
  vi.unstubAllEnvs()
})

beforeEach(() => {
  for (const fn of Object.values(platform)) fn.mockClear()
})

const gate = () => ({
  scorecardPath: 'out/scorecard.json',
  citationsPath: 'out/citations.json',
  qaReportPath: 'out/qa_report.md',
  postflightPath: 'out/postflight.json',
  manifestoPath: 'ANTI_SLOP_MANIFESTO.md',
  humanApprovedAt: new Date().toISOString(),
  formatSkillName: 'unit_test',
})

function publish(body: Record<string, unknown>, secret = SECRET) {
  return POST(
    new NextRequest('https://ryan-realty.com/api/social/publish', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-cron-secret': secret },
      body: JSON.stringify(body),
    }),
  )
}

const noPlatformCalled = () => {
  for (const fn of Object.values(platform)) expect(fn).not.toHaveBeenCalled()
}

describe('POST /api/social/publish under the video freeze', () => {
  it('refuses an approved reel with 423 Locked and touches no platform', async () => {
    const res = await publish({
      approved: true,
      platforms: ['instagram', 'facebook', 'tiktok', 'youtube'],
      mediaType: 'reel',
      mediaUrl: 'https://cdn.test/studio/d1/final.mp4',
      captionDefault: 'A film.',
      gate: gate(),
    })
    expect(res.status).toBe(423)
    expect(await res.json()).toEqual({ error: VIDEO_FREEZE_MESSAGE })
    noPlatformCalled()
  })

  it('refuses mediaType video, and an "image" whose file is an mp4', async () => {
    for (const body of [
      { mediaType: 'video', mediaUrl: 'https://cdn.test/a/clip.mp4' },
      { mediaType: 'image', mediaUrl: 'https://cdn.test/a/clip.mp4' },
    ]) {
      const res = await publish({ approved: true, platforms: ['instagram'], captionDefault: 'x', gate: gate(), ...body })
      expect(res.status).toBe(423)
    }
    noPlatformCalled()
  })

  it('fails closed: no media type and no file extension is refused', async () => {
    const res = await publish({
      approved: true,
      platforms: ['instagram'],
      mediaUrl: 'https://cdn.test/a/asset',
      captionDefault: 'x',
      gate: gate(),
    })
    expect(res.status).toBe(423)
    noPlatformCalled()
  })

  it('still rejects a caller without the secret before anything else', async () => {
    const res = await publish({ approved: true, platforms: ['instagram'], mediaType: 'reel', mediaUrl: 'https://x/a.mp4' }, 'wrong')
    expect(res.status).toBe(401)
  })

  it('still publishes an approved image post', async () => {
    const res = await publish({
      approved: true,
      platforms: ['instagram'],
      mediaType: 'image',
      mediaUrl: 'https://cdn.test/studio/d2/hero.jpg',
      captionDefault: 'Bend this week.',
      gate: gate(),
    })
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.success).toBe(true)
    expect(json.results.instagram).toMatchObject({ success: true, externalPostId: 'ig-image-1' })
    expect(platform.publishImage).toHaveBeenCalledTimes(1)
    expect(platform.publishReel).not.toHaveBeenCalled()
  })
})
