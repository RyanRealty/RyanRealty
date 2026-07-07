import 'server-only'
import { createServiceClient } from '@/lib/supabase/service'

/**
 * DAL for public.guest_search_alerts — anonymous listing-alert signups from
 * /search. Lives in lib/data so the table is only ever touched behind the DAL
 * boundary (gate G1). Service-role only (RLS is on with no policies); never
 * call these from the browser/anon client.
 */

const TABLE = 'guest_search_alerts'

/**
 * Resolve the crm_people.id for an alert row (fub legacy id link first, then
 * email match). Every alert row should be born tracking-ready — the send path
 * needs a crm_person_id for open/click attribution.
 */
async function resolveCrmPersonId(
  supabase: ReturnType<typeof createServiceClient>,
  args: { email?: string | null; fubPersonId?: number | null },
): Promise<number | null> {
  if (args.fubPersonId) {
    const { data } = await supabase
      .from('crm_people')
      .select('id')
      .eq('fub_legacy_id', args.fubPersonId)
      .eq('deleted', false)
      .limit(1)
      .maybeSingle()
    if (data?.id) return data.id as number
  }
  const email = (args.email ?? '').trim().toLowerCase()
  if (email) {
    const { data } = await supabase
      .from('crm_people')
      .select('id')
      .contains('emails', JSON.stringify([{ value: email }]))
      .eq('deleted', false)
      .limit(1)
      .maybeSingle()
    if (data?.id) return data.id as number
  }
  return null
}

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
  created_at?: string | null
  origin?: 'user' | 'broker' | 'system'
  assigned_by?: string | null
}

/**
 * Create a saved search FOR a lead on the broker's behalf (origin='broker'), or
 * a system-generated one. Same engine + table as a user's own saved search, so
 * it shows up in the lead's list and the alert cron emails it like any other.
 */
export async function createSavedSearchForLead(input: {
  email: string
  fubPersonId?: number | null
  /** crm_people.id — required for the alert email's open/click tracking. Resolved from fub id or email when omitted. */
  crmPersonId?: number | null
  name: string
  filters: Record<string, unknown>
  filtersHash: string
  origin: 'broker' | 'system'
  assignedBy?: string | null
  frequency?: 'daily' | 'weekly'
}): Promise<{ ok: boolean; error?: string }> {
  const supabase = createServiceClient()
  const email = input.email.trim().toLowerCase()

  // Resolve the CRM person when the caller didn't supply one, so the row is
  // born tracking-ready (fub id link first, then email match).
  const crmPersonId = input.crmPersonId
    ?? await resolveCrmPersonId(supabase, { email, fubPersonId: input.fubPersonId })

  const { error } = await supabase.from(TABLE).upsert(
    {
      email,
      filters: input.filters,
      filters_hash: input.filtersHash,
      name: input.name,
      fub_person_id: input.fubPersonId ?? null,
      crm_person_id: crmPersonId,
      origin: input.origin,
      assigned_by: input.assignedBy ?? null,
      source: input.origin === 'broker' ? 'broker-assigned' : 'system',
      notification_frequency: input.frequency ?? 'weekly',
      is_active: true,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'email,filters_hash' },
  )
  if (error) { console.error('[createSavedSearchForLead]', error.message); return { ok: false, error: 'persist_failed' } }
  return { ok: true }
}

/**
 * Saved searches for ONE lead — matched by FUB person id OR any of the lead's
 * emails (signups that predate identity-linking carry no fub_person_id, only
 * the email). Used by the broker Lead Command Center to show what a lead is
 * actively shopping for. Active rows first, newest first.
 */
export async function getGuestSearchAlertsForLead(args: {
  fubPersonId?: number | null
  emails?: string[]
}): Promise<GuestSearchAlertRow[]> {
  const supabase = createServiceClient()
  const emails = (args.emails ?? [])
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)
  const ors: string[] = []
  if (args.fubPersonId) ors.push(`fub_person_id.eq.${args.fubPersonId}`)
  for (const e of emails) ors.push(`email.eq.${e}`)
  if (ors.length === 0) return []

  const { data, error } = await supabase
    .from(TABLE)
    .select(
      'id, email, filters, name, notification_frequency, is_active, last_notified_at, unsubscribe_token, fub_person_id, created_at, origin, assigned_by',
    )
    .or(ors.join(','))
    .order('is_active', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(25)
  if (error) {
    console.error('[getGuestSearchAlertsForLead]', error.message)
    return []
  }
  return (data ?? []) as GuestSearchAlertRow[]
}

/**
 * Upsert by (email, filters_hash). Re-submitting the same search by the same
 * email re-activates + refreshes the row rather than creating a duplicate.
 */
export async function upsertGuestSearchAlert(input: GuestSearchAlertInput): Promise<{ ok: boolean; error?: string }> {
  const supabase = createServiceClient()
  const crmPersonId = await resolveCrmPersonId(supabase, {
    email: input.email,
    fubPersonId: input.fubPersonId,
  })
  const { error } = await supabase.from(TABLE).upsert(
    {
      email: input.email,
      filters: input.filters,
      filters_hash: input.filtersHash,
      name: input.name,
      fub_person_id: input.fubPersonId ?? null,
      crm_person_id: crmPersonId,
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
  // Most-overdue first (never-notified rows lead) so a large active set —
  // e.g. the neighborhood-default rollout — drains fairly across cron runs
  // instead of newest-created rows starving the rest.
  const { data, error } = await supabase
    .from(TABLE)
    .select('id, email, filters, name, notification_frequency, is_active, last_notified_at, unsubscribe_token, fub_person_id')
    .eq('is_active', true)
    .order('last_notified_at', { ascending: true, nullsFirst: true })
    .order('created_at', { ascending: true })
    .limit(Math.min(1000, Math.max(1, limit)))
  if (error) return []
  return (data ?? []) as GuestSearchAlertRow[]
}

/** Edit a saved search — rename and/or change its parameters. */
export async function updateSavedSearch(id: string, fields: { name?: string; filters?: Record<string, unknown>; filtersHash?: string; frequency?: 'daily' | 'weekly' }): Promise<{ ok: boolean; error?: string }> {
  const supabase = createServiceClient()
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (fields.name !== undefined) patch.name = fields.name
  if (fields.filters !== undefined) patch.filters = fields.filters
  if (fields.filtersHash !== undefined) patch.filters_hash = fields.filtersHash
  if (fields.frequency !== undefined) patch.notification_frequency = fields.frequency
  const { error } = await supabase.from(TABLE).update(patch).eq('id', id)
  if (error) { console.error('[updateSavedSearch]', error.message); return { ok: false, error: 'persist_failed' } }
  return { ok: true }
}

/** Remove a saved search by id. */
export async function deleteSavedSearchById(id: string): Promise<{ ok: boolean }> {
  const supabase = createServiceClient()
  const { error } = await supabase.from(TABLE).delete().eq('id', id)
  return { ok: !error }
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
