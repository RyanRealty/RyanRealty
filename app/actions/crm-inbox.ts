'use server'

/**
 * CRM inbox triage actions (Wave 7, Inbox triage — mutation side).
 *
 * These actions mutate the per-conversation triage state in
 * crm_conversation_state (unread/open/handled/closed + assigned_broker). The
 * MESSAGES themselves are never touched here — they stay in crm_timeline, and
 * the inbox inline reply goes through the existing suppression-gated send actions
 * (sendCrmSmsAction / sendCrmEmailAction in app/actions/crm.ts), NEVER a new send
 * path. This file is state-only.
 *
 * Every mutation is admin-guarded the same way app/actions/crm.ts is
 * (getCrmAccess) and scope-guarded with requirePersonInScope so a restricted
 * broker can only triage conversations they own. assignConversationAction is
 * superuser-only (re-assigning ownership is an owner action, mirroring
 * assignCrmBrokerAction).
 *
 * AUTO-DERIVE / WEBHOOK HOOK POINT (documented, NOT wired here):
 *   When an inbound message arrives the conversation should reset to 'unread'
 *   and last_inbound_at should advance. The inbound webhooks that write the
 *   crm_timeline rows are the right place to call markConversationUnreadOnInbound
 *   (the helper below). They are:
 *     - app/api/twilio/inbound-sms/route.ts  (after the sms_in upsert, ~line 74)
 *     - the email inbound ingest (when email_in lands in crm_timeline)
 *   We do NOT edit those webhooks in this piece. Phase B / the webhook owner
 *   imports markConversationUnreadOnInbound and calls it next to the timeline
 *   write. The helper is idempotent and upserts the state row.
 */

import { revalidatePath } from 'next/cache'
import { createServiceClient } from '@/lib/supabase/service'
import { getCrmAccess, requirePersonInScope } from '@/app/actions/crm'
import { scopeBroker, isPersonInScope } from '@/lib/crm/scope'
import {
  isValidConversationStatus,
  isAssignableBroker,
  type ConversationStatus,
} from '@/lib/data/crm/getInboxQueue'
import { isValidDraftChannel, upsertDraft, deleteDraft } from '@/lib/data/crm/drafts'
import { nameUnknownCallerContact } from '@/lib/data/crm/addUnknownCallerContact'

export type InboxActionResult = { ok: true } | { ok: false; error: string }

function revalidateInbox(personId?: number) {
  revalidatePath('/admin/crm/inbox')
  revalidatePath('/admin/crm')
  if (personId) revalidatePath(`/admin/crm/${personId}`)
}

/**
 * Upsert the triage state for a conversation. Internal helper shared by every
 * mutation — it never resolves access (callers guard first). Bumps updated_at.
 */
async function upsertState(
  personId: number,
  patch: { status?: ConversationStatus; assigned_broker?: string | null },
): Promise<InboxActionResult> {
  const sb = createServiceClient()
  const { error } = await sb
    .from('crm_conversation_state')
    .upsert(
      { person_id: personId, ...patch, updated_at: new Date().toISOString() },
      { onConflict: 'person_id' },
    )
  if (error) return { ok: false, error: error.message }
  return { ok: true }
}

/**
 * Set a single conversation's triage status (unread/open/handled/closed).
 * Admin + scope guarded.
 */
export async function setConversationStateAction(
  personId: number,
  status: string,
): Promise<InboxActionResult> {
  const access = await getCrmAccess()
  if (!access) return { ok: false, error: 'Unauthorized' }
  const id = Number(personId)
  if (!Number.isFinite(id) || id <= 0) return { ok: false, error: 'A contact is required' }
  if (!isValidConversationStatus(status)) return { ok: false, error: 'Invalid status' }
  const scoped = await requirePersonInScope(id, access)
  if (!scoped.ok) return scoped

  const result = await upsertState(id, { status })
  if (!result.ok) return result
  revalidateInbox(id)
  return { ok: true }
}

/**
 * Re-assign a conversation's triage owner. Owner action only — a restricted
 * broker cannot re-route a conversation away (mirrors assignCrmBrokerAction's
 * superuser-only guard). Pass an empty string / null to clear the owner.
 */
