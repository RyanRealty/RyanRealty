import { describe, expect, it } from 'vitest'
import { igMediaRows } from './route'
import type { IGMedia } from '@/lib/meta-graph'

const media = (over: Partial<IGMedia> = {}): IGMedia => ({
  id: 'm1',
  timestamp: '2026-08-24T00:00:00Z',
  media_type: 'IMAGE',
  media_url: 'https://example.com/a.jpg',
  permalink: 'https://instagram.com/p/a',
  caption: 'a caption',
  views: 27,
  reach: 16,
  total_interactions: 3,
  saved: 1,
  ...over,
})

describe('igMediaRows — an unmeasured metric is absent, never zero', () => {
  // The defect: Meta retired `impressions` for IG media at v22, every call 400d,
  // the error was caught and a 0 written. 869 straight days of false zeros in
  // marketing_channel_daily, with the pipeline reporting healthy the whole time.
  it('writes a row for every metric it actually read', () => {
    const rows = igMediaRows('2026-08-24', [media()])
    expect(rows.map((r) => r.metric).sort()).toEqual(['reach', 'saved', 'total_interactions', 'views'])
    expect(rows.find((r) => r.metric === 'views')?.value).toBe(27)
  })

  it('DROPS a metric it could not read rather than writing 0', () => {
    const rows = igMediaRows('2026-08-24', [media({ views: null, reach: null })])
    expect(rows.map((r) => r.metric).sort()).toEqual(['saved', 'total_interactions'])
    expect(rows.some((r) => r.metric === 'views')).toBe(false)
    expect(rows.some((r) => r.value === 0 && r.metric === 'views')).toBe(false)
  })

  it('keeps a genuine zero — 0 read from the API is real and must be written', () => {
    const rows = igMediaRows('2026-08-24', [media({ saved: 0 })])
    const saved = rows.find((r) => r.metric === 'saved')
    expect(saved).toBeDefined()
    expect(saved?.value).toBe(0)
  })

  it('never emits the retired impressions or engagement metrics', () => {
    const rows = igMediaRows('2026-08-24', [media()])
    expect(rows.some((r) => r.metric === 'impressions')).toBe(false)
    expect(rows.some((r) => r.metric === 'engagement')).toBe(false)
  })
})

import { fbAccountRows, fbPostRows } from './route'

describe('Facebook rows — retired metrics are gone, not zeroed', () => {
  // Meta retired page_impressions, page_impressions_unique, page_engaged_users,
  // page_fans and page_fan_adds with no replacement (verified live 2026-08-26).
  // Worse: asking for ONE retired name 400s the whole request, so the healthy
  // metrics beside it were zeroed as collateral. That is why Facebook post
  // clicks and reactions also read 0.
  it('never emits a retired page metric', () => {
    const rows = fbAccountRows('2026-08-24', {
      date: '2026-08-24',
      page_post_engagements: 4,
      page_video_views: 2,
      page_views_total: 1,
      page_daily_follows: 0,
      page_follows: 812,
    })
    const metrics = rows.map((r) => r.metric)
    for (const dead of ['page_impressions', 'page_impressions_unique', 'page_engaged_users', 'page_fans', 'page_fan_adds']) {
      expect(metrics).not.toContain(dead)
    }
    // page_daily_follows is a REAL 0 here and must survive.
    expect(rows.find((r) => r.metric === 'page_daily_follows')?.value).toBe(0)
    expect(rows.find((r) => r.metric === 'page_follows')?.value).toBe(812)
  })

  it('drops a page metric it could not read', () => {
    const rows = fbAccountRows('2026-08-24', {
      date: '2026-08-24',
      page_post_engagements: null,
      page_video_views: null,
      page_views_total: 3,
      page_daily_follows: null,
      page_follows: null,
    })
    expect(rows.map((r) => r.metric)).toEqual(['page_views_total'])
  })

  it('never emits post_impressions or post_engaged_users', () => {
    // Both are retired, along with every unique/organic variant — verified live
    // 2026-08-26 by asking for each alone. They are not fields on PagePost at
    // all now, so there is nothing that could reach a row as a fabricated 0.
    const rows = fbPostRows('2026-08-24', [
      {
        id: 'p1',
        created_time: '2026-08-24T00:00:00Z',
        permalink_url: 'https://facebook.com/p1',
        message: 'hello',
        post_reactions_by_type_total: 5,
        post_reactions_like_total: 4,
        post_clicks: 2,
        post_video_views: 9,
      },
    ])
    const metrics = rows.map((r) => r.metric)
    expect(metrics).not.toContain('post_impressions')
    expect(metrics).not.toContain('post_engaged_users')
    expect(metrics.sort()).toEqual([
      'post_clicks',
      'post_reactions_by_type_total',
      'post_reactions_like_total',
      'post_video_views',
    ])
  })

  it('publishes the post metrics that DO still resolve', () => {
    const rows = fbPostRows('2026-08-24', [
      {
        id: 'p1',
        created_time: '2026-08-24T00:00:00Z',
        permalink_url: 'https://facebook.com/p1',
        message: 'hello',
        post_reactions_by_type_total: 5,
        post_reactions_like_total: 4,
        post_clicks: 2,
        post_video_views: 9,
      },
    ])
    expect(rows.find((r) => r.metric === 'post_video_views')?.value).toBe(9)
    expect(rows.find((r) => r.metric === 'post_reactions_like_total')?.value).toBe(4)
  })

  it('a post whose whole insights call failed writes NOTHING', () => {
    const rows = fbPostRows('2026-08-24', [
      {
        id: 'p1',
        created_time: '2026-08-24T00:00:00Z',
        permalink_url: 'https://facebook.com/p1',
        message: 'hello',
        post_reactions_by_type_total: null,
        post_reactions_like_total: null,
        post_clicks: null,
        post_video_views: null,
      },
    ])
    expect(rows).toEqual([])
  })
})

