'use server'

/**
 * One-click membership toggle actions (CONTACT360 Phase 3.3, write side).
 *
 * Matt's top ask: "one click assign or unassign from workflow, newsletter,
 * saved search/listing alerts by toggling." These three admin-guarded server
 * actions flip a contact's membership in each channel:
 *
 *   - setSequenceEnrollment   — enroll / unenroll from a workflow
 *   - setNewsletterSubscription — subscribe / unsubscribe the newsletter
 *   - setListingAlertsPaused  — pause / resume every listing alert
 *
 * Every action:
 *   1. Is admin-guarded the same way app/actions/crm.ts is (getCrmAccess).
 *   2. Writes a crm_timeline event ('system' for workflow/listing-alerts, the
 *      consent-bearing newsletter change is logged 'system' too with consent in
 *      the title) so the change is audited on the contact.
 *   3. Routes any UNSUBSCRIBE through addSuppression and any RESUBSCRIBE through
 *      removeSuppression — the lib/crm/suppressions chokepoint, never a direct
 *      suppression write.
 *
 * COMPLIANCE (the load-bearing rule): subscribing REFUSES (no-op + a reason)
 * when a compliance hard-stop suppression exists for that channel. A broker can
 * never re-enable a channel the contact hard-opted-out of (CAN-SPAM unsubscribe,
 * hard bounce, spam complaint, TCPA STOP / do-not-text, do-not-call, hard-stop).
 * The decision is the pure canSubscribe() helper, fed the live suppression
 * footprint from getSuppressionSignals(). An SMS opt-in here can clear only the
 * soft 'no-sms-consent' default — never a real opt-out.
 */

import { revalidatePath } from 'next/cache'
import { createServiceClient } from '@/lib/supabase/service'
import { getCrmAccess } from '@/app/actions/crm'
import { manualEnrollPerson } from '@/lib/crm/enroll'
import { addSuppression, removeSuppression } from '@/lib/crm/suppressions'
import { canSubscribe } from '@/lib/crm/membership-consent'
import { getSuppressionSignals } from '@/lib/data/crm/getSuppressionSignals'
import { setContactListingAlertsPaused } from '@/lib/data/crm/getContactMemberships'
import {
  getNewsletterMembershipForLead,
  getCrmPersonContact,
  subscribeToNewsletter,
  setSubscriberStatus,
} from '@/lib/data/newsletter'
import { resolvePersonIdentity } from '@/lib/data/crm/resolvePersonIdentity'

export type MembershipResult = { ok: true; message?: string } | { ok: false; error: string }

/** Live enrollment statuses — the toggle "unenrolls" these. */
const LIVE_ENROLLMENT_STATUSES = ['running', 'paused', 'paused_reply', 'awaiting_broker', 'awaiting_broker_next']

function revalidateContact(personId: number) {
  revalidatePath('/admin/crm')
  revalidatePath(`/admin/crm/${personId}`)
}

// ── Workflow (sequence) membership ───────────────────────────────────────────

/**
 * Toggle a contact's enrollment in a workflow. `enrolled: true` enrolls (through
 * the canonical manualEnrollPerson path, which fail-closes on hard-stop and
 * never double-enrolls). `enrolled: false` stops every live enrollment for that
 * sequence. A workflow is NOT a send channel of its own — its email/sms steps
 * are each suppression-gated by the engine at send time — so enrolling here does
 * not itself bypass a compliance hard-stop (manualEnrollPerson refuses one).
 */
export async function setSequenceEnrollment(input: {
  personId: number
  sequenceId: number
  enrolled: boolean
}): Promise<MembershipResult> {
  const access = await getCrmAccess()
  if (!access) return { ok: false, error: 'Unauthorized' }
  const personId = Number(input.personId)
  const sequenceId = Number(input.sequenceId)
  if (!Number.isFinite(personId) || personId <= 0 || !Number.isFinite(sequenceId) || sequenceId <= 0) {
    return { ok: false, error: 'A contact and a workflow are required' }
  }

  const sb = createServiceClient()

  if (input.enrolled) {
    // Enroll through the canonical path (hard-stop fail-close + no double-enroll
    // live there). It writes its own 'manual-enroll' timeline row.
    const result = await manualEnrollPerson(personId, sequenceId, access.email)
    if (!result.enrolled) return { ok: false, error: result.reason }
    revalidateContact(personId)
    return { ok: true, message: `Enrolled in ${result.sequence}` }
  }

  // Unenroll: stop every live enrollment in this sequence for this contact.
  const { data: live } = await sb
    .from('crm_sequence_enrollments')
    .select('id')
    .eq('person_id', personId)
    .eq('sequence_id', sequenceId)
    .in('status', LIVE_ENROLLMENT_STATUSES)
  const ids = (live ?? []).map((r) => Number(r.id))
  if (ids.length === 0) return { ok: true, message: 'Not on this workflow' }

  const { error } = await sb
    .from('crm_sequence_enrollments')
    .update({ status: 'stopped', updated_at: new Date().toISOString() })
    .in('id', ids)
  if (error) return { ok: false, error: error.message }

  const { data: seq } = await sb.from('crm_sequences').select('name').eq('id', sequenceId).maybeSingle()
  await sb.from('crm_timeline').insert({
    person_id: personId,
    kind: 'system',
    title: `Removed from workflow "${seq?.name ?? `#${sequenceId}`}" by ${access.email}`,
    source: 'app',
    broker: access.brokerSlug,
  })
  revalidateContact(personId)
  return { ok: true, message: 'Removed from workflow' }
}

