import 'server-only'
import { createServiceClient } from '@/lib/supabase/service'
import { getGcalBusyIntervals } from '@/lib/google-calendar'
import { CRM_MAILBOXES } from '@/lib/crm/gmail'
import type { BusyInterval } from '@/lib/booking/slots'

/**
 * Everything already on a broker's calendar between two instants, as opaque
 * busy intervals. Titles and people are deliberately NOT returned: this feeds a
 * PUBLIC availability view, and a visitor must never be able to infer who a
 * broker is meeting or where. Only "that time is taken".
 *
 * TWO SOURCES, MERGED (Matt 2026-08-25). crm_appointments alone is not the
 * broker's life: a showing, a listing presentation or a dentist appointment
 * booked straight into Google would have been invisible here, and the public
 * page would have handed that hour to a stranger. Google Calendar is now read
 * for every broker alongside the CRM.
 *
 * Google is read through getGcalBusyIntervals, NOT getGcalEvents, because that
 * one collapses a failed API call into an empty list — which here would mean
 * "totally free". A Google read that FAILS throws and takes the whole call down
 * to the caller's closed-calendar path; a broker whose DWD is simply not
 * configured returns configured:false and falls back to CRM-only.
 */
export async function getBrokerBusyIntervals(args: {
  brokerSlug: string
  fromIso: string
  toIso: string
}): Promise<BusyInterval[]> {
  const sb = createServiceClient()
  const { data, error } = await sb
    .from('crm_appointments')
    .select('start_at, end_at')
    .eq('broker_slug', args.brokerSlug)
    // All-day rows are NOT busy time. In this CRM they are transaction
    // milestone pins written by the TC system — "Contract accepted · 2840 NE
    // Sedalia Loop" — spanning 00:00 to 00:00 the next day. Counting them as
    // busy let a single marker erase a whole bookable day: the live /book page
    // showed 4 open days out of 15 weekdays because Matt had one or two pins
    // on nearly every date (found 2026-08-25, first render). A milestone is a
    // note about a deal, not a meeting the broker is sitting in.
    .eq('all_day', false)
    // Overlap, not containment: an appointment that STARTS before the window
    // and runs into it still blocks slots inside it.
    .lt('start_at', args.toIso)
    .gt('end_at', args.fromIso)

  if (error) {
    // Fail CLOSED. An availability read that quietly returns [] would publish
    // the broker's whole day as free and double-book them.
    console.error('[getBrokerBusyIntervals]', error.message)
    throw new Error('availability_unavailable')
  }

  const out: BusyInterval[] = []
  for (const row of (data ?? []) as Array<{ start_at: string; end_at: string }>) {
    const startMs = Date.parse(row.start_at)
    const endMs = Date.parse(row.end_at)
    if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) continue
    out.push({ startMs, endMs })
  }

  // Google Calendar for the same broker. A throw here propagates on purpose:
  // the caller renders a closed calendar rather than an unverified open one.
  const brokerEmail = CRM_MAILBOXES.find((m) => m.slug === args.brokerSlug)?.email
  if (brokerEmail) {
    const gcal = await getGcalBusyIntervals(brokerEmail, args.fromIso, args.toIso)
    if (gcal.configured) out.push(...gcal.intervals)
  }

  return out
}

/**
 * Is this exact slot still free? The re-check the booking action runs inside
 * the write path, because availability was rendered seconds-to-minutes ago and
 * two visitors can want the same 10am.
 */
export async function isSlotStillFree(args: {
  brokerSlug: string
  startIso: string
  endIso: string
  bufferMinutes: number
}): Promise<boolean> {
  const bufferMs = args.bufferMinutes * 60_000
  const startMs = Date.parse(args.startIso) - bufferMs
  const endMs = Date.parse(args.endIso) + bufferMs
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs)) return false

  const busy = await getBrokerBusyIntervals({
    brokerSlug: args.brokerSlug,
    fromIso: new Date(startMs).toISOString(),
    toIso: new Date(endMs).toISOString(),
  })
  return busy.length === 0
}