export async function assignConversationAction(
  personId: number,
  broker: string | null,
): Promise<InboxActionResult> {
  const access = await getCrmAccess()
  if (!access) return { ok: false, error: 'Unauthorized' }
  // Only a superuser (scopeBroker === null) may re-assign — never a scoped broker.
  if (scopeBroker(access) !== null) {
    return { ok: false, error: 'Only an owner can re-assign a conversation' }
  }
  const id = Number(personId)
  if (!Number.isFinite(id) || id <= 0) return { ok: false, error: 'A contact is required' }
  const normalized = broker === '' ? null : broker
  if (!isAssignableBroker(normalized)) return { ok: false, error: 'Unknown broker' }

  const result = await upsertState(id, { assigned_broker: normalized })
  if (!result.ok) return result
  revalidateInbox(id)
  return { ok: true }
}

/**
 * Mark every conversation in the caller's scope as read — flips any 'unread'
 * conversation to 'open'. Scoped: a restricted broker only clears their own
 * unread; a superuser clears everyone's. Conversations with no state row yet
 * (which read as 'unread' by default) are materialized to 'open' here.
 */
export async function markAllReadAction(): Promise<InboxActionResult> {
  const access = await getCrmAccess()
  if (!access) return { ok: false, error: 'Unauthorized' }
  const slug = scopeBroker(access)
  const sb = createServiceClient()

  // 1) Existing state rows that are 'unread' -> 'open', broker-scoped.
  let stateQ = sb
    .from('crm_conversation_state')
    .update({ status: 'open', updated_at: new Date().toISOString() })
    .eq('status', 'unread')
  if (slug) stateQ = stateQ.eq('assigned_broker', slug)
  const { error: stateErr } = await stateQ
  if (stateErr) return { ok: false, error: stateErr.message }

  // 2) Contacts with inbound messages but NO state row also read as 'unread'
  //    by default. Materialize an 'open' state row for those so "mark all read"
  //    actually clears the inbox. Resolve the set from recent inbound messages,
  //    broker-scoped, excluding any person that already has a state row.
  let inboundQ = sb
    .from('crm_timeline')
    .select('person_id,crm_people!inner(assigned_broker,deleted)')
    .in('kind', ['sms_in', 'email_in', 'call', 'voicemail'])
    .order('ts', { ascending: false })
    .limit(2000)
  if (slug) inboundQ = inboundQ.eq('crm_people.assigned_broker', slug)
  const { data: inboundRows } = await inboundQ

  type Joined = { person_id: number; crm_people: { assigned_broker: string | null; deleted: boolean } | Array<{ assigned_broker: string | null; deleted: boolean }> | null }
  const candidatePersonIds = new Set<number>()
  const ownerByPerson = new Map<number, string | null>()
  for (const r of (inboundRows ?? []) as unknown as Joined[]) {
    const p = Array.isArray(r.crm_people) ? r.crm_people[0] : r.crm_people
    if (!p || p.deleted) continue
    candidatePersonIds.add(r.person_id)
    if (!ownerByPerson.has(r.person_id)) ownerByPerson.set(r.person_id, p.assigned_broker)
  }
  if (candidatePersonIds.size === 0) {
    revalidateInbox()
    return { ok: true }
  }
  const ids = [...candidatePersonIds]
  const { data: existing } = await sb
    .from('crm_conversation_state')
    .select('person_id')
    .in('person_id', ids)
  const have = new Set((existing ?? []).map((e) => (e as { person_id: number }).person_id))
  const toInsert = ids
    .filter((pid) => !have.has(pid))
    .map((pid) => ({
      person_id: pid,
      status: 'open' as const,
      assigned_broker: ownerByPerson.get(pid) ?? null,
      updated_at: new Date().toISOString(),
    }))
  if (toInsert.length > 0) {
    const { error: insErr } = await sb.from('crm_conversation_state').insert(toInsert)
    if (insErr) return { ok: false, error: insErr.message }
  }

  revalidateInbox()
  return { ok: true }
}

/**
 * Bulk-set the triage status for several conversations at once (the inbox
 * multi-select). Admin guarded; each conversation is scope-checked individually
 * so a restricted broker can only move conversations they own (any out-of-scope
 * id is skipped, not errored, so a partial selection still succeeds for the rest).
 */
