/**
 * Journey stage truth — named writers for crm_people.stage.
 *
 * Streamline v2 (2026-07-03) deactivated Lead and stamped every native create
 * as Nurture, so the packet showed Lead = 0. G3 / R-163 restore Lead as the
 * inbound entry stage. Advance happens only on a named real event — never a
 * historical-book backfill.
 *
 * reachability: entry-point native-create + enroll + first-outbound
 */

export const JOURNEY_ENTRY_STAGE = 'Lead' as const
export const JOURNEY_NURTURE_STAGE = 'Nurture' as const

export const JOURNEY_ADVANCE_TRIGGERS = ['sequence-enroll', 'first-outbound'] as const
export type JourneyAdvanceTrigger = (typeof JOURNEY_ADVANCE_TRIGGERS)[number]

export type JourneyWriter = {
  trigger: string
  sets?: typeof JOURNEY_ENTRY_STAGE
  from?: readonly string[]
  to?: string
  when: string
}

/** Every stage writer the class owns. The gate asserts this list stays named. */
export const JOURNEY_WRITERS: readonly JourneyWriter[] = [
  {
    trigger: 'native-create',
    sets: JOURNEY_ENTRY_STAGE,
    when: 'crm_people insert via buildNativePersonRow (form, inbound SMS/call, hot-anonymous)',
  },
  {
    trigger: 'sequence-enroll',
    from: [JOURNEY_ENTRY_STAGE],
    to: JOURNEY_NURTURE_STAGE,
    when: 'autoEnrollPerson or manualEnrollPerson succeeds',
  },
  {
    trigger: 'first-outbound',
    from: [JOURNEY_ENTRY_STAGE],
    to: JOURNEY_NURTURE_STAGE,
    when: 'first successful governed email/SMS (stampFirstBrokerActionIfEmpty path)',
  },
  {
    trigger: 'broker-set-stage',
    when: 'updateCrmStageAction / bulk set-stage — broker names the destination',
  },
  {
    trigger: 'sequence-change-stage',
    when: 'crm-sequence-engine change_stage step — workflow names the destination',
  },
]

export function isJourneyAdvanceTrigger(value: string): value is JourneyAdvanceTrigger {
  return (JOURNEY_ADVANCE_TRIGGERS as readonly string[]).includes(value)
}

/**
 * Pure decision: given the current stage and a named trigger, the next stage
 * or null when this trigger is a no-op (already past Lead, unknown trigger).
 */
export function nextStageOnTrigger(
  current: string | null | undefined,
  trigger: JourneyAdvanceTrigger,
): typeof JOURNEY_NURTURE_STAGE | null {
  if (current !== JOURNEY_ENTRY_STAGE) return null
  if (trigger === 'sequence-enroll' || trigger === 'first-outbound') return JOURNEY_NURTURE_STAGE
  return null
}
