/**
 * The video freeze at the Today Imagine produce door (Matt 2026-10-14). The
 * listing branch makes an image-to-video clip, so it is refused; the GBP
 * branch makes a still and is not. imagine-produce.test.ts covers the
 * pipeline itself with the freeze lifted.
 */
import { describe, expect, it, vi } from 'vitest'
import { produceImagineDraft, type ImagineProduceAdapters } from './imagine-produce'
import { VIDEO_FREEZE_MESSAGE } from '@/lib/content/video-freeze'
import type { MarketPulse } from '@/lib/data/types/market'

const PULSE: MarketPulse = {
  geoType: 'region',
  geoSlug: 'central-oregon',
  activeCount: 412,
  medianListPrice: 625000,
  newThisWeek: 18,
  priceDropsThisWeek: 12,
  closedLast30Days: 88,
  monthsOfSupply: 4.2,
  medianDaysToPending: 21,
  refreshedAt: '2026-08-13T00:00:00.000Z',
}

const STORED_JPG = 'https://x.supabase.co/storage/v1/object/public/banners/imagine-drafts/draft-2/still.jpg'

function adapters(): ImagineProduceAdapters {
  return {
    generateImageToVideo: vi.fn(async () => 'https://api.x.ai/tmp/fake.mp4'),
    generateBannerImage: vi.fn(async () => Buffer.from('jpeg')),
    downloadUrl: vi.fn(async () => Buffer.from('mp4-bytes')),
    storeMedia: vi.fn(async () => ({ ok: true as const, url: STORED_JPG })),
    findLiveListing: vi.fn(async () => ({
      listingKey: 'abc-key',
      listNumber: '220189422',
      address: '1844 NW Awbrey Rd',
      city: 'Bend',
      listPrice: 895000,
      photoUrl: 'https://cdn.example.com/mls/1844.jpg',
      bedrooms: 3,
      bathrooms: 2,
    })),
    getPulse: vi.fn(async () => PULSE),
    insertPending: vi.fn(async () => ({ ok: true as const, id: 'draft-2' })),
    markReady: vi.fn(async () => ({ ok: true as const })),
    killDraft: vi.fn(async () => ({ ok: true as const })),
  }
}

const who = { brokerSlug: 'matt', requestedBy: 'matt@ryan-realty.com' }

describe('produceImagineDraft under the video freeze', () => {
  it('refuses the listing clip before a listing lookup, a row, or an Imagine call', async () => {
    const a = adapters()
    const result = await produceImagineDraft({ kind: 'listing', query: '220189422', ...who }, a)
    expect(result).toEqual({ ok: false, error: VIDEO_FREEZE_MESSAGE })
    expect(a.findLiveListing).not.toHaveBeenCalled()
    expect(a.insertPending).not.toHaveBeenCalled()
    expect(a.generateImageToVideo).not.toHaveBeenCalled()
  })

  it('still produces the GBP still', async () => {
    const a = adapters()
    const result = await produceImagineDraft({ kind: 'gbp', ...who }, a)
    expect(result.ok).toBe(true)
    expect(a.generateBannerImage).toHaveBeenCalled()
    const payload = vi.mocked(a.markReady).mock.calls[0][0].executorResponse.publish_payload as Record<string, unknown>
    expect(payload.mediaType).toBe('image')
  })
})
