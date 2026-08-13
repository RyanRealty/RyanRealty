import { readFileSync } from 'node:fs'
import { describe, expect, it, vi } from 'vitest'
import { checkBrandVoice } from '@/lib/voice/check'
import {
  gbpDraftCaption,
  isTempImagineUrl,
  listingDraftCaption,
  LISTING_I2V_PROMPT,
  produceImagineDraft,
  type ImagineProduceAdapters,
  type LiveListingForImagine,
} from './imagine-produce'
import type { MarketPulse } from '@/lib/data/types/market'

const LISTING: LiveListingForImagine = {
  listingKey: 'abc-key',
  listNumber: '220189422',
  address: '1844 NW Awbrey Rd',
  city: 'Bend',
  listPrice: 895000,
  photoUrl: 'https://cdn.example.com/mls/1844.jpg',
  bedrooms: 3,
  bathrooms: 2,
}

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

const STORED_MP4 =
  'https://dwvlophlbvvygjfxcrhm.supabase.co/storage/v1/object/public/banners/imagine-drafts/draft-1/clip.mp4'
const STORED_JPG =
  'https://dwvlophlbvvygjfxcrhm.supabase.co/storage/v1/object/public/banners/imagine-drafts/draft-2/still.jpg'

function adapters(overrides: Partial<ImagineProduceAdapters> = {}): ImagineProduceAdapters {
  return {
    generateImageToVideo: vi.fn(async () => 'https://api.x.ai/tmp/fake.mp4'),
    generateBannerImage: vi.fn(async () => Buffer.from('jpeg')),
    downloadUrl: vi.fn(async () => Buffer.from('mp4-bytes')),
    storeMedia: vi.fn(async () => ({ ok: true as const, url: STORED_MP4 })),
    findLiveListing: vi.fn(async () => LISTING),
    getPulse: vi.fn(async () => PULSE),
    insertPending: vi.fn(async () => ({ ok: true as const, id: 'draft-1' })),
    markReady: vi.fn(async () => ({ ok: true as const })),
    killDraft: vi.fn(async () => ({ ok: true as const })),
    ...overrides,
  }
}

describe('Imagine produce captions (D11)', () => {
  it('listing caption is the address and price, then stop', () => {
    const caption = listingDraftCaption(LISTING)
    expect(caption).toBe('1844 NW Awbrey Rd, Bend. Listed at $895,000.')
    expect(checkBrandVoice(caption).ok).toBe(true)
    expect(caption).not.toMatch(/[—–;!]/)
  })

  it('GBP caption uses live pulse figures and Value my home', () => {
    const caption = gbpDraftCaption(PULSE)
    expect(caption).toContain('412 active listings')
    expect(caption).toContain('$625,000')
    expect(caption).toContain('88 closed in 30 days')
    expect(caption).toContain('4.2 months of supply')
    expect(caption.endsWith('Value my home.')).toBe(true)
    expect(checkBrandVoice(caption).ok).toBe(true)
    expect(caption).not.toMatch(/[—–;!]/)
  })
})

describe('isTempImagineUrl', () => {
  it('flags xAI temp hosts and the parked zoo', () => {
    expect(isTempImagineUrl('https://api.x.ai/v1/videos/abc')).toBe(true)
    expect(isTempImagineUrl(STORED_MP4)).toBe(false)
  })
})

