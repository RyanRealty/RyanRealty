/**
 * The one differentiating figure a roster card carries, per broker.
 *
 * WHY THIS EXISTS (SITE-48, 2026-09-09). The taste table of 2026-09-08 scored
 * /team 39 and named the whole page as its own dullest section: "three
 * identical directory cards — headshot, name, title pill, license line, and a
 * row of four contact buttons — with no bio, specialty, tenure, or sales fact
 * to differentiate one broker from another." The evaluator's own fix was "a
 * specialty/coverage tag sourced from real listing data".
 *
 * WHERE THE FIGURE MAY COME FROM. `getBrokerSales` (SITE-11) — the broker's
 * closings on the MLS, list side by `list_agent_email` and buy side by
 * `buyer_agent_mls_id` — and, only when that set is empty, their live listings.
 * NOT `brokers.specialties`, which is a self-declared tag with no source, and
 * NOT `brokers.bio`, which is our own copy.
 *
 * THE LADDER, and why it is a ladder rather than one figure. Read on
 * 2026-09-09 the three brokers hold three different shapes of record: 7
 * closings in the trailing twelve months, 3 closings in the trailing twelve,
 * and no closings at all with one live listing. One figure would have printed
 * "0" on the third card. Section 0 forbids that — unknown is not zero, and a
 * zero about a licensed broker's production is a claim, not a blank. So:
 *
 *   1. closings in the last 12 months, when there is at least one
 *   2. else closings on record at all, with the span
 *   3. else homes for sale now, when there is at least one
 *   4. else NOTHING — the card says nothing about production
 *
 * Pure, so the ladder is tested rather than believed.
 */

import type { BrokerSaleTile } from '@/lib/data/brokers/getBrokerSales'
import type { AboutFaceRecord } from '@/app/about/_v3/about-faces'

/** The trailing window the first rung measures. */
export const ROSTER_WINDOW_DAYS = 365

export type RosterActive = { city: string | null }

function dayKey(iso: string | null | undefined): string {
  return String(iso ?? '').slice(0, 10)
}

function tally(names: readonly (string | null | undefined)[]): { name: string; n: number }[] {
  const counts = new Map<string, number>()
  for (const raw of names) {
    const name = (raw ?? '').trim()
    if (!name) continue
    counts.set(name, (counts.get(name) ?? 0) + 1)
  }
  return [...counts.entries()]
    .map(([name, n]) => ({ name, n }))
    .sort((a, b) => b.n - a.n || a.name.localeCompare(b.name))
}

/** "Bend and Redmond" / "Bend, Redmond and Sisters". Never a bare slug list. */
export function placesSentence(places: readonly { name: string }[]): string {
  const names = places.map((p) => p.name)
  if (names.length === 0) return ''
  if (names.length === 1) return names[0]!
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`
}

export function brokerRosterRecord(input: {
  name: string
  /** Every row getBrokerSales returned for this broker. */
  sales: readonly BrokerSaleTile[]
  /** Their live listings, read only when the closing set is empty. */
  actives?: readonly RosterActive[]
  now?: Date
}): AboutFaceRecord | null {
  const now = input.now ?? new Date()
  const closed = input.sales.filter(
    (s) => !!s.CloseDate && s.ClosePrice != null && Number(s.ClosePrice) > 0,
  )
  const cutoff = dayKey(new Date(now.getTime() - ROSTER_WINDOW_DAYS * 86_400_000).toISOString())
  const recent = closed.filter((s) => dayKey(s.CloseDate) >= cutoff)

  if (recent.length > 0) {
    const places = tally(recent.map((s) => s.City))
    return {
      value: String(recent.length),
      label: recent.length === 1 ? 'closing in the last 12 months' : 'closings in the last 12 months',
      places,
      placesSummary: places.length > 0 ? 'Where those closings were' : 'How this is counted',
      sourceName: 'Closed MLS sales',
      trace:
        `Closed MLS sales through Oregon Data Share, every closing recorded for ${input.name} on either side of the deal ` +
        `(list side by list_agent_email, buy side by buyer_agent_mls_id), with a recorded ClosePrice and a CloseDate on or after ${cutoff}: ` +
        `${recent.length} of ${closed.length} on record. Places are the City on those same rows` +
        (places.length > 0 ? ` — ${places.map((p) => `${p.name} ${p.n}`).join(', ')}.` : '.'),
    }
  }

  if (closed.length > 0) {
    const years = closed
      .map((s) => Number(dayKey(s.CloseDate).slice(0, 4)))
      .filter((y) => Number.isFinite(y))
      .sort((a, b) => a - b)
    const first = years[0]
    const last = years[years.length - 1]
    const span = first != null && last != null && first !== last ? `, ${first} to ${last}` : first != null ? `, ${first}` : ''
    const places = tally(closed.map((s) => s.City))
    return {
      value: String(closed.length),
      label: closed.length === 1 ? `closed sale on record${span}` : `closed sales on record${span}`,
      places,
      placesSummary: places.length > 0 ? 'Where those sales were' : 'How this is counted',
      sourceName: 'Closed MLS sales',
      trace:
        `Closed MLS sales through Oregon Data Share, every closing recorded for ${input.name} on either side of the deal ` +
        `(list side by list_agent_email, buy side by buyer_agent_mls_id) with a recorded ClosePrice: ${closed.length} rows, ` +
        `none of them in the last ${ROSTER_WINDOW_DAYS} days. Places are the City on those same rows` +
        (places.length > 0 ? ` — ${places.map((p) => `${p.name} ${p.n}`).join(', ')}.` : '.'),
    }
  }

  const actives = input.actives ?? []
  if (actives.length > 0) {
    const places = tally(actives.map((a) => a.city))
    return {
      value: String(actives.length),
      label: actives.length === 1 ? 'home for sale right now' : 'homes for sale right now',
      places,
      placesSummary: places.length > 0 ? 'Where they are' : 'How this is counted',
      sourceName: 'Live MLS listings',
      trace:
        `Live MLS listings through Oregon Data Share, active listings whose listing agent is ${input.name} ` +
        `(matched on the Oregon license number and on list_agent_email): ${actives.length} active. ` +
        `This card shows live listings rather than closings because no closed sale is recorded against this broker on the feed — ` +
        `unknown is not zero, so nothing is printed about closings. Places are the City on those same rows` +
        (places.length > 0 ? ` — ${places.map((p) => `${p.name} ${p.n}`).join(', ')}.` : '.'),
    }
  }

  return null
}
