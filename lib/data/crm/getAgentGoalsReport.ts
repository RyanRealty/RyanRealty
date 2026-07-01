import 'server-only'
import { unstable_cache } from 'next/cache'
import { createServiceClient } from '@/lib/data/client'

// ── Types ─────────────────────────────────────────────────────────────────────

export type AgentGoalsRow = {
  brokerSlug: string
  brokerName: string
  avatarUrl: string | null
  /** Deals in stage='Closed' with close_date in the goal year */
  closedDeals: number
  /** Deals in any non-Closed, non-Lost stage (open pipeline) */
  upcomingDeals: number
  /** Sum of commission_dollars on closed deals in the year (dollars) */
  commissionEarned: number
  /**
   * Annual commission goal target in dollars.
   * null = no goal configured yet (no crm_goals table exists in V1).
   * Rendered as "Set goal" inline link in the table.
   */
  commissionGoal: number | null
}

export type AgentGoalsResult = {
  rows: AgentGoalsRow[]
  year: number
}

// ── Broker headshot map ───────────────────────────────────────────────────────

const BROKER_HEADSHOT: Record<string, string> = {
  matt: '/images/brokers/ryan-matt.png',
  rebecca: '/images/brokers/peterson-rebecca.png',
  paul: '/images/brokers/stevenson-paul.png',
}

// ── Core reader (uncached) ────────────────────────────────────────────────────

async function readAgentGoals(params: {
  year: number
  brokerSlug: string | null
}): Promise<AgentGoalsResult> {
  const sb = createServiceClient()
  const { year } = params

  const yearStart = `${year}-01-01`
  const yearEnd = `${year}-12-31`

  // 1. Broker roster — only CRM-active brokers with a crm_slug, ordered by sort_order
  const { data: brokerRows, error: brokerError } = await sb
    .from('brokers')
    .select('crm_slug,display_name,photo_url')
    .not('crm_slug', 'is', null)
    .eq('crm_active', true)
    .order('sort_order', { ascending: true })

  if (brokerError) console.error('[getAgentGoalsReport] brokers error', brokerError.message)

  const allBrokers = (brokerRows ?? []).filter((b) => b.crm_slug) as Array<{
    crm_slug: string
    display_name: string | null
    photo_url: string | null
  }>

  const scopedBrokers = params.brokerSlug
    ? allBrokers.filter((b) => b.crm_slug === params.brokerSlug)
    : allBrokers

  if (scopedBrokers.length === 0) {
    return { rows: [], year }
  }

  // 2. Per-broker queries — all in parallel.
  //
  //    Query A: Closed deal COUNT for the year.
  //             Uses { count: 'exact', head: true } — returns the real database
  //             COUNT(*) via Content-Range header, never capped by max_rows.
  //
  //    Query B: Upcoming (open pipeline) deal COUNT — no year filter; any deal
  //             not yet Closed or Lost is "upcoming". Excludes closed/lost by
  //             stage. Uses { count: 'exact', head: true }.
  //
  //    Query C: commission_dollars raw rows for closed deals in the year.
  //             Fetching raw values (not a COUNT) so we can SUM in JS.
  //             Safe from max_rows cap in practice: a brokerage realistically
  //             closes < 100 deals/year. Only non-null rows fetched.
  //
  const perBrokerResults = await Promise.all(
    scopedBrokers.map((b) => {
      const slug = b.crm_slug
      return Promise.all([
        // A: closed deals count for the year
        sb
          .from('crm_deals')
          .select('id', { count: 'exact', head: true })
          .eq('assigned_broker', slug)
          .eq('stage', 'Closed')
          .gte('close_date', yearStart)
          .lte('close_date', yearEnd),
        // B: upcoming / open pipeline deal count (all-time, no date filter)
        sb
          .from('crm_deals')
          .select('id', { count: 'exact', head: true })
          .eq('assigned_broker', slug)
          .not('stage', 'in', '("Closed","Lost")'),
        // C: commission_dollars for closed deals in the year (raw, for SUM)
        sb
          .from('crm_deals')
          .select('commission_dollars')
          .eq('assigned_broker', slug)
          .eq('stage', 'Closed')
          .gte('close_date', yearStart)
          .lte('close_date', yearEnd)
          .not('commission_dollars', 'is', null),
      ] as const)
    }),
  )

  // 3. Build result rows
  const rows: AgentGoalsRow[] = scopedBrokers.map((b, i) => {
    const [closedRes, upcomingRes, commissionRes] = perBrokerResults[i]

    const closedDeals = closedRes.count ?? 0
    const upcomingDeals = upcomingRes.count ?? 0

    // Sum commission_dollars across all closed deals in the year
    const commissionEarned = (commissionRes.data ?? []).reduce(
      (sum, row: { commission_dollars: number | null }) =>
        sum + (row.commission_dollars ?? 0),
      0,
    )

    return {
      brokerSlug: b.crm_slug,
      brokerName: b.display_name ?? b.crm_slug,
      avatarUrl: BROKER_HEADSHOT[b.crm_slug] ?? b.photo_url ?? null,
      closedDeals,
      upcomingDeals,
      commissionEarned,
      // V1: no crm_goals table exists yet — goal is always null.
      // Goal-setting UI is a future increment; the page renders "Set goal"
      // for any row with commissionGoal === null.
      commissionGoal: null,
    }
  })

  return { rows, year }
}

// ── Cached public API ─────────────────────────────────────────────────────────

/**
 * Agent Goals report data — annual commission actuals + goal targets per broker.
 * Cached 10 minutes to match FUB's documented cache TTL for reporting.
 *
 * Source tables:
 *   - brokers         (roster — crm_active=true, crm_slug non-null)
 *   - crm_deals       (stage, close_date, assigned_broker, commission_dollars)
 *
 * Metric → crm_* source mapping:
 *   Closed Deals       crm_deals  stage='Closed', close_date in year, assigned_broker=slug
 *                                 count:'exact' head query — exact, never capped
 *   Upcoming Deals     crm_deals  stage NOT IN ('Closed','Lost'), assigned_broker=slug
 *                                 count:'exact' head query — exact, never capped
 *   Commission Earned  crm_deals  stage='Closed', close_date in year, assigned_broker=slug
 *                                 raw commission_dollars rows summed in JS
 *                                 (safe from cap: < 100 deals/year in practice)
 *   Commission Goal    NONE — no crm_goals table exists yet. Always null in V1.
 *                      Rendered as "Set goal" inline link. Honest empty state.
 *   Goal Progress      NONE — derived from commissionGoal; blank when null.
 */
export async function getAgentGoalsReport(params: {
  year: number
  brokerSlug: string | null
}): Promise<AgentGoalsResult> {
  const cached = unstable_cache(
    () => readAgentGoals(params),
    ['crm-agent-goals-v1', String(params.year), params.brokerSlug ?? 'all'],
    { tags: ['crm-agent-goals', 'crm-reporting'], revalidate: 600 },
  )
  return cached()
}
