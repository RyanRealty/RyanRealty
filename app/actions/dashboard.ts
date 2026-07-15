'use server'

import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { getMetaPageTokenTrimmed } from '@/lib/meta-env'
import { createServiceClient } from '@/lib/supabase/service'
import { getGA4Summary } from './ga4-report'
import {
  getAdminSyncCounts,
  getListingsBreakdown,
  getListingHistoryTableStatus,
} from './listings'
import { getSyncCursor } from './sync-full-cron'
import { getSyncHistory } from './sync-history'

export type DashboardSyncData = {
  cursor: Awaited<ReturnType<typeof getSyncCursor>>
  history: Awaited<ReturnType<typeof getSyncHistory>>
  counts: Awaited<ReturnType<typeof getAdminSyncCounts>>
  breakdown: Awaited<ReturnType<typeof getListingsBreakdown>>
  historyTableStatus: Awaited<ReturnType<typeof getListingHistoryTableStatus>>
}

export async function getDashboardSyncData(): Promise<DashboardSyncData> {
  const [cursor, history, counts, breakdown, historyTableStatus] = await Promise.all([
    getSyncCursor(),
    getSyncHistory(20),
    getAdminSyncCounts(),
    getListingsBreakdown(),
    getListingHistoryTableStatus(),
  ])
  return { cursor, history, counts, breakdown, historyTableStatus }
}

export type DashboardLeadData = {
  totalVisits: number
  visitsWithUser: number
  visitsLast24h: number
  visitsWithUserLast24h: number
  recentVisits: { path: string; visit_id: string; user_id: string | null; created_at: string }[]
}

export async function getDashboardLeadData(): Promise<DashboardLeadData> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url?.trim() || !serviceKey?.trim()) {
    return {
      totalVisits: 0,
      visitsWithUser: 0,
      visitsLast24h: 0,
      visitsWithUserLast24h: 0,
      recentVisits: [],
    }
  }
  const supabase = createClient(url, serviceKey)

  const now = new Date()
  const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString()

  const [totalRes, withUserRes, last24hRes, withUser24hRes, recentRes] = await Promise.all([
    supabase.from('visits').select('*', { count: 'exact', head: true }),
    supabase.from('visits').select('*', { count: 'exact', head: true }).not('user_id', 'is', null),
    supabase.from('visits').select('*', { count: 'exact', head: true }).gte('created_at', dayAgo),
    supabase
      .from('visits')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', dayAgo)
      .not('user_id', 'is', null),
    supabase
      .from('visits')
      .select('path, visit_id, user_id, created_at')
      .order('created_at', { ascending: false })
      .limit(50),
  ])

  return {
    totalVisits: totalRes.count ?? 0,
    visitsWithUser: withUserRes.count ?? 0,
    visitsLast24h: last24hRes.count ?? 0,
    visitsWithUserLast24h: withUser24hRes.count ?? 0,
    recentVisits: (recentRes.data ?? []) as DashboardLeadData['recentVisits'],
  }
}

type DashboardMarketingMetaSummary = {
  spend: number
  impressions: number
  reach: number
  clicks: number
  ctr: number
  cpm: number
  frequency: number
  leadActions: number
  costPerLead: number | null
}

export type DashboardMarketingData = {
  windowLabel: string
  bendMarketContext: {
    available: boolean
    activeListings: number | null
    medianListPrice: number | null
    monthsOfSupply: number | null
    soldCount30d: number | null
    medianClosePrice90d: number | null
    marketHealthLabel: string | null
    error: string | null
  }
  ga4: {
    ok: boolean
    sessions: number
    socialSessions: number
    facebookLeadEvents: number
    leadEventRate: number
    error: string | null
  }
  metaAds: {
    configured: boolean
    summary: DashboardMarketingMetaSummary | null
    error: string | null
  }
  website: {
    sellerVisits30d: number
    sellerVisitsFromFacebook30d: number
    valuationRequests30d: number
    valuationRateFromFacebookSellerVisits: number | null
  }
  fub: {
    configured: boolean
    contactsSynced30d: number
    facebookContacts30d: number
    facebookContactCaptureRate: number | null
    error: string | null
  }
  fubPipeline: {
    mattBrokerId: string | null
    myLeadsTotal: number
    realtorExcludedCount: number
    targetableLeadPool: number
    activePipelineCount: number
    stageCounts: Array<{ stage: string; count: number }>
    outreachAutomationPlan: string[]
  }
  reportCard: {
    score: number
    verdict: 'strong' | 'needs_attention' | 'at_risk'
    items: Array<{
      action: 'scale' | 'pause' | 'test' | 'fix' | 'watch'
      priority: 'high' | 'medium' | 'low'
      title: string
      rationale: string
    }>
  }
  automation: {
    latestInsightId: string | null
    latestGeneratedAt: string | null
    latestStatus: string | null
    latestTitle: string | null
    latestPickupPrompt: string | null
    latestExecutionInsightId: string | null
    latestExecutionGeneratedAt: string | null
    latestExecutionStatus: string | null
    latestExecutionTitle: string | null
    latestExecutionMode: 'apply' | 'dry_run' | null
    latestExecutionAppliedCount: number | null
    latestExecutionGeneratedCount: number | null
  }
  nextActions: string[]
}

