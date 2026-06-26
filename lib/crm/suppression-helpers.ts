/**
 * CRM suppression helpers — the PURE types + non-async helpers extracted from
 * the 'use server' action module (app/actions/crm-suppressions.ts). A 'use
 * server' file may export ONLY async functions, so the result type, the audit-row
 * shape, the audit-row builder, and the compliance-lift guard live here in a plain
 * module the action imports back. No behavior change — verbatim move.
 */

import { isComplianceReason, type CrmSuppressionChannel } from '@/lib/data/crm/getCrmSuppressions'

export type CrmSuppressionResult = { ok: true } | { ok: false; error: string }

/**
 * The shape of the audit timeline row a suppression mutation writes. PURE
 * construction (no I/O) so the exact attribution payload is unit-tested.
 */
export type SuppressionAuditRow = {
  person_id: number
  kind: 'system'
  title: string
  body: string | null
  source: 'app'
  broker: string | null
  payload: Record<string, unknown>
}

/**
 * Build the audit timeline row for a suppression add/lift. PURE — exported for
 * the test. `who` is the acting admin's email (always from the verified session,
 * never user input); `whoBroker` is their broker slug for the timeline stamp.
 */
export function buildSuppressionAuditRow(input: {
  action: 'add' | 'lift'
  personId: number
  channel: CrmSuppressionChannel
  reason: string
  who: string
  whoBroker: string | null
  confirmed?: boolean
  value?: string | null
}): SuppressionAuditRow {
  const verb = input.action === 'add' ? 'Suppression added' : 'Suppression lifted'
  const title = `${verb}: ${input.channel} (${input.reason})`
  const isCompliance = isComplianceReason(input.reason)
  return {
    person_id: input.personId,
    kind: 'system',
    title,
    body: `${verb} by ${input.who} on ${input.channel} — reason "${input.reason}".`,
    source: 'app',
    broker: input.whoBroker,
    payload: {
      audit: 'suppression',
      action: input.action,
      channel: input.channel,
      reason: input.reason,
      value: input.value ?? null,
      compliance: isCompliance,
      confirmed: input.confirmed ?? false,
      by: input.who,
      at: new Date().toISOString(),
    },
  }
}

/**
 * The lift-confirmation guard. A compliance/litigator suppression can only be
 * lifted with an explicit confirm flag. PURE — the single decision point so the
 * action and the test agree. Returns ok:false (with the canonical message) when
 * a compliance lift is attempted without confirmation; ok:true otherwise.
 */
export function checkComplianceLiftAllowed(input: {
  reason: string
  confirm: boolean
}): CrmSuppressionResult {
  if (isComplianceReason(input.reason) && !input.confirm) {
    return {
      ok: false,
      error:
        'This is a compliance or litigator suppression. Lifting it is a legal liability and must be confirmed explicitly.',
    }
  }
  return { ok: true }
}
