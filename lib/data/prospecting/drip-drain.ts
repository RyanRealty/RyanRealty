/**
 * Drain one queued prospecting first-touch email when the drip schedule allows.
 *
 * Every run, in order:
 *   1. Settle stuck sends (drip-recover.ts). A claim whose function died
 *      mid-send is finalized when its email left, released back to the queue
 *      when it provably did not, and left alone (with an alert) otherwise. A
 *      run that changed a row, or spent over a minute checking, stops there;
 *      the next run sends with a full time budget.
 *   2. The weekday / spacing schedule.
 *   3. One drain at a time: when any email claim is still inside the busy
 *      window (a drain or a manual send may be mid-send), stand down.
 *   4. Peek the oldest queued row, fail-closed live-status hard-skip BEFORE the
 *      send claim (same verifyNotRelisted pattern the manual email intro uses),
 *      then send. Skipped rows leave the queue; the next eligible queued row may
 *      be tried in the same tick until one send is attempted or the queue is
 *      empty. Still at most ONE send per tick (spacing).
 */
import 'server-only'

import { verifyFsboStillActive, verifyNotRelisted } from '@/lib/data/prospecting/batch'
import {
  findInFlightFirstTouchSend,
  getLastDripSentAt,
  hardSkipQueuedFirstTouch,
  peekOldestQueuedFirstTouch,
  type QueuedDripItem,
} from '@/lib/data/prospecting/drip-queue'
import { recoverStuckFirstTouchSends, type StuckSendOutcome } from '@/lib/data/prospecting/drip-recover'
import {
  canSendDripNow,
  DRIP_SPACING_MINUTES,
  EXPIRED_FIRST_TOUCH_DRIP_HARD_STOP,
} from '@/lib/data/prospecting/drip-schedule'
import { sendProspectingEmailIntro } from '@/app/actions/prospecting'
import { getProspect } from '@/lib/data'
import { loadCmaFirstContactOverride } from '@/lib/cma/first-contact-override'
import type { SendGuardCode } from '@/lib/data/prospecting/types'

export type DripDrainResult =
  | {
      ok: true
      action: 'idle'
      reason: 'weekend' | 'before-window' | 'spacing' | 'empty' | 'expired-hard-stop'
    }
  | { ok: true; action: 'recovered'; recovered: StuckSendOutcome[] }
  | {
      ok: true
      action: 'busy'
      /** in-flight: a claim inside the busy window. claimed-elsewhere: lost the claim race for this row. */
      reason: 'in-flight' | 'claimed-elsewhere'
      kind: QueuedDripItem['kind']
      id: string
      claimAt?: string
    }
  | { ok: true; action: 'sent'; kind: QueuedDripItem['kind']; id: string }
  | { ok: true; action: 'skipped-all'; skipped: number }
  | { ok: false; error: string; kind?: QueuedDripItem['kind']; id?: string }

const MAX_HARD_SKIPS_PER_TICK = 25

/**
 * A run that spent longer than this settling stuck sends does not also start a
 * send. A CMA send needs most of the route's 300 s, and one the platform cuts
 * off is exactly the stuck send step 1 exists to clean up. The next tick sends
 * with the whole budget.
 */
export const DRIP_RECOVERY_SEND_BUDGET_MS = 60_000

/**
 * Refusals that end this row's time in the drip. 'in-progress' is NOT one:
 * another run holds the claim and is sending right now, which says nothing
 * about whether this owner should be emailed.
 */
const DEQUEUE_CODES: ReadonlySet<SendGuardCode> = new Set<SendGuardCode>([
  'relisted',
  'hard-stop',
  'off-market',
  'no-email',
  'suppressed',
  'already-sent',
  'no-doc',
  'not-found',
])

