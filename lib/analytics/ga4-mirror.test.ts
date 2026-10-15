import { describe, expect, it } from 'vitest'
import {
  GA4_MP_PAGE_VIEW_MIRROR_SINCE,
  GA4_TRAFFIC_RELIABLE_FROM,
  ga4LastDaysNeedTrafficCaveat,
  ga4WindowNeedsTrafficCaveat,
  isGa4PageViewMirrorOn,
  isMirrorShapedRow,
  stampMirrorInflated,
} from './ga4-mirror'

const ENV_ON = { GA4_API_SECRET: 'secret', NEXT_PUBLIC_GA4_MEASUREMENT_ID: 'G-ST40W4WM6T' }

describe('isGa4PageViewMirrorOn', () => {
  it('is on from the first mirror day when the MP credentials exist', () => {
    expect(isGa4PageViewMirrorOn(GA4_MP_PAGE_VIEW_MIRROR_SINCE, ENV_ON)).toBe(true)
    expect(isGa4PageViewMirrorOn('2026-09-21', ENV_ON)).toBe(true)
  })

  it('is off before 2026-08-10, so a backfill of older days stays unstamped', () => {
    expect(isGa4PageViewMirrorOn('2026-08-09', ENV_ON)).toBe(false)
  })

  it('is off without the API secret or a measurement id (fireGa4Event no-ops)', () => {
    expect(isGa4PageViewMirrorOn('2026-09-21', { NEXT_PUBLIC_GA4_MEASUREMENT_ID: 'G-X' })).toBe(false)
    expect(isGa4PageViewMirrorOn('2026-09-21', { GA4_API_SECRET: 's' })).toBe(false)
    expect(isGa4PageViewMirrorOn('2026-09-21', { GA4_API_SECRET: '  ', GA4_MEASUREMENT_ID: 'G-X' })).toBe(false)
  })
})

describe('isMirrorShapedRow', () => {
  it.each([
    ['account', '', 'sessions'],
    ['account', '', 'total_users'],
    ['account', '', 'new_users'],
    ['account', '', 'bounce_rate'],
    ['account', '', 'engagement_rate'],
    ['account', '', 'avg_session_duration_seconds'],
    ['account', '', 'lead_event_rate'],
    ['source', '(not set)', 'sessions'],
    ['source', 'google / organic', 'users'],
    ['source', '(direct) / (none)', 'engaged_sessions'],
  ])('stamps %s/%s/%s', (scope, scope_id, metric) => {
    expect(isMirrorShapedRow({ scope, scope_id, metric })).toBe(true)
  })

  it.each([
    // Real first-party events relayed, and counts the mirror does not touch.
    ['account', '', 'total_lead_events'],
    ['account', '', 'ai_assistant_sessions'],
    ['account', '', 'tracking_health_ok'],
    ['event', 'page_view', 'event_count'],
    ['page', '/', 'page_views'],
    ['source', 'lead_source:(not set)', 'lead_events'],
    ['source', 'chatgpt', 'ai_assistant_sessions'],
    ['channel', 'social:Organic Social', 'sessions'],
  ])('leaves %s/%s/%s alone', (scope, scope_id, metric) => {
    expect(isMirrorShapedRow({ scope, scope_id, metric })).toBe(false)
  })
})

describe('stampMirrorInflated', () => {
  const rows = [
    { scope: 'account', scope_id: '', metric: 'sessions', value: 699 },
    { scope: 'source', scope_id: '(not set)', metric: 'sessions', value: 690, metadata: { source_medium: '(not set)' } },
    { scope: 'event', scope_id: 'page_view', metric: 'event_count', value: 1631, metadata: { event_name: 'page_view' } },
  ]

  it('stamps shaped rows, keeps their metadata, and leaves the rest untouched', () => {
    const out = stampMirrorInflated(rows, true)
    expect(out[0].metadata).toEqual({ mirror_inflated: true, mirror_since: '2026-08-10' })
    expect(out[1].metadata).toEqual({ source_medium: '(not set)', mirror_inflated: true, mirror_since: '2026-08-10' })
    expect(out[2]).toBe(rows[2])
    // never mutates the input
    expect(rows[0]).not.toHaveProperty('metadata')
  })

  it('passes everything through when the mirror was off', () => {
    expect(stampMirrorInflated(rows, false)).toBe(rows)
  })
})

describe('ga4WindowNeedsTrafficCaveat — say it only where it applies', () => {
  it('a window that starts before GA4 sources were reliable needs the caveat', () => {
    expect(GA4_TRAFFIC_RELIABLE_FROM).toBe('2026-10-12')
    expect(ga4WindowNeedsTrafficCaveat('2026-09-14')).toBe(true)
    expect(ga4WindowNeedsTrafficCaveat('2026-10-11')).toBe(true)
  })
  it('a window that starts on or after that day does not', () => {
    expect(ga4WindowNeedsTrafficCaveat('2026-10-12')).toBe(false)
    expect(ga4WindowNeedsTrafficCaveat('2026-11-01')).toBe(false)
  })
  it('a window that ended before the relay began does not', () => {
    expect(ga4WindowNeedsTrafficCaveat('2026-07-01', '2026-07-31')).toBe(false)
    expect(ga4WindowNeedsTrafficCaveat('2026-07-01', GA4_MP_PAGE_VIEW_MIRROR_SINCE)).toBe(true)
    expect(ga4WindowNeedsTrafficCaveat('2026-09-01', '2026-09-30')).toBe(true)
  })
  it('the last N days, from a fixed now', () => {
    expect(ga4LastDaysNeedTrafficCaveat(30, Date.parse('2026-10-14T12:00:00Z'))).toBe(true)
    expect(ga4LastDaysNeedTrafficCaveat(30, Date.parse('2026-11-12T12:00:00Z'))).toBe(false)
  })
})
