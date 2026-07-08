/**
 * getContactMemberships — the current-state reader the Contact-360 one-click
 * membership toggles render from (CONTACT360 Phase 3.3, read side).
 *
 * Matt's top ask: "one click assign or unassign from workflow, newsletter,
 * saved search/listing alerts by toggling." A toggle needs to know its CURRENT
 * state to render on/off, which sequences a contact is on, and how many listing
 * alerts they receive. This reader returns all three in one call:
 *
 *   {
 *     sequences:     { id, name, enrolled, status }[]   // every ACTIVE workflow
 *     newsletter:    { subscribed, frequency }          // newsletter_subscribers
 *     listingAlerts: { count, active }                  // saved + guest alerts
 *   }
 *
 * Sources (each the canonical one — nothing forked):
 *   - sequences:     crm_sequences (the active workflows) LEFT-joined to this
 *                    person's live crm_sequence_enrollments. A workflow shows as
 *                    a toggle whether or not the contact is on it, so the broker
 *                    can flip it ON; `enrolled` + `status` reflect the live row.
 *   - newsletter:    getNewsletterMembershipForLead (the newsletter DAL) — keyed
 *                    by crm_person_id OR any of the contact's emails.
 *   - listingAlerts: getContactListingAlerts (REUSED, never forked) — reads
 *                    the unified listing_alerts table and normalizes `active`.
 *
 * Identity comes from the keystone resolver (resolvePersonIdentity) so a native
 * lead resolves the same as a FUB-imported one.
 *
 * FLAG (newsletter frequency): public.newsletter_subscribers has NO per-
 * subscriber cadence column — only `status` + `segment`. There is no honest
 * "weekly/daily" to report, so `frequency` is always null here. If a per-
 * subscriber cadence is ever added, surface it from that column.
 *
 * DAL boundary (G1): the raw .from() read of crm_sequences/_enrollments lives
 * here, inside lib/data/. Newsletter + listing alerts route through their
 * existing DAL readers.
 */
import { createServiceClient } from '@/lib/supabase/service'
import { resolvePersonIdentity } from '@/lib/data/crm/resolvePersonIdentity'
import { getContactListingAlerts } from '@/lib/data/crm/getContactListingAlerts'
import { getNewsletterMembershipForLead } from '@/lib/data/newsletter'

/** Enrollment statuses that mean the contact is CURRENTLY on the workflow. */
const LIVE_ENROLLMENT_STATUSES = new Set([
  'running',
  'paused',
  'paused_reply',
  'awaiting_broker',
  'awaiting_broker_next',
])

export type ContactSequenceMembership = {
  /** crm_sequences.id — the toggle target. */
  id: number
  name: string
  /** True when the contact has a live (non-terminal) enrollment in this workflow. */
  enrolled: boolean
  /** The live enrollment's status, else null when not enrolled. */
  status: string | null
}

export type ContactMemberships = {
  sequences: ContactSequenceMembership[]
  newsletter: { subscribed: boolean; frequency: string | null }
  listingAlerts: { count: number; active: number }
}

/**
 * The full membership snapshot for a contact: which active workflows they are on
 * (or could be flipped onto), whether they get the newsletter, and how many
 * listing alerts they receive. One call drives all the toggles.
 */
export async function getContactMemberships(crmPersonId: number): Promise<ContactMemberships> {
  const empty: ContactMemberships = {
    sequences: [],
    newsletter: { subscribed: false, frequency: null },
    listingAlerts: { count: 0, active: 0 },
  }
  if (!Number.isFinite(crmPersonId) || crmPersonId <= 0) return empty

  const [identity, sequences, listingAlerts] = await Promise.all([
    resolvePersonIdentity(crmPersonId),
    readSequenceMemberships(crmPersonId),
    getContactListingAlerts(crmPersonId),
  ])

  const newsletterRow = await getNewsletterMembershipForLead({
    crmPersonId,
    emails: identity.emails,
  })

  return {
    sequences,
    // The newsletter table has no per-subscriber cadence column (see file FLAG),
    // so frequency is always null today.
    newsletter: { subscribed: newsletterRow.subscribed, frequency: null },
    listingAlerts: {
      count: listingAlerts.length,
      active: listingAlerts.filter((a) => a.active).length,
    },
  }
}

