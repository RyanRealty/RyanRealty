/**
 * Drain one queued prospecting first-touch email when the drip schedule allows.
 *
 * Fail-closed live-status hard-skip BEFORE the send claim (same verifyNotRelisted
 * pattern the manual email intro uses). Skipped rows leave the queue; the next
 * eligible queued row may be tried in the same tick until one send is attempted
 * or the queue is empty — still at most ONE successful send per tick (spacing).
 */
import 'server-only'

import { verifyFsboStillActive, verifyNotRelisted } from '@/lib/data/prospecting/batch'
import {
  getLastDripSentAt,
  hardSkipQueuedFirstTouch,
  peekOldestQueuedFirstTouch,
  type QueuedDripItem,
} from '@/lib/data/prospecting/drip-queue'
import { canSendDripNow, DRIP_SPACING_MINUTES } from '@/lib/data/prospecting/drip-schedule'
import { sendProspectingEmailIntro } from '@/app/actions/prospecting'

export type DripDrainResult =
  | { ok: true; action: 'idle'; reason: 'weekend' | 'before-window' | 'spacing' | 'empty' }
  | { ok: true; action: 'sent'; kind: QueuedDripItem['kind']; id: string }
  | { ok: true; action: 'skipped-all'; skipped: number }
  | { ok: false; error: string; kind?: QueuedDripItem['kind']; id?: string }

const MAX_HARD_SKIPS_PER_TICK = 25

export async function drainProspectingFirstTouchDrip(now: Date = new Date()): Promise<DripDrainResult> {
  const last = await getLastDripSentAt()
  const gate = canSendDripNow({
    now,
    lastDripSentAt: last,
    spacingMinutes: DRIP_SPACING_MINUTES,
  })
  if (!gate.ok) {
    return { ok: true, action: 'idle', reason: gate.reason }
  }

  let skipped = 0
  for (let i = 0; i < MAX_HARD_SKIPS_PER_TICK; i++) {
    const next = await peekOldestQueuedFirstTouch()
    if (!next) {
      if (skipped > 0) return { ok: true, action: 'skipped-all', skipped }
      return { ok: true, action: 'idle', reason: 'empty' }
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
    const sent = await sendProspectingEmailIntro(next.kind, next.id, {
      idempotencyKey,
      actor: 'drip-cron',
    })
    if (!sent.ok) {
      // Permanent hard-stops / already-sent: dequeue so the drip does not stall.
      // Transient send-failed: leave queued (claim release restores queued when
      // queued_at is set — see migration release RPC).
      const dequeueCodes = new Set([
        'relisted',
        'hard-stop',
        'off-market',
        'no-email',
        'suppressed',
        'already-sent',
        'no-doc',
        'not-found',
      ])
      if (sent.code && dequeueCodes.has(sent.code)) {
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
