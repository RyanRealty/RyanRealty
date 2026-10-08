/**
 * Where a CMA sits on the path a broker actually walks:
 * build, review, schedule or send, then what happened after it left.
 *
 * The sentences are the product. A ready expired letter and a ready FSBO
 * letter share a Schedule button and do not share a result, because the
 * expired first-touch drip is stopped. This file is the one place that says so.
 */
import { EXPIRED_FIRST_TOUCH_DRIP_HARD_STOP } from '@/lib/data/prospecting/drip-schedule'
import type { CmaOrigin, CmaSendMode } from '@/lib/cma/origin'

export type CmaProcessInput = {
  building: boolean
  buildFailed: boolean
  held: boolean
  inDrip: boolean
  /** Letter row stamp or email-log send. The document left. */
  sent: boolean
  /** The queue calls it sent even though neither stamp exists. */
  countedSent: boolean
  hasDocument: boolean
  hasEmail: boolean
  sendMode: CmaSendMode
  origin: CmaOrigin
}

export type CmaProcessPlace = {
  where: string
  next: string
}

const EXPIRED_STOP = 'Expired letters stay in that drip and do not email while it is stopped.'

function readyNext(input: CmaProcessInput): string {
  if (input.origin === 'expired' && EXPIRED_FIRST_TOUCH_DRIP_HARD_STOP && input.sendMode === 'drip') {
    return `Schedule places it in the weekday drip. ${EXPIRED_STOP} Send now emails this one immediately.`
  }
  if (input.sendMode === 'drip') {
    return 'Schedule places it in the weekday drip. That drip emails on weekdays, one at a time. Send now emails this one immediately.'
  }
  if (input.sendMode === 'now') {
    return 'Send now emails this one immediately. Nothing sends until you press it.'
  }
  return 'This origin does not ride the drip. Nothing sends until you send it from this page.'
}

/** The two lines on the review page: where the letter is, and what the next press does. */
export function cmaProcessPlace(input: CmaProcessInput): CmaProcessPlace {
  if (input.sent) {
    return {
      where: 'Sent',
      next: 'The stages below are what we recorded after it left. A stage with no time was not recorded.',
    }
  }
  if (input.countedSent) {
    return {
      where: 'Counted as sent',
      next: 'The list marks this sent. Neither this letter nor the email log has a send time, so opens are not tied to it.',
    }
  }
  if (input.building) {
    return {
      where: 'Building',
      next: 'This page refreshes when the letter is ready. Nothing sends.',
    }
  }
  if (!input.hasDocument) {
    return {
      where: input.buildFailed ? 'Build failed' : 'No letter yet',
      next: 'Nothing sends until a letter exists. Save and rebuild is in the section below.',
    }
  }
  if (input.inDrip) {
    if (input.origin === 'expired' && EXPIRED_FIRST_TOUCH_DRIP_HARD_STOP) {
      return {
        where: 'In the weekday drip',
        next: `${EXPIRED_STOP} Send now on this page is the only way this one emails.`,
      }
    }
    if (input.origin === 'fsbo') {
      return {
        where: 'In the weekday drip',
        next: 'FSBO letters email on weekdays, one at a time. Send now emails this one immediately.',
      }
    }
    return {
      where: 'In the weekday drip',
      next: 'It waits there until the drain sends it. Send now emails this one immediately.',
    }
  }
  if (!input.hasEmail) {
    return {
      where: 'Not sent',
      next: 'There is no email on file, so this page cannot email it.',
    }
  }
  if (input.held) {
    return {
      where: 'Held',
      next: `Nothing has been sent. ${readyNext(input)}`,
    }
  }
  return {
    where: 'Ready, not sent',
    next: readyNext(input),
  }
}

/** Short mark on a queue row. The full sentence is the page banner, once. */
export function cmaQueueSendNote(state: string, origin: CmaOrigin): string | null {
  if (state !== 'ready' && state !== 'queued') return null
  if (origin === 'expired' && EXPIRED_FIRST_TOUCH_DRIP_HARD_STOP) return 'Drip stopped'
  if (origin === 'fsbo' && state === 'ready') return 'Weekday email'
  return null
}

/** One sentence for the list, so the same warning is not repeated on every row. */
export function cmaQueueSendBanner(rows: Array<{ state: string; origin: CmaOrigin }>): string | null {
  let expired = false
  let fsbo = false
  for (const row of rows) {
    if (!EXPIRED_FIRST_TOUCH_DRIP_HARD_STOP) break
    if (row.origin === 'expired' && (row.state === 'ready' || row.state === 'queued')) expired = true
    if (row.origin === 'fsbo' && row.state === 'ready') fsbo = true
  }
  if (expired && fsbo) {
    return 'Expired letters on this page wait in the drip and do not email while it is stopped. A ready FSBO letter emails on a weekday.'
  }
  if (expired) return 'Expired letters on this page: Schedule waits in the drip and does not email while it is stopped.'
  if (fsbo) return 'A ready FSBO letter on this page emails on a weekday when you schedule it.'
  return null
}

/** The sent filter's tally. Counts are the page in front of the broker, not the whole history. */
export function cmaSentPageLine(n: {
  shown: number
  opened: number
  clicked: number
  replied: number
  bad: number
}): string | null {
  if (n.shown <= 0) return null
  const bad = n.bad > 0 ? ` ${n.bad} bounced or unsubscribed.` : ''
  return `${n.shown} on this page. ${n.opened} opened. ${n.clicked} clicked. ${n.replied} replied.${bad}`
}
