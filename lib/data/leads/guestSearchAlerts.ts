import 'server-only'
import { createServiceClient } from '@/lib/supabase/service'

/**
 * DAL for public.guest_search_alerts — anonymous listing-alert signups from
 * /search. Lives in lib/data so the table is only ever touched behind the DAL
 * boundary (gate G1). Service-role only (RLS is on with no policies); never
 * call these from the browser/anon client.
 */

const TABLE = 'guest_search_alerts'

export type GuestSearchAlertInput = {
  /** Already lowercased + trimmed by the caller (the unique index is on the raw column). */
  email: string
  filters: Record<string, unknown>
  filtersHash: string
  name: string
  fubPersonId?: number | null
}

export type GuestSearchAlertRow = {
  id: string
  email: string
  filters: Record<string, unknown> | null
  name: string | null
  notification_frequency: string | null
  is_active: boolean | null
  last_notified_at: string | null
  unsubscribe_token: string
  fub_person_id: number | null
}

/**
 * Upsert by (email, filters_hash). Re-submitting the same search by the same
 * email re-activates + refreshes the row rather than creating a duplicate.
 */
export async function upsertGuestSearchAlert(input: GuestSearchAlertInput): Promise<{ ok: boolean; error?: string }> {
  const supabase = createServiceClient()
  const { error } = await supabase.from(TABLE).upsert(
    {
      email: input.email,
      filters: input.filters,
      filters_hash: input.filtersHash,
      name: input.name,
      fub_person_id: input.fubPersonId ?? null,
      is_active: true,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'email,filters_hash' },
  )
  if (error) {
    // Log the raw DB error server-side; return a generic code so a careless
    // caller edit can never leak schema/constraint details to the client.
    console.error('[upsertGuestSearchAlert]', error.message)
    return { ok: false, error: 'persist_failed' }
  }
  return { ok: true }
}

/** Active guest alerts for the cron to email. Newest first, capped. */
export async function getActiveGuestSearchAlerts(limit: number): Promise<GuestSearchAlertRow[]> {
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from(TABLE)
    .select('id, email, filters, name, notification_frequency, is_active, last_notified_at, unsubscribe_token, fub_person_id')
    .eq('is_active', true)
    .order('created_at', { ascending: false })
    .limit(Math.min(500, Math.max(1, limit)))
  if (error) return []
  return (data ?? []) as GuestSearchAlertRow[]
}

/** Stamp last_notified_at after the cron sends an alert email. */
export async function markGuestAlertNotified(id: string, isoTime: string): Promise<{ ok: boolean; error?: string }> {
  const supabase = createServiceClient()
  const { error } = await supabase.from(TABLE).update({ last_notified_at: isoTime, updated_at: isoTime }).eq('id', id)
  if (error) return { ok: false, error: error.message }
  return { ok: true }
}

/** Unsubscribe — deactivate by token. matched=false means the token was unknown. */
export async function deactivateGuestAlertByToken(token: string): Promise<{ ok: boolean; matched: boolean; error?: string }> {
  const trimmed = (token ?? '').trim()
  if (!trimmed) return { ok: true, matched: false }
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from(TABLE)
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq('unsubscribe_token', trimmed)
    .select('id')
  if (error) return { ok: false, matched: false, error: error.message }
  return { ok: true, matched: (data?.length ?? 0) > 0 }
}
