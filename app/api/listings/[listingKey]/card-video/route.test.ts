/**
 * GET /api/listings/[listingKey]/card-video — the dial's per-card reel.
 *
 * 1. A listing with a reel answers the reel, CDN-cacheable.
 * 2. A listing without one answers { video: null }, also cacheable (a fact).
 * 3. A failed read answers 503 no-store: an outage is never pinned as "no video".
 * 4. A key that is not a listing key never reaches the DAL.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

const getListingCardVideo = vi.fn()

vi.mock('@/lib/data', () => ({
  getListingCardVideo: (key: string) => getListingCardVideo(key),
  LISTING_CARD_VIDEO_KEY: /^[A-Za-z0-9_-]{1,64}$/,
}))

import { GET } from './route'

function call(key: string) {
  return GET(new Request(`http://localhost/api/listings/${encodeURIComponent(key)}/card-video`), {
    params: Promise.resolve({ listingKey: key }),
  })
}

const REEL = {
  kind: 'vimeo',
  embedType: 'iframe',
  url: 'https://player.vimeo.com/video/908396663?h=832cb5cb15',
  posterUrl: null,
}

describe('GET /api/listings/[listingKey]/card-video', () => {
  beforeEach(() => getListingCardVideo.mockReset())

  it('answers the reel for one listing, cacheable at the edge', async () => {
    getListingCardVideo.mockResolvedValue({ video: REEL, degraded: false })
    const res = await call('20260414182228939907000000')
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ video: REEL })
    expect(res.headers.get('cache-control')).toMatch(/s-maxage=3600/)
    expect(getListingCardVideo).toHaveBeenCalledWith('20260414182228939907000000')
  })

  it('answers null for a listing without a playable reel, and that is cacheable', async () => {
    getListingCardVideo.mockResolvedValue({ video: null, degraded: false })
    const res = await call('220226183')
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ video: null })
    expect(res.headers.get('cache-control')).toMatch(/s-maxage=/)
  })

  it('never lets the edge pin an empty from a failed read', async () => {
    getListingCardVideo.mockResolvedValue({ video: null, degraded: true })
    const res = await call('220226183')
    expect(res.status).toBe(503)
    expect(res.headers.get('cache-control')).toBe('no-store')
  })

  it('refuses a key that is not a listing key without touching the DAL', async () => {
    const res = await call('../../etc/passwd')
    expect(res.status).toBe(400)
    expect(getListingCardVideo).not.toHaveBeenCalled()
  })
})
