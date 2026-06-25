'use server'

/**
 * Market-report subscription actions (Stream 1, write side).
 *
 * The CRM contact record card lets a broker turn market reports on/off for a
 * contact, pick which geo AREAS the contact gets reports for, and set the
 * CADENCE. These two admin-guarded server actions persist that to
 * crm_report_subscriptions (one row per contact, upserted on person_id).
 *
 * Every action:
 *   1. Is admin-guarded the same way app/actions/crm.ts is (getCrmAccess) and
 *      scope-checked (requirePersonInScope) so a restricted broker only touches
 *      their own contacts.
 *   2. Writes a crm_timeline 'system' row so the change is audited on the contact.
 *   3. Revalidates the contact record path.
 *
 * Market reports are NOT a per-contact send channel that bypasses consent — the
 * report delivery itself is suppression-gated at send time (the same chokepoint
 * governs newsletter/sms). Turning the subscription on here records a preference;
 * it does not send anything, so there is no compliance hard-stop gate at this
 * layer (mirrors the listing-alerts toggle, which is a plain state flip).
 *
 * DAL boundary (G1): mutations live in this 'use server' module and write through
 * the service client; the typed reader lives in lib/data/crm.
 */

import { revalidatePath } from 'next/cache'
import { createServiceClient } from '@/lib/supabase/service'
import { getCrmAccess, requirePersonInScope } from '@/app/actions/crm'
import {
  getContactReportSubscription,
  normalizeReportFrequency,
  buildMarketReportAreas,
  type ReportFrequency,
} from '@/lib/data/crm/getContactReportSubscriptions'

export type CrmReportSubscriptionResult = { ok: true; message?: string } | { ok: false; error: string }

function revalidateContact(personId: number) {
  // The contact record card lives at /admin/console/leads/[id]; the old
  // /admin/crm/[id] route was a redirect stub. Revalidate the real page so the
  // toggle action (which has no redirect mask) refreshes the card.
  revalidatePath(`/admin/console/leads/${personId}`)
}

/**
 * Validate + de-dupe the submitted areas against the registry of valid options.
 * An unknown slug is dropped (never persisted) so a stale UI or a typo cannot
 * write a junk area that no report can ever be produced for. Returns the cleaned,
 * ordered, de-duped list.
 */
function sanitizeAreas(areas: unknown): string[] {
  const valid = new Set(buildMarketReportAreas().map((a) => a.slug))
  const input = Array.isArray(areas) ? areas : []
  const seen = new Set<string>()
  const out: string[] = []
  for (const raw of input) {
    if (typeof raw !== 'string') continue
    const slug = raw.trim()
    if (!slug || seen.has(slug) || !valid.has(slug)) continue
    seen.add(slug)
    out.push(slug)
  }
  return out
}

/**
 * Upsert a contact's market-report subscription: the chosen areas, cadence, and
 * active flag. One row per contact (conflict on person_id). Persists exactly what
 * the broker chose, after validating the areas against the registry.
 */
export async function setReportSubscriptionAction(
  personId: number,
  input: { areas: string[]; frequency: ReportFrequency; isActive: boolean },
): Promise<CrmReportSubscriptionResult> {
  const access = await getCrmAccess()
  if (!access) return { ok: false, error: 'Unauthorized' }
  const id = Number(personId)
  if (!Number.isFinite(id) || id <= 0) return { ok: false, error: 'A contact is required' }
  const scoped = await requirePersonInScope(id, access)
  if (!scoped.ok) return scoped

  const areas = sanitizeAreas(input.areas)
  const frequency = normalizeReportFrequency(input.frequency)
  const isActive = input.isActive === true

  // An active subscription with no areas can never produce a report. Refuse so
  // the broker does not leave the contact in a silently-empty "on" state.
  if (isActive && areas.length === 0) {
    return { ok: false, error: 'Pick at least one area to turn market reports on' }
  }

  const sb = createServiceClient()
  const { error } = await sb
    .from('crm_report_subscriptions')
    .upsert(
      {
        person_id: id,
        areas,
        frequency,
        is_active: isActive,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'person_id' },
    )
  if (error) return { ok: false, error: error.message }

  await sb.from('crm_timeline').insert({
    person_id: id,
    kind: 'system',
    title: isActive
      ? `Market reports set to ${frequency} for ${areas.length} ${areas.length === 1 ? 'area' : 'areas'} by ${access.email}`
      : `Market reports turned off by ${access.email}`,
    source: 'app',
    broker: access.brokerSlug,
  })

  revalidateContact(id)
  return { ok: true, message: isActive ? 'Market reports updated' : 'Market reports turned off' }
}

/**
 * Flip a contact's market-report subscription on or off, keeping the existing
 * areas + cadence. Turning ON requires at least one area already chosen; if none
 * exist yet, the broker is asked to pick areas first (the full setter does that).
 * A brand-new contact (no row yet) cannot be toggled ON to an empty subscription.
 */
export async function toggleReportSubscriptionAction(
  personId: number,
  isActive: boolean,
): Promise<CrmReportSubscriptionResult> {
  const access = await getCrmAccess()
  if (!access) return { ok: false, error: 'Unauthorized' }
  const id = Number(personId)
  if (!Number.isFinite(id) || id <= 0) return { ok: false, error: 'A contact is required' }
  const scoped = await requirePersonInScope(id, access)
  if (!scoped.ok) return scoped

  const existing = await getContactReportSubscription(id)
  const next = isActive === true

  if (next && (!existing || existing.areas.length === 0)) {
    return { ok: false, error: 'Pick at least one area to turn market reports on' }
  }

  const sb = createServiceClient()
  const { error } = await sb
    .from('crm_report_subscriptions')
    .upsert(
      {
        person_id: id,
        areas: existing?.areas ?? [],
        frequency: existing?.frequency ?? 'monthly',
        is_active: next,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'person_id' },
    )
  if (error) return { ok: false, error: error.message }

  await sb.from('crm_timeline').insert({
    person_id: id,
    kind: 'system',
    title: `Market reports ${next ? 'turned on' : 'turned off'} by ${access.email}`,
    source: 'app',
    broker: access.brokerSlug,
  })

  revalidateContact(id)
  return { ok: true, message: next ? 'Market reports turned on' : 'Market reports turned off' }
}
