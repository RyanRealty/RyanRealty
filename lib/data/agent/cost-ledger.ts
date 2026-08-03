/**
 * lib/data/agent/cost-ledger.ts — DAL for the broker SMS agent's spend
 * accounting (docs/plans/BROKER_SMS_AGENT_2026-07-31.md R2.1, "Cost + caps").
 *
 * Every LLM call the agent makes is cost-ledgered in `marketing_cost_ledger`
 * under `cost_type='broker_agent_tokens'` — the same table every other
 * marketing-brain producer writes to, so a single "nothing is zero cost"
 * rollup covers this surface too. `action_id` is null (this cost is not tied
 * to a `marketing_brain_actions` row); the broker + session live in
 * `metadata` instead.
 *
 * brokerSpendTodayUsd() backs the $3/day per-broker cap (lib/agent/runtime.ts
 * step (b)) — a calendar day in America/Los_Angeles, since that is Ryan
 * Realty's operating timezone and "today" should mean Bend's today, not UTC's.
 */
import { createServiceClient } from '@/lib/supabase/service'
import type { BrokerSlug } from '@/lib/agent/types'

const COST_TYPE = 'broker_agent_tokens' as const

export interface RecordAgentCostInput {
  brokerSlug: BrokerSlug
  sessionId: string
  costUsd: number
  meta?: Record<string, unknown>
}

export async function recordAgentCost(input: RecordAgentCostInput): Promise<void> {
  if (!Number.isFinite(input.costUsd) || input.costUsd < 0) {
    throw new Error(`[recordAgentCost] invalid costUsd: ${input.costUsd}`)
  }
  const sb = createServiceClient()
  const { error } = await sb.from('marketing_cost_ledger').insert({
    action_id: null,
    cost_type: COST_TYPE,
    amount_usd: input.costUsd,
    metadata: {
      broker_slug: input.brokerSlug,
      session_id: input.sessionId,
      ...(input.meta ?? {}),
    },
  })
  if (error) throw new Error(`[recordAgentCost] ${error.message}`)
}

// ── America/Los_Angeles calendar-day window ──────────────────────────────
//
// A soft spend cap tolerates the one-hour DST-transition-day edge case that a
// fixed-offset calculation carries; that is cheaper than pulling in a full
// tz library for a single daily boundary.

function laOffsetMinutes(reference: Date): number {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Los_Angeles',
    timeZoneName: 'shortOffset',
  })
  const part = dtf.formatToParts(reference).find((p) => p.type === 'timeZoneName')?.value ?? 'GMT-8'
  const match = part.match(/GMT([+-])(\d{1,2})(?::?(\d{2}))?/)
  if (!match) return -480
  const sign = match[1] === '-' ? -1 : 1
  const hours = Number(match[2])
  const minutes = match[3] ? Number(match[3]) : 0
  return sign * (hours * 60 + minutes)
}

/**
 * The [start, end) UTC instants bounding "today" in America/Los_Angeles.
 *
 * date-format-ok: timezone ARITHMETIC, not display. Intl.DateTimeFormat is used
 * with formatToParts to pull the y/m/d components of the local civil day so the
 * UTC window can be computed; nothing here produces a user-visible string, so
 * lib/format/date.ts (which formats FOR DISPLAY in the brand timezone) is the
 * wrong tool. Doing this with local Date getters would use the SERVER's zone and
 * silently shift the spend window on any non-Pacific host.
 */
export function laDayWindowUtc(now: Date = new Date()): { startUtc: string; endUtc: string } {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Los_Angeles',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
  const parts = fmt.formatToParts(now)
  const y = Number(parts.find((p) => p.type === 'year')?.value)
  const m = Number(parts.find((p) => p.type === 'month')?.value)
  const d = Number(parts.find((p) => p.type === 'day')?.value)
  const offsetMin = laOffsetMinutes(now)
  const startUtcMs = Date.UTC(y, m - 1, d, 0, 0, 0) - offsetMin * 60_000
  return {
    startUtc: new Date(startUtcMs).toISOString(),
    endUtc: new Date(startUtcMs + 24 * 60 * 60 * 1000).toISOString(),
  }
}

/** Sum of today's (America/Los_Angeles) broker_agent_tokens spend for one broker. */
export async function brokerSpendTodayUsd(brokerSlug: BrokerSlug): Promise<number> {
  const sb = createServiceClient()
  const { startUtc, endUtc } = laDayWindowUtc()
  const { data, error } = await sb
    .from('marketing_cost_ledger')
    .select('amount_usd')
    .eq('cost_type', COST_TYPE)
    .contains('metadata', { broker_slug: brokerSlug })
    .gte('recorded_at', startUtc)
    .lt('recorded_at', endUtc)
  if (error) throw new Error(`[brokerSpendTodayUsd] ${error.message}`)
  return (data ?? []).reduce((sum, row) => {
    const amount = (row as { amount_usd: unknown }).amount_usd
    return sum + (typeof amount === 'number' ? amount : Number(amount ?? 0))
  }, 0)
}
