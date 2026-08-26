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
    const rows = fbPostRows('2026-08-24', [
      {
        id: 'p1',
        created_time: '2026-08-24T00:00:00Z',
        permalink_url: 'https://facebook.com/p1',
        message: 'hello',
        post_impressions: null,
        post_engaged_users: null,
        post_reactions_by_type_total: 5,
        post_clicks: 2,
      },
    ])
    const metrics = rows.map((r) => r.metric)
    expect(metrics).not.toContain('post_impressions')
    expect(metrics).not.toContain('post_engaged_users')
    expect(metrics.sort()).toEqual(['post_clicks', 'post_reactions_by_type_total'])
  })
})