export async function bulkConversationStateAction(
  personIds: number[],
  status: string,
): Promise<{ ok: true; updated: number } | { ok: false; error: string }> {
  const access = await getCrmAccess()
  if (!access) return { ok: false, error: 'Unauthorized' }
  if (!isValidConversationStatus(status)) return { ok: false, error: 'Invalid status' }
  const ids = Array.from(new Set((personIds ?? []).map((n) => Number(n)).filter((n) => Number.isFinite(n) && n > 0)))
  if (ids.length === 0) return { ok: false, error: 'No conversations selected' }

  const sb = createServiceClient()

  // Scope-check the whole selection with ONE query (was requirePersonInScope
  // per id — one crm_people round trip per selected conversation, sequential,
  // so a 50-item multi-select cost 50 serial reads before the single upsert).
  // Same policy as requirePersonInScope: a superuser (slug null) passes all;
  // a restricted broker keeps only their own contacts (out-of-scope ids are
  // skipped, not errored, so a partial selection still succeeds for the rest).
  const slug = scopeBroker(access)
  let inScope: number[]
  if (!slug) {
    inScope = ids
  } else {
    const { data: owned } = await sb
      .from('crm_people')
      .select('id,assigned_broker')
      .in('id', ids)
    inScope = ((owned ?? []) as Array<{ id: number; assigned_broker: string | null }>)
      .filter((r) => isPersonInScope(slug, r.assigned_broker ?? null))
      .map((r) => r.id)
  }
  if (inScope.length === 0) return { ok: false, error: 'Not authorized for the selected conversations' }

  const now = new Date().toISOString()
  const { error } = await sb
    .from('crm_conversation_state')
    .upsert(
      inScope.map((pid) => ({ person_id: pid, status: status as ConversationStatus, updated_at: now })),
      { onConflict: 'person_id' },
    )
  if (error) return { ok: false, error: error.message }
  revalidateInbox()
  return { ok: true, updated: inScope.length }
}

/**
 * AUTO-DERIVE helper — call this from an inbound webhook (NOT wired in this
 * piece) right after it writes the inbound crm_timeline row. It resets the
 * conversation to 'unread' and advances last_inbound_at so the inbox re-surfaces
 * the thread. Idempotent: upserts the state row, defaulting assigned_broker to
 * the contact's lead owner when no state row exists yet.
 *
 * NOTE: this is a 'use server' export so it must be async. It is a write-path
 * helper, not a user-triggered action — it takes no access guard because the
 * webhook is the authenticated trust boundary (it already verified the Twilio /
 * email signature before calling). It never sends a message; it only sets state.
 */
export async function markConversationUnreadOnInbound(
  personId: number,
  inboundAt?: string,
): Promise<InboxActionResult> {
  const id = Number(personId)
  if (!Number.isFinite(id) || id <= 0) return { ok: false, error: 'A contact is required' }
  const sb = createServiceClient()
  const ts = inboundAt ?? new Date().toISOString()
  const now = new Date().toISOString()

  // An existing state row keeps its assigned_broker (a manual triage re-assign
  // must survive a new inbound). Only a fresh row defaults the owner to the
  // contact's lead owner. So: try to UPDATE first; if no row existed, INSERT.
  const { data: updated, error: updErr } = await sb
    .from('crm_conversation_state')
    .update({ status: 'unread', last_inbound_at: ts, updated_at: now })
    .eq('person_id', id)
    .select('person_id')
  if (updErr) return { ok: false, error: updErr.message }
  if (updated && updated.length > 0) return { ok: true }

  // No row yet — create one, defaulting the owner to the contact's lead owner.
  const { data: person } = await sb
    .from('crm_people')
    .select('assigned_broker')
    .eq('id', id)
    .maybeSingle()
  const { error: insErr } = await sb.from('crm_conversation_state').insert({
    person_id: id,
    status: 'unread',
    assigned_broker: (person?.assigned_broker as string | null) ?? null,
    last_inbound_at: ts,
    updated_at: now,
  })
  // A race could have inserted the row between our update + insert; treat a
  // unique-violation as success (the row now exists in the desired state).
  if (insErr && insErr.code !== '23505') return { ok: false, error: insErr.message }
  return { ok: true }
}

// ── Drafts (Inbox "Drafts" folder — started-but-unsent replies) ──────────────
//
// A draft is stored text ONLY. It never sends. When the broker actually sends
// the reply, the send routes through the existing suppression-gated actions
// (sendCrmSmsAction / sendCrmEmailAction) and the matching draft is deleted.
// These actions are admin + scope guarded like every other inbox mutation.

/**
 * Save (upsert) a started-but-unsent reply for a conversation, owned by the
 * acting broker + channel. Reads `body` (+ `subject` for email) from the compose
 * FormData so it can be a `formAction` on the composer form. An empty draft is a
 * delete (nothing to keep). Scope-guarded to the acting broker's own contacts.
 */
