/**
 * Bulk handler: crm:add-newsletter — subscribe a chunk of contacts to the
 * newsletter.
 *
 * This replaces an inline loop that had three defects, each of which mattered:
 *
 *  1. It ran on the operator's CHECKED ids only, ignoring the selection. Pick
 *     "all 616 matching" and it subscribed the ≤50 rows on the page — a
 *     different, smaller set than the bar said, with no indication.
 *  2. It re-subscribed people who had unsubscribed. subscribeToNewsletter used
 *     to flip any 'unsubscribed' row back to 'active', and this was the one
 *     caller with no consent gate in front of it. Re-adding an opt-out is the
 *     thing CAN-SPAM does not forgive.
 *  3. It looped getCrmPersonContact + subscribe sequentially inside a server
 *     action, capped at 2000. On a real cohort that request times out.
 *
 * Now it is an ordinary bulk job: selection-aware, chunked, resumable, and
 * gated by the SAME canSubscribe decision the single-contact toggle uses, so
 * there is one consent rule rather than two.
 *
 * CONSENT IS CHECKED, NOT ASSUMED. An operator selecting rows is not evidence
 * that those people asked for the newsletter, so the subscribe runs with
 * reactivate:'never' — an opted-out contact is skipped and counted, never
 * resurrected. Contacts with a live opt-out never reach the subscribe at all.
 */

import 'server-only'
import { createServiceClient } from '@/lib/supabase/service'
import type { BulkHandler, BulkResult } from '@/lib/crm/bulk-jobs'
import { canSubscribe } from '@/lib/crm/membership-consent'
import type { SuppressionSignal } from '@/lib/data/crm/getSuppressionSignals'
import { TAG_CHANNEL } from '@/lib/crm/tag-channel'
import { subscribeToNewsletter } from '@/lib/data/newsletter'
import type { NewsletterSegment } from '@/lib/data/newsletter'

const SEGMENTS = new Set(['general', 'buyer', 'seller', 'past-client'])

type PersonRow = {
  id: number
  name: string | null
  emails: Array<{ value?: string }> | null
  tags: string[] | null
  deleted: boolean
  fub_legacy_id: number | null
}

/** First non-empty address, lower-cased. '' when the contact has none. */
export function primaryEmailOf(row: { emails: Array<{ value?: string }> | null }): string {
  for (const e of row.emails ?? []) {
    const v = (e?.value ?? '').trim().toLowerCase()
    if (v) return v
  }
  return ''
}

/**
 * Compose the consent signals for one person from an already-batched read —
 * same composition getSuppressionSignals does per person, minus the N+1 (a
 * 250-row chunk would otherwise be 500 round trips). PURE, so it is tested.
 */
export function signalsFor(
  tags: string[] | null,
  suppressions: Array<{ channel: string; reason: string | null }>,
): SuppressionSignal[] {
  const signals: SuppressionSignal[] = suppressions.map((r) => ({
    channel: r.channel as SuppressionSignal['channel'],
    reason: String(r.reason ?? ''),
  }))
  const lower = new Set((tags ?? []).map((t) => t.toLowerCase()))
  for (const m of TAG_CHANNEL) {
    if (!lower.has(m.tag.toLowerCase())) continue
    for (const ch of m.channels) signals.push({ channel: ch, reason: `tag:${m.tag}` })
  }
  return signals
}

export const addNewsletterHandler: BulkHandler = async (ids, params): Promise<Partial<BulkResult>> => {
  const result: BulkResult = { processed: 0, skipped: 0, breakdown: {} }
  const bump = (k: string, n = 1) => { result.breakdown[k] = (result.breakdown[k] ?? 0) + n }
  if (ids.length === 0) return result

  const raw = String((params as { segment?: string }).segment ?? 'general')
  const segment = (SEGMENTS.has(raw) ? raw : 'general') as NewsletterSegment

  const sb = createServiceClient()
  const [people, supps] = await Promise.all([
    sb.from('crm_people').select('id,name,emails,tags,deleted,fub_legacy_id').in('id', ids),
    sb.from('crm_suppressions').select('person_id,channel,reason').in('person_id', ids),
  ])
  // Fail CLOSED on an unreadable compliance table: skip the chunk rather than
  // subscribe people whose opt-out state could not be read.
  if (people.error || supps.error) {
    result.skipped = ids.length
    bump(people.error ? 'read_failed' : 'suppression_read_failed', ids.length)
    return result
  }

  const byId = new Map<number, PersonRow>()
  for (const p of (people.data ?? []) as PersonRow[]) byId.set(p.id, p)
  const suppById = new Map<number, Array<{ channel: string; reason: string | null }>>()
  for (const s of (supps.data ?? []) as Array<{ person_id: number; channel: string; reason: string | null }>) {
    const arr = suppById.get(s.person_id)
    if (arr) arr.push(s)
    else suppById.set(s.person_id, [s])
  }

  for (const id of ids) {
    const person = byId.get(id)
    if (!person || person.deleted) { result.skipped++; bump('not_found'); continue }

    const email = primaryEmailOf(person)
    if (!email) { result.skipped++; bump('no_email'); continue }

    const decision = canSubscribe('email', signalsFor(person.tags, suppById.get(id) ?? []))
    if (!decision.allowed) { result.skipped++; bump('opted_out'); continue }

    const res = await subscribeToNewsletter({
      email,
      name: person.name,
      source: 'crm-bulk-assign',
      segment,
      crmPersonId: id,
      fubPersonId: person.fub_legacy_id,
      // Deliberately absent evidence of a fresh opt-in — see the file header.
    })
    if (res.ok && res.skippedOptedOut) { result.skipped++; bump('opted_out'); continue }
    if (!res.ok) { result.skipped++; bump('persist_failed'); continue }
    result.processed++
    bump('subscribed')
  }

  return result
}
