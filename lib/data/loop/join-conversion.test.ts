import { describe, expect, it } from 'vitest'
import {
  JOIN_CONVERSION_SOURCE,
  JOIN_CONVERT_EVENT,
  isJoinInquiry,
  isJoinPageUrl,
  summarizeJoinEvents,
} from './join-conversion'

describe('join conversion funnel', () => {
  it('recognizes the join inquiry values the contact form actually sends', () => {
    expect(isJoinInquiry('Join the team')).toBe(true)
    expect(isJoinInquiry('join the team')).toBe(true)
    expect(isJoinInquiry('Buying')).toBe(false)
    expect(isJoinInquiry('General Inquiry')).toBe(false)
    expect(isJoinInquiry('')).toBe(false)
  })

  it('matches only the /join path, not join-us or query collisions', () => {
    expect(isJoinPageUrl('https://ryan-realty.com/join')).toBe(true)
    expect(isJoinPageUrl('https://ryan-realty.com/join?utm=1')).toBe(true)
    expect(isJoinPageUrl('https://ryan-realty.com/join/')).toBe(true)
    expect(isJoinPageUrl('/join')).toBe(true)
    expect(isJoinPageUrl('https://ryan-realty.com/join-us')).toBe(false)
    expect(isJoinPageUrl('https://ryan-realty.com/contact?inquiry=Join%20the%20team')).toBe(false)
  })

  it('counts distinct sessions and drops fleet-test converts from the packet figure', () => {
    const now = new Date('2026-08-16T12:00:00.000Z')
    const stats = summarizeJoinEvents(
      [
        {
          session_id: 's1',
          event_type: 'page_view',
          event_at: '2026-08-16T07:00:00.000Z',
          page_url: 'https://ryan-realty.com/join',
          metadata: null,
        },
        {
          session_id: 's1',
          event_type: 'section_view',
          event_at: '2026-08-16T07:01:00.000Z',
          page_url: 'https://ryan-realty.com/join',
          metadata: null,
        },
        {
          session_id: 's2',
          event_type: JOIN_CONVERT_EVENT,
          event_at: '2026-08-16T08:00:00.000Z',
          page_url: 'https://ryan-realty.com/join',
          metadata: { channel: 'contact-form' },
        },
        {
          session_id: 'fleet',
          event_type: JOIN_CONVERT_EVENT,
          event_at: '2026-08-16T09:00:00.000Z',
          page_url: 'https://ryan-realty.com/join',
          metadata: { fleetTest: true },
        },
      ],
      now,
    )
    expect(stats.visits7d).toBe(1)
    expect(stats.visitsAll).toBe(1)
    expect(stats.conversions7d).toBe(1)
    expect(stats.conversionsAll).toBe(1)
    expect(stats.series.some((d) => d.day === '2026-08-16' && d.conversions === 1 && d.visits === 2)).toBe(
      true,
    )
  })

  it('names the visitor_events source the packet must cite', () => {
    expect(JOIN_CONVERSION_SOURCE).toContain('visitor_events')
    expect(JOIN_CONVERSION_SOURCE).toContain('getJoinConversionStats')
    expect(JOIN_CONVERSION_SOURCE).toContain(JOIN_CONVERT_EVENT)
  })
})
