import { describe, it, expect } from 'vitest'
import { rollDiscovery, ga4SessionSum, DISCOVERY_SPECS } from './discoveryPlatforms'

describe('rollDiscovery', () => {
  it('sums one platform across days and never adds Meta to GSC', () => {
    const out = rollDiscovery([
      { channel: 'meta_ads', metric: 'impressions', value: 100 },
      { channel: 'meta_ads', metric: 'impressions', value: 50 },
      { channel: 'meta_ads', metric: 'clicks', value: 7 },
      { channel: 'gsc', metric: 'impressions', value: 900 },
    ])
    const meta = out.find((c) => c.id === 'meta-ads')
    const gsc = out.find((c) => c.id === 'gsc')
    expect(meta?.count).toBe(150)
    expect(meta?.secondary.find((s) => s.metric === 'clicks')?.count).toBe(7)
    expect(gsc?.count).toBe(900)
    expect((meta?.count ?? 0) + (gsc?.count ?? 0)).toBe(1050)
  })

  it('sums GBP map and search impression slices as one platform', () => {
    const out = rollDiscovery([
      { channel: 'gbp', metric: 'business_impressions_desktop_maps', value: 10 },
      { channel: 'gbp', metric: 'business_impressions_desktop_search', value: 20 },
      { channel: 'gbp', metric: 'business_impressions_mobile_maps', value: 30 },
      { channel: 'gbp', metric: 'business_impressions_mobile_search', value: 40 },
      { channel: 'gbp', metric: 'call_clicks', value: 3 },
    ])
    const gbp = out.find((c) => c.id === 'gbp')
    expect(gbp?.count).toBe(100)
    expect(gbp?.secondary.find((s) => s.metric === 'call_clicks')?.count).toBe(3)
  })

  it('keeps LLM and TikTok UNMEASURED even when other rows exist', () => {
    const out = rollDiscovery([{ channel: 'tiktok', metric: 'followers_count', value: 800 }])
    expect(out.find((c) => c.id === 'llm')?.count).toBeNull()
    expect(out.find((c) => c.id === 'tiktok')?.count).toBeNull()
    expect(out.find((c) => c.id === 'tiktok')?.unmeasuredReason).toMatch(/cumulative/i)
  })

  it('uses 0 plus a missing-rows caveat when the writer exists but the window is empty', () => {
    const out = rollDiscovery([])
    const youtube = out.find((c) => c.id === 'youtube')
    expect(youtube?.count).toBe(0)
    expect(youtube?.unmeasuredReason).toBeNull()
    expect(youtube?.caveat).toMatch(/No youtube snapshot/i)
  })

  it('covers every connected snapshot platform we ingest', () => {
    const ids = DISCOVERY_SPECS.map((s) => s.id)
    expect(ids).toEqual(
      expect.arrayContaining([
        'meta-ads',
        'google-ads',
        'gsc',
        'gbp',
        'meta-page',
        'instagram',
        'linkedin',
        'x',
        'youtube',
        'tiktok',
        'llm',
      ]),
    )
  })
})

describe('ga4SessionSum', () => {
  it('sums GA4 sessions separately from discovery impressions', () => {
    expect(
      ga4SessionSum([
        { channel: 'ga4', metric: 'sessions', value: 12 },
        { channel: 'ga4', metric: 'sessions', value: 8 },
        { channel: 'gsc', metric: 'impressions', value: 999 },
      ]).value,
    ).toBe(20)
  })
})
