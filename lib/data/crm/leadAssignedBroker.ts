/**
 * Broker-ownership resolution for guest-search-alert (saved-search) scope checks.
 *
 * The admin saved-search actions key off a lead's email / FUB id (or a
 * guest_search_alerts row id), not a crm_people.id — so to honor broker scope we
 * resolve the lead's crm person and read its assigned_broker. Deliberately
 * uncached (authorization must see the live owner). Raw .from() stays in lib/data/
 * per the DAL boundary (G1).
 */
import { createServiceClient } from '@/lib/data/client'

/** The assigned_broker of the crm person a lead resolves to. found=false when no person matches. */
export async function resolveLeadAssignedBroker(input: {
  email?: string | null
  fubLegacyId?: number | null
}): Promise<{ found: boolean; assignedBroker: string | null }> {
  const sb = createServiceClient()

  if (input.fubLegacyId) {
    const { data } = await sb
      .from('crm_people')
      .select('assigned_broker')
      .eq('fub_legacy_id', input.fubLegacyId)
      .maybeSingle()
    if (data) return { found: true, assignedBroker: (data as { assigned_broker: string | null }).assigned_broker ?? null }
  }

  const email = (input.email ?? '').trim().toLowerCase()
  if (email) {
    // emails is jsonb [{value,isPrimary}]; object containment matches the value key.
    const { data } = await sb
      .from('crm_people')
      .select('assigned_broker')
      .contains('emails', [{ value: email }])
      .limit(1)
      .maybeSingle()
    if (data) return { found: true, assignedBroker: (data as { assigned_broker: string | null }).assigned_broker ?? null }
  }

  return { found: false, assignedBroker: null }
}

/** The email + FUB id a guest_search_alerts row resolves to (for update/delete scope). */
export async function getGuestAlertLead(alertId: string): Promise<{ email: string | null; fubLegacyId: number | null } | null> {
  const sb = createServiceClient()
  const { data } = await sb
    .from('guest_search_alerts')
    .select('email,fub_person_id')
    .eq('id', alertId)
    .maybeSingle()
  if (!data) return null
  const row = data as { email: string | null; fub_person_id: number | null }
  return { email: row.email ?? null, fubLegacyId: row.fub_person_id ?? null }
}
