import 'server-only'
import { createServiceClient } from '@/lib/data/client'

/** Per-broker closed-deal aggregate for the Agent Activity "Show me → closed deals" view */
export type ClosedDealsRow = {
  brokerSlug: string
  brokerName: string
  avatarUrl: string | null
  /** Deals in a closed stage whose (actual_close_date ?? close_date) falls in the period */
  closedDeals: number
  /** SUM(commission_dollars) over those deals */
  commission: number
}

export type ClosedDealsBrokerInput = {
  slug: string
  name: string
  avatarUrl: string | null
}

/**
 * Closed deals + commission per broker over [start, end] (ISO datetimes).
 * Closed = deal is in a stage flagged is_closed_stage AND its effective close
 * date (actual_close_date, falling back to close_date) is inside the window.
 * Archived deals are INCLUDED when their close date is in range (per §11 spec).
 * Uncached — called from the cached getAgentActivityReport reader.
 */
export async function fetchClosedDealsByBroker(
  brokers: ClosedDealsBrokerInput[],
  start: string,
  end: string,
): Promise<ClosedDealsRow[]> {
  const sb = createServiceClient()
  const brokerSlugs = brokers.map((b) => b.slug)

  const agg = new Map<string, { closedDeals: number; commission: number }>()
  for (const slug of brokerSlugs) agg.set(slug, { closedDeals: 0, commission: 0 })

  const { data: stageRows, error: stagesError } = await sb
    .from('crm_deal_stages')
    .select('name')
    .eq('is_closed_stage', true)
  if (stagesError) {
    console.error('[agentActivityClosedDeals] stages error', stagesError.message)
  }
  const closedStageNames = Array.from(
    new Set(((stageRows ?? []) as Array<{ name: string }>).map((s) => s.name)),
  )

  if (closedStageNames.length > 0 && brokerSlugs.length > 0) {
    const startDay = start.slice(0, 10)
    const endDay = end.slice(0, 10)
    const { data: dealRows, error: dealsError } = await sb
      .from('crm_deals')
      .select('assigned_broker,commission_dollars,close_date,actual_close_date')
      .in('stage', closedStageNames)
      .in('assigned_broker', brokerSlugs)
    if (dealsError) {
      console.error('[agentActivityClosedDeals] deals error', dealsError.message)
    }
    for (const d of (dealRows ?? []) as Array<{
      assigned_broker: string | null
      commission_dollars: number | null
      close_date: string | null
      actual_close_date: string | null
    }>) {
      const effClose = d.actual_close_date ?? d.close_date
      if (!d.assigned_broker || !effClose) continue
      if (effClose < startDay || effClose > endDay) continue
      const a = agg.get(d.assigned_broker)
      if (!a) continue
      a.closedDeals += 1
      a.commission += Number(d.commission_dollars ?? 0)
    }
  }

  return brokers
    .map((b) => ({
      brokerSlug: b.slug,
      brokerName: b.name,
      avatarUrl: b.avatarUrl,
      closedDeals: agg.get(b.slug)?.closedDeals ?? 0,
      commission: agg.get(b.slug)?.commission ?? 0,
    }))
    .sort((a, b) => b.closedDeals - a.closedDeals || b.commission - a.commission)
}