describe('produceImagineDraft listing', () => {
  it('i2vs the real MLS photo, stores our URL, and leaves humanApprovedAt null', async () => {
    const a = adapters()
    const result = await produceImagineDraft(
      { kind: 'listing', query: '220189422', brokerSlug: 'matt', requestedBy: 'matt@ryan-realty.com' },
      a,
    )
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.storedMediaUrl).toBe(STORED_MP4)
    expect(isTempImagineUrl(result.storedMediaUrl)).toBe(false)
    expect(a.generateImageToVideo).toHaveBeenCalledWith(
      expect.objectContaining({
        image_url: LISTING.photoUrl,
        prompt: LISTING_I2V_PROMPT,
      }),
    )
    expect(a.generateBannerImage).not.toHaveBeenCalled()
    expect(a.downloadUrl).toHaveBeenCalledWith('https://api.x.ai/tmp/fake.mp4')
    expect(a.markReady).toHaveBeenCalled()
    const readyArg = vi.mocked(a.markReady).mock.calls[0][0]
    expect(readyArg.payloadPatch?.humanApprovedAt).toBeNull()
    const payload = readyArg.executorResponse.publish_payload as Record<string, unknown>
    expect(payload.approved).toBe(false)
    expect(payload.mediaUrl).toBe(STORED_MP4)
    expect((payload.gate as { humanApprovedAt: null }).humanApprovedAt).toBeNull()
    expect(a.killDraft).not.toHaveBeenCalled()
  })

  it('refuses a name that is not a live listing with a photo', async () => {
    const a = adapters({ findLiveListing: vi.fn(async () => null) })
    const result = await produceImagineDraft(
      { kind: 'listing', query: '999 Fake St', brokerSlug: 'matt', requestedBy: 'matt@ryan-realty.com' },
      a,
    )
    expect(result.ok).toBe(false)
    expect(a.insertPending).not.toHaveBeenCalled()
    expect(a.generateImageToVideo).not.toHaveBeenCalled()
  })

  it('kills the pending row when stored media is still a temp Imagine URL', async () => {
    const a = adapters({
      storeMedia: vi.fn(async () => ({ ok: true as const, url: 'https://api.x.ai/tmp/still-temp.mp4' })),
    })
    const result = await produceImagineDraft(
      { kind: 'listing', query: '220189422', brokerSlug: 'matt', requestedBy: 'matt@ryan-realty.com' },
      a,
    )
    expect(result.ok).toBe(false)
    expect(a.killDraft).toHaveBeenCalledWith('draft-1', expect.stringContaining('temp Imagine URL'))
  })
})

describe('produceImagineDraft GBP', () => {
  it('stores a still from Imagine image, not a generated house video', async () => {
    const a = adapters({
      storeMedia: vi.fn(async () => ({ ok: true as const, url: STORED_JPG })),
      insertPending: vi.fn(async () => ({ ok: true as const, id: 'draft-2' })),
    })
    const result = await produceImagineDraft(
      { kind: 'gbp', brokerSlug: 'matt', requestedBy: 'matt@ryan-realty.com' },
      a,
    )
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.storedMediaUrl).toBe(STORED_JPG)
    expect(a.generateImageToVideo).not.toHaveBeenCalled()
    expect(a.generateBannerImage).toHaveBeenCalled()
    const payload = vi.mocked(a.markReady).mock.calls[0][0].executorResponse
      .publish_payload as Record<string, unknown>
    expect(payload.platforms).toEqual(['google_business_profile'])
    expect((payload.gate as { humanApprovedAt: null }).humanApprovedAt).toBeNull()
  })

  it('does not invent pulse numbers', async () => {
    const a = adapters({ getPulse: vi.fn(async () => null) })
    const result = await produceImagineDraft(
      { kind: 'gbp', brokerSlug: 'matt', requestedBy: 'matt@ryan-realty.com' },
      a,
    )
    expect(result.ok).toBe(false)
    expect(a.insertPending).not.toHaveBeenCalled()
  })
})

describe('produce path has no Replicate', () => {
  it('does not import Replicate or call the publish route', () => {
    const here = new URL('./', import.meta.url)
    const produceSrc = readFileSync(new URL('./imagine-produce.ts', here), 'utf8')
    const actionSrc = readFileSync(
      new URL('../../app/admin/(protected)/today/actions.ts', here),
      'utf8',
    )
    for (const src of [produceSrc, actionSrc]) {
      expect(src).not.toMatch(/\bfrom ['"]replicate['"]/)
      expect(src).not.toMatch(/import Replicate/)
      expect(src).not.toMatch(/\/api\/social\/publish/)
    }
    expect(produceSrc).toMatch(/humanApprovedAt: null/)
  })
})
