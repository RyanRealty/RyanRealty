/**
 * Data layer for /admin/analytics.
 *
 * Each function returns a typed, predictable shape. The page composes them in
 * parallel via Promise.all. All numbers trace to either:
 *   - the GA4 Data API (via getGA4SummaryCached)
 *   - public.marketing_channel_daily (GA4 daily sessions here; Meta spend via
 *     getMetaAdSpend in lib/data)
 *   - public.valuation_requests / cmas / marketing_assignments (Supabase)
 *
 * Each numeric figure rendered on the dashboard comes from exactly one of
 * these calls. See ./citations.json for the per-figure trace.
 */
import 'server-only'
import { createServiceClient } from '@/lib/supabase/service'
import { getGA4SummaryCached } from '@/lib/ga4-cache'
import { getLeadIntake } from '@/lib/data'
import { getMetaAdSpend } from '@/lib/data/analytics/getMetaAdSpend'

/** Range dates (YYYY-MM-DD) → inclusive ISO bounds for a crm_people query. */
function rangeToIso(range: DateRange): { startIso: string; endIso: string } {
  return {
    startIso: `${range.startDate}T00:00:00Z`,
    endIso: `${range.endDate}T23:59:59Z`,
  }
}

export type DateRange = { startDate: string; endDate: string }

/**
 * Parse the searchParams `range` value into ISO dates.
 *   "today" | "7d" | "30d" | "90d" | "12m" | "ytd" — relative to now
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
  } else if (range === '12m') {
    start.setUTCFullYear(start.getUTCFullYear() - 1)
    start.setUTCHours(0, 0, 0, 0)
  } else if (range === 'ytd') {
    start.setUTCMonth(0, 1)
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
  /** Real inbound leads captured in the CRM (system of record) over the range. */
  crmLeadCount: number
  leadConversionRate: number
  averageSessionDurationSeconds: number
  engagementRate: number
  bounceRate: number
  topSources: { sourceMedium: string; sessions: number }[]
  topLandingPages: { pagePath: string; sessions: number }[]
  paidSpendUsd: number | null
  /** Sessions referred by AI assistants (lib/ai-referrers.ts host roster), most first. */
  aiReferrers: { engine: string; sessions: number; users: number }[]
}

