import 'server-only'
import { createServiceClient } from '@/lib/supabase/service'
import { getCrmAssignmentConfig, type CrmAssignmentConfig, type AssignmentStrategy } from '@/lib/data/crm/getCrmAssignmentConfig'

/**
 * lead-routing — the lead-routing ENGINE (Wave 7). Built, shipped DORMANT.
 *
 * pickRoutedBroker({ source }) returns the broker slug a new lead should route
 * to, per the crm_assignment_config strategy:
 *
 *   - all_to_one  → default_broker (the SEEDED strategy; live behavior = matt).
 *   - by_source   → first crm_assignment_rules row matching the source, else default_broker.
 *   - round_robin → next routing_eligible broker via the ATOMIC SQL pointer
 *                   advance (crm_advance_round_robin), so two concurrent leads
 *                   never get the same broker.
 *
 * FAIL-SAFE: any error (unreadable config, RPC failure, no eligible broker)
 * resolves to 'matt'. A lead-capture path must never crash or hang on routing.
 *
 * The PURE decision helpers (resolveStrategy / nextRoundRobin) are exported for
 * unit testing without a DB.
 */

const SAFE_DEFAULT = 'matt'

export type PickRoutedBrokerInput = { source?: string | null }

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
 */
export async function pickRoutedBroker(input: PickRoutedBrokerInput = {}): Promise<string> {
  try {
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
