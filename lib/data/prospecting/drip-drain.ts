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
 *
 * A relist check that cannot answer is one of two things. When the MLS or our
 * listings table could not answer at all ('global': Spark down, rate limited,
 * no key), every row would fail the same way, so the drain stops, sends
 * nothing and moves nothing. When only this address cannot be answered
 * ('row'), the row is set aside for DRIP_VERIFY_RETRY_MS and the next row is
 * tried in the same tick; the third such failure takes it out of the queue and
 * texts Matt. Until 2026-09-30 both kinds left the row at the head of the
 * queue, so one unanswerable address stopped every send behind it, silently.
 */
import 'server-only'

import { verifyFsboStillActive, verifyNotRelisted } from '@/lib/data/prospecting/batch'
import {
  clearQueuedFirstTouchVerifyAttempts,
  findInFlightFirstTouchSend,
  getLastDripSentAt,
  hardSkipQueuedFirstTouch,
  peekOldestQueuedFirstTouch,
  setAsideQueuedFirstTouch,
  type QueuedDripItem,
} from '@/lib/data/prospecting/drip-queue'
import { queueBrokerHealthAlert } from '@/lib/crm/broker-alerts'
import { DRIP_CRON_ACTOR, mintRelistProof } from '@/lib/prospecting/send-capability'
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
  /** Every due row left the queue (skipped) or was set aside for a later tick (setAside). */
  | { ok: true; action: 'skipped-all'; skipped: number; setAside?: number }
  | { ok: false; error: string; kind?: QueuedDripItem['kind']; id?: string }

const MAX_HARD_SKIPS_PER_TICK = 25

/**
 * Relist checks that may fail for one address before its row leaves the queue.
 * A 'row' failure is a fact about the record (no key and no street number, a
 * street number with more on-market listings than a page, a listing our key
 * may not read, a shared address with no unit), so asking again rarely
 * changes the answer; three checks an hour apart give a fix to the record or a
 * blip the scope got wrong two real chances, cost six Spark calls, and hand the
 * row to a person the same working morning.
 */
export const DRIP_VERIFY_MAX_ATTEMPTS = 3

