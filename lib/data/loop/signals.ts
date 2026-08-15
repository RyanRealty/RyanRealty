/**
 * Company scoreboard ingest. One live pull, named sources, UNKNOWN when unread.
 * Docs: docs/plans/COMPANY_SCOREBOARD.md
 * reachability: entry-point scripts/company-scoreboard-probe.ts
 */

import type { SupabaseClient } from '@supabase/supabase-js'

export type SignalStatus = 'ok' | 'unreadable'

export type CountByKey = Record<string, number>

export type TokenHealth = {
  table: string
  rows: number
  expiresAt: string | null
  status: 'valid' | 'expired' | 'empty' | 'unreadable'
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
    source: string
  }
  cma: {
    status: SignalStatus
    rows: number
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
    const { data, error } = await sb
      .from('crm_people')
      .select('stage')
      .eq('deleted', false)
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
    skyRes,
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
    audienceRes,
    cmaRes,
    ...tokenResults
  ] = await Promise.all([
    countCrmStages(sb),
    sb.from('crm_people').select('id', { count: 'exact', head: true }).eq('deleted', false).gte('created_at', since7d),
    sb.from('marketing_brain_actions').select('status'),
    sb.from('sync_state').select('last_delta_sync_at,last_full_sync_at').eq('id', 'default').maybeSingle(),
    sb.from('tc_commissions').select('status,gci'),
    sb.from('site_improvement_ledger').select('domain,actual_delta'),
    sb.from('newsletter_subscribers').select('id', { count: 'exact', head: true }),
    sb.from('brokers').select('id', { count: 'exact', head: true }),
    sb.from('market_pulse_live').select('methodology_version'),
    sb.from('target_query_benchmark').select('query', { count: 'exact', head: true }).gte('date', since28d),
    sb.from('crm_sequences').select('id', { count: 'exact', head: true }),
    sb.from('tc_deals').select('id', { count: 'exact', head: true }),
    sb.from('skyslope_transactions').select('synced_at').order('synced_at', { ascending: false }).limit(1),
    sb.from('tc_form_catalog_items').select('id', { count: 'exact', head: true }).eq('disposition', 'updated'),
    sb.from('listing_alerts').select('id', { count: 'exact', head: true }),
    sb.from('listing_alerts').select('id', { count: 'exact', head: true }).eq('is_active', true),
    sb.from('listing_alerts').select('id', { count: 'exact', head: true }).not('crm_person_id', 'is', null),
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
    sb.from('meta_audience_log').select('ran_at').order('ran_at', { ascending: false }).limit(1),
    sb.from('cmas').select('id', { count: 'exact', head: true }),
    ...SOCIAL_TABLES.map((table) => sb.from(table).select('expires_at,updated_at')),
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
    const res = tokenResults[i] as { data: Array<{ expires_at?: string; updated_at?: string }> | null; error: { message: string } | null }
    if (res.error) {
      return { table, rows: 0, expiresAt: null, status: 'unreadable' }
    }
    const rows = res.data ?? []
    if (rows.length === 0) return { table, rows: 0, expiresAt: null, status: 'empty' }
    const expiresAt = rows[0]?.expires_at ?? null
    const expired = expiresAt ? Date.parse(expiresAt) < now.getTime() : false
    return { table, rows: rows.length, expiresAt, status: expired ? 'expired' : 'valid' }
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
    byDomain: {},
    source: 'site_improvement_ledger.domain + actual_delta',
  }
  if (!ledgerRes.error && ledgerRes.data) {
    ledger.rows = ledgerRes.data.length
    for (const row of ledgerRes.data) {
      bump(ledger.byDomain, (row.domain as string | null) || '(null)')
      if (row.actual_delta == null) ledger.openWindows += 1
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

  const skyRows = skyRes.data ?? []
  const tc: CompanyScoreboardSignals['tc'] = {
    status: dealsRes.error || skyRes.error || formRes.error ? 'unreadable' : 'ok',
    deals: dealsRes.count ?? 0,
    skySlopeRows: skyRows.length,
    skySlopeLatestSyncedAt: (skyRows[0]?.synced_at as string | null) ?? null,
    formUpdates: formRes.count ?? 0,
    source: 'tc_deals + skyslope_transactions.synced_at + tc_form_catalog_items disposition=updated',
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
    audienceRes.error
  const identity: CompanyScoreboardSignals['identity'] = {
    status: identityError ? 'unreadable' : 'ok',
    identityMap: identityRes.count ?? 0,
    identityMappedToCrm: identityCrmRes.count ?? 0,
    emailEvents7d: email7dRes.count ?? 0,
    emailOpens7d: emailOpenRes.count ?? 0,
    emailClicks7d: emailClickRes.count ?? 0,
    visitorEvents7d: visitor7dRes.count ?? 0,
    audienceLastRanAt: (audienceRes.data?.[0]?.ran_at as string | null) ?? null,
    source:
      'visitor_identity_map + email_events (event=open|click, 7d) + visitor_events 7d + meta_audience_log.ran_at',
  }

  const cma: CompanyScoreboardSignals['cma'] = {
    status: cmaRes.error ? 'unreadable' : 'ok',
    rows: cmaRes.count ?? 0,
    source: 'cmas count',
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
  }
}
