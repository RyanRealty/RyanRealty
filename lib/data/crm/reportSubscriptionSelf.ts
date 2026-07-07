/**
 * reportSubscriptionSelf — the self-serve market-report subscription DAL
 * (saved-search master goal, W3). A SIGNED-IN site user manages their own
 * crm_report_subscriptions row from /account/notifications. The admin-side
 * counterpart readers live in getContactReportSubscriptions; the bulk writer in
 * lib/crm/bulk-handlers/set-report-subscription. This file mirrors both:
 *
 *   - areas sanitize against the live registry (buildMarketReportAreas) so an
 *     unknown slug can never land in the row
 *   - frequency normalizes to weekly / monthly / quarterly
 *   - an ACTIVE subscription with zero valid areas is refused (never leave a
 *     person in a silently-empty "on" state)
 *   - every write stamps a crm_timeline 'system' row so the contact record
 *     shows the self-serve change
 *
 * The email → crm_people resolution also lives here (jsonb containment on
 * emails, deleted=false) so the server action never touches the table raw.
 *
 * DAL boundary (G1): every raw .from() read/write lives here, inside lib/data/.
 */
import 'server-only'
import { createServiceClient } from '@/lib/supabase/service'
import {
  buildMarketReportAreas,
  mapReportSubscriptionRow,
  normalizeReportFrequency,
  type ContactReportSubscription,
} from '@/lib/data/crm/getContactReportSubscriptions'

export type SelfReportSubscriptionInput = {
  areas: string[]
  frequency: string
  isActive: boolean
}

/**
 * Validate + de-dupe submitted areas against the set of valid registry slugs.
 * Pure — exported for the unit test. Mirrors sanitizeReportAreas in the bulk
 * handler (lib/crm/bulk-handlers/set-report-subscription.ts) so the self-serve
 * path can never store a slug the admin path would refuse.
 */
export function sanitizeSelfReportAreas(areas: unknown, validSlugs: ReadonlySet<string>): string[] {
  const input = Array.isArray(areas) ? areas : []
  const seen = new Set<string>()
  const out: string[] = []
  for (const raw of input) {
    if (typeof raw !== 'string') continue
    const slug = raw.trim()
    if (!slug || seen.has(slug) || !validSlugs.has(slug)) continue
    seen.add(slug)
    out.push(slug)
  }
  return out
}

/**
 * Resolve a site account email to its crm_people id. Matches on the emails
 * jsonb (containment on {value}) over non-deleted people, trying the lowercased
 * form first (the mirror's normalized shape) and the raw trimmed form second so
 * a person stored with an uppercase address still resolves.
 */
export async function findPersonIdByEmail(email: string): Promise<number | null> {
  const trimmed = (email ?? '').trim()
  if (!trimmed) return null
  const sb = createServiceClient()
  const candidates = [...new Set([trimmed.toLowerCase(), trimmed])]
  for (const value of candidates) {
    const { data, error } = await sb
      .from('crm_people')
      .select('id')
      .contains('emails', JSON.stringify([{ value }]))
      .eq('deleted', false)
      .limit(1)
      .maybeSingle()
    if (error) {
      console.error('[findPersonIdByEmail]', error.message)
      return null
    }
    const id = data?.id
    if (typeof id === 'number' && id > 0) return id
  }
  return null
}

/**
 * The person's market-report subscription state, or null when they have never
 * been set up (the UI renders the not-subscribed default from null).
 */
export async function getSelfReportSubscription(
  personId: number,
): Promise<ContactReportSubscription | null> {
  if (!Number.isFinite(personId) || personId <= 0) return null
  const sb = createServiceClient()
  const { data, error } = await sb
    .from('crm_report_subscriptions')
    .select('is_active,areas,frequency')
    .eq('person_id', personId)
    .maybeSingle()
  if (error) {
    console.error('[getSelfReportSubscription]', error.message)
    return null
  }
  return mapReportSubscriptionRow(data)
}

/**
 * Upsert the person's market-report subscription (one row per person, conflict
 * on person_id). Sanitizes areas, normalizes frequency, refuses an active
 * subscription with no valid areas, and stamps a crm_timeline 'system' row so
 * the contact record shows the self-serve change.
 */
export async function upsertSelfReportSubscription(
  personId: number,
  input: SelfReportSubscriptionInput,
): Promise<{ data: ContactReportSubscription | null, error: string | null }> {
  if (!Number.isFinite(personId) || personId <= 0) {
    return { data: null, error: 'We could not find your contact record.' }
  }

  const validSlugs = new Set(buildMarketReportAreas().map((a) => a.slug))
  const areas = sanitizeSelfReportAreas(input.areas, validSlugs)
  const frequency = normalizeReportFrequency(input.frequency)
  const isActive = input.isActive === true

  if (isActive && areas.length === 0) {
    return { data: null, error: 'Pick at least one area to get market reports.' }
  }

  const sb = createServiceClient()
  const nowIso = new Date().toISOString()

  const { error: upErr } = await sb
    .from('crm_report_subscriptions')
    .upsert(
      {
        person_id: personId,
        areas,
        frequency,
        is_active: isActive,
        updated_at: nowIso,
      },
      { onConflict: 'person_id' },
    )
  if (upErr) {
    console.error('[upsertSelfReportSubscription]', upErr.message)
    return { data: null, error: 'We could not save your market report preferences. Try again.' }
  }

  const { error: tlErr } = await sb.from('crm_timeline').insert({
    person_id: personId,
    kind: 'system',
    title: isActive
      ? `Market reports set to ${frequency} for ${areas.length} ${areas.length === 1 ? 'area' : 'areas'} (self-serve)`
      : 'Market reports turned off (self-serve)',
    source: 'app',
  })
  if (tlErr) console.error('[upsertSelfReportSubscription] timeline', tlErr.message)

  return { data: { isActive, areas, frequency }, error: null }
}
