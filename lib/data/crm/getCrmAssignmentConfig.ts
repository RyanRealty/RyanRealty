import 'server-only'
import { unstable_cache } from 'next/cache'
import { supabaseAnon } from '@/lib/data/client'

/**
 * getCrmAssignmentConfig — cached reader for the lead-routing config (Wave 7).
 *
 * Reads the single-row crm_assignment_config plus its by_source rules (migration
 * 20260625211000_crm_assignment_config.sql). The routing engine (lib/crm/lead-routing.ts)
 * and the Phase B settings UI both read through this. The mutation actions
 * (app/actions/crm-assignment.ts) revalidate the 'crm-assignment-config' tag on
 * every change.
 *
 * Fails SAFE: on any unreadable table it returns the dormant default
 * (all_to_one / matt / no rules), so routing degrades to all-to-Matt rather than
 * crashing a lead-capture path.
 *
 * DAL boundary (G1): the raw .from() reads live here, inside lib/data/.
 */
export type AssignmentStrategy = 'all_to_one' | 'round_robin' | 'by_source'

export type AssignmentRule = {
  id: number
  source: string
  broker: string
  position: number
}

export type CrmAssignmentConfig = {
  strategy: AssignmentStrategy
  defaultBroker: string
  rules: AssignmentRule[]
}

/** The dormant default returned on any read failure (live behavior = all-to-Matt). */
export const ASSIGNMENT_CONFIG_FALLBACK: CrmAssignmentConfig = {
  strategy: 'all_to_one',
  defaultBroker: 'matt',
  rules: [],
}

const VALID_STRATEGIES = new Set<AssignmentStrategy>(['all_to_one', 'round_robin', 'by_source'])

/** Coerce a raw strategy string to a known strategy, defaulting to all_to_one. Pure. */
export function normalizeStrategy(value: string | null | undefined): AssignmentStrategy {
  const s = (value ?? '').trim() as AssignmentStrategy
  return VALID_STRATEGIES.has(s) ? s : 'all_to_one'
}

type RawConfigRow = { strategy: string | null; default_broker: string | null }
type RawRuleRow = { id: number; source: string | null; broker: string | null; position: number | null }

/** Map raw config + rule rows to the typed config. Pure — exported for tests. */
export function mapAssignmentConfig(
  configRow: RawConfigRow | null,
  ruleRows: RawRuleRow[],
): CrmAssignmentConfig {
  if (!configRow) return ASSIGNMENT_CONFIG_FALLBACK
  const rules: AssignmentRule[] = []
  for (const r of ruleRows) {
    const source = (r.source ?? '').trim()
    const broker = (r.broker ?? '').trim()
    if (!source || !broker) continue
    rules.push({ id: r.id, source, broker, position: r.position ?? 0 })
  }
  rules.sort((a, b) => a.position - b.position || a.id - b.id)
  return {
    strategy: normalizeStrategy(configRow.strategy),
    defaultBroker: (configRow.default_broker ?? '').trim() || 'matt',
    rules,
  }
}

export const getCrmAssignmentConfig = unstable_cache(
  async (): Promise<CrmAssignmentConfig> => {
    const sb = supabaseAnon()
    if (!sb) return ASSIGNMENT_CONFIG_FALLBACK
    const [{ data: configRow, error: configErr }, { data: ruleRows, error: rulesErr }] = await Promise.all([
      sb.from('crm_assignment_config').select('strategy,default_broker').eq('id', 1).maybeSingle(),
      sb.from('crm_assignment_rules').select('id,source,broker,position').order('position', { ascending: true }),
    ])
    if (configErr) {
      console.error('[getCrmAssignmentConfig]', configErr.message)
      return ASSIGNMENT_CONFIG_FALLBACK
    }
    if (rulesErr) console.error('[getCrmAssignmentConfig] rules', rulesErr.message)
    return mapAssignmentConfig(
      (configRow as RawConfigRow | null) ?? null,
      (ruleRows as RawRuleRow[] | null) ?? [],
    )
  },
  ['crm-assignment-config-v1'],
  { revalidate: 300, tags: ['crm-assignment-config'] },
)