export async function saveDraftAction(
  personId: number,
  channel: string,
  formData: FormData,
): Promise<InboxActionResult> {
  const access = await getCrmAccess()
  if (!access) return { ok: false, error: 'Unauthorized' }
  const id = Number(personId)
  if (!Number.isFinite(id) || id <= 0) return { ok: false, error: 'A contact is required' }
  if (!isValidDraftChannel(channel)) return { ok: false, error: 'Invalid channel' }
  const scoped = await requirePersonInScope(id, access)
  if (!scoped.ok) return scoped

  const body = String(formData.get('body') ?? '')
  const subject = channel === 'email' ? (String(formData.get('subject') ?? '').trim() || null) : null

  // Nothing worth keeping — treat Save-with-empty as a discard.
  if (!body.trim() && !(subject ?? '').trim()) {
    const del = await deleteDraft(id, access.brokerSlug, channel)
    if (!del.ok) return del
    revalidateInbox(id)
    return { ok: true }
  }

  const res = await upsertDraft({ personId: id, brokerSlug: access.brokerSlug, channel, subject, body })
  if (!res.ok) return res
  revalidateInbox(id)
  return { ok: true }
}

/**
 * Discard a conversation's draft for the acting broker + channel. Called by the
 * "Discard draft" control and after a successful send (the reply is now a real
 * message). A missing draft is a no-op success. Scope-guarded.
 */
export async function discardDraftAction(
  personId: number,
  channel: string,
): Promise<InboxActionResult> {
  const access = await getCrmAccess()
  if (!access) return { ok: false, error: 'Unauthorized' }
  const id = Number(personId)
  if (!Number.isFinite(id) || id <= 0) return { ok: false, error: 'A contact is required' }
  if (!isValidDraftChannel(channel)) return { ok: false, error: 'Invalid channel' }
  const scoped = await requirePersonInScope(id, access)
  if (!scoped.ok) return scoped

  const res = await deleteDraft(id, access.brokerSlug, channel)
  if (!res.ok) return res
  revalidateInbox(id)
  return { ok: true }
}

// ── Unknown-caller Add Person (name a placeholder inbound contact — spec §9) ──

/**
 * Name an unknown-caller conversation. The inbound webhooks already created a
 * crm_people row for the number with a phone-derived placeholder name; this NAMES
 * that row (first/last/name + optional email) so the thread shows a real contact
 * instead of the raw number (AC-19/AC-20). It never creates a duplicate person and
 * never sends anything. Admin + scope guarded to the acting broker's own contact.
 */
export async function addUnknownCallerPersonAction(
  personId: number,
  firstName: string,
  lastName: string,
  email: string,
): Promise<InboxActionResult> {
  const access = await getCrmAccess()
  if (!access) return { ok: false, error: 'Unauthorized' }
  const id = Number(personId)
  if (!Number.isFinite(id) || id <= 0) return { ok: false, error: 'A contact is required' }
  const scoped = await requirePersonInScope(id, access)
  if (!scoped.ok) return scoped

  const res = await nameUnknownCallerContact({
    personId: id,
    firstName: String(firstName ?? ''),
    lastName: String(lastName ?? ''),
    email: String(email ?? '') || null,
    broker: access.brokerSlug,
  })
  if (!res.ok) return { ok: false, error: res.error }
  revalidateInbox(id)
  return { ok: true }
}

// ── §27 S3 — AI compose drafts (mobile pill strip) ───────────────────────────
//
// Generates a SHORT draft the broker reviews + edits in the compose field.
// This action NEVER sends — the send still goes through the suppression-gated
// sendCrmSmsAction/sendCrmEmailAction. Auto-send of AI content is prohibited
// (spec §27 S3 "AI template generation flow" step 6); filling an editable input
// is the entire scope of this action.

export type AiDraftKind = 'introduction' | 'follow_up' | 'still_buying' | 'custom'

