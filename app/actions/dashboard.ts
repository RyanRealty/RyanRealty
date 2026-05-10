'use server'

import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { createServiceClient } from '@/lib/supabase/service'
import { fetchMyLeadsFromFubLive } from '@/lib/followupboss'
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
  const { data: mattBrokerRow } = await supabase
    .from('brokers')
    .select('id, slug, display_name, email')
    .or('slug.eq.matt-ryan,display_name.ilike.%matt%ryan%,email.ilike.%matt%')
    .limit(1)
    .maybeSingle()

  const mattBroker = (mattBrokerRow ?? null) as
    | { id: string; slug?: string | null; email?: string | null }
    | null
  const mattBrokerId = mattBroker?.id ?? null
  const cacheQuery = await supabase
    .from('fub_contacts_cache')
    .select('id, broker_id, stage, tags, email, name')
    .gte('synced_at', startIso)
    .limit(5000)

  let contacts: FubContactSnapshot[] = (cacheQuery.data ?? []) as FubContactSnapshot[]
  let usedLiveSource = false
  if (cacheQuery.error || contacts.length === 0) {
    const live = await fetchMyLeadsFromFubLive({
      brokerSlug: mattBroker?.slug ?? 'matt-ryan',
      brokerEmail: mattBroker?.email ?? null,
      brokerId: mattBrokerId,
    })
    if (live.rows.length > 0) {
      usedLiveSource = true
      contacts = live.rows.map((row) => ({
        id: row.fub_id,
        broker_id: mattBrokerId,
        stage: row.stage,
        tags: row.tags,
        email: row.email,
        name: row.name,
      }))
    }
  }
  const myLeads =
    usedLiveSource || !mattBrokerId
      ? contacts
      : contacts.filter((row) => row.broker_id === mattBrokerId)

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
    process.env.META_PAGE_ACCESS_TOKEN?.trim() ||
    process.env.META_PAGE_TOKEN?.trim() ||
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
    const [sellerVisitsRes, sellerFacebookRes, valuationRes, contactsRes, facebookContactsRes, pipelineSnapshot] =
      await Promise.all([
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
        supabase
          .from('fub_contacts_cache')
          .select('id', { count: 'exact', head: true })
          .gte('synced_at', startIso),
        supabase
          .from('fub_contacts_cache')
          .select('id', { count: 'exact', head: true })
          .gte('synced_at', startIso)
          .ilike('source', 'Facebook%'),
        getFubPipelineSnapshot(supabase, startIso),
      ])

    sellerVisits30d = sellerVisitsRes.count ?? 0
    sellerVisitsFromFacebook30d = sellerFacebookRes.count ?? 0
    valuationRequests30d = valuationRes.count ?? 0
    contactsSynced30d = contactsRes.count ?? 0
    facebookContacts30d = facebookContactsRes.count ?? 0
    fubPipeline = pipelineSnapshot
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

  if (process.env.FOLLOWUPBOSS_API_KEY?.trim()) score += 15
  else {
    reportItems.push({
      action: 'fix',
      priority: 'high',
      title: 'Configure Follow Up Boss API key',
      rationale: 'Without FUB connection, quality and downstream listing outcomes are not measurable.',
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
        title: 'Facebook to FUB capture gap',
        rationale: `Only ${(facebookContactCaptureRate * 100).toFixed(1)}% of Facebook lead events map to Facebook-tagged FUB contacts. Validate webhook attribution and source tags.`,
      })
    }
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
      configured: Boolean(process.env.FOLLOWUPBOSS_API_KEY?.trim()),
      contactsSynced30d,
      facebookContacts30d,
      facebookContactCaptureRate,
      error: process.env.FOLLOWUPBOSS_API_KEY?.trim() ? null : 'FOLLOWUPBOSS_API_KEY is not configured',
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

  const activeOrPending = 'StandardStatus.eq.Active,StandardStatus.eq.Pending'
  const [listingsRes, missingPhotoRes, classifiedRes] = await Promise.all([
    supabase.from('listings').select('*', { count: 'exact', head: true }).or(activeOrPending),
    supabase.from('listings').select('*', { count: 'exact', head: true }).or(activeOrPending).is('PhotoURL', null),
    supabase.from('listing_photo_classifications').select('*', { count: 'exact', head: true }),
  ])

  const totalListings = listingsRes.count ?? 0
  const missingPrimaryPhoto = missingPhotoRes.count ?? 0
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
    const [guidesRes, blogRes, commRes] = await Promise.all([
      supabase.from('guides').select('id', { count: 'exact', head: true }).eq('status', 'published'),
      supabase.from('blog_posts').select('id', { count: 'exact', head: true }).eq('status', 'published'),
      supabase.from('communities').select('id', { count: 'exact', head: true }).not('description', 'is', null),
    ])

    if (guidesRes.error) {
      console.error('[getDashboardContentStatus] guides', guidesRes.error)
      return { data: null, error: 'Failed to load content status' }
    }
    if (blogRes.error) {
      console.error('[getDashboardContentStatus] blog_posts', blogRes.error)
      return { data: null, error: 'Failed to load content status' }
    }
    if (commRes.error) {
      console.error('[getDashboardContentStatus] communities', commRes.error)
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
