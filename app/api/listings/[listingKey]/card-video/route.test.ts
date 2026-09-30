/**
 * GET /api/listings/[listingKey]/card-video (SITE-194).
 *
 * 1. The body is the DAL's answer: the card reel or null.
 * 2. A found answer is CDN-cacheable (s-maxage); a failed read is not
 *    (no-store), so an empty fallback never pins at the edge.
 * 3. A blank key is a 400.
 */
import { describe, expect, it, vi } from 'vitest'

const getListingCardVideo = vi.fn()
vi.mock('@/lib/data', () => ({ getListingCardVideo: (key: string) => getListingCardVideo(key) }))

import { GET } from './route'

const params = (listingKey: string) => ({ params: Promise.resolve({ listingKey }) })

describe('GET /api/listings/[listingKey]/card-video', () => {
  it('returns the reel the DAL resolved, CDN-cached', async () => {
    getListingCardVideo.mockResolvedValueOnce({
      listingKey: '20240001',
      reel: { kind: 'iframe', src: 'https://www.youtube.com/embed/x?autoplay=1' },
    })
    const res = await GET(new Request('http://localhost/api/listings/20240001/card-video'), params('20240001'))
    expect(res.status).toBe(200)
    expect(res.headers.get('cache-control')).toContain('s-maxage=600')
    expect(await res.json()).toEqual({
      listingKey: '20240001',
      reel: { kind: 'iframe', src: 'https://www.youtube.com/embed/x?autoplay=1' },
    })
    expect(getListingCardVideo).toHaveBeenCalledWith('20240001')
  })

  it('a listing with no reel answers null, still cacheable', async () => {
    getListingCardVideo.mockResolvedValueOnce({ listingKey: '20240002', reel: null })
    const res = await GET(new Request('http://localhost/x'), params('20240002'))
    expect(await res.json()).toEqual({ listingKey: '20240002', reel: null })
    expect(res.headers.get('cache-control')).toContain('s-maxage=600')
  })

  it('a failed read is served once and never cached', async () => {
    getListingCardVideo.mockRejectedValueOnce(new Error('statement timeout'))
    const res = await GET(new Request('http://localhost/x'), params('20240003'))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ listingKey: '20240003', reel: null })
    expect(res.headers.get('cache-control')).toBe('no-store')
  })

  it('a blank key is a 400', async () => {
    const res = await GET(new Request('http://localhost/x'), params('  '))
    expect(res.status).toBe(400)
  })
})
