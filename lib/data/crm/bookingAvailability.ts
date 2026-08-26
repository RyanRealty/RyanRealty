import 'server-only'
import { createServiceClient } from '@/lib/supabase/service'
import type { BusyInterval } from '@/lib/booking/slots'

/**
 * Everything already on a broker's calendar between two instants, as opaque
 * busy intervals. Titles and people are deliberately NOT returned: this feeds a
 * PUBLIC availability view, and a visitor must never be able to infer who a
 * broker is meeting or where. Only "that time is taken".
 */
export async function getBrokerBusyIntervals(args: {
  brokerSlug: string
  fromIso: string
  toIso: string
}): Promise<BusyInterval[]> {
  const sb = createServiceClient()
  const { data, error } = await sb
    .from('crm_appointments')
    .select('start_at, end_at, all_day')
    .eq('broker_slug', args.brokerSlug)
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
  for (const row of (data ?? []) as Array<{ start_at: string; end_at: string; all_day: boolean | null }>) {
    const startMs = Date.parse(row.start_at)
    const endMs = Date.parse(row.end_at)
    if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) continue
    out.push({ startMs, endMs })
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