export async function fetchOverview(range: DateRange): Promise<OverviewData> {
  const summaryRes = await getGA4SummaryCached(range.startDate, range.endDate)
  const { startIso, endIso } = rangeToIso(range)
  const intake = await getLeadIntake({ startIso, endIso })
  const crmLeadCount = intake.inboundLeads

  // Meta writes metric 'spend' at account AND campaign scope; getMetaAdSpend
  // reads the account rows only (the old 'spend_usd' read never matched a row).
  const { spendUsd: paidSpendUsd } = await getMetaAdSpend(range.startDate, range.endDate)

  if (!summaryRes.ok) {
    return {
      sessions: 0,
      totalUsers: 0,
      newUsers: 0,
      generateLeadCount: 0,
      crmLeadCount,
      leadConversionRate: 0,
      averageSessionDurationSeconds: 0,
      engagementRate: 0,
      bounceRate: 0,
      topSources: [],
      topLandingPages: [],
      paidSpendUsd,
      aiReferrers: [],
    }
  }

  const d = summaryRes.data
  const generateLead = d.topLeadEvents.find((e) => e.eventName === 'generate_lead')?.eventCount ?? 0
  // Conversion rate uses real CRM leads over GA4 sessions (accurate numerator).
  const leadConversionRate = d.sessions > 0 ? crmLeadCount / d.sessions : 0

  return {
    sessions: d.sessions,
    totalUsers: d.totalUsers,
    newUsers: d.newUsers,
    generateLeadCount: generateLead,
    crmLeadCount,
    leadConversionRate,
    averageSessionDurationSeconds: d.averageSessionDurationSeconds,
    engagementRate: d.engagementRate,
    bounceRate: d.bounceRate,
    topSources: d.topSources.slice(0, 3).map((s) => ({ sourceMedium: s.sourceMedium, sessions: s.sessions })),
    topLandingPages: d.topPages.slice(0, 3).map((p) => ({ pagePath: p.pagePath, sessions: p.views })),
    paidSpendUsd,
    aiReferrers: [...d.aiReferrers]
      .sort((a, b) => b.sessions - a.sessions)
      .map((r) => ({ engine: r.engine, sessions: r.sessions, users: r.users })),
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
  const summaryRes = await getGA4SummaryCached(range.startDate, range.endDate)
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
  /**
   * Aggregate scroll_depth event count from GA4 topEvents.
   * Per-milestone breakdown (25/50/75/100%) is NOT available in the existing
   * GA4 report and has been intentionally removed (D12 data-accuracy fix —
   * the prior code fabricated per-milestone ratios, violating §0).
   * Surface this total only; label it clearly in the UI.
   */
  scrollTotal: number
}

export async function fetchBehavior(range: DateRange): Promise<BehaviorData> {
  const summaryRes = await getGA4SummaryCached(range.startDate, range.endDate)
  if (!summaryRes.ok) return { pages: [], scrollTotal: 0 }
  const d = summaryRes.data

  // scroll_depth events live in topEvents (aggregate). The per-milestone
  // breakdown (25/50/75/100%) requires a separate GA4 report dimensioned by
  // event_param `percent_scrolled` that is not yet wired. We expose ONLY the
  // aggregate total so no fabricated numbers appear in the UI. (D12 fix)
  const scrollTotal = d.topEvents.find((e) => e.eventName === 'scroll_depth')?.eventCount ?? 0

  return {
    pages: d.topPages.slice(0, 20),
    scrollTotal,
  }
}

export type FunnelData = {
  lpVariant: string | null
  steps: { label: string; count: number; dropOffPct: number | null }[]
  availableVariants: string[]
}

// Plain words (2026-10-14). The scroll step counts every scroll milestone the
// landing pages sent (25/50/75/100), not only half-way, so it says "any depth".
const FUNNEL_LABELS = [
  'Visits (Google Analytics)',
  'Landing page viewed',
  'Scrolled the page (any depth)',
  'Started a form',
  'Sent a form',
  'Lead in the CRM',
  'CMA delivered',
] as const

export async function fetchFunnel(range: DateRange, lpVariant?: string): Promise<FunnelData> {
  const summaryRes = await getGA4SummaryCached(range.startDate, range.endDate)

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

  // Leads captured (native CRM, system of record) + CMA deliveries in window.
  const { startIso, endIso } = rangeToIso(range)
  const intake = await getLeadIntake({ startIso, endIso })
  const leadCaptured = intake.inboundLeads

  // CMA deliveries — cmas where status was set to delivered in the window
  const { countCmasInRange } = await import('@/lib/data')
  const cmaDelivered = await countCmasInRange({
    statusIn: ['delivered', 'final', 'sent'],
    fromIso: startIso,
    toIso: endIso,
  })

  const rawCounts = [
    sessionCount,
    lpViewCount,
    scrollCount,
    formStartCount,
    generateLeadCount,
    leadCaptured,
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
  leadsBySource: { sourceMedium: string; leadEvents: number }[]
  brokerSplit: { broker: string; count: number }[]
  classificationMix: { classification: string; count: number }[]
  timeSeries: { date: string; leads: number; sessions: number }[]
  costPerLeadUsd: number | null
}

export async function fetchConversions(range: DateRange): Promise<ConversionsData> {
  const supabase = createServiceClient()
  const { startIso, endIso } = rangeToIso(range)

  // Leads, broker split, source mix, per-day — all from the native CRM (system
  // of record). Attributable inbound only; prospecting/import lists excluded.
  const intake = await getLeadIntake({ startIso, endIso })

  const brokerSplit = intake.byBroker.map((b) => ({ broker: b.broker, count: b.count }))

  // Channel mix replaces the old CRM "tier" classification — more meaningful and
  // it actually populates (tier was never set on the native rows).
  const classificationMix = intake.byChannel
    .filter((c) => c.attributable)
    .map((c) => ({ classification: c.label, count: c.count }))

  const leadsBySource = intake.bySource.map((s) => ({
    sourceMedium: s.source,
    leadEvents: s.count,
  }))

  // Per-day sessions from GA4 daily snapshots; per-day leads from CRM intake.
  const leadsByDate = new Map(intake.byDay.map((d) => [d.date, d.inbound]))
  const { data: dailyRows } = await supabase
    .from('marketing_channel_daily')
    .select('date, scope, metric, value')
    .eq('channel', 'ga4')
    .eq('metric', 'sessions')
    .eq('scope', 'account')
    .gte('date', range.startDate)
    .lte('date', range.endDate)
    .order('date', { ascending: true })

  const dateSet = new Set<string>([...leadsByDate.keys()])
  const sessionsByDate = new Map<string, number>()
  if (Array.isArray(dailyRows)) {
    for (const r of dailyRows as Array<{ date: string; value: number }>) {
      sessionsByDate.set(r.date, Number(r.value) || 0)
      dateSet.add(r.date)
    }
  }
  const timeSeries = Array.from(dateSet)
    .sort((a, b) => a.localeCompare(b))
    .map((date) => ({
      date,
      leads: leadsByDate.get(date) ?? 0,
      sessions: sessionsByDate.get(date) ?? 0,
    }))

  // Cost per lead — Meta spend / real CRM leads captured.
  const { spendUsd } = await getMetaAdSpend(range.startDate, range.endDate)
  const costPerLeadUsd =
    spendUsd !== null && spendUsd > 0 && intake.inboundLeads > 0 ? spendUsd / intake.inboundLeads : null

  return {
    leadsBySource,
    brokerSplit,
    classificationMix,
    timeSeries,
    costPerLeadUsd,
  }
}
