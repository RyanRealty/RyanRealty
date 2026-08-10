import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * The single chokepoint that records a message into the first-class conversation
 * model (admin rebuild RC1, spec 02). Every send + inbound path calls THIS —
 * never inserts into crm_conversation / crm_message directly — so the "one
 * message = one row, group = one conversation with N participants" invariant
 * lives in exactly one place (kills the RC4 accretion + RC2 scattered-mutation
 * traps that produced the person-collapsed timeline in the first place).
 *
 * SHADOW-WRITE CONTRACT (while the read path still reads crm_timeline):
 * crm_timeline stays the source of truth until the inbox/thread rewire flips.
 * Callers MUST wrap this in try/catch — a conversation-model failure can never
 * break a real send that already went out. This helper also swallows its own
 * errors into a typed result rather than throwing, as a second belt.
 *
 * Conversation resolution:
 *  - group (twilioConversationSid present) → keyed by the Twilio Conversation
 *    SID (unique index). One carrier group thread = one conversation.
 *  - 1:1 → the canonical non-group conversation for primaryPersonId, unioning
 *    channels over time via channel_set. Matches how the UI collapses per contact,
 *    but now with a real typed message table underneath.
 *
 * Idempotency: provider_sid (Twilio SID / Gmail id) is the receipt key and has a
 * unique index; a re-record of the same SID no-ops. Sends are already guarded
 * upstream by withSendIdempotency, so this is a backstop, not the primary gate.
 */

export type RecordMessageChannel = 'sms' | 'mms' | 'email' | 'call' | 'voicemail'
export type RecordMessageDirection = 'in' | 'out'

export type RecordMessageParticipant = {
  personId?: number | null
  rawPhone?: string | null
  rawEmail?: string | null
  /** channel_address — E.164 phone or email; the per-conversation participant key */
  address: string
  displayName?: string | null
}

export type RecordMessageInput = {
  sb: SupabaseClient
  direction: RecordMessageDirection
  channel: RecordMessageChannel
  body?: string | null
  subject?: string | null
  /** Twilio SID / Gmail id — THE receipt key. Unique; a repeat no-ops. */
  providerSid?: string | null
  /** broker slug that sent it (out) — null for inbound */
  sentBy?: string | null
  idempotencyKey?: string | null
  media?: unknown[]
  /** the crm_timeline row this mirrors, for cross-reference during the shadow phase */
  timelineId?: number | null
  /** the contact this 1:1 thread belongs to (also the group's primary contact) */
  primaryPersonId?: number | null
  /** every party on the message (contacts + raw numbers); a group is 2+ */
  participants: RecordMessageParticipant[]
  /** present → this is a native carrier group thread; keys the conversation */
  twilioConversationSid?: string | null
  gmailThreadId?: string | null
  assignedBroker?: string | null
  /** conversation subject line (group friendlyName / email subject) */
  conversationSubject?: string | null
}

export type RecordMessageResult =
  | { ok: true; conversationId: string; messageId: string | null; deduped: boolean }
  | { ok: false; error: string }

/** A 23505 unique-violation from PostgREST (duplicate provider_sid / idem key). */
function isUniqueViolation(err: unknown): boolean {
  const code = (err as { code?: string } | null)?.code
  return code === '23505'
}

async function upsertParticipants(
  sb: SupabaseClient,
  conversationId: string,
  participants: RecordMessageParticipant[],
): Promise<void> {
  if (participants.length === 0) return
  const rows = participants.map((p) => ({
    conversation_id: conversationId,
    person_id: p.personId ?? null,
    raw_phone: p.rawPhone ?? null,
    raw_email: p.rawEmail ?? null,
    channel_address: p.address,
    display_name: p.displayName ?? null,
    role: p.personId ? 'contact' : 'raw',
  }))
  // (conversation_id, channel_address) is unique — a member already on the thread
  // is a no-op. ignoreDuplicates so re-recording a group never errors.
  await sb
    .from('crm_conversation_participant')
    .upsert(rows, { onConflict: 'conversation_id,channel_address', ignoreDuplicates: true })
}

/**
 * Find (or create) the conversation this message belongs to. Group threads key on
 * the Twilio Conversation SID; 1:1 threads key on the primary contact. Returns the
 * conversation id, or null if it cannot be resolved (no group SID and no contact).
 */
