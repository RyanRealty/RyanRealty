/**
 * Drain one row from the Sunday 2026-10-04 first-touch queue.
 *
 * Not the weekday drip. canSendSundayQueueNow stays closed until Sunday
 * 2026-10-04 08:00 America/Los_Angeles, then one send per DRIP_SPACING_MINUTES.
 * Rows are status `sunday-queue`, not `queued`, so drainProspectingFirstTouchDrip
 * does not see them. The expired-first-touch hard stop stays on that weekday
 * drain only. This queue is the batch Matt opened for approved CMAs (including
 * expired) starting that Sunday. Relist, suppression, and client-ready checks
 * still run inside sendProspectingEmailIntro.
 *
 * Does not settle stuck sends. The weekday drain in the same cron tick already
 * did, and this drain runs only when that pass did not send.
 */
import 'server-only'

import { verifyFsboStillActive, verifyNotRelisted } from '@/lib/data/prospecting/batch'
import {
  findInFlightFirstTouchSend,
  getLastSundayQueueSentAt,
  hardSkipSundayQueue,
  peekOldestSundayQueue,
  type SundayQueueItem,
} from '@/lib/data/prospecting/drip-queue'
import { canSendSundayQueueNow } from '@/lib/data/prospecting/drip-schedule'
import { sendProspectingEmailIntro } from '@/app/actions/prospecting'
import { getProspect } from '@/lib/data'
import { loadCmaFirstContactOverride } from '@/lib/cma/first-contact-override'
import type { SendGuardCode } from '@/lib/data/prospecting/types'

export type SundayDrainResult =
  | { ok: true; action: 'idle'; reason: 'before-open' | 'spacing' | 'empty' }
  | {
      ok: true
      action: 'busy'
      reason: 'in-flight' | 'claimed-elsewhere'
      kind: SundayQueueItem['kind']
      id: string
      claimAt?: string
    }
  | { ok: true; action: 'sent'; kind: SundayQueueItem['kind']; id: string }
  | { ok: true; action: 'skipped-all'; skipped: number }
  | { ok: false; error: string; kind?: SundayQueueItem['kind']; id?: string }

const MAX_HARD_SKIPS_PER_TICK = 25

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

export async function drainSundayFirstTouchQueue(now: Date = new Date()): Promise<SundayDrainResult> {
  // Open instant first, with no queue read and no send. Saturday night and
  // Sunday 07:59 stop here.
  const closed = canSendSundayQueueNow({ now, lastSundayQueueSentAt: null })
  if (!closed.ok && closed.reason === 'before-open') {
    return { ok: true, action: 'idle', reason: 'before-open' }
  }
  const last = await getLastSundayQueueSentAt()
  const gate = canSendSundayQueueNow({ now, lastSundayQueueSentAt: last })
  if (!gate.ok) {
    return { ok: true, action: 'idle', reason: gate.reason }
  }

  const inFlight = await findInFlightFirstTouchSend(now)
  if (inFlight) {
    return {
      ok: true,
      action: 'busy',
      reason: 'in-flight',
      kind: inFlight.kind,
      id: inFlight.id,
      claimAt: inFlight.claimAt,
    }
  }

  let skipped = 0
  for (let i = 0; i < MAX_HARD_SKIPS_PER_TICK; i++) {
    const next = await peekOldestSundayQueue()
    if (!next) {
      if (skipped > 0) return { ok: true, action: 'skipped-all', skipped }
      return { ok: true, action: 'idle', reason: 'empty' }
    }

    const relistCheck = await verifyNotRelisted(next.kind, {
      street_address: next.streetAddress,
      city: next.city,
      expiryComparator: next.expiredAt,
      listing_key: next.kind === 'expired' ? next.id : null,
      fsbo_url: next.kind === 'fsbo' ? next.id : null,
    })
    if (relistCheck.relisted || relistCheck.verifyFailed) {
      const reason = relistCheck.verifyFailed
        ? 'verify-failed-fail-closed'
        : 'relisted-active-pending-coming-soon-or-closed'
      await hardSkipSundayQueue(next.kind, next.id, reason)
      skipped++
      continue
    }
    if (next.kind === 'fsbo') {
      const still = await verifyFsboStillActive(next.id)
      if (still.verifyFailed || !still.active) {
        await hardSkipSundayQueue(
          next.kind,
          next.id,
          still.verifyFailed ? 'fsbo-status-verify-failed' : 'fsbo-off-market',
        )
        skipped++
        continue
      }
    }

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
      idempotencyKey: next.idempotencyKey,
      // Same cron auth bypass as the weekday drain. The queue is not that drip.
      actor: 'drip-cron',
      subjectOverride,
      bodyOverride,
    })
    if (!sent.ok) {
      if (sent.code === 'in-progress') {
        return { ok: true, action: 'busy', reason: 'claimed-elsewhere', kind: next.kind, id: next.id }
      }
      if (sent.code && DEQUEUE_CODES.has(sent.code)) {
        await hardSkipSundayQueue(next.kind, next.id, `send-refused:${sent.code}`)
        skipped++
        continue
      }
      return { ok: false, error: sent.error ?? 'send-failed', kind: next.kind, id: next.id }
    }
    return { ok: true, action: 'sent', kind: next.kind, id: next.id }
  }

  return { ok: true, action: 'skipped-all', skipped }
}
