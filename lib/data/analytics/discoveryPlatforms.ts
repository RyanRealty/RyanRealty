/**
 * "Saw us" catalog — every connected platform snapshot, one card each.
 * Counts are never added across platforms. GBP's four impression surfaces
 * are slices of one platform and may be summed with each other.
 */

import type { CountKind } from './salesFunnelMath'

export type DiscoveryGroup = 'paid' | 'search' | 'local' | 'social' | 'video' | 'llm'

export const DISCOVERY_GROUP_LABEL: Record<DiscoveryGroup, string> = {
  paid: 'Paid',
  search: 'Search',
  local: 'Google Business Profile',
  social: 'Organic social',
  video: 'Video',
  llm: 'LLM / AI answers',
}

export type DiscoverySecondary = {
  metric: string
  label: string
}

export type DiscoverySpec = {
  id: string
  group: DiscoveryGroup
  label: string
  /** marketing_channel_daily.channel. Null when there is no ingestor. */
  channel: string | null
  /** One metric, or several that partition the same platform (GBP maps/search). */
  primaryMetrics: string[]
  primaryLabel: string
  secondary: DiscoverySecondary[]
  caveatWhenPresent: string
  /** If set, this card is always UNMEASURED regardless of rows. */
  alwaysUnmeasured: string | null
}

export type SnapshotMetricRow = {
  channel: string
  metric: string
  value: number | string | null
}

export type DiscoveryChannel = {
  id: string
  group: DiscoveryGroup
  label: string
  metric: string
  count: number | null
  countKind: CountKind
  secondary: { label: string; metric: string; count: number | null }[]
  unmeasuredReason: string | null
  caveat: string | null
  rowCount: number
}

export const DISCOVERY_SPECS: readonly DiscoverySpec[] = [
  {
    id: 'meta-ads',
    group: 'paid',
    label: 'Meta ads',
    channel: 'meta_ads',
    primaryMetrics: ['impressions'],
    primaryLabel: 'impressions',
    secondary: [{ metric: 'clicks', label: 'clicks' }],
    caveatWhenPresent: 'Paid impressions. Events, not unique people. Daily reach is not summed.',
    alwaysUnmeasured: null,
  },
  {
    id: 'google-ads',
    group: 'paid',
    label: 'Google ads',
    channel: 'google_ads',
    primaryMetrics: ['impressions'],
    primaryLabel: 'impressions',
    secondary: [{ metric: 'clicks', label: 'clicks' }],
    caveatWhenPresent: 'Paid impressions. Events, not unique people.',
    alwaysUnmeasured: null,
  },
  {
    id: 'gsc',
    group: 'search',
    label: 'Google Search',
    channel: 'gsc',
    primaryMetrics: ['impressions'],
    primaryLabel: 'impressions',
    secondary: [{ metric: 'clicks', label: 'clicks' }],
    caveatWhenPresent: 'Search Console query impressions, not unique people.',
    alwaysUnmeasured: null,
  },
  {
    id: 'gbp',
    group: 'local',
    label: 'Google Business Profile',
    channel: 'gbp',
    primaryMetrics: [
      'business_impressions_desktop_maps',
      'business_impressions_desktop_search',
      'business_impressions_mobile_maps',
      'business_impressions_mobile_search',
    ],
    primaryLabel: 'impressions',
    secondary: [
      { metric: 'website_clicks', label: 'website clicks' },
      { metric: 'call_clicks', label: 'call clicks' },
    ],
    caveatWhenPresent: 'Maps plus search impressions on desktop and mobile, summed. Those four are slices of one GBP location, not four platforms.',
    alwaysUnmeasured: null,
  },
  {
    id: 'meta-page',
    group: 'social',
    label: 'Facebook page',
    channel: 'meta_page',
    primaryMetrics: ['page_impressions'],
    primaryLabel: 'impressions',
    secondary: [{ metric: 'page_engaged_users', label: 'engaged users' }],
    caveatWhenPresent: 'Organic page impressions. Separate from Meta ads. Events, not unique people.',
    alwaysUnmeasured: null,
  },
  {
    id: 'instagram',
    group: 'social',
    label: 'Instagram',
    channel: 'instagram',
    primaryMetrics: ['impressions'],
    primaryLabel: 'impressions',
    secondary: [{ metric: 'profile_views', label: 'profile views' }],
    caveatWhenPresent: 'Organic Instagram impressions. Events, not unique people. Daily reach is not summed.',
    alwaysUnmeasured: null,
  },
  {
    id: 'linkedin',
    group: 'social',
    label: 'LinkedIn',
    channel: 'linkedin',
    primaryMetrics: ['impressions'],
    primaryLabel: 'impressions',
    secondary: [{ metric: 'clicks', label: 'clicks' }],
    caveatWhenPresent: 'Organic LinkedIn impressions. Events, not unique people.',
    alwaysUnmeasured: null,
  },
  {
    id: 'x',
    group: 'social',
    label: 'X',
    channel: 'x',
    primaryMetrics: ['impressions'],
    primaryLabel: 'impressions',
    secondary: [{ metric: 'engagements', label: 'engagements' }],
    caveatWhenPresent: 'Account impressions. The ingestor omits the row when the API tier would write a fake zero.',
    alwaysUnmeasured: null,
  },
  {
    id: 'youtube',
    group: 'video',
    label: 'YouTube',
    channel: 'youtube',
    primaryMetrics: ['views'],
    primaryLabel: 'views',
    secondary: [{ metric: 'watch_time_minutes', label: 'watch minutes' }],
    caveatWhenPresent: 'YouTube Analytics daily views, not unique viewers.',
    alwaysUnmeasured: null,
  },
  {
    id: 'tiktok',
    group: 'video',
    label: 'TikTok',
    channel: 'tiktok',
    primaryMetrics: ['impressions'],
    primaryLabel: 'impressions',
    secondary: [],
    caveatWhenPresent: '',
    alwaysUnmeasured:
      'TikTok writes cumulative video views, not daily impressions. A period sum would double-count. Period reach is UNMEASURED.',
  },
  {
    id: 'llm',
    group: 'llm',
    label: 'LLM / AI answers',
    channel: null,
    primaryMetrics: ['citations'],
    primaryLabel: 'citations',
    secondary: [],
    caveatWhenPresent: '',
    alwaysUnmeasured: 'No unique-people writer for ChatGPT, Gemini, or similar citations.',
  },
] as const

