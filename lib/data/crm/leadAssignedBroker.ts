/**
 * Broker-ownership resolution for guest-search-alert (saved-search) scope checks.
 *
 * The admin saved-search actions key off a lead's email / FUB id (or a
 * listing_alerts row id), not a crm_people.id — so to honor broker scope we
 * resolve the lead's crm person and read its assigned_broker. Deliberately
 * uncached (authorization must see the live owner). Raw .from() stays in lib/data/
 * per the DAL boundary (G1).
 */
import { createServiceClient } from '@/lib/data/client'
import { personIdsByEmailCi } from './personByEmailCi'

/** The assigned_broker of the crm person a lead resolves to. found=false when no person matches. */
export async function resolveLeadAssignedBroker(input: {
  email?: string | null
  fubLegacyId?: number | null
}): Promise<{ found: boolean; assignedBroker: string | null }> {
  const sb = createServiceClient()

  if (input.fubLegacyId) {
    const { data, error } = await sb
      .from('crm_people')
      .select('assigned_broker')
      .eq('fub_legacy_id', input.fubLegacyId)
      .maybeSingle()
    // FAIL CLOSED: this feeds a scope check. A swallowed error → found:false → the
    // caller reads "not out of scope" → access GRANTED. Throw so the scope check denies.
    if (error) throw new Error(`resolveLeadAssignedBroker(fub): ${error.message}`)
    if (data) return { found: true, assignedBroker: (data as { assigned_broker: string | null }).assigned_broker ?? null }
  }

  const email = (input.email ?? '').trim().toLowerCase()
  if (email) {
    // CASE-INSENSITIVE: stored emails carry mixed case; a byte-exact jsonb match would
    // miss them → found:false → the scope check would GRANT access. Match over
    // lower(value) instead. personIdsByEmailCi throws on error (fail-closed upstream).
    const ids = await personIdsByEmailCi(sb, email)
    if (ids.length > 0) {
      const { data, error } = await sb
        .from('crm_people')
        .select('assigned_broker')
        .in('id', ids)
        .limit(1)
        .maybeSingle()
      if (error) throw new Error(`resolveLeadAssignedBroker(email): ${error.message}`)
      if (data) return { found: true, assignedBroker: (data as { assigned_broker: string | null }).assigned_broker ?? null }
    }
  }

  return { found: false, assignedBroker: null }
}

/**
 * The assigned_broker of a crm person BY ID.
 *
 * The sibling above resolves by email / legacy id because saved-search actions
 * key off those. Page-level scope checks key off the route's person id instead,
 * and the only by-id path was requirePersonInScope in app/actions/crm.ts — which
 * surfaces that read cannot use, because the client-portal view is pinned
 * read-only by construction (clientPortalView.test.ts forbids importing any
 * @/app/actions/ module, so a write can never sneak onto it).
 *
 * Same FAIL-CLOSED doctrine as the rest of this file: this feeds an
 * authorization decision, so a swallowed error would read as "no owner", match
 * no slug, and — depending on the caller's polarity — could grant access. Throw
 * instead, and let the page deny.
 */
export async function resolvePersonAssignedBroker(
  personId: number,
): Promise<{ found: boolean; assignedBroker: string | null }> {
  const sb = createServiceClient()
  const { data, error } = await sb
    .from('crm_people')
    .select('assigned_broker')
    .eq('id', personId)
    .maybeSingle()
  if (error) throw new Error(`resolvePersonAssignedBroker: ${error.message}`)
  if (!data) return { found: false, assignedBroker: null }
  return {
    found: true,
    assignedBroker: (data as { assigned_broker: string | null }).assigned_broker ?? null,
  }
}

/** The email + FUB id a listing_alerts row resolves to (for update/delete scope). */
export async function getGuestAlertLead(alertId: string): Promise<{ email: string | null; fubLegacyId: number | null } | null> {
  const sb = createServiceClient()
  const { data } = await sb
    .from('listing_alerts')
    .select('email,fub_person_id')
    .eq('id', alertId)
    .maybeSingle()
  if (!data) return null
  const row = data as { email: string | null; fub_person_id: number | null }
  return { email: row.email ?? null, fubLegacyId: row.fub_person_id ?? null }
}