/** How long a row whose address could not be verified waits before its next check. */
export const DRIP_VERIFY_RETRY_MS = 60 * 60_000

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
  let setAside = 0
  const tried = new Set<string>()
  const doneForNow = (): DripDrainResult =>
    skipped + setAside > 0
      ? { ok: true, action: 'skipped-all', skipped, ...(setAside > 0 ? { setAside } : {}) }
      : { ok: true, action: 'idle', reason: 'empty' }
  for (let i = 0; i < MAX_HARD_SKIPS_PER_TICK; i++) {
    const next = await peekOldestQueuedFirstTouch({ ...peekArgs, now })
    if (!next) {
      if (EXPIRED_FIRST_TOUCH_DRIP_HARD_STOP && skipped + setAside === 0) {
        const held = await peekOldestQueuedFirstTouch({ kinds: ['expired'], now })
        if (held?.kind === 'expired') {
          return { ok: true, action: 'idle', reason: 'expired-hard-stop' }
        }
      }
      return doneForNow()
    }
    if (EXPIRED_FIRST_TOUCH_DRIP_HARD_STOP && next.kind === 'expired') {
      return { ok: true, action: 'idle', reason: 'expired-hard-stop' }
    }
    // Never check one row twice in a tick (a set-aside write that did not
    // take would otherwise hand the same row back 25 times).
    const rowKey = `${next.kind}:${next.id}`
    if (tried.has(rowKey)) return doneForNow()
    tried.add(rowKey)

    const relistCheck = await verifyNotRelisted(next.kind, {
      street_address: next.streetAddress,
      city: next.city,
      postal_code: next.postalCode,
      // Expired: off-market ts. FSBO: detected_at (Closed after detect hard-skips).
      expiryComparator: next.expiredAt,
      listing_key: next.kind === 'expired' ? next.id : null,
      fsbo_url: next.kind === 'fsbo' ? next.id : null,
    })
    if (relistCheck.relisted) {
      await hardSkipQueuedFirstTouch(next.kind, next.id, 'relisted-active-pending-coming-soon-or-closed')
      skipped++
      continue
    }
    if (relistCheck.verifyFailed) {
      // The MLS or our table could not answer at all: every row would fail the
      // same way. Send nothing and move nothing (dequeuing here would let one
      // Spark outage empty the queue, 25 rows a minute).
      if (relistCheck.failureScope !== 'row') {
        return { ok: false, error: 'relist check could not answer; left queued', kind: next.kind, id: next.id }
      }
      // Only this address cannot be answered: set it aside and go on.
      if ((await setAsideAfterVerifyFailure(next, relistCheck.reason, now)) === 'dequeued') skipped++
      else setAside++
      continue
    }
    if (next.kind === 'fsbo') {
      const still = await verifyFsboStillActive(next.id)
      // An unreadable fsbo_listings row is our database failing, not this
      // owner: hold, like any check that could not answer. It used to dequeue.
      if (still.verifyFailed) {
        return { ok: false, error: 'FSBO status read failed; left queued', kind: next.kind, id: next.id }
      }
      if (!still.active) {
        await hardSkipQueuedFirstTouch(next.kind, next.id, 'fsbo-off-market')
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
      actor: DRIP_CRON_ACTOR,
      subjectOverride,
      bodyOverride,
      // This check stands for the intro's and the CMA rail's: one send asks
      // Spark once (it asked three times, six calls, until 2026-09-30).
      relistProof: mintRelistProof(next.kind, next.id, relistCheck),
    })
    if (!sent.ok) {
      // Another run claimed this row between our peek and our claim and is
      // sending it now. Stand down; the row stays exactly as that run leaves it.
      if (sent.code === 'in-progress') {
        return { ok: true, action: 'busy', reason: 'claimed-elsewhere', kind: next.kind, id: next.id }
      }
      // The send path's own screen could not answer (the CMA rail's table
      // read, or an address it cannot screen). Same two cases as above.
      if (sent.code === 'verify-failed') {
        if (sent.verifyScope !== 'row') {
          return { ok: false, error: sent.error ?? 'relist check could not answer; left queued', kind: next.kind, id: next.id }
        }
        if ((await setAsideAfterVerifyFailure(next, sent.error ?? null, now)) === 'dequeued') skipped++
        else setAside++
        continue
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

  return { ok: true, action: 'skipped-all', skipped, ...(setAside > 0 ? { setAside } : {}) }
}

/**
 * A relist check that could not answer for this row's address: set the row
 * aside for DRIP_VERIFY_RETRY_MS, counted. On the DRIP_VERIFY_MAX_ATTEMPTS-th
 * failure take it out of the queue and text Matt (the ops alert, deduped per
 * address for a week), so a person checks the MLS by hand. Before the counter
 * migration is applied the row is only set aside, never dropped.
 */
async function setAsideAfterVerifyFailure(
  next: QueuedDripItem,
  reason: string | null,
  now: Date,
): Promise<'set-aside' | 'dequeued'> {
  const { attempts } = await setAsideQueuedFirstTouch(next.kind, next.id, new Date(now.getTime() + DRIP_VERIFY_RETRY_MS))
  if (attempts == null || attempts < DRIP_VERIFY_MAX_ATTEMPTS) return 'set-aside'
  await hardSkipQueuedFirstTouch(next.kind, next.id, `relist-verify-failed:${attempts}`)
  await clearQueuedFirstTouchVerifyAttempts(next.kind, next.id)
  const where = [next.streetAddress, next.city].filter(Boolean).join(', ') || next.id
  const why = (reason ?? 'no reason given').replace(/\s+/g, ' ').slice(0, 140)
  await queueBrokerHealthAlert({
    key: `drip-verify-${next.kind}-${where.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 48)}`,
    body: `Drip took ${where} (${next.kind}) out of the queue: the MLS relist check could not answer ${attempts} times (${why}). Nothing was sent. Check the MLS by hand, then queue it again from its CMA.`,
    cooldownMinutes: 7 * 24 * 60,
  })
  return 'dequeued'
}
