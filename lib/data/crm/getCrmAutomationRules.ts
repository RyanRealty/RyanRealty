import 'server-only'
import { unstable_cache } from 'next/cache'
import { createServiceClient } from '@/lib/supabase/service'

/**
 * getCrmAutomationRules — the cached read side of the crm_automation_rules table.
 *
 * crm_automation_rules is the UI-configurable replacement for the hardcoded
 * RULES const in lib/crm/enroll.ts. A rule is "when trigger_type/trigger_value
 * fires, run action_type/action_value". This reader returns the full typed set
 * ordered by position; callers filter on is_active themselves (the manager shows
 * inactive rows, the engine skips them).
 *
 * DAL boundary (G1): the raw .from('crm_automation_rules') read lives here. The
 * CRUD actions (app/actions/crm-automation-rules.ts) revalidate
 * CRM_AUTOMATION_RULES_TAG on every write. Rules change rarely, so a 5-minute
 * cache is generous; the enroll path reads through the cache on every new lead.
 *
 * Fails SOFT (empty array) on an unreadable table so the enroll path's typed
 * fallback const takes over rather than the whole new-lead flow crashing.
 */

export type CrmTriggerType =
  | 'tag_added'
  | 'stage_changed'
  | 'source_is'
  | 'inactivity'
  | 'deal_stage_changed'
  | 'inquiry'
  | 'property_saved'
  | 'calendar_date'
  | 'appointment'
export type CrmActionType = 'enroll_sequence' | 'add_tag' | 'set_stage' | 'assign_broker'

export type CrmAutomationRule = {
  id: number
  name: string
  isActive: boolean
  triggerType: CrmTriggerType
  triggerValue: string
  actionType: CrmActionType
  actionValue: string
  position: number
}

/** The cache tag the CRUD actions revalidate on write. */
export const CRM_AUTOMATION_RULES_TAG = 'crm-automation-rules' as const

type RawRule = {
  id: number
  name: string
  is_active: boolean
  trigger_type: string
  trigger_value: string
  action_type: string
  action_value: string
  position: number
}

const TRIGGER_TYPES: readonly CrmTriggerType[] = [
  'tag_added',
  'stage_changed',
  'source_is',
  'inactivity',
  'deal_stage_changed',
  'inquiry',
  'property_saved',
  'calendar_date',
  'appointment',
]
const ACTION_TYPES: readonly CrmActionType[] = ['enroll_sequence', 'add_tag', 'set_stage', 'assign_broker']

/** Narrow a raw string to a known trigger type (the CHECK guarantees it, but a
 *  drifted row never produces an untyped value downstream). */
export function isTriggerType(value: string): value is CrmTriggerType {
  return (TRIGGER_TYPES as readonly string[]).includes(value)
}

/** Narrow a raw string to a known action type. */
export function isActionType(value: string): value is CrmActionType {
  return (ACTION_TYPES as readonly string[]).includes(value)
}

/** Map a raw DB row to the typed shape. Pure — exported for tests. */
export function mapRule(r: RawRule): CrmAutomationRule {
  return {
    id: Number(r.id),
    name: r.name,
    isActive: r.is_active !== false,
    triggerType: isTriggerType(r.trigger_type) ? r.trigger_type : 'tag_added',
    triggerValue: r.trigger_value,
    actionType: isActionType(r.action_type) ? r.action_type : 'add_tag',
    actionValue: r.action_value,
    position: Number(r.position ?? 0),
  }
}

/**
 * Pure trigger matcher: given the full rule set + a fired trigger (type/value),
 * return the active matching rules in evaluation order (position asc). The engine
 * uses this to pick which actions to run; callers that want "first wins" take
 * [0]. Exported standalone so it is unit-tested without a DB.
 *
 * Matching is exact + case-insensitive on the trigger value so a tag/stage/
 * source compares the same way the rest of the CRM normalises them.
 */
export function matchRules(
  rules: ReadonlyArray<CrmAutomationRule>,
  triggerType: CrmTriggerType,
  triggerValue: string,
): CrmAutomationRule[] {
  const needle = triggerValue.trim().toLowerCase()
  return rules
    .filter((r) => r.isActive && r.triggerType === triggerType && r.triggerValue.trim().toLowerCase() === needle)
    .sort((a, b) => a.position - b.position)
}

export const getCrmAutomationRules = unstable_cache(
  async (): Promise<CrmAutomationRule[]> => {
    const sb = createServiceClient()
    const { data, error } = await sb
      .from('crm_automation_rules')
      .select('id,name,is_active,trigger_type,trigger_value,action_type,action_value,position')
      .order('position', { ascending: true })
      .order('id', { ascending: true })
    if (error || !data) {
      if (error) console.error('[getCrmAutomationRules]', error.message)
      return []
    }
    return (data as RawRule[]).map(mapRule)
  },
  ['crm-automation-rules-v1'],
  { revalidate: 300, tags: [CRM_AUTOMATION_RULES_TAG] },
)

/**
 * Engine helper: active rules for a given trigger, already matched + ordered.
 * Reads through the cache then applies the pure matcher. The auto-enroll path
 * calls this with ('tag_added', tag) and takes the first enroll_sequence action.
 */
export async function getActiveRulesForTrigger(
  triggerType: CrmTriggerType,
  triggerValue: string,
): Promise<CrmAutomationRule[]> {
  const rules = await getCrmAutomationRules()
  return matchRules(rules, triggerType, triggerValue)
}
