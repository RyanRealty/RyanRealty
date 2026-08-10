/**
 * High-confidence auto-merge (Matt P12 lock 2026-08-09).
 *
 * When email resolves to person A and phone to person B (A ≠ B), merge into the
 * older row (lower id) IFF the pair is high-confidence. Fail-closed otherwise.
 *
 * High confidence requires ALL of:
 *   - both people exist, not deleted, not stage Trash
 *   - neither carries compliance:hard-stop (or equivalent protected tags)
 *   - email uniquely maps to A (no other living person has it)
 *   - phone uniquely maps to B (no other living person has it)
 *   - neither already marked custom.merged_into
 *
 * Uses mergePeopleCore — the one merge path.
 */

import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import { mergePeopleCore } from '@/lib/crm/merge-people'
import { personIdsByEmailCi } from '@/lib/data/crm/personByEmailCi'

const PROTECTED = new Set([
  'compliance:hard-stop',
  'contact:do-not-text',
  'contact:do-not-call',
])

function digitsPhone(v: string): string {
  return v.replace(/[^0-9]/g, '').replace(/^1(?=\d{10}$)/, '')
}

export type HighConfidenceMergeResult =
  | { merged: false; reason: string }
  | { merged: true; survivorId: number; mergedId: number }

export async function maybeAutoMergeEmailPhoneConflict(
  sb: SupabaseClient,
  input: { email?: string | null; phone?: string | null },
): Promise<HighConfidenceMergeResult> {
  const email = (input.email ?? '').trim().toLowerCase()
  const phone = digitsPhone(input.phone ?? '')
  if (!email || phone.length < 10) {
    return { merged: false, reason: 'need_both_email_and_phone' }
  }

  let emailIds: number[]
  try {
    emailIds = await personIdsByEmailCi(sb, email)
  } catch (e) {
    return { merged: false, reason: 'email_lookup_failed:' + (e as Error).message }
  }

  // Phone match via contact_points value (exact digits variants).
  const phoneVariants = [phone, phone.length === 10 ? `1${phone}` : phone.slice(-10)]
  const phoneIds = new Set<number>()
  for (const variant of phoneVariants) {
    if (!variant) continue
    const { data: pts, error: phoneErr } = await sb
      .from('crm_contact_points')
      .select('person_id')
      .eq('kind', 'phone')
      .eq('value', variant)
    if (phoneErr) return { merged: false, reason: 'phone_lookup_failed:' + phoneErr.message }
    for (const row of pts ?? []) {
      const id = Number((row as { person_id: number }).person_id)
      if (Number.isFinite(id) && id > 0) phoneIds.add(id)
    }
  }
  // Fallback: contains last-10 digits in phones jsonb (PostgREST filter limited —
  // only if contact_points missed).
  if (phoneIds.size === 0) {
    const last10 = phone.slice(-10)
    const { data: phonePeople } = await sb
      .from('crm_people')
      .select('id,phones')
      .eq('deleted', false)
      .filter('phones', 'cs', JSON.stringify([{ value: last10 }]))
      .limit(20)
    for (const p of phonePeople ?? []) {
      const phones = (p.phones as Array<{ value?: string }> | null) ?? []
      for (const cp of phones) {
        const d = digitsPhone(String(cp?.value ?? ''))
        if (d && d.slice(-10) === last10) phoneIds.add(Number(p.id))
      }
    }
  }

  // High-confidence conflict: exactly one email person and exactly one phone person, different.
  if (emailIds.length !== 1 || phoneIds.size !== 1) {
    return { merged: false, reason: 'not_unique_identity_map' }
  }
  const a = emailIds[0]!
  const b = [...phoneIds][0]!
  if (a === b) return { merged: false, reason: 'same_person' }

  const { data: people, error } = await sb
    .from('crm_people')
    .select('id,deleted,stage,tags,custom,assigned_broker')
    .in('id', [a, b])
  if (error || !people || people.length !== 2) {
    return { merged: false, reason: 'people_read_failed' }
  }

  for (const p of people) {
    if (p.deleted) return { merged: false, reason: 'deleted' }
    if (String(p.stage ?? '') === 'Trash') return { merged: false, reason: 'trash' }
    const custom = (p.custom as Record<string, unknown> | null) ?? {}
    if (custom.merged_into != null) return { merged: false, reason: 'already_merged' }
    const tags = ((p.tags as string[] | null) ?? []).map((t) => t.toLowerCase())
    for (const t of tags) {
      if (PROTECTED.has(t)) return { merged: false, reason: 'protected_tag:' + t }
    }
  }

  const survivorId = Math.min(a, b)
  const mergedId = Math.max(a, b)

  try {
    await mergePeopleCore(sb, survivorId, mergedId, {
      email: 'system:high-confidence-merge',
      brokerSlug: (people.find((p) => p.id === survivorId)?.assigned_broker as string | null) ?? 'matt',
    })
  } catch (e) {
    return { merged: false, reason: 'merge_failed:' + (e as Error).message }
  }

  return { merged: true, survivorId, mergedId }
}
