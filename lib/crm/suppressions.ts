/**
 * Suppression chokepoint — EVERY outbound send path checks here first
 * (blueprint §6). One function, one table, no per-path tag logic.
 */

import 'server-only'
import { createServiceClient } from '@/lib/supabase/service'

export type SendChannel = 'email' | 'sms' | 'call'

/**
 * Tag → channel suppression mapping (tags are live the instant they land on a
 * person). Exported read-only so a consent-decision reader projects the SAME
 * authoritative tag footprint isSuppressed enforces at send time — one mapping,
 * never a second copy that can drift.
 */
export const TAG_CHANNEL: ReadonlyArray<{ tag: string; channels: ReadonlyArray<'all' | SendChannel> }> = [
  { tag: 'compliance:hard-stop', channels: ['all'] },
  { tag: 'contact:do-not-text', channels: ['sms'] },
  // TCPA: a text message is legally a "call". A do-not-call contact must be
  // blocked from SMS as well as voice (incident 2026-06-16: do-not-call
  // homeowners were texted because this mapped to 'call' only).
  { tag: 'contact:do-not-call', channels: ['call', 'sms'] },
  { tag: 'do_not_email', channels: ['email'] },
  { tag: 'unsubscribed', channels: ['email'] },
  { tag: 'bounced', channels: ['email'] },
  { tag: 'complained', channels: ['email'] },
]

export async function isSuppressed(personId: number, channel: SendChannel): Promise<{ suppressed: boolean; reasons: string[] }> {
  const sb = createServiceClient()
  const [rows, person] = await Promise.all([
    sb.from('crm_suppressions').select('channel,reason').eq('person_id', personId).in('channel', ['all', channel]),
    sb.from('crm_people').select('tags').eq('id', personId).maybeSingle(),
  ])
  if (rows.error) {
    // fail CLOSED: if the compliance table is unreadable, do not send
    return { suppressed: true, reasons: ['suppression-check-failed: ' + rows.error.message] }
  }
  const reasons = (rows.data ?? []).map((r) => `${r.channel}:${r.reason}`)
  // tags are an equally authoritative source (set at lead creation by
  // owner-resolution / BatchData flags, before any suppression row exists)
  const tags = ((person.data?.tags as string[] | undefined) ?? [])
  const tagsLower = new Set(tags.map((t) => t.toLowerCase()))
  for (const m of TAG_CHANNEL) {
    if (tagsLower.has(m.tag.toLowerCase()) && (m.channels.includes('all') || m.channels.includes(channel))) {
      reasons.push(`tag:${m.tag}`)
    }
  }
  return { suppressed: reasons.length > 0, reasons }
}

/**
 * Email-keyed suppression check for send paths where no crm_person_id is known
 * at the call site (a fresh lead, a CMA addressed to a raw lead_email, a
 * home-valuation acknowledgment). Resolves EVERY crm_person carrying that email
 * and treats the address as suppressed if ANY of these is true:
 *
 *   1. Any matched person is suppressed for the channel (via isSuppressed —
 *      this also covers the protected compliance tags compliance:hard-stop,
 *      contact:do-not-text, contact:do-not-call through TAG_CHANNEL).
 *   2. A protected compliance tag sits on a matched person (belt-and-suspenders;
 *      isSuppressed already enforces these, kept explicit so the contract is
 *      readable and survives any future TAG_CHANNEL edit).
 *   3. A crm_suppressions row exists keyed by that email (value column) with
 *      channel in ('all', the channel) — covers email-keyed opt-outs written
 *      before any person row exists (bounce/complaint webhooks, manual entry).
 *
 * FAIL-CLOSED: on ANY read error, return suppressed=true. A brand-new email
 * with no person and no suppression row is NOT suppressed (a fresh opt-in).
 */
const PROTECTED_COMPLIANCE_TAGS = new Set([
  'compliance:hard-stop',
  'contact:do-not-text',
  'contact:do-not-call',
])

export async function isSuppressedByEmail(
  email: string,
  channel: SendChannel,
): Promise<{ suppressed: boolean; reasons: string[] }> {
  const normalized = (email ?? '').trim().toLowerCase()
  if (!normalized) {
    // An empty address can't be verified against the consent record — fail closed.
    return { suppressed: true, reasons: ['no-email'] }
  }

  const sb = createServiceClient()
  const reasons: string[] = []

  // 1 + 2. Resolve every person carrying this email, then run the canonical
  // per-person check (covers suppression rows AND protected tags) plus an
  // explicit protected-tag scan.
  const people = await sb
    .from('crm_people')
    .select('id,tags')
    .contains('emails', [{ value: normalized }])
  if (people.error) {
    return { suppressed: true, reasons: ['email-suppression-check-failed: ' + people.error.message] }
  }
  for (const p of people.data ?? []) {
    const tags = ((p.tags as string[] | undefined) ?? []).map((t) => t.toLowerCase())
    for (const t of tags) {
      if (PROTECTED_COMPLIANCE_TAGS.has(t)) reasons.push(`tag:${t}`)
    }
    const per = await isSuppressed(p.id as number, channel)
    if (per.suppressed) reasons.push(...per.reasons.map((r) => `person:${p.id}:${r}`))
  }

  // 3. Email-keyed suppression rows (no person required).
  const rows = await sb
    .from('crm_suppressions')
    .select('channel,reason')
    .eq('value', normalized)
    .in('channel', ['all', channel])
  if (rows.error) {
    return { suppressed: true, reasons: ['email-suppression-check-failed: ' + rows.error.message] }
  }
  for (const r of rows.data ?? []) reasons.push(`email:${r.channel}:${r.reason}`)

  return { suppressed: reasons.length > 0, reasons }
}

/**
 * Remove a suppression (audit p0.3 — makes "Reply START to resubscribe" real).
 * Scoped by channel + optional reason so a user STARTing only clears their own
 * stop-keyword opt-out, never a compliance do-not-text/hard-stop we set.
 */
export async function removeSuppression(params: {
  personId: number
  channel: 'all' | SendChannel
  reason?: string
}): Promise<void> {
  const sb = createServiceClient()
  let q = sb.from('crm_suppressions').delete().eq('person_id', params.personId).eq('channel', params.channel)
  if (params.reason) q = q.eq('reason', params.reason)
  await q
}

export async function addSuppression(params: {
  personId: number
  channel: 'all' | SendChannel
  reason: string
  source?: string
  value?: string | null
}): Promise<void> {
  const sb = createServiceClient()
  await sb.from('crm_suppressions').insert({
    person_id: params.personId,
    channel: params.channel,
    reason: params.reason,
    source: params.source ?? 'app',
    value: params.value ?? null,
  })

  // Phase 8.4 — enqueue removal from the Meta CRM Custom Audience. A suppressed
  // contact must be DELETED from the audience, not just excluded from the next
  // upload. This is NON-BLOCKING and FAIL-CLOSED-PRESERVING: the suppression row
  // above is already written (the load-bearing consent record). The queue write
  // is a best-effort downstream side effect wrapped so a queue/Meta failure can
  // NEVER throw out of addSuppression. (enqueueAudienceRemoval also swallows its
  // own errors; this try/catch is the belt-and-suspenders second guard.)
  try {
    const { enqueueAudienceRemoval } = await import('@/lib/data/crm/enqueueAudienceRemoval')
    const res = await enqueueAudienceRemoval(params.personId, params.reason)
    if (!res.ok) console.warn('[suppressions] audience-removal enqueue failed:', res.error)
  } catch (e) {
    console.warn('[suppressions] audience-removal enqueue threw:', e instanceof Error ? e.message : String(e))
  }
}