export async function resolveConversation(
  input: Pick<
    RecordMessageInput,
    | 'sb'
    | 'primaryPersonId'
    | 'participants'
    | 'twilioConversationSid'
    | 'gmailThreadId'
    | 'assignedBroker'
    | 'conversationSubject'
    | 'channel'
  >,
): Promise<{ ok: true; conversationId: string } | { ok: false; error: string }> {
  const { sb } = input

  // ── Group: keyed by the carrier Conversation SID (unique index) ──
  if (input.twilioConversationSid) {
    const { data: existing } = await sb
      .from('crm_conversation')
      .select('id')
      .eq('twilio_conversation_sid', input.twilioConversationSid)
      .maybeSingle()
    if (existing?.id) {
      await upsertParticipants(sb, existing.id, input.participants)
      return { ok: true, conversationId: existing.id }
    }
    const { data: created, error } = await sb
      .from('crm_conversation')
      .insert({
        twilio_conversation_sid: input.twilioConversationSid,
        primary_person_id: input.primaryPersonId ?? null,
        assigned_broker: input.assignedBroker ?? null,
        subject: input.conversationSubject ?? null,
        channel_set: [],
      })
      .select('id')
      .single()
    if (error || !created) {
      // Lost a create race — re-read by the unique SID.
      const { data: raced } = await sb
        .from('crm_conversation')
        .select('id')
        .eq('twilio_conversation_sid', input.twilioConversationSid)
        .maybeSingle()
      if (raced?.id) {
        await upsertParticipants(sb, raced.id, input.participants)
        return { ok: true, conversationId: raced.id }
      }
      return { ok: false, error: error?.message ?? 'conversation create failed' }
    }
    await upsertParticipants(sb, created.id, input.participants)
    return { ok: true, conversationId: created.id }
  }

  // ── 1:1: the canonical non-group conversation for this contact ──
  const pid = input.primaryPersonId
  if (!pid) return { ok: false, error: 'no primary contact for a 1:1 conversation' }

  const { data: existing } = await sb
    .from('crm_conversation')
    .select('id')
    .eq('primary_person_id', pid)
    .eq('is_group', false)
    .is('twilio_conversation_sid', null)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()
  if (existing?.id) {
    await upsertParticipants(sb, existing.id, input.participants)
    return { ok: true, conversationId: existing.id }
  }
  const { data: created, error } = await sb
    .from('crm_conversation')
    .insert({
      primary_person_id: pid,
      assigned_broker: input.assignedBroker ?? null,
      channel_set: [],
    })
    .select('id')
    .single()
  if (error || !created) {
    // Lost a create race — crm_conversation_one_to_one_idx guarantees one 1:1 thread
    // per contact, so a concurrent insert re-reads the winner instead of fragmenting.
    const { data: raced } = await sb
      .from('crm_conversation')
      .select('id')
      .eq('primary_person_id', pid)
      .eq('is_group', false)
      .is('twilio_conversation_sid', null)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle()
    if (raced?.id) {
      await upsertParticipants(sb, raced.id, input.participants)
      return { ok: true, conversationId: raced.id }
    }
    return { ok: false, error: error?.message ?? 'conversation create failed' }
  }
  await upsertParticipants(sb, created.id, input.participants)
  return { ok: true, conversationId: created.id }
}

export async function recordConversationMessage(input: RecordMessageInput): Promise<RecordMessageResult> {
  try {
    // Idempotency backstop: a message with this provider_sid already recorded.
    if (input.providerSid) {
      const { data: dupe } = await input.sb
        .from('crm_message')
        .select('id, conversation_id')
        .eq('provider_sid', input.providerSid)
        .maybeSingle()
      if (dupe?.id) return { ok: true, conversationId: dupe.conversation_id, messageId: dupe.id, deduped: true }
    }

    const conv = await resolveConversation(input)
    if (!conv.ok) return conv

    const { data: msg, error } = await input.sb
      .from('crm_message')
      .insert({
        conversation_id: conv.conversationId,
        direction: input.direction,
        channel: input.channel,
        body: input.body ?? null,
        subject: input.subject ?? null,
        provider_sid: input.providerSid ?? null,
        sent_by: input.sentBy ?? null,
        idempotency_key: input.idempotencyKey ?? null,
        media: input.media ?? [],
        timeline_id: input.timelineId ?? null,
      })
      .select('id')
      .single()
    if (error) {
      // A concurrent record of the same provider_sid / idem key — treat as deduped.
      if (isUniqueViolation(error)) return { ok: true, conversationId: conv.conversationId, messageId: null, deduped: true }
      return { ok: false, error: error.message }
    }
    // P12 measurement: first outbound human-touch stamps person.custom.
    if (input.direction === 'out' && input.primaryPersonId) {
      const kind =
        input.channel === 'sms' || input.channel === 'mms'
          ? input.channel === 'mms'
            ? 'mms_out'
            : 'sms_out'
          : input.channel === 'email'
            ? 'email_out'
            : input.channel === 'call'
              ? 'call'
              : 'sms_out'
      void import('@/lib/crm/first-broker-action')
        .then(({ stampFirstBrokerActionIfEmpty }) =>
          stampFirstBrokerActionIfEmpty(input.sb, input.primaryPersonId!, {
            kind,
            broker: input.sentBy ?? input.assignedBroker ?? null,
          }),
        )
        .catch(() => {})
    }
    return { ok: true, conversationId: conv.conversationId, messageId: msg?.id ?? null, deduped: false }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}
