import 'server-only'
import { createServiceClient } from '@/lib/supabase/service'

/**
 * Blackout days for the public booking calendar.
 *
 * Stored half-open [starts_on, ends_on): a single day off is one row whose
 * ends_on is the FOLLOWING day. Callers work in inclusive dates because that is
 * how a person thinks about a day off; the translation happens here so no UI
 * has to remember the convention.
 */
export type BookingBlackout = {
  id: number
  brokerSlug: string
  /** Inclusive first day off, YYYY-MM-DD. */
  startsOn: string
  /** INCLUSIVE last day off, YYYY-MM-DD — translated from the exclusive bound. */
  endsOn: string
  reason: string | null
}

function nextDay(dateKey: string): string {
  const d = new Date(`${dateKey}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + 1)
  return d.toISOString().slice(0, 10)
}

function prevDay(dateKey: string): string {
  const d = new Date(`${dateKey}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() - 1)
  return d.toISOString().slice(0, 10)
}

/** Upcoming blackouts for a broker, soonest first. Past ones are not listed. */
export async function listBookingBlackouts(brokerSlug: string): Promise<BookingBlackout[]> {
  const sb = createServiceClient()
  const today = new Date().toISOString().slice(0, 10)
  const { data, error } = await sb
    .from('broker_booking_blackouts')
    .select('id, broker_slug, starts_on, ends_on, reason')
    .eq('broker_slug', brokerSlug)
    .gte('ends_on', today)
    .order('starts_on', { ascending: true })
  if (error) {
    console.error('[listBookingBlackouts]', error.message)
    return []
  }
  return (data ?? []).map((r) => ({
    id: r.id as number,
    brokerSlug: r.broker_slug as string,
    startsOn: r.starts_on as string,
    // Stored bound is exclusive; show the last day a person is actually off.
    endsOn: prevDay(r.ends_on as string),
    reason: (r.reason as string | null) ?? null,
  }))
}

/** Add a blackout from INCLUSIVE dates. A single day passes the same date twice. */
export async function addBookingBlackout(input: {
  brokerSlug: string
  startsOn: string
  endsOn: string
  reason?: string | null
}): Promise<{ ok: boolean; error?: string }> {
  const sb = createServiceClient()
  const { error } = await sb.from('broker_booking_blackouts').insert({
    broker_slug: input.brokerSlug,
    starts_on: input.startsOn,
    // Inclusive in, exclusive out — the CHECK constraint requires ends_on > starts_on,
    // so a one-day blackout would be rejected without this.
    ends_on: nextDay(input.endsOn),
    reason: input.reason?.trim() || null,
  })
  if (error) {
    console.error('[addBookingBlackout]', error.message)
    return { ok: false, error: 'Could not save that day off' }
  }
  return { ok: true }
}

export async function deleteBookingBlackout(id: number, brokerSlug: string): Promise<{ ok: boolean }> {
  const sb = createServiceClient()
  // Scoped by broker as well as id: an id alone would let one broker delete
  // another's day off.
  const { error } = await sb
    .from('broker_booking_blackouts')
    .delete()
    .eq('id', id)
    .eq('broker_slug', brokerSlug)
  if (error) {
    console.error('[deleteBookingBlackout]', error.message)
    return { ok: false }
  }
  return { ok: true }
}
