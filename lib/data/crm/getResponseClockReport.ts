import 'server-only'
import { unstable_cache } from 'next/cache'
import { createServiceClient } from '@/lib/data/client'
import {
  loadClockPopulation,
  loadFirstHumanTouches,
  RESPONSE_CLOCK_WINDOW_HOURS,
} from '@/lib/crm/response-clock-run'
import {
  BUSINESS_END_HOUR,
  BUSINESS_START_HOUR,
  HUMAN_TOUCH_KINDS,
  NON_HUMAN_SOURCES,
  RESPONSE_GRACE_MINUTES,
  SITE_SUBMIT_SOURCES,
  STALE_HOURS,
  classify,
  responseClockStats,
  responseDueAt,
  type ResponseClockStats,
} from '@/lib/crm/response-clock'

/**
 * getResponseClockReport — what /admin/crm shows a broker on load (SITE-09).
 *
 * Two questions, one read:
 *   1. WHO IS WAITING RIGHT NOW. Every site submit in the last 26 hours with no
 *      human touch, oldest first, with the five-minute mark it is measured
 *      against. This is the list a broker acts on.
 *   2. ARE WE KEEPING THE CLOCK. Median seconds from row creation to first human
 *      touch over 28 days, counted only for leads created 8am–8pm Pacific (the
 *      node's accept window), plus how many sat a full day untouched.
 *
 * THE POPULATION AND THE PREDICATE ARE NOT REDEFINED HERE. Both come from
 * lib/crm/response-clock-run.ts, which the cron also calls, and the human-touch
 * rule from lib/crm/response-clock.ts. A panel that disagreed with the timer
 * about who is untouched would be worse than no panel.
 *
 * Not the same metric as getSpeedToLeadReport: that one counts ANY outbound row
 * including drip email as first contact, over every attributable lead source.
 * This one counts only a person's own send, only on site submits. Both are
 * true; they answer different questions, so neither number was changed to match.
 */

export type ResponseClockWaiting = {
  personId: number
  name: string | null
  ask: string
  source: string | null
  assignedBroker: string
  createdAt: string
  ageMinutes: number
  dueAt: string
  /** Past the five-minute mark and already paged. */
  flag5mAt: string | null
  /** Past a full day. */
  flag24hAt: string | null
  href: string
}

export type ResponseClockReport = {
  waiting: ResponseClockWaiting[]
  /**
   * Site submits inside the LIVE window (26h), waiting or not. Separates the two
   * reasons the waiting list can be empty: everyone was answered, or nobody
   * wrote. "Every site submit has a human touch" over an empty set reads as a
   * claim and is not one.
   */
  liveWindowLeads: number
  stats28d: ResponseClockStats
  generatedAt: string
  /** The §0 trace: table, filter, window, row counts. Rendered beside the figures. */
  sourceLine: string
}

const STATS_WINDOW_DAYS = 28

async function readResponseClock(): Promise<ResponseClockReport> {
  const sb = createServiceClient()
  const now = new Date()

  // One 28-day population read serves both halves; the live list is the tail of it.
  const { leads, windowStart } = await loadClockPopulation(sb, {
    now,
    windowHours: STATS_WINDOW_DAYS * 24,
  })
  const touches = await loadFirstHumanTouches(sb, leads.map((l) => l.personId), windowStart)
  const stats28d = responseClockStats(leads, touches, now)

  const liveCutoff = now.getTime() - RESPONSE_CLOCK_WINDOW_HOURS * 3600_000
  const waiting: ResponseClockWaiting[] = []
  let liveWindowLeads = 0
  for (const lead of leads) {
    const createdIso = lead.createdAt ?? lead.fubCreatedAt
    if (!createdIso) continue
    const created = new Date(createdIso)
    if (created.getTime() < liveCutoff) continue
    liveWindowLeads++
    const decision = classify({
      createdAt: created,
      now,
      firstHumanTouchAt: touches.get(lead.personId)?.ts ?? null,
      flags: lead.flags,
    })
    if (decision.state === 'touched') continue
    waiting.push({
      personId: lead.personId,
      name: lead.name,
      ask: lead.ask,
      source: lead.source ?? null,
      assignedBroker: lead.assignedBroker ?? 'matt',
      createdAt: created.toISOString(),
      ageMinutes: decision.ageMinutes,
      dueAt: responseDueAt(created).toISOString(),
      flag5mAt: lead.flags.flag5mAt ?? null,
      flag24hAt: lead.flags.flag24hAt ?? null,
      href: `/admin/people/${lead.personId}`,
    })
  }
  waiting.sort((a, b) => b.ageMinutes - a.ageMinutes)

  const sourceLine =
    `crm_people.source or source:* tag in (${SITE_SUBMIT_SOURCES.join(', ')}), created_at ≥ ${windowStart}` +
    ` — ${leads.length} site submits, ${stats28d.leads} of them created ${BUSINESS_START_HOUR}:00–${BUSINESS_END_HOUR}:00 America/Los_Angeles;` +
    ` touches = crm_timeline kind in (${HUMAN_TOUCH_KINDS.join(', ')}) excluding source in (${NON_HUMAN_SOURCES.join(', ')})` +
    ` and any row stamped payload.initiator = system — ${stats28d.contacted} of the in-hours leads touched by a person.` +
    ` Response mark: submit + ${RESPONSE_GRACE_MINUTES} min inside business hours, next 8am otherwise; stale at ${STALE_HOURS}h wall clock.` +
    (stats28d.unstampedTouches > 0
      ? ` READ THE MEDIAN LOW: ${stats28d.unstampedTouches} of the ${stats28d.contacted} counted ${
          stats28d.contacted === 1 ? 'touch predates' : 'touches predate'
        } the provenance stamp the send rails now write, so a system confirmation from before it` +
        ` (a /book appointment invite is the known case) can still read as a person answering. The figure` +
        ` tightens toward the truth as stamped rows fill the window, and it is never slower than reality.`
      : '')

  return { waiting, liveWindowLeads, stats28d, generatedAt: now.toISOString(), sourceLine }
}

/**
 * Cached 5 minutes — the same cadence the cron runs on, so the panel can never
 * show a state the timer has not seen. Tag `crm-response-clock`.
 */
export async function getResponseClockReport(): Promise<ResponseClockReport> {
  const cached = unstable_cache(() => readResponseClock(), ['crm-response-clock-v1'], {
    tags: ['crm-response-clock', 'crm-reporting'],
    revalidate: 300,
  })
  return cached()
}
