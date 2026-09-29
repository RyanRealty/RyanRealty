/**
 * The owner's email slot for a CMA send.
 *
 * WHY THIS EXISTS. On 2026-09-28 six expired owners were emailed their CMA
 * from "Send now" on the review page, and every one of their prospect rows
 * still read "never emailed". `sendCmaToLead` stamped the CMA (`delivered`),
 * the CRM timeline and `email_events`, and never touched the owner's row in
 * `expired_listings` / `fsbo_listings`. So /admin/prospecting showed them
 * uncontacted, and the only thing between an owner and a second first-contact
 * email was the individual CMA row's own status. A second `cmas` row for the
 * same house could be sent again.
 *
 * The weekday drip (`sendProspectingEmailIntro`) never had this hole: it
 * claims the owner's row, sends, stamps the message id, then finalizes, and
 * releases the claim if the send fails before anything leaves. This module
 * gives the CMA rail itself that same sequence, on the same row-locked RPCs
 * (lib/data/prospecting/send-claim.ts), so every caller of `sendCmaToLead` is
 * covered and not only the ones that remembered to claim first.
 *
 * THE SEQUENCE, as a lease:
 *   acquire   after the suppression gate, before the PDF renders. Anything but a
 *             clean claim refuses the send, and nothing leaves. Fails closed.
 *   pre-send  the default. Settling releases the claim, because nothing left.
 *   in-flight markSending() the moment before a rail is handed the message, until
 *             a rail refuses for certain (markNotSent) or takes it (markAccepted).
 *             The email may be out, so the claim is NOT released, whether Gmail
 *             never answered or something threw mid-call. Settling leaves it; the
 *             RPC's two minute window keeps a second click out, and the error
 *             already tells the broker to check Sent.
 *   accepted  a rail took the message. The provider id is stamped on the owner's
 *             row at once (the claim treats a message-id-bearing row as already
 *             sent, so even a failed finalize cannot lead to a second email), and
 *             settling finalizes with retries.
 *
 * Stamp and finalize failures are logged and swallowed: the email is gone, and a
 * bookkeeping failure must not turn a completed send into an error the broker
 * sees (they would click again).
 *
 * WHEN THERE IS NO LEASE TO TAKE (a no-op lease, the send proceeds as before):
 *   - someone asked for this CMA (seller valuation, place page, lead form, a
 *     broker, a BPO). The rule is one COLD first contact per owner; an owner who
 *     asks for a valuation after we cold-emailed them must still get it, so an
 *     asked send neither claims nor is refused by the owner's row;
 *   - the recipient is on our own domain: a test send or a preview, which must
 *     never mark a real owner as emailed;
 *   - no prospect row resolves for this CMA (an ordinary seller or lead CMA);
 *   - the caller already holds the claim. `sendProspectingEmailIntro` claims
 *     first, then calls the rail. A second claim on the same row would come back
 *     `claimed_elsewhere` and refuse the drip's own send.
 */

import {
  claimProspectEmailSend,
  finalizeProspectEmailSend,
  releaseProspectEmailSend,
  stampProspectEmailMessageId,
} from '@/lib/data/prospecting/send-claim'
import { resolveProspectForCmaSend } from '@/lib/data/prospecting/cma-send-prospect'
import type { ProspectKind } from '@/lib/data/prospecting/types'
import { isInternalRecipientEmail } from '@/lib/email/internal-recipient'
import { isAskedOrigin, type CmaOrigin } from '@/lib/cma/origin'

/** Finalize retries after a completed send, same count the drip uses. */
export const CMA_SEND_FINALIZE_ATTEMPTS = 3

/**
 * One key per document. The same CMA sent to the same owner twice replays
 * instead of resending; a different send that already completed reads as
 * already sent. Both refuse.
 */
export function cmaSendIdempotencyKey(slug: string): string {
  return `cma-send:${slug}`
}

/**
 * The broker-facing sentence for every claim answer that is not a clean claim.
 * Takes a plain string on purpose: the RPC's answer is cast, not checked, so an
 * answer nobody planned for must refuse too.
 */
export function cmaSendClaimRefusal(status: string): string {
  switch (status) {
    case 'already_sent':
      return 'Not sent. This owner was already emailed for this home, so a second first-contact email is blocked. The prospect record shows when it went out. To write to them again, use your own inbox.'
    case 'replay':
      return 'Not sent. This CMA already went to the owner from this same button. The prospect record shows when it went out. To write to them again, use your own inbox.'
    case 'claimed_elsewhere':
      return 'Not sent. Another send to this owner is in progress right now (the weekday drip or another tab). Give it a couple of minutes, then check the prospect record before trying again.'
    case 'not_found':
      return "Not sent. The owner's prospect record could not be found when the send started, so a duplicate could not be ruled out."
    case 'not_deployed':
      return 'Not sent. Owner email tracking is not set up on this database yet (migration 20260722010100 is pending), so a duplicate could not be ruled out.'
    default:
      return `Not sent. The owner email check gave an answer this app does not know (${status}), so a duplicate could not be ruled out.`
  }
}

