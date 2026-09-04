/**
 * Worklist bucket classification (pure). Shared by list.ts summary chips and
 * the /admin/prospecting row state word so SEND paint cannot drift from counts.
 *
 * Fail-closed: market hard-skip (relisted / off-market) and missing CRM person
 * never classify as sendable — same class as canOpenProspectSend / enroll hide.
 */

import type { ProspectComplianceState, ProspectDocState } from './types'

export type ProspectBucket = 'sendable' | 'needs-audit' | 'sent' | 'excluded' | 'no-phone'

export function classifyProspect(
  doc: ProspectDocState,
  compliance: Pick<
    ProspectComplianceState,
    'relisted' | 'offMarket' | 'allChannelsBlocked' | 'channels' | 'noPhone' | 'noEmail' | 'hardStop' | 'suppressedSms'
  >,
  sendable: boolean,
  personId: number | null = null,
): ProspectBucket {
  if (doc.state === 'sent') return 'sent'
  // Market hard-skip BEFORE doc/channel paint (Remarkable/Dodds class): Active
  // MLS / off-market must never surface as Send — or as Failed+Retry build —
  // even when EMAIL is otherwise open or the audit was killed by the re-list guard.
  if (compliance.relisted || compliance.offMarket || compliance.allChannelsBlocked) return 'excluded'
  if (doc.state !== 'ready') return 'needs-audit'
  // Doc ready, not yet sent. CHANNEL-AWARE (Matt 2026-08-05): a DNC contact with
  // an open email channel is emailable, not a red "Blocked" wall. Person link
  // required (Pine Vista / Nugget class) — same gate as canOpenProspectSend.
  const smsOpen = !compliance.channels.sms.blocked
  const emailOpen = !compliance.channels.email.blocked
  if ((smsOpen || emailOpen) && personId != null) return 'sendable'
  // Ready doc but no CRM person (or no deliverable channel): not Send.
  // Reuse no-phone as the attach/reachability bucket so list never paints SEND.
  if (
    personId == null ||
    (compliance.noPhone && compliance.noEmail && !compliance.hardStop && !compliance.suppressedSms)
  ) {
    return 'no-phone'
  }
  return sendable ? 'sendable' : 'excluded'
}
