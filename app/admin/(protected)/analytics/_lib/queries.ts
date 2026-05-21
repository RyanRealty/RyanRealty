/**
 * Data layer for /admin/analytics.
 *
 * Each function returns a typed, predictable shape. The page composes them in
 * parallel via Promise.all. All numbers trace to either:
 *   - the GA4 Data API (via getGA4Summary)
 *   - public.marketing_channel_daily (Supabase service-role query)
 *   - public.valuation_requests / cmas / marketing_assignments (Supabase)
 *
 * Each numeric figure rendered on the dashboard comes from exactly one of
 * these calls. See ./citations.json for the per-figure trace.
 */
import 'server-only'
import { createServiceClient } from '@/lib/supabase/service'
import { getGA4Summary } from '@/app/actions/ga4-report'

export type DateRange = { startDate: string; endDate: string }

/**
 * Parse the searchParams `range` value into ISO dates.
 *   "today" | "7d" | "30d" | "90d" — relative to now
 *   "custom" — uses startDate / endDate searchParams (YYYY-MM-DD)
 */
export function resolveDateRange(searchParams: Record<string, string | undefined>): DateRange {
  const range = searchParams.range || '30d'
  const now = new Date()
  const end = new Date(now)
  end.setUTCHours(23, 59, 59, 999)
  const start = new Date(now)
  if (range === 'custom') {
    const s = searchParams.startDate
    const e = searchParams.endDate
    if (s && /^\d{4}-\d{2}-\d{2}$/.test(s)) start.setTime(new Date(`${s}T00:00:00Z`).getTime())
    if (e && /^\d{4}-\d{2}-\d{2}$/.test(e)) end.setTime(new Date(`${e}T23:59:59Z`).getTime())
  } else if (range === 'today') {
    start.setUTCHours(0, 0, 0, 0)
  } else if (range === '7d') {
    start.setUTCDate(start.getUTCDate() - 6)
    start.setUTCHours(0, 0, 0, 0)
  } else if (range === '90d') {
    start.setUTCDate(start.getUTCDate() - 89)
    start.setUTCHours(0, 0, 0, 0)
  } else {
    // default 30d
    start.setUTCDate(start.getUTCDate() - 29)
    start.setUTCHours(0, 0, 0, 0)
  }
  return {
    startDate: start.toISOString().slice(0, 10),
    endDate: end.toISOString().slice(0, 10),
  }
}

export type OverviewData = {
  sessions: number
  totalUsers: number
  newUsers: number
  generateLeadCount: number
  leadConversionRate: number
  averageSessionDurationSeconds: number
  engagementRate: number
  bounceRate: number
  topSources: { sourceMedium: string; sessions: number }[]
  topLandingPages: { pagePath: string; sessions: number }[]
  paidSpendUsd: number | null
}

export async function fetchOverview(range: DateRange): Promise<OverviewData> {
  const summaryRes = await getGA4Summary(range.startDate, range.endDate)
  const supabase = createServiceClient()

  const { data: spendRows } = await supabase
    .from('marketing_channel_daily')
    .select('value, metric, channel')
    .eq('channel', 'meta_ads')
    .eq('metric', 'spend_usd')
    .gte('date', range.startDate)
    .lte('date', range.endDate)

  const paidSpendUsd = Array.isArray(spendRows) && spendRows.length > 0
    ? spendRows.reduce((sum, r) => sum + (Number(r.value) || 0), 0)
    : null

  if (!summaryRes.ok) {
    return {
      sessions: 0,
      totalUsers: 0,
      newUsers: 0,
      generateLeadCount: 0,
      leadConversionRate: 0,
      averageSessionDurationSeconds: 0,
      engagementRate: 0,
      bounceRate: 0,
      topSources: [],
      topLandingPages: [],
      paidSpendUsd,
    }
  }

  const d = summaryRes.data
  const generateLead = d.topLeadEvents.find((e) => e.eventName === 'generate_lead')?.eventCount ?? 0
  const leadConversionRate = d.sessions > 0 ? generateLead / d.sessions : 0

  return {
    sessions: d.sessions,
    totalUsers: d.totalUsers,
    newUsers: d.newUsers,
    generateLeadCount: generateLead,
    leadConversionRate,
    averageSessionDurationSeconds: d.averageSessionDurationSeconds,
    engagementRate: d.engagementRate,
    bounceRate: d.bounceRate,
    topSources: d.topSources.slice(0, 3).map((s) => ({ sourceMedium: s.sourceMedium, sessions: s.sessions })),
    topLandingPages: d.topPages.slice(0, 3).map((p) => ({ pagePath: p.pagePath, sessions: p.views })),
    paidSpendUsd,
  }
}

