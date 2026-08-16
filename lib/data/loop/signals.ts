/**
 * Company scoreboard ingest. One live pull, named sources, UNKNOWN when unread.
 * Docs: docs/plans/COMPANY_SCOREBOARD.md
 * reachability: entry-point scripts/company-scoreboard-probe.ts
 */

import type { SupabaseClient } from '@supabase/supabase-js'

import { isExpiredUnlearned } from './ledger-draft'
import { readJoinConversionStats } from './join-conversion'
import { readLookWalkBaseline } from './look-walk'
import { readMetaAudienceHold, type MetaAudienceHold } from './meta-audience-hold'
import { readVideoDecisionDocket } from './video-docket'
import { readSkySlopeMirrorFreshness } from '@/lib/tc/skyslope-mirror-freshness'

export type SignalStatus = 'ok' | 'unreadable'

export type CountByKey = Record<string, number>

export type TokenHealth = {
  table: string
  rows: number
  expiresAt: string | null
  refreshTokenPresent: boolean
  /**
   * 'auto-refresh' = access token past expires_at but a refresh token is stored:
   * the daily token-heartbeat renews it on demand. NOT a dead connection — the
   * 2026-08-15 escape was calling these "expired, Matt must reconnect."
   * 'needs-reauth' = past expiry with no refresh token: only a new OAuth grant
   * can revive it (park it unless the platform matters).
   */
  status: 'valid' | 'auto-refresh' | 'needs-reauth' | 'empty' | 'unreadable'
}

export type CompanyScoreboardSignals = {
  fetchedAt: string
  crm: {
    status: SignalStatus
    people: number
    byStage: CountByKey
    createdLast7d: number
    source: string
  }
  brain: {
    status: SignalStatus
    byStatus: CountByKey
    measured: number
    source: string
  }
  social: {
    status: SignalStatus
    tokens: TokenHealth[]
    source: string
  }
  sync: {
    status: SignalStatus
    lastDeltaSyncAt: string | null
    lastFullSyncAt: string | null
    source: string
  }
  commissions: {
    status: SignalStatus
    rows: number
    gciByStatus: CountByKey
    gciSum: number
    source: string
  }
  ledger: {
    status: SignalStatus
    rows: number
    openWindows: number
    expiredUnlearned: number
    expiredByDomain: CountByKey
    byDomain: CountByKey
    source: string
  }
  newsletter: {
    status: SignalStatus
    subscribers: number
    source: string
  }
  brokers: {
    status: SignalStatus
    count: number
    source: string
  }
  pulse: {
    status: SignalStatus
    rows: number
    byMethodology: CountByKey
    source: string
  }
  gsc: {
    status: SignalStatus
    rows28d: number
    source: string
  }
  sequences: {
    status: SignalStatus
    sequences: number
    source: string
  }
  tc: {
    status: SignalStatus
    deals: number
    skySlopeRows: number
    skySlopeLatestSyncedAt: string | null
    formUpdates: number
    source: string
  }
  search: {
    status: SignalStatus
    listingAlerts: number
    listingAlertsActive: number
    listingAlertsWithPerson: number
    savedSearchesLegacy: number
    searchAreas: number
    boundaries: number
    facetRefreshedAt: string | null
    source: string
  }
  identity: {
    status: SignalStatus
    identityMap: number
    identityMappedToCrm: number
    emailEvents7d: number
    emailOpens7d: number
    emailClicks7d: number
    visitorEvents7d: number
    audienceLastRanAt: string | null
    audienceHold: MetaAudienceHold
    source: string
  }
  cma: {
    status: SignalStatus
    rows: number
    look: SignalStatus
    lookVerdict: string | null
    lookSlug: string | null
    source: string
  }
  lookWalk: {
    status: SignalStatus
    publicRoutes: number
    publicOk: number
    viewports: string[]
    recordedAt: string | null
    source: string
  }
  join: {
    status: SignalStatus
    visits7d: number
    visitsAll: number
    conversions7d: number
    conversionsAll: number
    source: string
  }
  video: {
    status: SignalStatus
    decision: 'pending' | 'park' | 'rebuild'
    parkUsd: number
    rebuildCapPerRowUsd: number
    deadSafeZoneImports: number
    source: string
  }
}

