import { describe, expect, it } from 'vitest'
import { buildEmailEngagement, buildTimelineItems } from './person-view-model'

describe('buildEmailEngagement — keep click URLs', () => {
  it('lists each distinct destination on the send they belong to', () => {
    const engagement = buildEmailEngagement([
      {
        id: 1,
        kind: 'email_out',
        ts: '2026-09-01T10:00:00Z',
        title: 'A market analysis for 2465 7th',
        payload: {},
      },
      {
        id: 2,
        kind: 'email_click',
        ts: '2026-09-01T12:00:00Z',
        title: 'Clicked a link in: A market analysis for 2465 7th',
        payload: {
          label: 'A market analysis for 2465 7th',
          url: 'https://ryan-realty.com/reviews',
        },
      },
      {
        id: 3,
        kind: 'email_click',
        ts: '2026-09-01T12:01:00Z',
        title: 'Clicked a link in: A market analysis for 2465 7th',
        payload: {
          label: 'A market analysis for 2465 7th',
          url: 'https://ryan-realty.com/subdivisions/diamond-bar-ranch',
        },
      },
    ])
    const row = engagement['A market analysis for 2465 7th']
    expect(row.clicks).toBe(2)
    expect(row.clickUrls).toEqual([
      'https://ryan-realty.com/reviews',
      'https://ryan-realty.com/subdivisions/diamond-bar-ranch',
    ])
  })
})

describe('buildTimelineItems — click URLs ride the email_out row', () => {
  it('folds click destinations onto the sent row so the timeline can list them', () => {
    const timeline = [
      {
        id: 1,
        kind: 'email_out',
        ts: '2026-09-01T10:00:00Z',
        title: 'A market analysis for 2465 7th',
        body: 'CMA sent.',
        broker: 'matt',
        source: 'app',
        starred: false,
        payload: { slug: 'cma-2465-7th' },
      },
      {
        id: 2,
        kind: 'email_click',
        ts: '2026-09-01T12:00:00Z',
        title: 'Clicked',
        payload: { label: 'A market analysis for 2465 7th', url: 'https://ryan-realty.com/reviews' },
      },
    ]
    const engagement = buildEmailEngagement(timeline)
    const items = buildTimelineItems(timeline, engagement)
    expect(items).toHaveLength(1)
    expect(items[0]!.kind).toBe('email_out')
    expect(items[0]!.clicks).toBe(1)
    expect(items[0]!.clickUrls).toEqual(['https://ryan-realty.com/reviews'])
  })
})