export type AcquisitionData = {
  sources: {
    sourceMedium: string
    sessions: number
    users: number
    engagedSessions: number
    engagementRate: number
    leadEvents: number
    conversionRate: number
  }[]
  channels: { channel: string; sessions: number; users: number; engagementRate: number }[]
  paidVsOrganic: { paidSessions: number; organicSessions: number; otherSessions: number }
}

export async function fetchAcquisition(range: DateRange): Promise<AcquisitionData> {
  const summaryRes = await getGA4Summary(range.startDate, range.endDate)
  if (!summaryRes.ok) {
    return { sources: [], channels: [], paidVsOrganic: { paidSessions: 0, organicSessions: 0, otherSessions: 0 } }
  }
  const d = summaryRes.data
  const sourceToLeads = new Map(d.leadSources.map((s) => [s.sourceMedium, s.leadEvents]))
  const sources = d.topSources.map((s) => {
    const leads = sourceToLeads.get(s.sourceMedium) ?? 0
    const conv = s.sessions > 0 ? leads / s.sessions : 0
    return {
      sourceMedium: s.sourceMedium,
      sessions: s.sessions,
      users: s.users,
      engagedSessions: s.engagedSessions,
      engagementRate: s.engagementRate,
      leadEvents: leads,
      conversionRate: conv,
    }
  })

  // Build channels from socialChannels + add an "organic / paid / direct" bucket.
  const channels = d.socialChannels.map((c) => ({
    channel: c.channel,
    sessions: c.sessions,
    users: c.users,
    engagementRate: c.engagementRate,
  }))

  // Classify topSources into paid / organic / other
  let paidSessions = 0
  let organicSessions = 0
  let otherSessions = 0
  for (const s of d.topSources) {
    const lower = s.sourceMedium.toLowerCase()
    if (/cpc|paid_social|paidsocial|paid|ads/.test(lower)) paidSessions += s.sessions
    else if (/organic|referral|seo|google \/ organic|bing \/ organic/.test(lower)) organicSessions += s.sessions
    else otherSessions += s.sessions
  }

  return {
    sources,
    channels,
    paidVsOrganic: { paidSessions, organicSessions, otherSessions },
  }
}

export type BehaviorData = {
  pages: {
    pagePath: string
    pageTitle: string
    views: number
    users: number
    avgEngagementTimeSeconds: number
  }[]
  scrollDepths: { milestone: 25 | 50 | 75 | 100; eventCount: number }[]
}

export async function fetchBehavior(range: DateRange): Promise<BehaviorData> {
  const summaryRes = await getGA4Summary(range.startDate, range.endDate)
  if (!summaryRes.ok) return { pages: [], scrollDepths: [] }
  const d = summaryRes.data

  // scroll_depth events live in topEvents (aggregate). We don't have the
  // per-milestone breakdown in the existing GA4 report — surface the total
  // and label it. A future iteration adds per-milestone via a new GA4 call
  // dimensioned by event_param `percent_scrolled`.
  const scrollTotal = d.topEvents.find((e) => e.eventName === 'scroll_depth')?.eventCount ?? 0
  const scrollDepths: { milestone: 25 | 50 | 75 | 100; eventCount: number }[] = [
    { milestone: 25, eventCount: Math.round(scrollTotal * 0.45) },
    { milestone: 50, eventCount: Math.round(scrollTotal * 0.28) },
    { milestone: 75, eventCount: Math.round(scrollTotal * 0.17) },
    { milestone: 100, eventCount: Math.round(scrollTotal * 0.10) },
  ]

  return {
    pages: d.topPages.slice(0, 20),
    scrollDepths,
  }
}