const SOCIAL_TABLES = [
  'tiktok_auth',
  'youtube_auth',
  'linkedin_auth',
  'x_auth',
  'google_business_profile_auth',
  'threads_auth',
  'pinterest_auth',
  'nextdoor_auth',
] as const

// threads_auth carries a long-lived token with no refresh_token column.
const NO_REFRESH_COLUMN = new Set<string>(['threads_auth'])

function bump(map: CountByKey, key: string, amount = 1) {
  map[key] = (map[key] ?? 0) + amount
}

function emptyCrm(): CompanyScoreboardSignals['crm'] {
  return {
    status: 'unreadable',
    people: 0,
    byStage: {},
    createdLast7d: 0,
    source: 'crm_people (deleted=false)',
  }
}

async function countCrmStages(
  sb: SupabaseClient,
): Promise<{ error: string | null; people: number; byStage: CountByKey }> {
  const byStage: CountByKey = {}
  let people = 0
  const page = 1000
  for (let from = 0; ; from += page) {
    // fleet:test rows are verification-fleet fixtures, never business reality.
    const { data, error } = await sb
      .from('crm_people')
      .select('stage')
      .eq('deleted', false)
      .not('tags', 'cs', '{"fleet:test"}')
      .range(from, from + page - 1)
    if (error) return { error: error.message, people: 0, byStage: {} }
    const rows = data ?? []
    people += rows.length
    for (const row of rows) bump(byStage, (row.stage as string | null) || '(null)')
    if (rows.length < page) return { error: null, people, byStage }
  }
}