export async function aiSmsDraftAction(
  personId: number,
  kind: AiDraftKind,
  customPrompt?: string,
): Promise<{ ok: true; draft: string } | { ok: false; error: string }> {
  const access = await getCrmAccess()
  if (!access) return { ok: false, error: 'Unauthorized' }
  const id = Number(personId)
  if (!Number.isFinite(id) || id <= 0) return { ok: false, error: 'A contact is required' }
  const scoped = await requirePersonInScope(id, access)
  if (!scoped.ok) return scoped
  if (!process.env.ANTHROPIC_API_KEY?.trim()) return { ok: false, error: 'AI drafting is not configured' }

  const [{ getInboxContactCard }, { getConversationThread }] = await Promise.all([
    import('@/lib/data/crm/getInboxThread'),
    import('@/lib/data/crm/getInboxQueue'),
  ])
  const [card, thread] = await Promise.all([getInboxContactCard(id), getConversationThread(id, 12)])
  if (!card) return { ok: false, error: 'Contact not found' }

  const recent = thread
    .filter((it) => ['message', 'email', 'call', 'note'].includes(it.category))
    .slice(0, 8)
    .map((it) => `${it.label} (${it.ts.slice(0, 10)}): ${(it.snippet ?? '').slice(0, 160)}`)
    .join('\n')

  const ask =
    kind === 'introduction'
      ? 'Write a first-touch introduction text.'
      : kind === 'follow_up'
        ? 'Write a follow-up text that references the most recent real activity in the context.'
        : kind === 'still_buying'
          ? 'Write a gentle check-in text asking whether they are still looking at homes.'
          : `Write a text for this request from the broker: ${String(customPrompt ?? '').slice(0, 300)}`

  const { default: Anthropic } = await import('@anthropic-ai/sdk')
  const client = new Anthropic()
  try {
    const msg = await client.messages.create({
      model: 'claude-opus-4-8',
      max_tokens: 300,
      system: [
        'You draft one short SMS for a Ryan Realty broker in Bend, Oregon. The broker reviews and edits before sending.',
        'Voice: direct, specific, kind, honest. Plain English. Short sentences.',
        'HARD RULES: no em dashes, no semicolons, no exclamation marks, no emoji.',
        'Banned words: stunning, gorgeous, charming, nestled, boasts, dream home, truly, luxurious, delve, seamless, elevate, vibrant, curated, act fast, dont miss out.',
        'Never invent market numbers, prices, listings, or facts not present in the context. Reference only what the contact actually did or said.',
        'Under 280 characters. Output ONLY the SMS body text, nothing else.',
      ].join(' '),
      messages: [
        {
          role: 'user',
          content: `Contact: ${card.name ?? 'Unknown'} · stage ${card.stage}${card.source ? ` · source ${card.source}` : ''}${card.timeframe ? ` · timeframe ${card.timeframe}` : ''}\nRecent activity (newest first):\n${recent || '(no prior activity)'}\n\n${ask}`,
        },
      ],
    })
    const text = msg.content.find((b) => b.type === 'text')?.text?.trim()
    if (!text) return { ok: false, error: 'No draft came back. Try again.' }
    return { ok: true, draft: text.slice(0, 320) }
  } catch (e) {
    // Graceful degradation: the raw SDK message carries API/billing internals
    // ("credit balance is too low… Plans & Billing") — never surface that to
    // the composer (2026-07-02 mobile audit). Log for diagnosis, show a
    // friendly line.
    console.error('[aiSmsDraftAction]', e instanceof Error ? e.message : e)
    return { ok: false, error: 'AI drafting is unavailable right now. Write your text below.' }
  }
}

/**
 * Render an SMS template body for a specific contact — merge tokens resolved
 * server-side (same renderCrmMerge + buildMergeContext path the send uses) so
 * the mobile compose sheet shows WHAT WILL SEND, not raw %tokens%
 * (2026-07-02 mobile audit: 17 of 37 live SMS templates carry FUB-era tokens;
 * one reached a contact literally on Jun 30). Tokens the contact has no data
 * for stay literal and come back in `unresolved` for the composer warning.
 * Render-only — no send, no writes.
 */
export async function renderSmsTemplateAction(
  personId: number,
  body: string,
): Promise<{ ok: true; body: string; unresolved: string[] } | { ok: false; error: string }> {
  const access = await getCrmAccess()
  if (!access) return { ok: false, error: 'Unauthorized' }
  const id = Number(personId)
  if (!Number.isFinite(id) || id <= 0) return { ok: false, error: 'A contact is required' }
  const scoped = await requirePersonInScope(id, access)
  if (!scoped.ok) return scoped
  const raw = String(body ?? '').slice(0, 4000)

  const sb = createServiceClient()
  const { data: person } = await sb
    .from('crm_people')
    .select('first_name,last_name,name,stage,source,lender_name,emails,phones,addresses,assigned_broker,custom')
    .eq('id', id)
    .maybeSingle()
  if (!person) return { ok: false, error: 'Contact not found' }

  const [{ renderCrmMerge, findUnresolvedMergeTokens }, { buildMergeContext }] = await Promise.all([
    import('@/lib/crm/merge'),
    import('@/lib/crm/merge-context'),
  ])
  const p = person as { assigned_broker?: string | null }
  const senderSlug = access.brokerSlug ?? p.assigned_broker ?? null
  const ctx = await buildMergeContext({ person, senderSlug })
  const rendered = renderCrmMerge(raw, person, ctx)
  return { ok: true, body: rendered, unresolved: findUnresolvedMergeTokens(rendered) }
}