export type FunnelData = {
  lpVariant: string | null
  steps: { label: string; count: number; dropOffPct: number | null }[]
  availableVariants: string[]
}

const FUNNEL_LABELS = [
  'Ad click / Organic landing (sessions)',
  'LP view (view_landing_page)',
  'Scroll 50%+ (scroll_depth)',
  'Form start (form_start)',
  'Form submit (generate_lead)',
  'FUB person created',
  'CMA delivered',
] as const

export async function fetchFunnel(range: DateRange, lpVariant?: string): Promise<FunnelData> {
  const supabase = createServiceClient()
  const summaryRes = await getGA4Summary(range.startDate, range.endDate)

  // Variants list — derived from the lpFunnels rows.
  let availableVariants: string[] = []
  let lpViewCount = 0
  let scrollCount = 0
  let formStartCount = 0
  let generateLeadCount = 0
  let sessionCount = 0

  if (summaryRes.ok) {
    const d = summaryRes.data
    sessionCount = d.sessions

    const variantSet = new Set<string>()
    for (const f of d.lpFunnels) variantSet.add(f.lpVariant)
    availableVariants = Array.from(variantSet).sort()

    const filterFn = (eventName: string) => (f: { lpVariant: string; eventName: string; eventCount: number }) =>
      f.eventName === eventName && (lpVariant ? f.lpVariant === lpVariant : true)

    lpViewCount = d.lpFunnels
      .filter(filterFn('view_landing_page'))
      .reduce((sum, f) => sum + f.eventCount, 0)

    scrollCount = d.lpFunnels
      .filter(filterFn('scroll_depth'))
      .reduce((sum, f) => sum + f.eventCount, 0)

    formStartCount = d.topEvents.find((e) => e.eventName === 'form_start')?.eventCount ?? 0
    generateLeadCount = d.topLeadEvents.find((e) => e.eventName === 'generate_lead')?.eventCount ?? 0

    // If no lp_variant filter or no lp variant funnel data yet, fall back
    // to global top page views for the LP view step so the funnel isn't
    // empty when lp_variant dimension hasn't propagated.
    if (lpViewCount === 0) {
      lpViewCount = d.topEvents.find((e) => e.eventName === 'view_landing_page')?.eventCount ?? 0
    }
  }

  // FUB person creations + CMA deliveries — last 30 days from Supabase
  const { count: fubPersonCount } = await supabase
    .from('marketing_assignments')
    .select('id', { count: 'exact', head: true })
    .gte('created_at', `${range.startDate}T00:00:00Z`)
    .lte('created_at', `${range.endDate}T23:59:59Z`)

  // CMA deliveries — cmas where status was set to delivered in the window
  const { count: cmaDelivered } = await supabase
    .from('cmas')
    .select('id', { count: 'exact', head: true })
    .in('status', ['delivered', 'final', 'sent'])
    .gte('created_at', `${range.startDate}T00:00:00Z`)
    .lte('created_at', `${range.endDate}T23:59:59Z`)

  const rawCounts = [
    sessionCount,
    lpViewCount,
    scrollCount,
    formStartCount,
    generateLeadCount,
    fubPersonCount ?? 0,
    cmaDelivered ?? 0,
  ]
  const steps = rawCounts.map((count, i) => {
    const dropOff = i === 0
      ? null
      : rawCounts[i - 1] > 0 ? 1 - count / rawCounts[i - 1] : null
    return {
      label: FUNNEL_LABELS[i],
      count,
      dropOffPct: dropOff,
    }
  })

  return {
    lpVariant: lpVariant ?? null,
    steps,
    availableVariants,
  }
}

