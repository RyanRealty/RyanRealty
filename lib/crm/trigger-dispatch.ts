/**
 * trigger-dispatch — fire a CRM trigger and run all matching automation rules.
 *
 * Called from write boundaries (stage update, tag add, etc.) after the primary
 * DB write completes. Non-blocking: callers should `void fireTrigger(...)` or
 * await inside a try/catch so a trigger failure never aborts the primary action.
 *
 * What this does:
 *   1. Reads the cached crm_automation_rules for the given trigger type/value.
 *   2. For each matching active rule, dispatches the action:
 *      - enroll_sequence  → manualEnrollPerson(personId, sequenceId)
 *      - add_tag          → addPersonTagsDirect(personId, [tag])
 *      - set_stage        → updatePersonStageDirect(personId, stage)
 *      - assign_broker    → updatePersonBrokerDirect(personId, broker)
 *   3. Also scans crm_sequences whose `triggers` jsonb contains a matching entry
 *      and auto-enrolls the person into each (skip if already enrolled).
 *
 * All actions are fire-and-forget with individual try/catch so one failing
 * action never blocks the rest.
 *
 * This is SERVER-ONLY (createServiceClient). Import only from server actions
 * or route handlers.
 */

import 'server-only'
import { createServiceClient } from '@/lib/supabase/service'
import { getActiveRulesForTrigger, type CrmTriggerType } from '@/lib/data/crm/getCrmAutomationRules'
import { manualEnrollPerson } from '@/lib/crm/enroll'

// ── Extended trigger types (v2 — FUB §8.5) ────────────────────────────────────

export type ExtendedTriggerType =
  | CrmTriggerType
  | 'deal_stage_changed'
  | 'inquiry'
  | 'property_saved'
  | 'calendar_date'
  | 'appointment'

/**
 * fireTrigger — dispatch a trigger event for a person.
 *
 * @param type    The trigger type string (v1 or v2).
 * @param value   The trigger value (stage key, tag key, source, etc.).
 * @param personId  The crm_people.id of the person this event affects.
 *
 * Returns a summary for logging (not intended to block the caller).
 */
export async function fireTrigger(
  type: ExtendedTriggerType,
  value: string,
  personId: number,
): Promise<{ dispatched: number; enrolled: number; errors: string[] }> {
  const errors: string[] = []
  let dispatched = 0
  let enrolled = 0

  // 1. crm_automation_rules: only v1 types are stored in the table today;
  //    v2 types are accepted without error but will match 0 rules until rows
  //    for those types exist. Safe: getActiveRulesForTrigger returns [] on a
  //    type not in the DB's CHECK — the check was widened by the migration.
  const v1Type = type as CrmTriggerType
  let rules: Awaited<ReturnType<typeof getActiveRulesForTrigger>> = []
  try {
    rules = await getActiveRulesForTrigger(v1Type, value)
  } catch (e) {
    errors.push(`rules-read: ${e instanceof Error ? e.message : String(e)}`)
  }

  for (const rule of rules) {
    try {
      await dispatchRuleAction(rule.actionType, rule.actionValue, personId)
      dispatched++
    } catch (e) {
      errors.push(`rule-${rule.id}: ${e instanceof Error ? e.message : String(e)}`)
    }
  }

  // 2. Sequence-level triggers: sequences whose `triggers` jsonb array contains
  //    { type, value } matching this event. We query directly (not cached) because
  //    sequence triggers change infrequently but need to fire immediately.
  try {
    const sb = createServiceClient()
    // Postgres jsonb @> operator: does the array contain this object?
    const triggerObj = JSON.stringify({ type, value })
    const { data: seqs } = await sb
      .from('crm_sequences')
      .select('id,name,status,triggers')
      .eq('status', 'active')
      // Use contains operator to find sequences with this trigger
      .filter('triggers', 'cs', `[${triggerObj}]`)
      .limit(20)

    for (const seq of seqs ?? []) {
      try {
        const result = await manualEnrollPerson(personId, seq.id as number, `trigger:${type}`)
        if (result.enrolled) enrolled++
        // result.reason is logged but not treated as error when enrolled=false
        // (e.g. "already enrolled" is fine)
      } catch (e) {
        errors.push(`seq-${seq.id}: ${e instanceof Error ? e.message : String(e)}`)
      }
    }
  } catch (e) {
    errors.push(`seq-triggers: ${e instanceof Error ? e.message : String(e)}`)
  }

  return { dispatched, enrolled, errors }
}

// ── Rule action dispatch ───────────────────────────────────────────────────────

async function dispatchRuleAction(
  actionType: string,
  actionValue: string,
  personId: number,
): Promise<void> {
  const sb = createServiceClient()

  switch (actionType) {
    case 'enroll_sequence': {
      const seqId = Number(actionValue)
      if (!Number.isInteger(seqId) || seqId <= 0) throw new Error(`bad sequence id: ${actionValue}`)
      await manualEnrollPerson(personId, seqId, 'automation-rule')
      break
    }
    case 'add_tag': {
      const tagKey = actionValue.trim()
      if (!tagKey) throw new Error('empty tag key')
      const { data: person } = await sb.from('crm_people').select('tags').eq('id', personId).maybeSingle()
      if (!person) throw new Error('person not found')
      const current = (person.tags as string[]) ?? []
      if (current.includes(tagKey)) return // already tagged
      await sb
        .from('crm_people')
        .update({ tags: [...current, tagKey], updated_at: new Date().toISOString() })
        .eq('id', personId)
      await sb.from('crm_timeline').insert({
        person_id: personId, kind: 'system',
        title: `Tag added by automation: ${tagKey}`, source: 'automation-rule',
      })
      break
    }
    case 'set_stage': {
      const stage = actionValue.trim()
      if (!stage) throw new Error('empty stage key')
      await sb
        .from('crm_people')
        .update({ stage, updated_at: new Date().toISOString() })
        .eq('id', personId)
      await sb.from('crm_timeline').insert({
        person_id: personId, kind: 'stage_change',
        title: `Stage set by automation: ${stage}`, source: 'automation-rule',
      })
      break
    }
    case 'assign_broker': {
      const broker = actionValue.trim()
      if (!broker) throw new Error('empty broker slug')
      await sb
        .from('crm_people')
        .update({ assigned_broker: broker, updated_at: new Date().toISOString() })
        .eq('id', personId)
      await sb.from('crm_timeline').insert({
        person_id: personId, kind: 'system',
        title: `Assigned to broker by automation: ${broker}`, source: 'automation-rule',
      })
      break
    }
    default:
      throw new Error(`unknown action type: ${actionType}`)
  }
}
