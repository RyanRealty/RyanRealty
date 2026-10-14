/**
 * lib/meta-marketing-api.mjs under the video freeze (Matt 2026-10-14): no
 * video goes to the ad account (/advideos) and no video_data creative is
 * built, before any request leaves the process. Calls that carry no video
 * (a campaign) are untouched.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { VIDEO_FREEZE_MESSAGE } from '@/lib/content/video-freeze'
import { MetaMarketingError, createAdCreative, createCampaign, uploadVideo } from './meta-marketing-api.mjs'

const fetchMock = vi.fn()

beforeEach(() => {
  vi.stubEnv('META_AD_ACCOUNT_ID', 'act_123')
  vi.stubEnv('META_PAGE_ID', 'page-1')
  vi.stubEnv('META_PAGE_TOKEN', 'unit-test-token')
  fetchMock.mockReset()
  fetchMock.mockImplementation(async () => new Response(JSON.stringify({ id: 'meta-1' }), { status: 200 }))
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

describe('meta-marketing-api under the video freeze', () => {
  it('uploadVideo refuses before reading the file or calling Meta', async () => {
    const upload = uploadVideo('/no/such/dir/ad.mp4')
    await expect(upload).rejects.toBeInstanceOf(MetaMarketingError)
    await expect(uploadVideo('/no/such/dir/ad.mp4')).rejects.toThrow(VIDEO_FREEZE_MESSAGE)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('createAdCreative refuses the video_data creative before calling Meta', async () => {
    // A variable, not a literal: the module's JSDoc types only part of the shape.
    const creative = {
      video_id: 'v-1',
      page_id: 'page-1',
      primary_text: 'Bend this month.',
      headline: 'Bend market',
      call_to_action: { type: 'SIGN_UP', value: { lead_gen_form_id: 'form-1' } },
    }
    await expect(createAdCreative(creative)).rejects.toThrow(VIDEO_FREEZE_MESSAGE)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('a call that carries no video still goes through', async () => {
    const result = await createCampaign({ name: 'Unit test campaign' })
    expect(result).toEqual({ id: 'meta-1' })
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(String(fetchMock.mock.calls[0][0])).toContain('/act_123/campaigns')
  })
})