/**
 * Read the active workflows + this person's live enrollment in each. Every active
 * workflow is returned (so a broker can flip an OFF one ON); `enrolled`/`status`
 * reflect the live enrollment when one exists. A terminal enrollment (stopped /
 * completed) reads as not-enrolled so the toggle shows OFF and re-enrolling is
 * offered.
 */
async function readSequenceMemberships(crmPersonId: number): Promise<ContactSequenceMembership[]> {
  const sb = createServiceClient()

  const [{ data: seqs }, { data: enrollments }] = await Promise.all([
    sb.from('crm_sequences').select('id,name').eq('status', 'active').order('name', { ascending: true }),
    sb
      .from('crm_sequence_enrollments')
      .select('sequence_id,status,created_at')
      .eq('person_id', crmPersonId)
      .order('created_at', { ascending: false }),
  ])

  // Newest live enrollment per sequence wins (created_at desc above).
  const liveBySequence = new Map<number, string>()
  for (const row of enrollments ?? []) {
    const seqId = Number(row.sequence_id)
    const status = String(row.status ?? '')
    if (!LIVE_ENROLLMENT_STATUSES.has(status)) continue
    if (!liveBySequence.has(seqId)) liveBySequence.set(seqId, status)
  }

  return (seqs ?? []).map((s) => {
    const id = Number(s.id)
    const status = liveBySequence.get(id) ?? null
    return {
      id,
      name: String(s.name ?? ''),
      enrolled: status !== null,
      status,
    }
  })
}

/**
 * Pause or resume EVERY listing alert a contact receives — ONE update on the
 * unified listing_alerts table, keyed by the same identity the reader uses
 * (crm_person_id OR auth user_id OR FUB id OR any of the contact's emails), so
 * the write matches exactly what getContactListingAlerts reads. Used by the
 * membership toggle's listing-alerts action. Lives in the DAL (raw .from()
 * allowed here).
 *
 * Returns the number of rows touched split by signed-in vs guest (user_id
 * presence) so the caller can log a truthful timeline entry — the historical
 * shape from the two-table era, kept so callers need no changes. Listing
 * alerts carry NO consent hard-stop (they are a first-party site feature the
 * contact created), so pausing/resuming is a plain state flip — the
 * suppression chokepoint governs email/sms sends, not the alert rows
 * themselves.
 */
export async function setContactListingAlertsPaused(
  crmPersonId: number,
  paused: boolean,
): Promise<{ savedSearches: number; guestAlerts: number }> {
  if (!Number.isFinite(crmPersonId) || crmPersonId <= 0) return { savedSearches: 0, guestAlerts: 0 }
  const sb = createServiceClient()
  const identity = await resolvePersonIdentity(crmPersonId)

  const ors: string[] = [`crm_person_id.eq.${crmPersonId}`]
  if (identity.authUserId) ors.push(`user_id.eq.${identity.authUserId}`)
  if (identity.fubLegacyId !== null) ors.push(`fub_person_id.eq.${identity.fubLegacyId}`)
  for (const e of identity.emails) ors.push(`email.eq.${e}`)

  const { data, error } = await sb
    .from('listing_alerts')
    .update({ is_active: !paused, updated_at: new Date().toISOString() })
    .or(ors.join(','))
    .select('id, user_id')
  if (error) {
    console.error('[setContactListingAlertsPaused]', error.message)
    return { savedSearches: 0, guestAlerts: 0 }
  }
  const rows = (data ?? []) as Array<{ id: string; user_id: string | null }>
  const savedSearches = rows.filter((r) => r.user_id != null).length
  return { savedSearches, guestAlerts: rows.length - savedSearches }
}
