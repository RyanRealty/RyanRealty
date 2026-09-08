/**
 * COMPLIANCE FLAGS ON THE ROW (round four, class D).
 *
 * Two of the four rebuilt exemplars carried a status the document was not
 * entitled to ignore:
 *
 *  - 1617 NW 8th is an ACTIVE listing held by another brokerage, and the
 *    closing chapter solicited the owner. Soliciting a seller who is under a
 *    written listing agreement with another firm is the one compliance line a
 *    price opinion can cross by accident.
 *  - 2465 7th is WITHDRAWN, not Expired. A withdrawal takes the listing off
 *    the market; it does not end the agreement, and the term may still be
 *    running. An expired listing is the case where nobody represents the
 *    owner, and only that case.
 *
 * Neither document carried a carve-out because nothing on `render_args` said
 * so. This is the block a renderer reads to suppress a solicitation. It
 * decides nothing about the price and nothing about what the chapter says: it
 * states the status, whether the listing is live with somebody else, and
 * whether the last cycle ended in a way that leaves an agreement open.
 */
import { BRAND } from '@/lib/brand/contact'
import type { CmaSubjectStatus } from '@/lib/cma/types'

/** MLS statuses that mean the listing is on the market right now. */
const LIVE_STATUSES = new Set(['active', 'active under contract', 'pending', 'coming soon'])

/** Off the market without selling, with the agreement possibly still running. */
const WITHDRAWN_STATUSES = new Set(['withdrawn', 'canceled', 'cancelled'])

/** Our own email domain. The same test lib/agent/tools/produce.ts uses for its third-party guard. */
const OUR_EMAIL_DOMAIN = `@${BRAND.domain}`

function norm(value: string | null | undefined): string {
  return String(value ?? '').trim().toLowerCase()
}

export function buildSubjectStatus(args: {
  standardStatus: string | null | undefined
  listAgentName?: string | null
  listAgentEmail?: string | null
  listOfficeName?: string | null
  /** Carried through from `resolveFinalCycle` when a stale cycle was suppressed. */
  suppressedReason?: string | null
}): CmaSubjectStatus {
  const status = String(args.standardStatus ?? '').trim() || null
  const key = norm(status)

  // Ours by the listing agent's email domain, or by the office name on the
  // row. Either one is sufficient; the MLS carries the office on every row and
  // the email on most.
  const listingAgentIsUs =
    norm(args.listAgentEmail).endsWith(OUR_EMAIL_DOMAIN) || norm(args.listOfficeName).includes(norm(BRAND.name))

  const isLive = LIVE_STATUSES.has(key)
  const isActiveWithOtherBrokerage = isLive && !listingAgentIsUs
  const isWithdrawnNotExpired = WITHDRAWN_STATUSES.has(key)

  const notes: string[] = []
  if (isActiveWithOtherBrokerage) {
    const who = String(args.listOfficeName ?? '').trim()
    notes.push(
      `This home is on the market with another brokerage${
        who ? ` (${who})` : ''
      }. This report is an opinion of value and not an offer to represent the owner.`,
    )
  }
  if (isWithdrawnNotExpired) {
    notes.push(
      'This listing was taken off the market rather than expiring, so a listing agreement may still be in force. This report is an opinion of value and not an offer to represent the owner.',
    )
  }
  const suppressed = String(args.suppressedReason ?? '').trim()
  if (suppressed) notes.push(suppressed)

  return {
    standardStatus: status,
    isActiveWithOtherBrokerage,
    isWithdrawnNotExpired,
    listingAgentIsUs,
    note: notes.length ? notes.join(' ') : null,
  }
}
