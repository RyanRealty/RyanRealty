import 'server-only'
import { createServiceClient } from '@/lib/supabase/service'
import { getCrmAssignmentConfig, type CrmAssignmentConfig, type AssignmentStrategy } from '@/lib/data/crm/getCrmAssignmentConfig'
import { getLeadFlowBySource } from '@/lib/data/crm/getLeadFlow'
import { resolveLeadFlow } from '@/lib/crm/lead-flow-resolver'

/**
 * lead-routing — the lead-routing ENGINE (Wave 7 + Lead Flows layer).
 *
 * pickRoutedBroker({ source, price, area, tags }) resolves the broker slug a
 * new lead should route to. The resolution order is:
 *
 *   1. Lead Flows (FUB §8.3): look up the lead_flows row matching the source.
 *      Walk its rules (evalCondition). On a match, resolve the DistributionTarget:
 *
 *      - broker   → return that slug directly.
 *      - group    → call crm_advance_group_round_robin(group_id) to get the next
 *                   broker from the group's per-group atomic RR pointer.
 *      - pond     → set crm_people.pond_id in the caller; this function returns
 *                   the sentinel POND_SENTINEL so ensureNativeLead can wire pond_id.
 *      - none     → fall through to step 2.
 *
 *   2. Fallback: crm_assignment_config (all_to_one / round_robin / by_source)
 *      — the existing strategy from Wave 7. Behavior is all-to-Matt until an
 *      owner changes the strategy in /admin/crm/settings/assignment.
 *
 * FAIL-SAFE: any error (unreadable config, RPC failure, no eligible broker)
 * resolves to 'matt'. A lead-capture path must never crash or hang on routing.
 *
 * Exported pure helpers (resolveStrategy, nextRoundRobin) are unchanged for
 * backward-compat and unit-testing.
 */

const SAFE_DEFAULT = 'matt'

/**
 * Sentinel returned to callers when a lead routed to a pond.
 * ensureNativeLead checks for this and sets crm_people.pond_id instead of
 * using this string as an assigned_broker.
 */
export const POND_ROUTING_SENTINEL = '__pond__'

export type PickRoutedBrokerInput = {
  source?: string | null
  /** Numeric price from the lead (used by lead-flow rule conditions). */
  price?: number | null
  /** Area / geo string from the lead (used by lead-flow rule conditions). */
  area?: string | null
  /** Tags on the lead (used by lead-flow rule conditions). */
  tags?: string[]
  /**
   * When the flow resolves to a pond, the caller needs the pond_id to set on
   * crm_people. If provided, this object is populated in-place.
   */
  pondResult?: { pondId: number | null }
}

/**
 * The pure "which strategy applies, and for all_to_one/by_source what broker?"
 * decision. Returns either a resolved broker slug (no DB needed) or a signal that
 * round_robin must be resolved by the atomic SQL advance.
 *
 *   - all_to_one → { kind: 'resolved', broker: defaultBroker }
 *   - by_source  → first matching rule's broker, else defaultBroker (resolved)
 *   - round_robin → { kind: 'round_robin' } (caller must advance the pointer)
 *
 * Pure — exported for tests.
 */
export function resolveStrategy(
  config: CrmAssignmentConfig,
  source: string | null | undefined,
): { kind: 'resolved'; broker: string } | { kind: 'round_robin' } {
  const fallback = config.defaultBroker || SAFE_DEFAULT
  switch (config.strategy) {
    case 'round_robin':
      return { kind: 'round_robin' }
    case 'by_source': {
      const key = (source ?? '').trim()
      if (key) {
        const match = config.rules.find((r) => r.source === key)
        if (match) return { kind: 'resolved', broker: match.broker || fallback }
      }
      return { kind: 'resolved', broker: fallback }
    }
    case 'all_to_one':
    default:
      return { kind: 'resolved', broker: fallback }
  }
}

/**
 * Pure round-robin step: given the ordered eligible-broker slugs and the previous
 * pointer index, return the next broker + next index (wrapping). Mirrors the SQL
 * crm_advance_round_robin math so the rotation is unit-testable in isolation.
 *
 * Returns null when there are no eligible brokers (caller fails safe).
 */
export function nextRoundRobin(
  eligible: string[],
  prevIndex: number,
): { broker: string; index: number } | null {
  const n = eligible.length
  if (n === 0) return null
  const safePrev = Number.isInteger(prevIndex) ? prevIndex : -1
  const index = ((safePrev + 1) % n + n) % n  // wrap, guarding a negative prev
  return { broker: eligible[index], index }
}

/**
 * Resolve the broker a new lead routes to. Never throws — fails safe to 'matt'.
 *
 * Returns POND_ROUTING_SENTINEL when the lead should land in a pond. The caller
 * (ensureNativeLead) should check for this and set crm_people.pond_id from
 * input.pondResult.pondId.
 */
export async function pickRoutedBroker(input: PickRoutedBrokerInput = {}): Promise<string> {
  try {
    const source = (input.source ?? '').trim()

    // ── Step 1: Lead Flows (FUB §8.3) ────────────────────────────────────────
    if (source) {
      const flow = await getLeadFlowBySource(source)
      if (flow && !flow.archived) {
        const target = resolveLeadFlow(flow, flow.rules, {
          price: input.price ?? null,
          area: input.area ?? null,
          tags: input.tags ?? [],
        })

        switch (target.kind) {
          case 'broker': {
            const slug = target.slug?.trim() || SAFE_DEFAULT
            return slug
          }
          case 'group': {
            // Per-group atomic round-robin via the SECURITY DEFINER SQL fn.
            const sb = createServiceClient()
            const { data, error } = await sb.rpc('crm_advance_group_round_robin', {
              p_group_id: target.groupId,
            })
            if (error) {
              console.warn('[pickRoutedBroker] group RR RPC failed, falling back:', error.message)
              return SAFE_DEFAULT
            }
            const chosen = typeof data === 'string' ? data.trim() : ''
            return chosen || SAFE_DEFAULT
          }
          case 'pond': {
            // Populate the pondResult out-param so ensureNativeLead can set pond_id.
            if (input.pondResult) {
              input.pondResult.pondId = target.pondId
            }
            return POND_ROUTING_SENTINEL
          }
          case 'none':
            // Flow exists but has no configured target — fall through to Step 2.
            break
        }
      }
    }

    // ── Step 2: crm_assignment_config fallback (Wave 7) ──────────────────────
    const config = await getCrmAssignmentConfig()
    const decision = resolveStrategy(config, input.source)
    if (decision.kind === 'resolved') {
      return decision.broker || SAFE_DEFAULT
    }
    // round_robin → atomic pointer advance via the SECURITY DEFINER SQL fn.
    const sb = createServiceClient()
    const { data, error } = await sb.rpc('crm_advance_round_robin')
    if (error) {
      console.warn('[pickRoutedBroker] round-robin RPC failed, falling back:', error.message)
      return config.defaultBroker || SAFE_DEFAULT
    }
    const chosen = typeof data === 'string' ? data.trim() : ''
    return chosen || config.defaultBroker || SAFE_DEFAULT
  } catch (err) {
    console.warn('[pickRoutedBroker] failed, defaulting to matt:', err instanceof Error ? err.message : String(err))
    return SAFE_DEFAULT
  }
}

export type { AssignmentStrategy }
