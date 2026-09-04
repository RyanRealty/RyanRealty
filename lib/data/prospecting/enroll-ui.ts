/**
 * Display-only drip / send gates for the prospect detail panel.
 * Server actions re-check live; these keep the UI fail-closed with send.
 */

import type { ProspectComplianceState } from './types'

export function prospectMarketBlocksOutreach(compliance: {
  relisted: boolean
  offMarket: boolean
}): boolean {
  return compliance.relisted || compliance.offMarket
}

/** Same market + channel fail-closed as Send intro. Person required to enroll. */
export function prospectDripBlockedReason(args: {
  compliance: Pick<
    ProspectComplianceState,
    'relisted' | 'offMarket' | 'allChannelsBlocked'
  >
  drip: { enrolled: boolean; sequenceId: number | null; sequenceName: string | null }
  personId: number | null
}): string | null {
  if (args.compliance.relisted) return 'Relisted or sold — never enroll.'
  if (args.compliance.offMarket) return 'Off market — never enroll.'
  if (args.compliance.allChannelsBlocked) return 'No open channel. Never enroll.'
  if (args.drip.enrolled) return `Already in ${args.drip.sequenceName ?? 'the drip workflow'}.`
  if (args.personId == null) return 'Link a CRM contact before enrolling.'
  if (args.drip.sequenceId == null) return 'No active drip workflow is configured for this kind.'
  return null
}

/**
 * Hide Enroll when MLS relist / off-market hard-skip would also hide Send,
 * or when no effective CRM person is linked (Link contact / owner-attach instead
 * of a disabled Enroll button). Keep "In drip" visible if already enrolled.
 */
export function shouldHideProspectEnroll(args: {
  compliance: { relisted: boolean; offMarket: boolean }
  drip: { enrolled: boolean }
  /** Effective send person (null = unlinked or contactless farm stub). */
  personId?: number | null
}): boolean {
  if (args.drip.enrolled) return false
  if (prospectMarketBlocksOutreach(args.compliance)) return true
  if (args.personId === null) return true
  return false
}

/** Send rail requires a linked person (CMA compose / owner-unknown class). */
export function canOpenProspectSend(args: {
  compliance: { relisted: boolean; offMarket: boolean; allChannelsBlocked: boolean }
  personId: number | null
}): boolean {
  return (
    !args.compliance.relisted &&
    !args.compliance.offMarket &&
    !args.compliance.allChannelsBlocked &&
    args.personId != null
  )
}