export async function drainProspectingFirstTouchDrip(now: Date = new Date()): Promise<DripDrainResult> {
  // 1. Stuck sends first, at any hour: settling one never sends an email.
  // (Elapsed time is measured on the real clock; `now` is the schedule's clock.)
  const recoveryStartedMs = Date.now()
  const recovered = await recoverStuckFirstTouchSends(now)
  if (
    recovered.some((r) => r.outcome === 'finalized' || r.outcome === 'released') ||
    Date.now() - recoveryStartedMs > DRIP_RECOVERY_SEND_BUDGET_MS
  ) {
    return { ok: true, action: 'recovered', recovered }
  }

  // 2. Schedule.
  const last = await getLastDripSentAt()
  const gate = canSendDripNow({
    now,
    lastDripSentAt: last,
    spacingMinutes: DRIP_SPACING_MINUTES,
  })
  if (!gate.ok) {
    return { ok: true, action: 'idle', reason: gate.reason }
  }

  // 3. One drain at a time.
  const inFlight = await findInFlightFirstTouchSend(now)
  if (inFlight) {
    return { ok: true, action: 'busy', reason: 'in-flight', kind: inFlight.kind, id: inFlight.id, claimAt: inFlight.claimAt }
  }

  // 4. Peek, verify, send.
  // Expired hard stop: never send, dequeue, or mark an expired row. Ask the
  // FIFO for FSBO only so a queued expired CMA cannot block an FSBO send.
  // A peeked expired row (the filter was ignored, or a later code path) is
  // refused here too, and left exactly as it was.
  const peekArgs = EXPIRED_FIRST_TOUCH_DRIP_HARD_STOP
    ? { kinds: ['fsbo'] as const }
    : undefined
  let skipped = 0
  for (let i = 0; i < MAX_HARD_SKIPS_PER_TICK; i++) {
    const next = await peekOldestQueuedFirstTouch(peekArgs)
    if (!next) {
      if (skipped > 0) return { ok: true, action: 'skipped-all', skipped }
      if (EXPIRED_FIRST_TOUCH_DRIP_HARD_STOP) {
        const held = await peekOldestQueuedFirstTouch({ kinds: ['expired'] })
        if (held?.kind === 'expired') {
          return { ok: true, action: 'idle', reason: 'expired-hard-stop' }
        }
      }
      return { ok: true, action: 'idle', reason: 'empty' }
    }
    if (EXPIRED_FIRST_TOUCH_DRIP_HARD_STOP && next.kind === 'expired') {
      return { ok: true, action: 'idle', reason: 'expired-hard-stop' }
    }

    const relistCheck = await verifyNotRelisted(next.kind, {
      street_address: next.streetAddress,
      city: next.city,
      // Expired: off-market ts. FSBO: detected_at (Closed after detect hard-skips).
      expiryComparator: next.expiredAt,
      listing_key: next.kind === 'expired' ? next.id : null,
      fsbo_url: next.kind === 'fsbo' ? next.id : null,
    })
    if (relistCheck.relisted || relistCheck.verifyFailed) {
      const reason = relistCheck.verifyFailed
        ? 'verify-failed-fail-closed'
        : 'relisted-active-pending-coming-soon-or-closed'
      await hardSkipQueuedFirstTouch(next.kind, next.id, reason)
      skipped++
      continue
    }
    if (next.kind === 'fsbo') {
      const still = await verifyFsboStillActive(next.id)
      if (still.verifyFailed || !still.active) {
        await hardSkipQueuedFirstTouch(
          next.kind,
          next.id,
          still.verifyFailed ? 'fsbo-status-verify-failed' : 'fsbo-off-market',
        )
        skipped++
        continue
      }
    }

    const idempotencyKey = `drip:${next.kind}:${next.id}:${next.queuedAt}`
    // Review-page email edits (if any) live on the linked CMA build_summary.
    let subjectOverride: string | null = null
    let bodyOverride: string | null = null
    const prospect = await getProspect(next.kind, next.id)
    const cmaSlug =
      prospect && (prospect.doc.state === 'ready' || prospect.doc.state === 'sent')
        ? prospect.doc.slug
        : null
    if (cmaSlug) {
      const ov = await loadCmaFirstContactOverride(cmaSlug)
      if (ov) {
        subjectOverride = ov.subject || null
        bodyOverride = ov.bodyText || null
      }
    }
    const sent = await sendProspectingEmailIntro(next.kind, next.id, {
      idempotencyKey,
      actor: 'drip-cron',
      subjectOverride,
      bodyOverride,
    })
    if (!sent.ok) {
      // Another run claimed this row between our peek and our claim and is
      // sending it now. Stand down; the row stays exactly as that run leaves it.
      if (sent.code === 'in-progress') {
        return { ok: true, action: 'busy', reason: 'claimed-elsewhere', kind: next.kind, id: next.id }
      }
      // Permanent hard-stops / already-sent: dequeue so the drip does not stall.
      // Transient send-failed: leave queued (claim release restores queued when
      // queued_at is set — see migration release RPC). A send Gmail never
      // confirmed keeps its claim instead; step 1 settles it once it is stale.
      if (sent.code && DEQUEUE_CODES.has(sent.code)) {
        await hardSkipQueuedFirstTouch(next.kind, next.id, `send-refused:${sent.code}`)
        skipped++
        continue
      }
      return { ok: false, error: sent.error ?? 'send-failed', kind: next.kind, id: next.id }
    }
    return { ok: true, action: 'sent', kind: next.kind, id: next.id }
  }

  return { ok: true, action: 'skipped-all', skipped }
}