export async function collectCompanyScoreboardSignals(
  sb: SupabaseClient,
  now: Date = new Date(),
): Promise<CompanyScoreboardSignals> {
  const fetchedAt = now.toISOString()
  const since7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()
  const since28d = new Date(now.getTime() - 28 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)

  const [
    peopleRes,
    people7dRes,
    brainRes,
    syncRes,
    commissionsRes,
    ledgerRes,
    newsletterRes,
    brokersRes,
    pulseRes,
    gscRes,
    sequencesRes,
    dealsRes,
    skyFreshness,
    formRes,
    alertsRes,
    alertsActiveRes,
    alertsPersonRes,
    savedSearchRes,
    searchAreasRes,
    boundariesRes,
    facetRes,
    identityRes,
    identityCrmRes,
    email7dRes,
    emailOpenRes,
    emailClickRes,
    visitor7dRes,
    audienceHold,
    cmaRes,
    joinStats,
    ...tokenResults
  ] = await Promise.all([
    countCrmStages(sb),
    sb.from('crm_people').select('id', { count: 'exact', head: true }).eq('deleted', false).not('tags', 'cs', '{"fleet:test"}').gte('created_at', since7d),
    sb.from('marketing_brain_actions').select('status'),
    sb.from('sync_state').select('last_delta_sync_at,last_full_sync_at').eq('id', 'default').maybeSingle(),
    sb.from('tc_commissions').select('status,gci'),
    sb.from('site_improvement_ledger').select('domain,actual_delta,shipped_at,window_days'),
    sb.from('newsletter_subscribers').select('id', { count: 'exact', head: true }).not('email', 'ilike', '%fleet-test%'),
    sb.from('brokers').select('id', { count: 'exact', head: true }),
    sb.from('market_pulse_live').select('methodology_version'),
    sb.from('target_query_benchmark').select('query', { count: 'exact', head: true }).gte('date', since28d),
    sb.from('crm_sequences').select('id', { count: 'exact', head: true }),
    sb.from('tc_deals').select('id', { count: 'exact', head: true }),
    readSkySlopeMirrorFreshness(sb, now),
    sb.from('tc_form_catalog_items').select('id', { count: 'exact', head: true }).eq('disposition', 'updated'),
    sb.from('listing_alerts').select('id', { count: 'exact', head: true }).not('email', 'ilike', '%fleet-test%'),
    sb.from('listing_alerts').select('id', { count: 'exact', head: true }).eq('is_active', true).not('email', 'ilike', '%fleet-test%'),
    sb.from('listing_alerts').select('id', { count: 'exact', head: true }).not('crm_person_id', 'is', null).not('email', 'ilike', '%fleet-test%'),
    sb.from('saved_searches').select('id', { count: 'exact', head: true }),
    sb.from('search_areas').select('id', { count: 'exact', head: true }),
    sb.from('boundaries').select('id', { count: 'exact', head: true }),
    sb.from('search_facet_counts').select('refreshed_at').order('refreshed_at', { ascending: false }).limit(1),
    sb.from('visitor_identity_map').select('rr_vid', { count: 'exact', head: true }),
    sb.from('visitor_identity_map').select('rr_vid', { count: 'exact', head: true }).not('crm_person_id', 'is', null),
    sb.from('email_events').select('id', { count: 'exact', head: true }).gte('occurred_at', since7d),
    sb.from('email_events').select('id', { count: 'exact', head: true }).gte('occurred_at', since7d).eq('event', 'open'),
    sb.from('email_events').select('id', { count: 'exact', head: true }).gte('occurred_at', since7d).eq('event', 'click'),
    sb.from('visitor_events').select('id', { count: 'exact', head: true }).gte('event_at', since7d),
    readMetaAudienceHold(sb, now),
    sb.from('cmas').select('id', { count: 'exact', head: true }),
    readJoinConversionStats(sb, now),
    ...SOCIAL_TABLES.map((table) =>
      sb.from(table).select(NO_REFRESH_COLUMN.has(table) ? 'expires_at' : 'expires_at,refresh_token'),
    ),
  ])

  const crm = emptyCrm()
  if (!peopleRes.error) {
    crm.status = 'ok'
    crm.people = peopleRes.people
    crm.byStage = peopleRes.byStage
    crm.createdLast7d = people7dRes.error ? -1 : (people7dRes.count ?? 0)
    if (people7dRes.error) crm.status = 'unreadable'
  }

  const brain: CompanyScoreboardSignals['brain'] = {
    status: brainRes.error ? 'unreadable' : 'ok',
    byStatus: {},
    measured: 0,
    source: 'marketing_brain_actions.status',
  }
  if (!brainRes.error && brainRes.data) {
    for (const row of brainRes.data) {
      const status = (row.status as string | null) || '(null)'
      bump(brain.byStatus, status)
    }
    brain.measured = brain.byStatus.measured ?? 0
  }

  const tokens: TokenHealth[] = SOCIAL_TABLES.map((table, i) => {
    const res = tokenResults[i] as {
      data: Array<{ expires_at?: string; refresh_token?: string | null }> | null
      error: { message: string } | null
    }
    if (res.error) {
      return { table, rows: 0, expiresAt: null, refreshTokenPresent: false, status: 'unreadable' }
    }
    const rows = res.data ?? []
    if (rows.length === 0) {
      return { table, rows: 0, expiresAt: null, refreshTokenPresent: false, status: 'empty' }
    }
    const expiresAt = rows[0]?.expires_at ?? null
    const refreshTokenPresent = Boolean(rows[0]?.refresh_token?.trim())
    const pastExpiry = expiresAt ? Date.parse(expiresAt) < now.getTime() : false
    const status = !pastExpiry ? 'valid' : refreshTokenPresent ? 'auto-refresh' : 'needs-reauth'
    return { table, rows: rows.length, expiresAt, refreshTokenPresent, status }
  })

  const sync: CompanyScoreboardSignals['sync'] = {
    status: syncRes.error ? 'unreadable' : 'ok',
    lastDeltaSyncAt: (syncRes.data?.last_delta_sync_at as string | null) ?? null,
    lastFullSyncAt: (syncRes.data?.last_full_sync_at as string | null) ?? null,
    source: 'sync_state id=default',
  }

  const commissions: CompanyScoreboardSignals['commissions'] = {
    status: commissionsRes.error ? 'unreadable' : 'ok',
    rows: 0,
    gciByStatus: {},
    gciSum: 0,
    source: 'tc_commissions.status + gci',
  }
  if (!commissionsRes.error && commissionsRes.data) {
    commissions.rows = commissionsRes.data.length
    for (const row of commissionsRes.data) {
      const status = (row.status as string | null) || '(null)'
      const gci = Number(row.gci ?? 0)
      if (Number.isFinite(gci)) {
        commissions.gciSum += gci
        commissions.gciByStatus[status] = (commissions.gciByStatus[status] ?? 0) + gci
      }
    }
  }

  const ledger: CompanyScoreboardSignals['ledger'] = {
    status: ledgerRes.error ? 'unreadable' : 'ok',
    rows: 0,
    openWindows: 0,
    expiredUnlearned: 0,
    expiredByDomain: {},
    byDomain: {},
    source: 'site_improvement_ledger.domain + actual_delta + shipped_at + window_days',
  }
  if (!ledgerRes.error && ledgerRes.data) {
    ledger.rows = ledgerRes.data.length
    for (const row of ledgerRes.data) {
      const domain = (row.domain as string | null) || '(null)'
      bump(ledger.byDomain, domain)
      if (row.actual_delta == null) ledger.openWindows += 1
      const stranded = isExpiredUnlearned(
        {
          shippedAt: String(row.shipped_at ?? fetchedAt),
          windowDays: Number(row.window_days ?? 14),
          actualDelta: row.actual_delta == null ? null : Number(row.actual_delta),
        },
        now,
      )
      if (stranded) {
        ledger.expiredUnlearned += 1
        bump(ledger.expiredByDomain, domain)
      }
    }
  }

  const newsletter: CompanyScoreboardSignals['newsletter'] = {
    status: newsletterRes.error ? 'unreadable' : 'ok',
    subscribers: newsletterRes.count ?? 0,
    source: 'newsletter_subscribers count',
  }

  const brokers: CompanyScoreboardSignals['brokers'] = {
    status: brokersRes.error ? 'unreadable' : 'ok',
    count: brokersRes.count ?? 0,
    source: 'brokers count',
  }

  const pulse: CompanyScoreboardSignals['pulse'] = {
    status: pulseRes.error ? 'unreadable' : 'ok',
    rows: 0,
    byMethodology: {},
    source: 'market_pulse_live.methodology_version',
  }
  if (!pulseRes.error && pulseRes.data) {
    pulse.rows = pulseRes.data.length
    for (const row of pulseRes.data) {
      bump(pulse.byMethodology, (row.methodology_version as string | null) || '(null)')
    }
  }

  const gsc: CompanyScoreboardSignals['gsc'] = {
    status: gscRes.error ? 'unreadable' : 'ok',
    rows28d: gscRes.count ?? 0,
    source: 'target_query_benchmark date >= now-28d',
  }

  const sequences: CompanyScoreboardSignals['sequences'] = {
    status: sequencesRes.error ? 'unreadable' : 'ok',
    sequences: sequencesRes.count ?? 0,
    source: 'crm_sequences count',
  }

  const tc: CompanyScoreboardSignals['tc'] = {
    status: dealsRes.error || skyFreshness.status === 'unreadable' || formRes.error ? 'unreadable' : 'ok',
    deals: dealsRes.count ?? 0,
    skySlopeRows: skyFreshness.rowCount,
    skySlopeLatestSyncedAt: skyFreshness.latestSyncedAt,
    formUpdates: formRes.count ?? 0,
    source: 'tc_deals + readSkySlopeMirrorFreshness + tc_form_catalog_items disposition=updated',
  }

  const searchError =
    alertsRes.error ||
    alertsActiveRes.error ||
    alertsPersonRes.error ||
    savedSearchRes.error ||
    searchAreasRes.error ||
    boundariesRes.error ||
    facetRes.error
  const search: CompanyScoreboardSignals['search'] = {
    status: searchError ? 'unreadable' : 'ok',
    listingAlerts: alertsRes.count ?? 0,
    listingAlertsActive: alertsActiveRes.count ?? 0,
    listingAlertsWithPerson: alertsPersonRes.count ?? 0,
    savedSearchesLegacy: savedSearchRes.count ?? 0,
    searchAreas: searchAreasRes.count ?? 0,
    boundaries: boundariesRes.count ?? 0,
    facetRefreshedAt: (facetRes.data?.[0]?.refreshed_at as string | null) ?? null,
    source:
      'listing_alerts + saved_searches (legacy) + search_areas + boundaries + search_facet_counts.refreshed_at',
  }

  const identityError =
    identityRes.error ||
    identityCrmRes.error ||
    email7dRes.error ||
    emailOpenRes.error ||
    emailClickRes.error ||
    visitor7dRes.error ||
    audienceHold.status === 'unreadable'
  const identity: CompanyScoreboardSignals['identity'] = {
    status: identityError ? 'unreadable' : 'ok',
    identityMap: identityRes.count ?? 0,
    identityMappedToCrm: identityCrmRes.count ?? 0,
    emailEvents7d: email7dRes.count ?? 0,
    emailOpens7d: emailOpenRes.count ?? 0,
    emailClicks7d: emailClickRes.count ?? 0,
    visitorEvents7d: visitor7dRes.count ?? 0,
    audienceLastRanAt: audienceHold.lastRanAt,
    audienceHold,
    source:
      'visitor_identity_map + email_events (event=open|click, 7d) + visitor_events 7d + readMetaAudienceHold',
  }

  const look = readLookWalkBaseline()
  const cmaLookOk = look.status === 'ok' && look.cma.status === 'ok'
  const cma: CompanyScoreboardSignals['cma'] = {
    status: cmaRes.error ? 'unreadable' : 'ok',
    rows: cmaRes.count ?? 0,
    look: cmaLookOk ? 'ok' : 'unreadable',
    lookVerdict: look.cma.verdict,
    lookSlug: look.cma.slug,
    source: cmaLookOk
      ? `cmas count + look-walk baseline ${look.cma.slug} (${look.cma.verdict})`
      : 'cmas count (CMA look unread — look-walk baseline missing or ungraded)',
  }
  const publicOk = look.public.routes.filter((r) => r.http390 === 200 && r.http1280 === 200).length
  const lookWalk: CompanyScoreboardSignals['lookWalk'] = {
    status: look.status === 'ok' && look.public.routes.length > 0 ? 'ok' : 'unreadable',
    publicRoutes: look.public.routes.length,
    publicOk,
    viewports: look.viewports,
    recordedAt: look.recordedAt,
    source: look.source,
  }

  const join: CompanyScoreboardSignals['join'] = {
    status: joinStats.status,
    visits7d: joinStats.visits7d,
    visitsAll: joinStats.visitsAll,
    conversions7d: joinStats.conversions7d,
    conversionsAll: joinStats.conversionsAll,
    source: joinStats.source,
  }

  const videoDocket = readVideoDecisionDocket()
  const video: CompanyScoreboardSignals['video'] = {
    status: videoDocket.status,
    decision: videoDocket.decision.status,
    parkUsd: videoDocket.park.incrementalVendorUsd ?? -1,
    rebuildCapPerRowUsd: videoDocket.rebuild.producerCapPerRowUsd ?? -1,
    deadSafeZoneImports: videoDocket.inventory.deadSafeZoneImports,
    source: videoDocket.source,
  }

  return {
    fetchedAt,
    crm,
    brain,
    social: {
      status: tokens.every((t) => t.status === 'unreadable') ? 'unreadable' : 'ok',
      tokens,
      source: SOCIAL_TABLES.join(', '),
    },
    sync,
    commissions,
    ledger,
    newsletter,
    brokers,
    pulse,
    gsc,
    sequences,
    tc,
    search,
    identity,
    cma,
    lookWalk,
    join,
    video,
  }
}