export interface CmaProspectLease {
  /** The owner's row this send holds. Null for a no-op lease. */
  readonly prospect: { kind: ProspectKind; id: string } | null
  /**
   * Call the moment before a rail is handed the message. From here an early exit,
   * a thrown error included, keeps the claim: the email may be out.
   */
  markSending(): void
  /** Every rail refused for certain, so nothing left. The claim will be released. */
  markNotSent(): void
  /** A rail took the message. Stamps the provider id on the owner's row right now. */
  markAccepted(args: { messageId: string | null }): Promise<void>
  /** Release if nothing was handed to a rail, finalize if one accepted, else leave it. Never throws. */
  settle(): Promise<void>
}

export type AcquireCmaProspectLeaseResult =
  | { ok: true; lease: CmaProspectLease }
  | { ok: false; error: string }

const NO_LEASE: CmaProspectLease = {
  prospect: null,
  markSending() {},
  markNotSent() {},
  async markAccepted() {},
  async settle() {},
}

export async function acquireCmaProspectLease(args: {
  slug: string
  recipientEmail: string
  personId: number | null
  /**
   * Where the CMA came from (classifyCmaOrigin on the row). An asked origin
   * never takes the lease: the one-first-contact rule is for cold outreach, and
   * a valuation someone requested is a reply, not a first contact.
   */
  origin: CmaOrigin
  /**
   * The caller already owns the owner's email claim and will stamp and finalize
   * it under its own idempotency key. Only `sendProspectingEmailIntro` does.
   */
  callerHoldsClaim?: boolean
}): Promise<AcquireCmaProspectLeaseResult> {
  const { slug, recipientEmail, personId } = args
  if (args.callerHoldsClaim) return { ok: true, lease: NO_LEASE }
  if (isAskedOrigin(args.origin)) return { ok: true, lease: NO_LEASE }
  if (isInternalRecipientEmail(recipientEmail)) return { ok: true, lease: NO_LEASE }

  let prospect: Awaited<ReturnType<typeof resolveProspectForCmaSend>>
  try {
    prospect = await resolveProspectForCmaSend(slug)
  } catch (e) {
    console.error(`[cma-send-claim] ${slug}: prospect lookup failed, send refused:`, e instanceof Error ? e.message : e)
    return {
      ok: false,
      error: 'Not sent. Could not check whether this owner was already emailed, so nothing went out. Try again in a minute.',
    }
  }
  if (!prospect) return { ok: true, lease: NO_LEASE }

  const { kind, id } = prospect
  const idempotencyKey = cmaSendIdempotencyKey(slug)

  let status: string
  try {
    status = await claimProspectEmailSend(kind, id, idempotencyKey)
  } catch (e) {
    console.error(`[cma-send-claim] ${slug}: claim on ${kind}:${id} failed, send refused:`, e instanceof Error ? e.message : e)
    return {
      ok: false,
      error: "Not sent. Could not reserve this owner's email slot, so nothing went out. Try again in a minute.",
    }
  }
  if (status !== 'claimed') {
    console.warn(`[cma-send-claim] ${slug}: claim on ${kind}:${id} answered ${status}, send refused`)
    return { ok: false, error: cmaSendClaimRefusal(status) }
  }

  let state: 'pre-send' | 'in-flight' | 'accepted' = 'pre-send'
  let messageId: string | null = null
  let settled = false

  const lease: CmaProspectLease = {
    prospect: { kind, id },

    markSending() {
      state = 'in-flight'
    },

    markNotSent() {
      state = 'pre-send'
    },

    async markAccepted({ messageId: providerId }) {
      state = 'accepted'
      messageId = providerId
      if (!providerId) return
      try {
        await stampProspectEmailMessageId(kind, id, providerId)
      } catch (e) {
        console.error(
          `[cma-send-claim] ${slug}: message-id stamp on ${kind}:${id} failed (finalize still attempted):`,
          e instanceof Error ? e.message : e,
        )
      }
    },

    async settle() {
      if (settled) return
      settled = true

      if (state === 'in-flight') {
        console.warn(
          `[cma-send-claim] ${slug}: the message may be out, claim on ${kind}:${id} left in place. Check Sent before sending again.`,
        )
        return
      }

      if (state === 'pre-send') {
        try {
          await releaseProspectEmailSend(kind, id)
        } catch (e) {
          console.error(
            `[cma-send-claim] ${slug}: release of ${kind}:${id} failed (the claim expires on its own):`,
            e instanceof Error ? e.message : e,
          )
        }
        return
      }

      for (let attempt = 1; attempt <= CMA_SEND_FINALIZE_ATTEMPTS; attempt++) {
        try {
          await finalizeProspectEmailSend(kind, id, { idempotencyKey, messageId, personId })
          return
        } catch (e) {
          console.error(
            `[cma-send-claim] ${slug}: finalize attempt ${attempt} on ${kind}:${id} failed:`,
            e instanceof Error ? e.message : e,
          )
        }
      }
      console.error(
        `[cma-send-claim] ${slug}: SENT but finalize FAILED after ${CMA_SEND_FINALIZE_ATTEMPTS} attempts. Manual reconcile needed.`,
        { kind, id, messageId },
      )
    },
  }
  return { ok: true, lease }
}