export const DISCOVERY_CHANNELS = [...new Set(DISCOVERY_SPECS.map((s) => s.channel).filter(Boolean))] as string[]

export const DISCOVERY_METRICS = [
  ...new Set(DISCOVERY_SPECS.flatMap((s) => [...s.primaryMetrics, ...s.secondary.map((x) => x.metric)])),
  'sessions',
]

function sumMetric(rows: SnapshotMetricRow[], channel: string, metrics: string[]): { value: number; rows: number } {
  let value = 0
  let n = 0
  const want = new Set(metrics)
  for (const r of rows) {
    if (r.channel !== channel) continue
    if (!want.has(r.metric)) continue
    n += 1
    value += Number(r.value) || 0
  }
  return { value, rows: n }
}

export function rollDiscovery(rows: SnapshotMetricRow[]): DiscoveryChannel[] {
  return DISCOVERY_SPECS.map((spec) => {
    if (spec.alwaysUnmeasured) {
      return {
        id: spec.id,
        group: spec.group,
        label: spec.label,
        metric: spec.primaryLabel,
        count: null,
        countKind: 'events',
        secondary: spec.secondary.map((s) => ({ label: s.label, metric: s.metric, count: null })),
        unmeasuredReason: spec.alwaysUnmeasured,
        caveat: null,
        rowCount: 0,
      }
    }
    const channel = spec.channel
    if (!channel) {
      return {
        id: spec.id,
        group: spec.group,
        label: spec.label,
        metric: spec.primaryLabel,
        count: null,
        countKind: 'events',
        secondary: [],
        unmeasuredReason: 'No snapshot channel for this platform.',
        caveat: null,
        rowCount: 0,
      }
    }
    const primary = sumMetric(rows, channel, spec.primaryMetrics)
    const secondary = spec.secondary.map((s) => {
      const got = sumMetric(rows, channel, [s.metric])
      return {
        label: s.label,
        metric: s.metric,
        count: got.rows === 0 ? null : got.value,
      }
    })
    return {
      id: spec.id,
      group: spec.group,
      label: spec.label,
      metric: spec.primaryLabel,
      count: primary.rows === 0 ? 0 : primary.value,
      countKind: 'events',
      secondary,
      unmeasuredReason: null,
      caveat:
        primary.rows === 0
          ? `No ${spec.channel} snapshot rows for ${spec.primaryLabel} in this window. The cron may be behind or OAuth may be expired.`
          : spec.caveatWhenPresent,
      rowCount: primary.rows,
    }
  })
}

export function ga4SessionSum(rows: SnapshotMetricRow[]): { value: number; rows: number } {
  return sumMetric(rows, 'ga4', ['sessions'])
}

export const DISCOVERY_GROUP_ORDER: DiscoveryGroup[] = [
  'paid',
  'search',
  'local',
  'social',
  'video',
  'llm',
]
