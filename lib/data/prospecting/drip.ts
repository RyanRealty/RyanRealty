import 'server-only'

/**
 * Drip-sequence resolution for the prospecting hub's one-click enroll.
 *
 * ONE resolution path shared by the detail read (button enabled/disabled
 * state) and enrollProspectInDripAction (app/actions/prospecting.ts), so the
 * UI and the action can never disagree about WHICH workflow a kind maps to.
 *
 * The resolution mirrors lib/crm/enroll.ts autoEnrollPerson exactly:
 * PRIMARY — the UI-configurable crm_automation_rules table (tag_added on the
 * kind's intent tag → enroll_sequence, first active rule by position wins).
 * FALLBACK — the master-plan const (fub_legacy_plan_id 71 expired / 72 fsbo),
 * so a config-table outage never silently kills the button.
 *
 * The enrollment WRITE stays in lib/crm/enroll.ts manualEnrollPerson — this
 * module only answers "which sequence" and "is this person already in it".
 */

import { createServiceClient } from '@/lib/supabase/service'
import type { ProspectDripState, ProspectKind } from './types'

/** Mirrors lib/crm/enroll.ts RULES for the two prospecting kinds. */
const FALLBACK_PLAN_ID: Record<ProspectKind, number> = { expired: 71, fsbo: 72 }

export function dripIntentTagFor(kind: ProspectKind): string {
  return kind === 'expired' ? 'intent:expired-listing' : 'intent:fsbo'
}

/**
 * Enrollment statuses that count as "already in the drip" for the DISPLAY
 * state. Deliberately broader than manualEnrollPerson's refusal set
 * (running/paused/awaiting_broker_next): a paused_reply or awaiting_broker
 * enrollment is still a live drip, and offering a second enroll there would
 * invite a duplicate cadence. Fail-safe direction: over-disable, never
 * over-enroll.
 */
const LIVE_DRIP_STATUSES = ['running', 'paused', 'paused_reply', 'awaiting_broker', 'awaiting_broker_next']

export interface DripSequence {
  id: number
  name: string
  status: string
}

/** The workflow this prospect kind enrolls into (null when none is active). */
export async function resolveDripSequenceForKind(kind: ProspectKind): Promise<DripSequence | null> {
  const sb = createServiceClient()

  // PRIMARY: automation rules (tag_added → enroll_sequence), position order.
  let sequenceId: number | null = null
  try {
    const { getActiveRulesForTrigger } = await import('@/lib/data/crm/getCrmAutomationRules')
    const matched = await getActiveRulesForTrigger('tag_added', dripIntentTagFor(kind))
    const candidates = matched
      .filter((r) => r.actionType === 'enroll_sequence')
      .map((r) => ({ position: r.position, sequenceId: Number(r.actionValue) }))
      .filter((c) => Number.isInteger(c.sequenceId) && c.sequenceId > 0)
      .sort((a, b) => a.position - b.position)
    if (candidates.length) sequenceId = candidates[0].sequenceId
  } catch (e) {
    console.error('[resolveDripSequenceForKind] automation-rules read failed, using fallback const', e)
  }

  let q = sb.from('crm_sequences').select('id,name,status')
  q = sequenceId !== null ? q.eq('id', sequenceId) : q.eq('fub_legacy_plan_id', FALLBACK_PLAN_ID[kind])
  const { data, error } = await q.maybeSingle()
  if (error) {
    console.error('[resolveDripSequenceForKind]', error.message)
    return null
  }
  if (!data || data.status !== 'active') return null
  return { id: Number(data.id), name: String(data.name), status: String(data.status) }
}

/** Button state for the detail view: resolved sequence + live-enrollment read. */
export async function getProspectDripState(kind: ProspectKind, personId: number | null): Promise<ProspectDripState> {
  const seq = await resolveDripSequenceForKind(kind)
  if (!seq) return { sequenceId: null, sequenceName: null, enrolled: false }
  if (personId == null) return { sequenceId: seq.id, sequenceName: seq.name, enrolled: false }

  const sb = createServiceClient()
  const { data, error } = await sb
    .from('crm_sequence_enrollments')
    .select('id')
    .eq('person_id', personId)
    .eq('sequence_id', seq.id)
    .in('status', LIVE_DRIP_STATUSES)
    .limit(1)
  if (error) {
    // Fail toward "enrolled" so an unreadable enrollments table disables the
    // button rather than inviting a duplicate drip.
    console.error('[getProspectDripState]', error.message)
    return { sequenceId: seq.id, sequenceName: seq.name, enrolled: true }
  }
  return { sequenceId: seq.id, sequenceName: seq.name, enrolled: (data ?? []).length > 0 }
}