function parseNumber(value: unknown): number {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

type FubContactSnapshot = {
  id: string
  broker_id: string | null
  stage: string | null
  tags: unknown
  email: string | null
  name: string | null
}

function isLikelyRealtorContact(row: FubContactSnapshot): boolean {
  const normalizedTags = Array.isArray(row.tags)
    ? row.tags.map((value) => String(value).toLowerCase())
    : []

  const keywordMatch = normalizedTags.some((tag) =>
    ['realtor', 'real estate agent', 'agent', 'broker', 'lender', 'loan officer', 'title rep', 'escrow'].some((keyword) =>
      tag.includes(keyword)
    )
  )

  if (keywordMatch) return true

  const normalizedName = (row.name ?? '').toLowerCase()
  if (/\b(realtor|broker|agent)\b/.test(normalizedName)) return true

  const normalizedEmail = (row.email ?? '').toLowerCase()
  if (/\b(realty|properties|brokerage|kw\.com|remax|coldwellbanker|sothebys|exprealty)\b/.test(normalizedEmail)) {
    return true
  }

  return false
}

async function getFubPipelineSnapshot(
  supabase: SupabaseClient,
  startIso: string
): Promise<DashboardMarketingData['fubPipeline']> {
  const { getMattBrokerRecord } = await import('@/lib/data')
  const mattBroker = await getMattBrokerRecord()
  const mattBrokerId = mattBroker?.id ?? null

  // Primary source: in-house CRM (lib/crm/), which replaced FUB as the
  // execution engine on 2026-06-10. FUB API access was decommissioned
  // 2026-06-24 (getFubApiKey() always returns undefined — see
  // lib/crm/fub-env.ts), so crm_people is the live, current source of
  // lead/pipeline data. The old fub_contacts_cache / fetchMyLeadsFromFubLive
  // fallback branch was deleted 2026-07-14: the cache stopped syncing at the
  // cutover and the live fetch was a guaranteed no-op, so the fallback could
  // only ever produce stale or empty data dressed up as a measurement.
  //
  // Paged read: PostgREST caps a single response at 1000 rows regardless of
  // .limit(), so a plain .limit(5000) silently truncated pipeline totals.
  const crmRows: Array<{
    id: string
    stage: string | null
    tags: unknown
    emails: unknown
    name: string | null
  }> = []
  const PAGE = 1000
  for (let from = 0; from < 20_000; from += PAGE) {
    const { data, error } = await supabase
      .from('crm_people')
      .select('id, assigned_broker, stage, tags, emails, name')
      .eq('deleted', false)
      .in('assigned_broker', ['matt', 'matt-ryan'])
      .or(`updated_at.gte.${startIso},last_activity_at.gte.${startIso}`)
      .order('id', { ascending: true })
      .range(from, from + PAGE - 1)
    if (error) {
      console.error('[getFubPipelineSnapshot] crm_people page error', error.message)
      break
    }
    const page = (data ?? []) as typeof crmRows
    crmRows.push(...page)
    if (page.length < PAGE) break
  }

  // crm_people.emails is a jsonb array of { value, isPrimary } objects (or
  // plain strings on legacy rows) — String(row.emails[0]) produced the literal
  // "[object Object]", which permanently disabled the realtor-email exclusion.
  const firstEmailValue = (field: unknown): string | null => {
    if (!Array.isArray(field)) return null
    for (const entry of field) {
      if (typeof entry === 'string' && entry.trim()) return entry.trim()
      if (entry && typeof entry === 'object') {
        const value = (entry as { value?: unknown }).value
        if (typeof value === 'string' && value.trim()) return value.trim()
      }
    }
    return null
  }

  const contacts: FubContactSnapshot[] = crmRows.map((row) => ({
    id: row.id,
    broker_id: mattBrokerId,
    stage: row.stage,
    tags: row.tags,
    email: firstEmailValue(row.emails),
    name: row.name,
  }))

  const myLeads = contacts

  const targetable = myLeads.filter((row) => !isLikelyRealtorContact(row))
  const realtorExcludedCount = myLeads.length - targetable.length

  const stageMap = new Map<string, number>()
  targetable.forEach((row) => {
    const stage = (row.stage ?? 'Unstaged').trim() || 'Unstaged'
    stageMap.set(stage, (stageMap.get(stage) ?? 0) + 1)
  })

  const stageCounts = Array.from(stageMap.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([stage, count]) => ({ stage, count }))

  const inactiveStages = new Set(['Listing Signed', 'Closed', 'Disqualified', 'Do Not Contact', 'Archive'])
  const activePipelineCount = targetable.filter((row) => {
    const stage = (row.stage ?? '').trim()
    return !inactiveStages.has(stage)
  }).length

  return {
    mattBrokerId,
    myLeadsTotal: myLeads.length,
    realtorExcludedCount,
    targetableLeadPool: targetable.length,
    activePipelineCount,
    stageCounts,
    outreachAutomationPlan: [
      'New Lead -> SMS in 2 minutes, email in 10 minutes, call task in 15 minutes',
      'Attempting Contact -> 5-touch sequence over 7 days (SMS/email/call mix)',
      'Connected -> seller intent qualification and valuation consult offer',
      'Seller Nurture -> weekly market proof + monthly valuation nudge',
      'Appointment Set or Listing Opportunity -> pause prospecting ads and shift to trust-content retargeting',
    ],
  }
}

async function getMetaAdsSummary30d(): Promise<{
  configured: boolean
  summary: DashboardMarketingMetaSummary | null
  error: string | null
}> {
  const adAccountIdRaw = process.env.META_AD_ACCOUNT_ID?.trim()
  const token =
    getMetaPageTokenTrimmed() ||
    process.env.META_APP_TOKEN?.trim() ||
    null

  if (!adAccountIdRaw || !token) {
    return {
      configured: false,
      summary: null,
      error: 'Meta Ads API env vars not fully configured',
    }
  }

  const adAccountId = adAccountIdRaw.startsWith('act_') ? adAccountIdRaw : `act_${adAccountIdRaw}`
  const url = new URL(`https://graph.facebook.com/v18.0/${adAccountId}/insights`)
  url.searchParams.set(
    'fields',
    'spend,impressions,reach,clicks,ctr,cpm,frequency,actions,cost_per_action_type'
  )
  url.searchParams.set('date_preset', 'last_30d')
  url.searchParams.set('access_token', token)

  try {
    const response = await fetch(url.toString(), { cache: 'no-store' })
    const payload = (await response.json()) as {
      data?: Array<Record<string, unknown>>
      error?: { message?: string }
    }

    if (!response.ok || payload.error) {
      return {
        configured: true,
        summary: null,
        error: payload.error?.message || `Meta API request failed with HTTP ${response.status}`,
      }
    }

    const row = payload.data?.[0] ?? {}
    const actions = Array.isArray(row.actions)
      ? (row.actions as Array<{ action_type?: string; value?: string }>)
      : []

    const leadActions = actions.reduce((total, action) => {
      const actionType = (action.action_type || '').toLowerCase()
      if (!actionType.includes('lead')) return total
      return total + parseNumber(action.value)
    }, 0)

    const spend = parseNumber(row.spend)
    const summary: DashboardMarketingMetaSummary = {
      spend,
      impressions: parseNumber(row.impressions),
      reach: parseNumber(row.reach),
      clicks: parseNumber(row.clicks),
      ctr: parseNumber(row.ctr),
      cpm: parseNumber(row.cpm),
      frequency: parseNumber(row.frequency),
      leadActions,
      costPerLead: leadActions > 0 ? spend / leadActions : null,
    }

    return { configured: true, summary, error: null }
  } catch (error) {
    return {
      configured: true,
      summary: null,
      error: error instanceof Error ? error.message : 'Failed to fetch Meta Ads insights',
    }
  }
}

type BendMarketContext = DashboardMarketingData['bendMarketContext']

async function getBendMarketContext(supabase: SupabaseClient): Promise<BendMarketContext> {
  void supabase
  try {
    const { getMarketPulseRowForGeo } = await import('@/lib/data')
    const data = await getMarketPulseRowForGeo({
      geoType: 'city',
      geoSlug: 'bend',
      propertyType: 'A',
      columns:
        'active_count, median_list_price, months_of_supply, sold_count_30d, median_close_price_90d, market_health_label',
    })

    if (!data) {
      return {
        available: false,
        activeListings: null,
        medianListPrice: null,
        monthsOfSupply: null,
        soldCount30d: null,
        medianClosePrice90d: null,
        marketHealthLabel: null,
        error: 'No Bend pulse row',
      }
    }

    const row = data as Record<string, unknown>
    const numOrNull = (v: unknown): number | null => {
      const n = Number(v)
      return Number.isFinite(n) ? n : null
    }

    return {
      available: true,
      activeListings: numOrNull(row.active_count),
      medianListPrice: numOrNull(row.median_list_price),
      monthsOfSupply: numOrNull(row.months_of_supply),
      soldCount30d: numOrNull(row.sold_count_30d),
      medianClosePrice90d: numOrNull(row.median_close_price_90d),
      marketHealthLabel:
        typeof row.market_health_label === 'string' ? row.market_health_label : null,
      error: null,
    }
  } catch (err) {
    return {
      available: false,
      activeListings: null,
      medianListPrice: null,
      monthsOfSupply: null,
      soldCount30d: null,
      medianClosePrice90d: null,
      marketHealthLabel: null,
      error: err instanceof Error ? err.message : 'Bend pulse fetch failed',
    }
  }
}

export async function getDashboardMarketingData(): Promise<DashboardMarketingData> {
  const now = new Date()
  const start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
  const startIso = start.toISOString()
  const startDate = start.toISOString().slice(0, 10)
  const endDate = now.toISOString().slice(0, 10)

  const gaPromise = getGA4Summary(startDate, endDate)
  const metaPromise = getMetaAdsSummary30d()

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  let sellerVisits30d = 0
  let sellerVisitsFromFacebook30d = 0
  let valuationRequests30d = 0
  let contactsSynced30d = 0
  let facebookContacts30d = 0
  let bendMarketContext: BendMarketContext = {
    available: false,
    activeListings: null,
    medianListPrice: null,
    monthsOfSupply: null,
    soldCount30d: null,
    medianClosePrice90d: null,
    marketHealthLabel: null,
    error: 'Supabase not configured',
  }
  let fubPipeline: DashboardMarketingData['fubPipeline'] = {
    mattBrokerId: null,
    myLeadsTotal: 0,
    realtorExcludedCount: 0,
    targetableLeadPool: 0,
    activePipelineCount: 0,
    stageCounts: [],
    outreachAutomationPlan: [
      'New Lead -> SMS in 2 minutes, email in 10 minutes, call task in 15 minutes',
      'Attempting Contact -> 5-touch sequence over 7 days (SMS/email/call mix)',
      'Connected -> seller intent qualification and valuation consult offer',
      'Seller Nurture -> weekly market proof + monthly valuation nudge',
      'Appointment Set or Listing Opportunity -> pause prospecting ads and shift to trust-content retargeting',
    ],
  }

  if (url?.trim() && serviceKey?.trim()) {
    const supabase = createClient(url, serviceKey)

    // Contact metrics come from crm_people via getLeadIntake — the org-wide
    // "new leads" source of truth (lib/data/crm/getLeadIntake.ts). The old
    // fub_contacts_cache counts froze at the 2026-06-24 FUB decommission and
    // read a permanent fabricated 0. Snap the intake window to 10-minute
    // buckets so its unstable_cache key stays stable (getDashboardKpis
    // pattern) — a millisecond now() would force a full re-read per render.
    const TEN_MIN_MS = 600_000
    const intakeEndMs = Math.ceil(now.getTime() / TEN_MIN_MS) * TEN_MIN_MS
    const intakePromise = (async () => {
      const { getLeadIntake } = await import('@/lib/data')
      return getLeadIntake({
        startIso: new Date(intakeEndMs - 30 * 24 * 60 * 60 * 1000).toISOString(),
        endIso: new Date(intakeEndMs).toISOString(),
      })
    })()

    const [
      sellerVisitsRes,
      sellerFacebookRes,
      valuationRes,
      intake,
      pipelineSnapshot,
      bendCtx,
    ] = await Promise.all([
        supabase
          .from('visits')
          .select('id', { count: 'exact', head: true })
          .gte('created_at', startIso)
          .or('path.ilike./sell%,path.ilike./home-valuation%'),
        // Seller visits attributed to Facebook: utm_source=facebook in path,
        // an fbclid present (paid clickthroughs auto-tagged by Facebook), or
        // a referrer host in the Meta family (facebook / instagram / m.me).
        supabase
          .from('visits')
          .select('id', { count: 'exact', head: true })
          .gte('created_at', startIso)
          .or('path.ilike./sell%,path.ilike./home-valuation%')
          .or(
            [
              'path.ilike.%utm_source=facebook%',
              'path.ilike.%fbclid=%',
              'referrer.ilike.%facebook.%',
              'referrer.ilike.%instagram.%',
              'referrer.ilike.%m.me%',
            ].join(',')
          ),
        supabase
          .from('valuation_requests')
          .select('id', { count: 'exact', head: true })
          .gte('created_at', startIso),
        intakePromise,
        getFubPipelineSnapshot(supabase, startIso),
        getBendMarketContext(supabase),
      ])

    sellerVisits30d = sellerVisitsRes.count ?? 0
    sellerVisitsFromFacebook30d = sellerFacebookRes.count ?? 0
    valuationRequests30d = valuationRes.count ?? 0
    // All crm_people rows created in the window (imports included) — the
    // honest "contacts added" figure now that FUB syncing is dead.
    contactsSynced30d = intake.totalRows
    // Social-channel inbound leads per leadSourceTaxonomy (Meta lead forms +
    // paid/organic social) — the taxonomy-consistent "Facebook sourced" count.
    facebookContacts30d = intake.byChannel.find((c) => c.channel === 'social')?.count ?? 0
    fubPipeline = pipelineSnapshot
    bendMarketContext = bendCtx
  }

  const [ga, meta] = await Promise.all([gaPromise, metaPromise])
  const socialSessions = ga.ok ? ga.data.socialChannels.reduce((sum, row) => sum + row.sessions, 0) : 0
  const facebookLeadEvents = ga.ok
    ? ga.data.leadSources
        .filter((row) => /facebook/i.test(row.sourceMedium))
        .reduce((sum, row) => sum + row.leadEvents, 0)
    : 0

  const valuationRateFromFacebookSellerVisits =
    sellerVisitsFromFacebook30d > 0 ? valuationRequests30d / sellerVisitsFromFacebook30d : null
  const facebookContactCaptureRate =
    facebookLeadEvents > 0 ? facebookContacts30d / facebookLeadEvents : null

  const nextActions: string[] = []
  if (!meta.configured) nextActions.push('Set META_AD_ACCOUNT_ID and Meta access token to unlock paid metrics.')
  if (!ga.ok) nextActions.push('Finish GA4 service account setup to measure full acquisition-to-lead performance.')
  if (sellerVisitsFromFacebook30d > 0 && valuationRateFromFacebookSellerVisits !== null && valuationRateFromFacebookSellerVisits < 0.02) {
    nextActions.push('Facebook seller landing conversion is under 2.0%; test new valuation offer and shorter form.')
  }
  if (meta.summary && meta.summary.frequency >= 3.5) {
    nextActions.push('Meta ad frequency is high; rotate fresh creative and widen top-of-funnel audience.')
  }
  if (nextActions.length === 0) {
    nextActions.push('Pipeline is healthy; run one new creative test and one audience test this week.')
  }

  const reportItems: DashboardMarketingData['reportCard']['items'] = []
  let score = 0

  if (meta.configured && meta.summary) score += 20
  else {
    reportItems.push({
      action: 'fix',
      priority: 'high',
      title: 'Restore Meta Ads API visibility',
      rationale: 'Meta summary metrics are missing, so weekly paid optimization is partly blind.',
    })
  }

  if (ga.ok) score += 20
  else {
    reportItems.push({
      action: 'fix',
      priority: 'high',
      title: 'Complete GA4 service account setup',
      rationale: 'GA4 is required for reliable source and landing performance attribution.',
    })
  }

  // FUB API access was decommissioned 2026-06-24 — the in-house CRM
  // (crm_people, sourced by getFubPipelineSnapshot above) is the live
  // pipeline/quality signal now, not a direct FUB API connection.
  if (fubPipeline.myLeadsTotal > 0) score += 15
  else {
    reportItems.push({
      action: 'fix',
      priority: 'high',
      title: 'CRM pipeline data is empty',
      rationale: 'No recent crm_people activity for Matt found, so quality and downstream listing outcomes are not measurable.',
    })
  }

  if (meta.summary) {
    if (meta.summary.frequency <= 2.8) score += 10
    else if (meta.summary.frequency <= 3.5) score += 5
    else {
      reportItems.push({
        action: 'test',
        priority: 'medium',
        title: 'Creative fatigue risk detected',
        rationale: `Frequency is ${meta.summary.frequency.toFixed(2)}. Refresh creative and broaden audience to avoid rising CPL.`,
      })
    }

    if (meta.summary.ctr >= 1.2) score += 10
    else if (meta.summary.ctr >= 0.8) score += 5
    else {
      reportItems.push({
        action: 'test',
        priority: 'medium',
        title: 'Low click-through rate',
        rationale: `CTR is ${meta.summary.ctr.toFixed(2)}%. Test stronger hooks, seller pain-point headlines, and first-frame visuals.`,
      })
    }

    if (meta.summary.costPerLead !== null) {
      if (meta.summary.costPerLead <= 25) score += 10
      else if (meta.summary.costPerLead <= 40) score += 5
      else {
        reportItems.push({
          action: 'pause',
          priority: 'high',
          title: 'Cost per lead above target',
          rationale: `CPL is ${meta.summary.costPerLead.toFixed(2)}. Pause weakest variants and reallocate to best performers.`,
        })
      }
    }
  }

  if (valuationRateFromFacebookSellerVisits !== null) {
    if (valuationRateFromFacebookSellerVisits >= 0.03) score += 10
    else if (valuationRateFromFacebookSellerVisits >= 0.02) score += 5
    else {
      reportItems.push({
        action: 'test',
        priority: 'high',
        title: 'Landing conversion below benchmark',
        rationale: `Facebook seller visit to valuation rate is ${(valuationRateFromFacebookSellerVisits * 100).toFixed(1)}%. Test offer framing and simplify form friction.`,
      })
    }
  }

  if (facebookContactCaptureRate !== null) {
    if (facebookContactCaptureRate >= 0.8) score += 5
    else {
      reportItems.push({
        action: 'fix',
        priority: 'medium',
        title: 'Facebook to CRM capture gap',
        rationale: `Only ${(facebookContactCaptureRate * 100).toFixed(1)}% of Facebook lead events map to social-channel CRM leads (leadSourceTaxonomy). Validate webhook attribution and source tags.`,
      })
    }
  }

  // Performance signal: did anything actually happen this cycle?
  // Without this band, the score is dominated by the 55-point infra baseline
  // and stays flat at 65 even when no campaigns run. This makes it move with
  // real activity.
  const hasMetaSpend = (meta.summary?.spend ?? 0) > 0
  const hasMetaImpressions = (meta.summary?.impressions ?? 0) > 0
  if (hasMetaSpend && hasMetaImpressions) {
    score += 5
  } else {
    reportItems.push({
      action: 'fix',
      priority: 'high',
      title: 'No active Meta campaign this cycle',
      rationale: 'Meta Ads reports zero spend and zero impressions in the last 30 days. Optimization cannot improve a pipeline with no inputs. Launch or unpause a seller-targeted campaign before the next cycle.',
    })
  }
  const ga4Sessions = ga.ok ? ga.data.sessions : 0
  if (ga4Sessions >= 100) {
    score += 5
  } else if (ga4Sessions > 0) {
    reportItems.push({
      action: 'watch',
      priority: 'low',
      title: 'Site traffic below threshold',
      rationale: `GA4 reports ${ga4Sessions} sessions in the last 30 days. Optimization signal is noisy below 100 sessions. Boost organic or paid traffic this week.`,
    })
  }

  // Bend market context: surface a one-line nudge if the local market is in
  // seller-favorable conditions so the agent reading the packet has a reason
  // to launch or scale a campaign.
  if (
    bendMarketContext.available &&
    bendMarketContext.monthsOfSupply !== null &&
    bendMarketContext.monthsOfSupply <= 4
  ) {
    reportItems.push({
      action: 'scale',
      priority: 'medium',
      title: 'Bend market favors sellers right now',
      rationale: `Bend SFR months of supply is ${bendMarketContext.monthsOfSupply.toFixed(1)} (seller's market threshold is 4.0). This is the right time to push seller-acquisition spend.`,
    })
  }

  if (reportItems.length === 0) {
    reportItems.push({
      action: 'scale',
      priority: 'low',
      title: 'System is healthy this cycle',
      rationale: 'Scale budget gradually and continue one creative test plus one audience test this week.',
    })
  }

  const boundedScore = Math.max(0, Math.min(100, score))
  const verdict: DashboardMarketingData['reportCard']['verdict'] =
    boundedScore >= 75 ? 'strong' : boundedScore >= 50 ? 'needs_attention' : 'at_risk'

  let latestInsightId: string | null = null
  let latestGeneratedAt: string | null = null
  let latestStatus: string | null = null
  let latestTitle: string | null = null
  let latestPickupPrompt: string | null = null
  let latestExecutionInsightId: string | null = null
  let latestExecutionGeneratedAt: string | null = null
  let latestExecutionStatus: string | null = null
  let latestExecutionTitle: string | null = null
  let latestExecutionMode: 'apply' | 'dry_run' | null = null
  let latestExecutionAppliedCount: number | null = null
  let latestExecutionGeneratedCount: number | null = null

  if (url?.trim() && serviceKey?.trim()) {
    const supabase = createClient(url, serviceKey)
    const [latestInsightResult, latestExecutionResult] = await Promise.all([
      supabase
        .from('agent_insights')
        .select('id, created_at, status, title, data')
        .eq('insight_type', 'marketing_optimization_weekly')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from('agent_insights')
        .select('id, created_at, status, title, data')
        .eq('insight_type', 'fub_outreach_execution_weekly')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
    ])

    const latestInsight = latestInsightResult.data
    const latestExecutionInsight = latestExecutionResult.data

    latestInsightId = latestInsight?.id ?? null
    latestGeneratedAt = latestInsight?.created_at ?? null
    latestStatus = latestInsight?.status ?? null
    latestTitle = latestInsight?.title ?? null

    const payload = latestInsight?.data as { pickup_prompt?: string } | null
    latestPickupPrompt = typeof payload?.pickup_prompt === 'string' ? payload.pickup_prompt : null

    latestExecutionInsightId = latestExecutionInsight?.id ?? null
    latestExecutionGeneratedAt = latestExecutionInsight?.created_at ?? null
    latestExecutionStatus = latestExecutionInsight?.status ?? null
    latestExecutionTitle = latestExecutionInsight?.title ?? null
    const executionPayload = latestExecutionInsight?.data as {
      execution_mode?: 'apply' | 'dry_run'
      execution_items?: unknown[]
    } | null
    latestExecutionMode =
      executionPayload?.execution_mode === 'apply' || executionPayload?.execution_mode === 'dry_run'
        ? executionPayload.execution_mode
        : null
    latestExecutionGeneratedCount = Array.isArray(executionPayload?.execution_items)
      ? executionPayload.execution_items.length
      : null
    latestExecutionAppliedCount = Array.isArray(executionPayload?.execution_items)
      ? executionPayload.execution_items.filter((item) => {
          if (typeof item !== 'object' || item === null) return false
          return Boolean((item as { applied?: boolean }).applied)
        }).length
      : null
  }

  return {
    windowLabel: 'Last 30 days',
    bendMarketContext,
    ga4: {
      ok: ga.ok,
      sessions: ga.ok ? ga.data.sessions : 0,
      socialSessions,
      facebookLeadEvents,
      leadEventRate: ga.ok ? ga.data.leadEventRate : 0,
      error: ga.ok ? null : ga.error,
    },
    metaAds: meta,
    website: {
      sellerVisits30d,
      sellerVisitsFromFacebook30d,
      valuationRequests30d,
      valuationRateFromFacebookSellerVisits,
    },
    fub: {
      // FUB API access was decommissioned 2026-06-24 (lib/crm/fub-env.ts) —
      // "configured" now means the in-house CRM pipeline (crm_people) has
      // live data, not that a FUB API key is set. contactsSynced30d and
      // facebookContacts30d are crm_people figures via getLeadIntake (the
      // dead fub_contacts_cache reads were removed 2026-07-14).
      configured: fubPipeline.myLeadsTotal > 0,
      contactsSynced30d,
      facebookContacts30d,
      facebookContactCaptureRate,
      error: fubPipeline.myLeadsTotal > 0 ? null : 'No recent crm_people activity found for Matt',
    },
    fubPipeline,
    reportCard: {
      score: boundedScore,
      verdict,
      items: reportItems,
    },
    automation: {
      latestInsightId,
      latestGeneratedAt,
      latestStatus,
      latestTitle,
      latestPickupPrompt,
      latestExecutionInsightId,
      latestExecutionGeneratedAt,
      latestExecutionStatus,
      latestExecutionTitle,
      latestExecutionMode,
      latestExecutionAppliedCount,
      latestExecutionGeneratedCount,
    },
    nextActions,
  }
}

export type DashboardDataQuality = {
  totalListings: number
  missingPrimaryPhoto: number
  classifiedPhotos: number
}

export async function getDashboardDataQuality(): Promise<DashboardDataQuality> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url?.trim() || !serviceKey?.trim()) {
    return { totalListings: 0, missingPrimaryPhoto: 0, classifiedPhotos: 0 }
  }
  const supabase = createClient(url, serviceKey)

  void supabase // legacy client retained for sibling queries elsewhere
  const { getListingTilesCount } = await import('@/lib/data')
  const [totalActivePending, missingPhotoTiles, classifiedRes] = await Promise.all([
    // DAL: exact head-count of active+pending tiles via listing_tile_mv.
    // scope:'all' — admin data-quality counts intentionally cover the full
    // statewide feed (the default service-area guard would shrink them; audit
    // P0-3). Count query, NOT a row fetch: the old limit-500 tile fetch pegged
    // totalListings at exactly 500 forever (the feed has far more rows).
    getListingTilesCount({ status: 'active-and-pending', scope: 'all' }),
    // DAL: active+pending tiles missing a hero photo (feed-wide, see above).
    getListingTilesCount({ status: 'active-and-pending', missingPhoto: true, scope: 'all' }),
    createClient(url, serviceKey)
      .from('listing_photo_classifications')
      .select('*', { count: 'exact', head: true }),
  ])

  const totalListings = totalActivePending
  const missingPrimaryPhoto = missingPhotoTiles
  const classifiedPhotos = classifiedRes.count ?? 0

  return { totalListings, missingPrimaryPhoto, classifiedPhotos }
}

