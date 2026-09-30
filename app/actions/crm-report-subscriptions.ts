'use server'
import { revalidatePerson } from '@/lib/crm/revalidate-person'

/**
 * Market-report subscription actions (Stream 1, write side).
 *
 * The CRM lets a broker turn market reports on/off for a contact, pick which
 * geo AREAS the contact gets reports for, and set the CADENCE. This action is
 * what the send center's "Send now + subscribe" and the legacy lead form call.
 *
 * Rebuilt 2026-09-29 on lib/crm/market-report-admin.ts, the one planner every
 * door shares (Matt's decisions 2026-09-29):
 *   1. Session- and ownership-checked (getCrmAccess + requirePersonInScope):
 *      a restricted broker only touches their own contacts.
 *   2. Every change writes a crm_timeline row naming the admin and saying what
 *      changed (areas, interval, on/off), through the DAL.
 *   3. A contact who stopped her own reports (one-click, her email link, her
 *      account page) is only turned back on with a consent note recording how
 *      she asked (`consentNote`).
 *   4. A new subscription starts NOT approved: nothing sends until a broker
 *      previews the report and approves the first send on the market report
 *      card. Its last_sent_at starts at the last report she actually received,
 *      so "Send now + subscribe" never sends the same report twice.
 *
 * Turning the subscription on records a preference; delivery itself is
 * suppression-gated at send time (lib/crm/market-report-send.ts).
 *
 * DAL boundary (G1): no raw .from() here; writes go through lib/data/crm.
 */

import { revalidatePath } from 'next/cache'
import { getCrmAccess, requirePersonInScope } from '@/app/actions/crm'
import { normalizeReportFrequency, type ReportFrequency } from '@/lib/data/crm/getContactReportSubscriptions'
import { adminUpdateReportSubscription } from '@/lib/crm/market-report-admin'

export type CrmReportSubscriptionResult = { ok: true; message?: string } | { ok: false; error: string }

/**
 * Set a contact's market-report subscription: the chosen areas, cadence, and
 * on/off. Creates the row on a first setup. Areas are validated against the
 * live registry; an unknown slug is refused by name.
 */
export async function setReportSubscriptionAction(
  personId: number,
  input: { areas: string[]; frequency: ReportFrequency; isActive: boolean; consentNote?: string | null },
): Promise<CrmReportSubscriptionResult> {
  const access = await getCrmAccess()
  if (!access) return { ok: false, error: 'Unauthorized' }
  if (access.role === 'report_viewer') return { ok: false, error: 'Your role can read the CRM but not change it.' }
  const id = Number(personId)
  if (!Number.isFinite(id) || id <= 0) return { ok: false, error: 'A contact is required' }
  const scoped = await requirePersonInScope(id, access)
  if (!scoped.ok) return scoped

  const r = await adminUpdateReportSubscription({
    personId: id,
    admin: { email: access.email, brokerSlug: access.brokerSlug },
    areas: Array.isArray(input.areas) ? input.areas : [],
    frequency: normalizeReportFrequency(input.frequency),
    active: input.isActive === true,
    consentNote: input.consentNote ?? null,
    createIfMissing: true,
  })
  if (!r.ok) return r

  revalidatePerson(id)
  revalidatePath('/admin/crm')
  return { ok: true, message: r.message }
}
