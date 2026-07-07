/**
 * resolvePersonForTracking — the email-tracking identity resolver for outbound
 * subscription sends (listing alerts today, reusable by any send path).
 *
 * attributeOutbound needs a crm_people.id (open/click rows) and the person's
 * assigned_broker slug (?agent= attribution). Alert rows carry a nullable
 * crm_person_id bridge column; this resolves in order:
 *
 *   1. crm_person_id when the row already carries one (strongest link) —
 *      confirmed against crm_people (deleted=false) so a stale id never
 *      attributes tracking to a removed person.
 *   2. Case-insensitive email match via crm_person_ids_by_email_ci (the same
 *      RPC the suppression path uses — a byte-exact jsonb match misses the
 *      ~25% of stored addresses with uppercase). The caller should write the
 *      resolved id back onto the alert row so the next send is pre-linked.
 *
 * Unresolved is a VALID outcome (personId null): the alert still sends with
 * broker attribution only — attributeOutbound skips the tracking wrapper when
 * personId is null by design. Resolution failure must never block a send, so
 * DB errors here log + resolve to null instead of throwing (unlike the
 * suppression path, which fails closed).
 *
 * Raw .from()/.rpc() lives in lib/data per the DAL boundary (G1).
 */
import 'server-only'
import { createServiceClient } from '@/lib/data/client'
import { personIdsByEmailCi } from './personByEmailCi'

export type TrackingPersonResolution = {
  /** crm_people.id, or null when nobody resolved (send stays untracked). */
  personId: number | null
  /** crm_people.assigned_broker short slug (matt/rebecca/paul) or null. */
  assignedBroker: string | null
  /** FUB legacy id for the ?_fuid= click-attribution stamp, when known. */
  fubPersonId: number | null
  /** How the person was found — 'email' means the caller should backfill the row link. */
  resolvedBy: 'crm_person_id' | 'email' | null
}

const UNRESOLVED: TrackingPersonResolution = {
  personId: null,
  assignedBroker: null,
  fubPersonId: null,
  resolvedBy: null,
}

type PersonRow = {
  id: number | string
  assigned_broker: string | null
  fub_legacy_id: number | string | null
}

function toResolution(row: PersonRow, resolvedBy: 'crm_person_id' | 'email'): TrackingPersonResolution {
  const id = Number(row.id)
  const fub = row.fub_legacy_id == null ? null : Number(row.fub_legacy_id)
  return {
    personId: Number.isFinite(id) && id > 0 ? id : null,
    assignedBroker: (row.assigned_broker ?? '').trim() || null,
    fubPersonId: fub != null && Number.isFinite(fub) && fub > 0 ? fub : null,
    resolvedBy,
  }
}

/**
 * The crm_person_id linkage for a batch of guest_search_alerts rows. The cron
 * DAL projection (lib/data/leads/guestSearchAlerts.ts) predates the bridge
 * column; this reads just the linkage so the alert cron can resolve tracking
 * without touching that projection. Missing ids map to null.
 */
export async function getGuestAlertPersonLinks(rowIds: string[]): Promise<Map<string, number | null>> {
  const links = new Map<string, number | null>()
  if (rowIds.length === 0) return links
  const sb = createServiceClient()
  const { data, error } = await sb
    .from('guest_search_alerts')
    .select('id, crm_person_id')
    .in('id', rowIds)
  if (error) {
    console.error('[getGuestAlertPersonLinks]', error.message)
    return links
  }
  for (const row of (data ?? []) as Array<{ id: string; crm_person_id: number | null }>) {
    links.set(row.id, row.crm_person_id ?? null)
  }
  return links
}

/**
 * Backfill crm_person_id onto an alert row after an email-match resolution so
 * the next send is pre-linked (no repeat lookup). Best-effort — a failed
 * write-back must never undo a real send.
 */
export async function linkAlertRowToPerson(
  table: 'saved_searches' | 'guest_search_alerts',
  rowId: string,
  personId: number,
): Promise<void> {
  const sb = createServiceClient()
  const { error } = await sb
    .from(table)
    .update({ crm_person_id: personId })
    .eq('id', rowId)
  if (error) console.error('[linkAlertRowToPerson]', table, rowId, error.message)
}

export async function resolvePersonForTracking(input: {
  crmPersonId?: number | null
  email?: string | null
}): Promise<TrackingPersonResolution> {
  const sb = createServiceClient()
  const select = 'id, assigned_broker, fub_legacy_id'

  // 1) Pre-linked row — confirm the person still exists and is not deleted.
  const crmPersonId = input.crmPersonId ?? null
  if (crmPersonId != null && Number.isFinite(crmPersonId) && crmPersonId > 0) {
    const { data, error } = await sb
      .from('crm_people')
      .select(select)
      .eq('id', crmPersonId)
      .eq('deleted', false)
      .maybeSingle()
    if (error) {
      console.error('[resolvePersonForTracking] by id', error.message)
    } else if (data) {
      return toResolution(data as PersonRow, 'crm_person_id')
    }
    // Stale/deleted link — fall through to the email path.
  }

  // 2) Case-insensitive email match.
  const email = (input.email ?? '').trim().toLowerCase()
  if (!email) return UNRESOLVED
  try {
    const ids = await personIdsByEmailCi(sb, email)
    if (ids.length === 0) return UNRESOLVED
    const { data, error } = await sb
      .from('crm_people')
      .select(select)
      .in('id', ids)
      .eq('deleted', false)
      .order('id', { ascending: true })
      .limit(1)
      .maybeSingle()
    if (error) {
      console.error('[resolvePersonForTracking] by email', error.message)
      return UNRESOLVED
    }
    if (data) return toResolution(data as PersonRow, 'email')
  } catch (e) {
    console.error('[resolvePersonForTracking]', e instanceof Error ? e.message : String(e))
  }
  return UNRESOLVED
}
