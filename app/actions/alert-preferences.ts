'use server'

/**
 * Consumer alert-preference actions (Phase 3 UI,
 * docs/plans/SEARCH_OPTIMIZATION_PLAN_2026-07-29.md §4) — the typed-event
 * controls a SIGNED-IN subscriber manages from /account/saved-searches:
 *
 * - setAlertEventsAction: the six event toggles (new / price_change /
 *   status_change / back_on_market / sold / open_house).
 * - setAlertScheduleDaysAction: weekly per-day-of-week schedule
 *   (0=Sunday..6=Saturday; empty selection clears the restriction).
 * - addAlertRecipientAction / removeAlertRecipientAction: household
 *   recipients ([{email, name?, unsubscribe_token}]).
 *
 * AUTHZ MODEL (mirrors app/actions/saved-searches.ts): getSession() is the
 * chokepoint — a client never passes a user id. Every DAL write carries BOTH
 * the row id AND the session user_id (…ForUser variants), so a signed-in user
 * can only ever touch their own rows; the recipient editor additionally does
 * its read-modify-write through getListingAlertForUser, which returns null
 * for a row the caller does not own. All inputs are zod-validated.
 */

import { randomUUID } from 'crypto'
import { z } from 'zod'
import { getSession } from '@/app/actions/auth'
import {
  getListingAlertForUser,
  updateListingAlertEventSettingsForUser,
  updateListingAlertRecipientsForUser,
  type ListingAlertRecipientEntry,
} from '@/lib/data/leads/listingAlerts'
import { normalizeScheduleDays } from '@/lib/saved-search-cadence'

export type AlertPreferenceResult = { error: string | null }

/** Household recipients cap per alert (primary not counted). */
const MAX_RECIPIENTS = 5

// The full six-key toggle map — the manager UI renders all six switches, so a
// write always carries the complete map (no partial-merge read needed) and the
// stored jsonb is exactly what normalizeEventToggles expects back.
const eventTogglesSchema = z
  .object({
    new: z.boolean(),
    price_change: z.boolean(),
    status_change: z.boolean(),
    back_on_market: z.boolean(),
    sold: z.boolean(),
    open_house: z.boolean(),
  })
  .strict()

// 0=Sunday..6=Saturday, at most one entry per day. Bounds enforced here so a
// crafted client payload can never store an out-of-range smallint.
const scheduleDaysSchema = z.array(z.number().int().min(0).max(6)).max(7)

const emailSchema = z.email()

function cleanId(id: unknown): string {
  return typeof id === 'string' ? id.trim() : ''
}

/** Set the six typed-event toggles on one alert the session user owns. */
export async function setAlertEventsAction(
  id: string,
  toggles: unknown,
): Promise<AlertPreferenceResult> {
  const alertId = cleanId(id)
  if (!alertId) return { error: 'Search not found' }
  const parsed = eventTogglesSchema.safeParse(toggles)
  if (!parsed.success) return { error: 'Pick which updates you want.' }
  const session = await getSession()
  if (!session) return { error: 'Not signed in' }
  const result = await updateListingAlertEventSettingsForUser(alertId, session.user.id, {
    events: parsed.data,
  })
  if (!result.ok) return { error: 'Could not update that search' }
  return { error: null }
}

/**
 * Set the weekly day-of-week schedule on one alert the session user owns.
 * An empty selection clears the restriction (plain 7-day interval applies).
 */
export async function setAlertScheduleDaysAction(
  id: string,
  days: unknown,
): Promise<AlertPreferenceResult> {
  const alertId = cleanId(id)
  if (!alertId) return { error: 'Search not found' }
  const parsed = scheduleDaysSchema.safeParse(days)
  if (!parsed.success) return { error: 'Pick valid days of the week.' }
  const session = await getSession()
  if (!session) return { error: 'Not signed in' }
  const result = await updateListingAlertEventSettingsForUser(alertId, session.user.id, {
    // Dedupe + sort through the canonical normalizer; [] → null = no restriction.
    scheduleDays: normalizeScheduleDays(parsed.data),
  })
  if (!result.ok) return { error: 'Could not update that search' }
  return { error: null }
}

/**
 * Add a household recipient to one alert the session user owns. The entry is
 * born with its own unsubscribe token so the first email it receives already
 * carries a working per-recipient opt-out.
 */
export async function addAlertRecipientAction(
  id: string,
  email: string,
  name?: string,
): Promise<AlertPreferenceResult> {
  const alertId = cleanId(id)
  if (!alertId) return { error: 'Search not found' }
  const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : ''
  if (!emailSchema.safeParse(normalizedEmail).success) {
    return { error: 'Enter a valid email address.' }
  }
  const cleanName = typeof name === 'string' ? name.trim().slice(0, 80) : ''

  const session = await getSession()
  if (!session) return { error: 'Not signed in' }

  // Owner-checked read: null for a missing row AND for someone else's row.
  const row = await getListingAlertForUser(alertId, session.user.id)
  if (!row) return { error: 'Search not found' }

  if (normalizedEmail === (row.email ?? '').trim().toLowerCase()) {
    return { error: 'That address already gets this alert.' }
  }
  const existing: ListingAlertRecipientEntry[] = Array.isArray(row.recipients)
    ? row.recipients
    : []
  if (existing.some((r) => (r?.email ?? '').trim().toLowerCase() === normalizedEmail)) {
    return { error: 'That address already gets this alert.' }
  }
  if (existing.length >= MAX_RECIPIENTS) {
    return { error: `You can share this alert with up to ${MAX_RECIPIENTS} people.` }
  }

  const next: ListingAlertRecipientEntry[] = [
    ...existing,
    { email: normalizedEmail, name: cleanName || null, unsubscribe_token: randomUUID() },
  ]
  const result = await updateListingAlertRecipientsForUser(alertId, session.user.id, next)
  if (!result.ok) return { error: 'Could not add that recipient' }
  return { error: null }
}

/** Remove a household recipient from one alert the session user owns. */
export async function removeAlertRecipientAction(
  id: string,
  email: string,
): Promise<AlertPreferenceResult> {
  const alertId = cleanId(id)
  if (!alertId) return { error: 'Search not found' }
  const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : ''
  if (!normalizedEmail) return { error: 'Recipient not found' }

  const session = await getSession()
  if (!session) return { error: 'Not signed in' }

  const row = await getListingAlertForUser(alertId, session.user.id)
  if (!row) return { error: 'Search not found' }

  const existing: ListingAlertRecipientEntry[] = Array.isArray(row.recipients)
    ? row.recipients
    : []
  const remaining = existing.filter(
    (r) => (r?.email ?? '').trim().toLowerCase() !== normalizedEmail,
  )
  if (remaining.length === existing.length) return { error: 'Recipient not found' }

  const result = await updateListingAlertRecipientsForUser(
    alertId,
    session.user.id,
    remaining.length > 0 ? remaining : null,
  )
  if (!result.ok) return { error: 'Could not remove that recipient' }
  return { error: null }
}