// ── Newsletter membership ────────────────────────────────────────────────────

/**
 * Toggle a contact's newsletter subscription. The newsletter is an EMAIL
 * channel: subscribing here is a re-subscribe that MUST honor an email
 * compliance hard-stop. So `subscribed: true` first checks canSubscribe('email')
 * against the live suppression footprint and refuses (no-op) on any email
 * opt-out. Unsubscribing writes an email 'unsubscribe' suppression through the
 * chokepoint (stops the newsletter AND every other email send); re-subscribing
 * clears only a soft/own 'unsubscribe' suppression we set here, never a hard
 * bounce/complaint/hard-stop.
 */
export async function setNewsletterSubscription(input: {
  personId: number
  subscribed: boolean
}): Promise<MembershipResult> {
  const access = await getCrmAccess()
  if (!access) return { ok: false, error: 'Unauthorized' }
  const personId = Number(input.personId)
  if (!Number.isFinite(personId) || personId <= 0) return { ok: false, error: 'A contact is required' }

  const sb = createServiceClient()
  const identity = await resolvePersonIdentity(personId)

  if (input.subscribed) {
    // Compliance gate FIRST — refuse a re-subscribe over any email opt-out.
    const signals = await getSuppressionSignals(personId)
    const decision = canSubscribe('email', signals)
    if (!decision.allowed) return { ok: false, error: `Cannot subscribe: ${decision.reason}` }

    const contact = await getCrmPersonContact(personId)
    if (!contact?.email) return { ok: false, error: 'No email address on file' }

    const sub = await subscribeToNewsletter({
      email: contact.email,
      name: contact.name,
      source: `crm-toggle:${access.email}`,
      crmPersonId: personId,
      fubPersonId: identity.fubLegacyId,
    })
    if (!sub.ok) return { ok: false, error: sub.error ?? 'Subscribe failed' }

    // A resubscribe clears the soft email 'unsubscribe' suppression WE set here
    // (scoped by reason so it can never clear a hard bounce/complaint/hard-stop).
    await removeSuppression({ personId, channel: 'email', reason: 'unsubscribe' })

    await sb.from('crm_timeline').insert({
      person_id: personId,
      kind: 'system',
      title: `Newsletter: subscribed by ${access.email}`,
      source: 'app',
      broker: access.brokerSlug,
    })
    revalidateContact(personId)
    return { ok: true, message: 'Subscribed to the newsletter' }
  }

  // Unsubscribe: flip the subscriber row off (if present) AND write the email
  // suppression through the chokepoint, so the withdrawal stops every email send.
  const membership = await getNewsletterMembershipForLead({ crmPersonId: personId, emails: identity.emails })
  if (membership.subscribed) {
    const sub = await sb
      .from('newsletter_subscribers')
      .select('id')
      .or([`crm_person_id.eq.${personId}`, ...identity.emails.map((e) => `email.eq.${e}`)].join(','))
      .limit(1)
      .maybeSingle()
    if (sub.data?.id) await setSubscriberStatus(String(sub.data.id), 'unsubscribed')
  }
  await addSuppression({ personId, channel: 'email', reason: 'unsubscribe', source: `crm-toggle:${access.email}` })

  await sb.from('crm_timeline').insert({
    person_id: personId,
    kind: 'system',
    title: `Newsletter: unsubscribed by ${access.email} (email sends suppressed)`,
    source: 'app',
    broker: access.brokerSlug,
  })
  revalidateContact(personId)
  return { ok: true, message: 'Unsubscribed from the newsletter' }
}

// ── Listing-alerts membership ────────────────────────────────────────────────

/**
 * Pause or resume EVERY listing alert a contact receives (saved_searches +
 * guest_search_alerts), in one click. Listing alerts are a first-party site
 * feature the contact created themselves — they carry NO consent hard-stop, so
 * this is a plain state flip (no suppression write). The email/sms delivery of
 * an alert is still independently suppression-gated at send time. The write goes
 * through the DAL (setContactListingAlertsPaused) keyed off the same identity
 * the reader uses, so paused state matches what getContactListingAlerts reports.
 */
export async function setListingAlertsPaused(input: {
  personId: number
  paused: boolean
}): Promise<MembershipResult> {
  const access = await getCrmAccess()
  if (!access) return { ok: false, error: 'Unauthorized' }
  const personId = Number(input.personId)
  if (!Number.isFinite(personId) || personId <= 0) return { ok: false, error: 'A contact is required' }

  const touched = await setContactListingAlertsPaused(personId, input.paused)
  const total = touched.savedSearches + touched.guestAlerts
  if (total === 0) return { ok: true, message: 'No listing alerts on file' }

  const sb = createServiceClient()
  await sb.from('crm_timeline').insert({
    person_id: personId,
    kind: 'system',
    title: `Listing alerts ${input.paused ? 'paused' : 'resumed'} by ${access.email} (${total} ${total === 1 ? 'alert' : 'alerts'})`,
    source: 'app',
    broker: access.brokerSlug,
  })
  revalidateContact(personId)
  return { ok: true, message: input.paused ? 'Listing alerts paused' : 'Listing alerts resumed' }
}