export type DashboardContentStatus = {
  publishedGuides: number
  publishedBlogPosts: number
  communitiesWithDescription: number
}

export async function getDashboardContentStatus(): Promise<{
  data: DashboardContentStatus | null
  error: string | null
}> {
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!url?.trim() || !key?.trim()) {
      return {
        data: {
          publishedGuides: 0,
          publishedBlogPosts: 0,
          communitiesWithDescription: 0,
        },
        error: null,
      }
    }

    const supabase = createServiceClient()
    const { countCommunitiesNotNull } = await import('@/lib/data')
    const [guidesRes, blogRes, commCount] = await Promise.all([
      supabase.from('guides').select('id', { count: 'exact', head: true }).eq('status', 'published'),
      supabase.from('blog_posts').select('id', { count: 'exact', head: true }).eq('status', 'published'),
      countCommunitiesNotNull('description'),
    ])
    const commRes = { count: commCount, error: null as { message: string } | null }

    if (guidesRes.error) {
      console.error('[getDashboardContentStatus] guides', guidesRes.error)
      return { data: null, error: 'Failed to load content status' }
    }
    if (blogRes.error) {
      console.error('[getDashboardContentStatus] blog_posts', blogRes.error)
      return { data: null, error: 'Failed to load content status' }
    }

    return {
      data: {
        publishedGuides: guidesRes.count ?? 0,
        publishedBlogPosts: blogRes.count ?? 0,
        communitiesWithDescription: commRes.count ?? 0,
      },
      error: null,
    }
  } catch (err) {
    console.error('[getDashboardContentStatus]', err)
    return { data: null, error: 'Failed to load content status' }
  }
}
