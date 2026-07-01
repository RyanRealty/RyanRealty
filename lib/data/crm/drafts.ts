/**
 * CRM Inbox drafts DAL (FUB-parity delivery #5 — the Drafts folder).
 *
 * A draft is a started-but-unsent reply persisted in crm_message_drafts, keyed to
 * one (person, broker, channel). The Inbox "Drafts" folder lists the conversations
 * that carry at least one draft owned by the acting broker; opening such a
 * conversation prefills the composer with the saved body; sending the reply (via
 * the existing suppression-gated send actions) deletes the matching draft.
 *
 * This module NEVER sends anything — it only stores/reads/deletes draft text.
 * Every send still routes through app/actions/crm.ts (compliance untouched).
 *
 * DAL boundary (G1): all raw .from() reads/writes for drafts live here.
 */
import 'server-only'
import { createServiceClient } from '@/lib/supabase/service'

/** The two channels a draft can target — mirrors the DB CHECK constraint. */
export type DraftChannel = 'text' | 'email'

/** Canonical channel list — the single source the validator reads. */
export const DRAFT_CHANNELS: readonly DraftChannel[] = ['text', 'email']

/** Pure: validate a requested draft channel (re-exported from the 'use server' action). */
export function isValidDraftChannel(channel: string): channel is DraftChannel {
  return (DRAFT_CHANNELS as readonly string[]).includes(channel)
}

/** A single saved draft row, camelCased for the UI/action layer. */
export type MessageDraft = {
  personId: number
  brokerSlug: string | null
  channel: DraftChannel
  subject: string | null
  body: string
  updatedAt: string
}

/** The per-person draft summary the inbox queue folds in (which channels + recency). */
export type PersonDraftSummary = {
  updatedAt: string
  hasText: boolean
  hasEmail: boolean
}

/**
 * Normalize the acting broker's slug for storage/lookup. The unique index
 * coalesces null → '' so an unmapped admin still gets a single draft slot.
 */
function ownerKey(brokerSlug: string | null): string | null {
  const s = (brokerSlug ?? '').trim()
  return s === '' ? null : s
}

/**
 * All draft summaries owned by the acting broker, keyed by person. Powers the
 * Drafts folder membership + the folder count. A superuser still owns drafts
 * under their own slug (matt), so this is always the acting user's own drafts.
 */
export async function listDraftsByPerson(
  brokerSlug: string | null,
): Promise<Map<number, PersonDraftSummary>> {
  const owner = ownerKey(brokerSlug)
  const sb = createServiceClient()
  let q = sb
    .from('crm_message_drafts')
    .select('person_id,channel,updated_at')
    .order('updated_at', { ascending: false })
    .limit(1000)
  q = owner === null ? q.is('broker_slug', null) : q.eq('broker_slug', owner)
  const { data } = await q

  const byPerson = new Map<number, PersonDraftSummary>()
  for (const r of (data ?? []) as Array<{ person_id: number; channel: string; updated_at: string }>) {
    const cur = byPerson.get(r.person_id)
    if (cur) {
      if (r.channel === 'text') cur.hasText = true
      if (r.channel === 'email') cur.hasEmail = true
      if (r.updated_at > cur.updatedAt) cur.updatedAt = r.updated_at
    } else {
      byPerson.set(r.person_id, {
        updatedAt: r.updated_at,
        hasText: r.channel === 'text',
        hasEmail: r.channel === 'email',
      })
    }
  }
  return byPerson
}

/**
 * Both drafts (text + email) for one person owned by the acting broker. Used to
 * prefill the composer when a drafted conversation is opened.
 */
export async function getDraftsForPerson(
  personId: number,
  brokerSlug: string | null,
): Promise<{ text: MessageDraft | null; email: MessageDraft | null }> {
  const owner = ownerKey(brokerSlug)
  const sb = createServiceClient()
  let q = sb
    .from('crm_message_drafts')
    .select('person_id,broker_slug,channel,subject,body,updated_at')
    .eq('person_id', personId)
  q = owner === null ? q.is('broker_slug', null) : q.eq('broker_slug', owner)
  const { data } = await q

  const out: { text: MessageDraft | null; email: MessageDraft | null } = { text: null, email: null }
  for (const r of (data ?? []) as Array<{
    person_id: number
    broker_slug: string | null
    channel: string
    subject: string | null
    body: string | null
    updated_at: string
  }>) {
    const draft: MessageDraft = {
      personId: r.person_id,
      brokerSlug: r.broker_slug,
      channel: r.channel === 'email' ? 'email' : 'text',
      subject: r.subject,
      body: r.body ?? '',
      updatedAt: r.updated_at,
    }
    if (draft.channel === 'email') out.email = draft
    else out.text = draft
  }
  return out
}

/**
 * Upsert a draft for (person, acting broker, channel). Returns { ok } so the
 * calling action can surface a clean error. The caller has already guarded
 * access + scope; this is storage only.
 */
export async function upsertDraft(params: {
  personId: number
  brokerSlug: string | null
  channel: DraftChannel
  subject: string | null
  body: string
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const sb = createServiceClient()
  const { error } = await sb.from('crm_message_drafts').upsert(
    {
      person_id: params.personId,
      broker_slug: ownerKey(params.brokerSlug),
      channel: params.channel,
      subject: params.channel === 'email' ? params.subject : null,
      body: params.body,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'person_id,broker_slug,channel' },
  )
  if (error) return { ok: false, error: error.message }
  return { ok: true }
}

/**
 * Delete a person's draft for the acting broker + channel. Called on discard and
 * after a successful send (the reply is now a real message, no draft remains).
 * A missing row is a no-op success.
 */
export async function deleteDraft(
  personId: number,
  brokerSlug: string | null,
  channel: DraftChannel,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const owner = ownerKey(brokerSlug)
  const sb = createServiceClient()
  let q = sb
    .from('crm_message_drafts')
    .delete()
    .eq('person_id', personId)
    .eq('channel', channel)
  q = owner === null ? q.is('broker_slug', null) : q.eq('broker_slug', owner)
  const { error } = await q
  if (error) return { ok: false, error: error.message }
  return { ok: true }
}