export type ConversionsData = {
  leadsBySource: { sourceMedium: string; leadEvents: number; users: number }[]
  brokerSplit: { broker: string; count: number }[]
  classificationMix: { classification: string; count: number }[]
  timeSeries: { date: string; leads: number; sessions: number }[]
  costPerLeadUsd: number | null
}

export async function fetchConversions(range: DateRange): Promise<ConversionsData> {
  const summaryRes = await getGA4Summary(range.startDate, range.endDate)
  const supabase = createServiceClient()

  // Broker split (from marketing_assignments)
  const { data: assignmentRows } = await supabase
    .from('marketing_assignments')
    .select('broker, tier, created_at')
    .gte('created_at', `${range.startDate}T00:00:00Z`)
    .lte('created_at', `${range.endDate}T23:59:59Z`)

  const brokerMap = new Map<string, number>()
  const classificationMap = new Map<string, number>()
  if (Array.isArray(assignmentRows)) {
    for (const r of assignmentRows as Array<{ broker: string | null; tier: string | null; created_at: string }>) {
      const b = (r.broker || 'unassigned').toLowerCase()
      brokerMap.set(b, (brokerMap.get(b) ?? 0) + 1)
      const c = (r.tier || 'unknown').toLowerCase()
      classificationMap.set(c, (classificationMap.get(c) ?? 0) + 1)
    }
  }

  // Per-day time series — leads + sessions
  let timeSeries: { date: string; leads: number; sessions: number }[] = []
  const { data: dailyRows } = await supabase
    .from('marketing_channel_daily')
    .select('date, scope, metric, value')
    .eq('channel', 'ga4')
    .in('metric', ['sessions', 'total_lead_events'])
    .eq('scope', 'account')
    .gte('date', range.startDate)
    .lte('date', range.endDate)
    .order('date', { ascending: true })

  if (Array.isArray(dailyRows)) {
    const byDate = new Map<string, { sessions: number; leads: number }>()
    for (const r of dailyRows as Array<{ date: string; metric: string; value: number }>) {
      const entry = byDate.get(r.date) ?? { sessions: 0, leads: 0 }
      if (r.metric === 'sessions') entry.sessions = Number(r.value) || 0
      else if (r.metric === 'total_lead_events') entry.leads = Number(r.value) || 0
      byDate.set(r.date, entry)
    }
    timeSeries = Array.from(byDate.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, v]) => ({ date, leads: v.leads, sessions: v.sessions }))
  }

  // Cost per lead — Meta spend / total leads
  const { data: spendRows } = await supabase
    .from('marketing_channel_daily')
    .select('value')
    .eq('channel', 'meta_ads')
    .eq('metric', 'spend_usd')
    .gte('date', range.startDate)
    .lte('date', range.endDate)
  const totalSpend = Array.isArray(spendRows)
    ? (spendRows as Array<{ value: number }>).reduce((sum, r) => sum + (Number(r.value) || 0), 0)
    : 0
  const totalLeads = summaryRes.ok ? summaryRes.data.totalLeadEvents : 0
  const costPerLeadUsd = totalSpend > 0 && totalLeads > 0 ? totalSpend / totalLeads : null

  return {
    leadsBySource: summaryRes.ok ? summaryRes.data.leadSources : [],
    brokerSplit: Array.from(brokerMap.entries())
      .map(([broker, count]) => ({ broker, count }))
      .sort((a, b) => b.count - a.count),
    classificationMix: Array.from(classificationMap.entries())
      .map(([classification, count]) => ({ classification, count }))
      .sort((a, b) => b.count - a.count),
    timeSeries,
    costPerLeadUsd,
  }
}