// ---------------------------------------------------------------------------
// Instagram ACCOUNT level — the same defect, one layer up
// ---------------------------------------------------------------------------

import { igAccountRows } from './route'
import type { IGAccountInsightsDay } from '@/lib/meta-graph'

const account = (over: Partial<IGAccountInsightsDay> = {}): IGAccountInsightsDay => ({
  date: '2026-08-24',
  views: 26,
  reach: 15,
  profile_views: 2,
  website_clicks: 0,
  accounts_engaged: 0,
  total_interactions: 0,
  likes: 0,
  comments: 0,
  shares: 0,
  saves: 0,
  new_followers: 1,
  follower_count: 1259,
  ...over,
})

describe('igAccountRows — the account feed stops inventing zeros too', () => {
  // The media-level fix shipped first and was reported as "Instagram fixed".
  // It was not: getIGAccountInsights still asked for the retired `impressions`,
  // which 400s the WHOLE batch, so reach / profile_views / website_clicks were
  // zeroed as collateral. Verified live 2026-08-26 — the call was still failing.
  it('never asks for the retired impressions metric', () => {
    const rows = igAccountRows('2026-08-24', account())
    expect(rows.some((r) => r.metric === 'impressions')).toBe(false)
  })

  it('publishes views as the replacement for impressions', () => {
    const rows = igAccountRows('2026-08-24', account())
    expect(rows.find((r) => r.metric === 'views')?.value).toBe(26)
  })

  it('DROPS a metric it could not read rather than writing 0', () => {
    const rows = igAccountRows('2026-08-24', account({ views: null, reach: null }))
    expect(rows.some((r) => r.metric === 'views')).toBe(false)
    expect(rows.some((r) => r.metric === 'reach')).toBe(false)
  })

  it('keeps a genuine zero — 0 read from the API is real and must be written', () => {
    const rows = igAccountRows('2026-08-24', account({ website_clicks: 0 }))
    const clicks = rows.find((r) => r.metric === 'website_clicks')
    expect(clicks).toBeDefined()
    expect(clicks?.value).toBe(0)
  })

  it('separates the lifetime follower total from the daily delta', () => {
    // follower_count at period=lifetime is a 400, and at period=day it is a
    // DELTA. The lifetime total comes from the user object field instead.
    const rows = igAccountRows('2026-08-24', account())
    expect(rows.find((r) => r.metric === 'follower_count')?.value).toBe(1259)
    expect(rows.find((r) => r.metric === 'new_followers')?.value).toBe(1)
  })

  it('a total failure of every read writes NOTHING, not a row of zeros', () => {
    const dead = account({
      views: null, reach: null, profile_views: null, website_clicks: null,
      accounts_engaged: null, total_interactions: null, likes: null,
      comments: null, shares: null, saves: null, new_followers: null,
      follower_count: null,
    })
    expect(igAccountRows('2026-08-24', dead)).toEqual([])
  })
})
