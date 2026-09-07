/**
 * Pure ETA for a CMA sitting in the prospecting first-touch drip queue.
 *
 * Inputs are the FIFO queued list + last drip send + now + the target row.
 * Uses the same weekday 08:00 America/Los_Angeles window and
 * DRIP_SPACING_MINUTES cadence as lib/data/prospecting/drip-schedule.ts.
 * No DB, no clock — callers supply `now`.
 */

import { zonedDayMinutes } from '@/lib/format/date'
// date-format-ok: formatToParts for drip-window timezone arithmetic + ETA wall-clock label
import {
  DRIP_SPACING_MINUTES,
  DRIP_TIMEZONE,
  DRIP_WEEKDAY_START_MINUTES,
  isDripWeekday,
  isDripWindowOpen,
} from '@/lib/data/prospecting/drip-schedule'
import type { QueuedDripItem } from '@/lib/data/prospecting/drip-queue'

export type DripEtaTarget = { kind: QueuedDripItem['kind']; id: string }

export type DripEta = {
  position: number
  queueDepth: number
  etaAt: Date
  label: string
  /** One-liner for the card: weekday window + spacing. */
  cadence: string
}

/** Shared cadence copy for In-drip cards (queue + Review). */
export const DRIP_CADENCE_LINE =
  'Weekday drip · opens ~8am PT · every 5 min'

const WEEKDAY_ORDER = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const

/** Local civil parts in the drip timezone (for advancing to next weekday 08:00). */
function zonedCivilParts(d: Date, timeZone: string = DRIP_TIMEZONE): {
  year: number
  month: number
  day: number
  weekday: string
  hour: number
  minute: number
} {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(d)
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? ''
  return {
    year: Number(get('year')),
    month: Number(get('month')),
    day: Number(get('day')),
    weekday: get('weekday') || 'Mon',
    hour: Number(get('hour')) % 24,
    minute: Number(get('minute')),
  }
}

/**
 * UTC instant for a civil local wall time in `timeZone`. Iteratively corrects
 * the UTC guess against Intl's observed local parts (DST-safe enough for ETA).
 */
function zonedLocalToUtc(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  timeZone: string = DRIP_TIMEZONE,
): Date {
  let guess = Date.UTC(year, month - 1, day, hour, minute, 0)
  for (let i = 0; i < 4; i++) {
    const seen = zonedCivilParts(new Date(guess), timeZone)
    const asUtc = Date.UTC(seen.year, seen.month - 1, seen.day, seen.hour, seen.minute, 0)
    const wanted = Date.UTC(year, month - 1, day, hour, minute, 0)
    const delta = wanted - asUtc
    if (delta === 0) break
    guess += delta
  }
  return new Date(guess)
}

function addLocalCalendarDays(d: Date, days: number, timeZone: string = DRIP_TIMEZONE): Date {
  const p = zonedCivilParts(d, timeZone)
  // Noon local avoids DST edge when shifting the civil day.
  const noon = zonedLocalToUtc(p.year, p.month, p.day, 12, 0, timeZone)
  const shifted = new Date(noon.getTime() + days * 86_400_000)
  const s = zonedCivilParts(shifted, timeZone)
  return zonedLocalToUtc(s.year, s.month, s.day, p.hour, p.minute, timeZone)
}

/** Push `t` forward until it sits inside an open drip window (weekday ≥ 08:00). */
export function advanceIntoDripWindow(t: Date, timeZone: string = DRIP_TIMEZONE): Date {
  let cursor = new Date(t.getTime())
  for (let i = 0; i < 14; i++) {
    if (isDripWindowOpen(cursor, timeZone)) return cursor
    const { day, minutes } = zonedDayMinutes(cursor, timeZone)
    if (isDripWeekday(cursor, timeZone) && minutes < DRIP_WEEKDAY_START_MINUTES) {
      const p = zonedCivilParts(cursor, timeZone)
      return zonedLocalToUtc(p.year, p.month, p.day, 8, 0, timeZone)
    }
    // Weekend (or closed): step to next local calendar day at 08:00.
    const nextDay = addLocalCalendarDays(cursor, 1, timeZone)
    const p = zonedCivilParts(nextDay, timeZone)
    cursor = zonedLocalToUtc(p.year, p.month, p.day, 8, 0, timeZone)
  }
  return cursor
}

/**
 * Earliest instant the drip may send the head of the queue, given spacing
 * since `lastDripSentAt` and the weekday window.
 */
export function earliestDripSendAt(args: {
  now: Date
  lastDripSentAt: Date | null
  spacingMinutes?: number
  timeZone?: string
}): Date {
  const spacing = args.spacingMinutes ?? DRIP_SPACING_MINUTES
  const timeZone = args.timeZone ?? DRIP_TIMEZONE
  let t: Date
  if (args.lastDripSentAt) {
    t = new Date(args.lastDripSentAt.getTime() + spacing * 60_000)
    if (t.getTime() < args.now.getTime()) t = new Date(args.now.getTime())
  } else {
    t = new Date(args.now.getTime())
  }
  return advanceIntoDripWindow(t, timeZone)
}

/** Next send slot after a successful send at `sentAt` (spacing + window). */
export function nextDripSendAfter(sentAt: Date, spacingMinutes = DRIP_SPACING_MINUTES, timeZone = DRIP_TIMEZONE): Date {
  return advanceIntoDripWindow(new Date(sentAt.getTime() + spacingMinutes * 60_000), timeZone)
}

function formatEtaLabel(etaAt: Date, position: number, queueDepth: number, timeZone = DRIP_TIMEZONE): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    weekday: 'short',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).formatToParts(etaAt)
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? ''
  const weekday = get('weekday')
  const hour = get('hour')
  const minute = get('minute')
  const dayPeriod = (get('dayPeriod') || 'AM').toLowerCase().replace(/\./g, '')
  // "#2 of 2 · next ~Tue 8:10am PT"
  return `#${position} of ${queueDepth} · next ~${weekday} ${hour}:${minute}${dayPeriod} PT`
}

/**
 * Position + ETA for `target` inside the FIFO drip queue.
 * Returns null when the target is not currently queued.
 */
export function dripEtaFor(args: {
  queued: ReadonlyArray<Pick<QueuedDripItem, 'kind' | 'id'>>
  lastDripSentAt: Date | null
  now: Date
  target: DripEtaTarget
  spacingMinutes?: number
  timeZone?: string
}): DripEta | null {
  const { queued, target } = args
  const idx = queued.findIndex((q) => q.kind === target.kind && q.id === target.id)
  if (idx < 0) return null
  const position = idx + 1
  const queueDepth = queued.length
  const spacing = args.spacingMinutes ?? DRIP_SPACING_MINUTES
  const timeZone = args.timeZone ?? DRIP_TIMEZONE

  let etaAt = earliestDripSendAt({
    now: args.now,
    lastDripSentAt: args.lastDripSentAt,
    spacingMinutes: spacing,
    timeZone,
  })
  for (let i = 1; i < position; i++) {
    etaAt = nextDripSendAfter(etaAt, spacing, timeZone)
  }

  return {
    position,
    queueDepth,
    etaAt,
    label: formatEtaLabel(etaAt, position, queueDepth, timeZone),
    cadence: DRIP_CADENCE_LINE,
  }
}

/** Exported for tests — weekday short names the advance loop may land on. */
export const _dripEtaWeekdays = WEEKDAY_ORDER
