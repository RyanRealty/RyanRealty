import 'server-only'

/**
 * Native group MMS via the Twilio Conversations API.
 *
 * HOW GROUP MMS ACTUALLY WORKS (docs: conversations-classic/group-texting +
 * conversations-classic/inbound-autocreation — verified 2026-07-02):
 * - SMS group members are participants with `MessagingBinding.Address` ONLY
 *   (NO ProxyAddress — the "number pair" model is 1:1-only).
 * - The broker's Twilio line joins as a standalone
 *   `MessagingBinding.ProjectedAddress` participant; REST-posted messages set
 *   `Author=<that projected address>`.
 * - Twilio then fans the message out as a REAL carrier group MMS: recipients
 *   see one group thread with every member's real number, and replies come
 *   back as group MMS routed into the same Conversation (matched by the
 *   "number group" — the sorted set of all senders + receivers).
 * - Group MMS is +1 long-code only, max 10 total addresses, and needs at
 *   least 3 total addresses (2 SMS members + the projected broker line).
 *
 * The pre-2026-07-02 implementation bound every member Address+ProxyAddress —
 * that is the 1:1 proxy model, NOT group MMS: each recipient saw a lone 1:1
 * thread with the proxy number and nobody saw each other. Do not regress to it.
 *
 * Inbound replies to these conversations fire the Conversations service webhook
 * (app/api/twilio/conversations-events) — Programmable Messaging does NOT
 * support group MMS, so the per-number inbound-sms webhook NEVER fires for
 * group traffic. Recording depends entirely on the Conversations webhook.
 *
 * Caller is responsible for the fallback: if this returns ok:false (bad
 * numbers, Twilio rejection, group MMS activation failure), send the message
 * 1:1 to each recipient instead.
 */
const BASE = 'https://conversations.twilio.com/v1'

function authHeader(): string {
  const sid = process.env.TWILIO_ACCOUNT_SID ?? ''
  const tok = process.env.TWILIO_AUTH_TOKEN ?? ''
  return 'Basic ' + Buffer.from(`${sid}:${tok}`).toString('base64')
}

function headers(): Record<string, string> {
  return { Authorization: authHeader(), 'Content-Type': 'application/x-www-form-urlencoded' }
}

/**
 * Twilio Conversations requires strict E.164 (+1XXXXXXXXXX) for every
 * MessagingBinding address. getSendTarget returns bare 10-digit phones
 * (e.g. "5416109091"), which the plain SMS API tolerates but Conversations
 * rejects. Normalize here at the Twilio boundary.
 */
export function toE164(phone: string | null | undefined): string | null {
  const digits = String(phone ?? '').replace(/\D/g, '')
  const ten = digits.length >= 10 ? digits.slice(-10) : null
  return ten ? `+1${ten}` : null
}

export async function deleteConversation(sid: string): Promise<void> {
  try {
    await fetch(`${BASE}/Conversations/${sid}`, { method: 'DELETE', headers: { Authorization: authHeader() } })
  } catch {
    /* best-effort cleanup */
  }
}

export type GroupMmsMedia = {
  content: Buffer
  contentType: string
  filename?: string
}

export type GroupMmsResult =
  | {
      ok: true
      conversationSid: string
      messageSid: string
      /** Chat service that owns the conversation's media (MCS) — stored on the
       *  timeline payload so the admin media proxy can fetch it later. */
      chatServiceSid: string | null
      /** MCS media attached to the send, in message order. */
      media: Array<{ mediaSid: string; contentType: string }>
    }
  | { ok: false; error: string }

/** Group MMS hard limit (Twilio): 10 total addresses incl. the projected line. */
export const GROUP_MMS_MAX_ADDRESSES = 10

/**
 * Upload one media file to Twilio's Media Content Service (MCS) — the
 * two-step Conversations media flow (docs: conversations-classic/
 * media-support-conversations). Uploaded media is garbage-collected after
 * 5 minutes unless attached to a message, so callers attach immediately.
 */
async function uploadConversationMedia(
  chatServiceSid: string,
  media: GroupMmsMedia,
): Promise<{ ok: true; mediaSid: string } | { ok: false; error: string }> {
  try {
    const res = await fetch(`https://mcs.us1.twilio.com/v1/Services/${chatServiceSid}/Media`, {
      method: 'POST',
      headers: { Authorization: authHeader(), 'Content-Type': media.contentType },
      body: new Uint8Array(media.content),
    })
    const data = (await res.json()) as { sid?: string; message?: string }
    if (!res.ok || !data.sid) return { ok: false, error: data.message ?? `MCS upload failed (${res.status})` }
    return { ok: true, mediaSid: data.sid }
  } catch (e) {
    return { ok: false, error: String(e) }
  }
}

export async function sendGroupMms(params: {
  /** The broker's MMS-capable Twilio line — joins the group as its ProjectedAddress. */
  projectedAddress: string
  /** Phones of every group member (the lead + the added people). */
  participants: string[]
  body: string
  friendlyName?: string
  /** Attachments (already size/type-validated by the caller). The first rides
   *  the body message; extras go out as follow-up media-only messages —
   *  Conversations REST attaches one MediaSid per message reliably. */
  media?: GroupMmsMedia[]
}): Promise<GroupMmsResult> {
  const projected = toE164(params.projectedAddress)
  const participants = [...new Set(params.participants.map(toE164).filter((p): p is string => Boolean(p)))]
    .filter((p) => p !== projected)
  if (!projected) return { ok: false, error: 'invalid broker line for group projection' }
  if (participants.length < 2) return { ok: false, error: 'group needs 2+ valid participant numbers' }
  if (participants.length + 1 > GROUP_MMS_MAX_ADDRESSES) {
    return { ok: false, error: `group MMS supports at most ${GROUP_MMS_MAX_ADDRESSES - 1} recipients` }
  }
  if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN) {
    return { ok: false, error: 'twilio credentials missing' }
  }

  try {
    // 1. Create the conversation. The response carries chat_service_sid — the
    //    MCS service that owns any media we upload for this conversation.
    const convRes = await fetch(`${BASE}/Conversations`, {
      method: 'POST',
      headers: headers(),
      body: new URLSearchParams({ FriendlyName: params.friendlyName ?? 'Group text' }),
    })
    const conv = (await convRes.json()) as { sid?: string; chat_service_sid?: string; message?: string }
    if (!conv.sid) return { ok: false, error: conv.message ?? 'failed to create conversation' }
    const conversationSid = conv.sid
    const chatServiceSid = conv.chat_service_sid ?? null

    // 2. Add every SMS member with Address ONLY (no ProxyAddress — that would
    //    silently downgrade the thread to per-person 1:1 proxy messaging).
    for (const phone of participants) {
      const partRes = await fetch(`${BASE}/Conversations/${conversationSid}/Participants`, {
        method: 'POST',
        headers: headers(),
        body: new URLSearchParams({ 'MessagingBinding.Address': phone }),
      })
      const part = (await partRes.json()) as { sid?: string; message?: string }
      if (!part.sid) {
        await deleteConversation(conversationSid)
        return { ok: false, error: `participant ${phone}: ${part.message ?? 'failed to add'}` }
      }
    }

    // 3. Add the broker's line as the standalone projected address (the
    //    brokerage's window into the group).
    const projRes = await fetch(`${BASE}/Conversations/${conversationSid}/Participants`, {
      method: 'POST',
      headers: headers(),
      body: new URLSearchParams({ 'MessagingBinding.ProjectedAddress': projected }),
    })
    const proj = (await projRes.json()) as { sid?: string; message?: string }
    if (!proj.sid) {
      await deleteConversation(conversationSid)
      return { ok: false, error: `projected address ${projected}: ${proj.message ?? 'failed to add'}` }
    }

    // 4. Upload media to MCS (attachments were silently DROPPED on group sends
    //    before 2026-07-09 — the uploaded file never reached the message).
    const mediaSids: Array<{ mediaSid: string; contentType: string }> = []
    if (params.media?.length) {
      if (!chatServiceSid) {
        await deleteConversation(conversationSid)
        return { ok: false, error: 'conversation has no chat service sid — cannot attach media' }
      }
      for (const m of params.media) {
        const up = await uploadConversationMedia(chatServiceSid, m)
        if (!up.ok) {
          await deleteConversation(conversationSid)
          return { ok: false, error: `media upload (${m.filename ?? m.contentType}): ${up.error}` }
        }
        mediaSids.push({ mediaSid: up.mediaSid, contentType: m.contentType })
      }
    }

    // 5. Post the message authored by the projected address — Twilio fans it
    //    out as a real carrier group MMS. First media rides the body message.
    const first = new URLSearchParams({ Author: projected, Body: params.body })
    if (mediaSids[0]) first.set('MediaSid', mediaSids[0].mediaSid)
    const msgRes = await fetch(`${BASE}/Conversations/${conversationSid}/Messages`, {
      method: 'POST',
      headers: headers(),
      body: first,
    })
    const msg = (await msgRes.json()) as { sid?: string; message?: string }
    if (!msg.sid) {
      await deleteConversation(conversationSid)
      return { ok: false, error: msg.message ?? 'failed to send group message' }
    }

    // 6. Any remaining media go out as media-only follow-up messages (one
    //    MediaSid per message — the reliably-documented REST contract).
    for (const m of mediaSids.slice(1)) {
      const extra = new URLSearchParams({ Author: projected, MediaSid: m.mediaSid })
      const extraRes = await fetch(`${BASE}/Conversations/${conversationSid}/Messages`, {
        method: 'POST',
        headers: headers(),
        body: extra,
      })
      const extraMsg = (await extraRes.json()) as { sid?: string; message?: string }
      if (!extraMsg.sid) {
        // The body message already went out — do NOT tear the group down.
        // Report success with the media that did send.
        console.warn('[twilio-conversations] follow-up media message failed:', extraMsg.message)
        break
      }
    }

    return { ok: true, conversationSid, messageSid: msg.sid, chatServiceSid, media: mediaSids }
  } catch (e) {
    return { ok: false, error: String(e) }
  }
}

// ---------------------------------------------------------------------------
// Inbound (conversations-events webhook) support
// ---------------------------------------------------------------------------

export type ConversationParticipantInfo = {
  address: string | null
  proxyAddress: string | null
  projectedAddress: string | null
}

/** Raw participant list of a conversation (SMS addresses + projected lines). */
export async function fetchConversationParticipants(conversationSid: string): Promise<ConversationParticipantInfo[]> {
  const res = await fetch(`${BASE}/Conversations/${conversationSid}/Participants?PageSize=50`, {
    headers: { Authorization: authHeader() },
  })
  if (!res.ok) return []
  const data = (await res.json()) as {
    participants?: Array<{ messaging_binding?: { address?: string; proxy_address?: string; projected_address?: string } | null }>
  }
  return (data.participants ?? []).map((p) => ({
    address: p.messaging_binding?.address ?? null,
    proxyAddress: p.messaging_binding?.proxy_address ?? null,
    projectedAddress: p.messaging_binding?.projected_address ?? null,
  }))
}

export type GroupShape = {
  /** SMS members participating with Address only (true group-MMS members). */
  smsAddresses: string[]
  /** Our Twilio line(s) projected into the group. */
  projectedAddresses: string[]
  /**
   * True when this is a native group-MMS conversation. Only these need the
   * Conversations webhook to record inbound — proxy-bound (Address+Proxy) 1:1
   * conversations still fire the per-number inbound-sms webhook, and recording
   * them here too would double-write the timeline.
   */
  isGroupMms: boolean
}

/** Pure classifier: separates group-MMS conversations from proxy/1:1 ones. */
export function groupShapeOf(participants: ConversationParticipantInfo[]): GroupShape {
  const smsAddresses = participants
    .filter((p) => p.address && !p.proxyAddress)
    .map((p) => p.address as string)
  const projectedAddresses = participants
    .filter((p) => p.projectedAddress)
    .map((p) => p.projectedAddress as string)
  return { smsAddresses, projectedAddresses, isGroupMms: smsAddresses.length >= 2 }
}

export type ConversationMediaItem = { mediaSid: string; contentType: string }

/**
 * Parse the `Media` webhook param (JSON array of {Sid, ContentType, Filename,
 * Size}) into the shape the CRM stores/renders. Malformed input → [].
 */
export function parseConversationMedia(mediaJson: string | null | undefined): ConversationMediaItem[] {
  if (!mediaJson) return []
  try {
    const arr = JSON.parse(mediaJson) as Array<{ Sid?: string; ContentType?: string }>
    if (!Array.isArray(arr)) return []
    return arr
      .filter((m) => typeof m?.Sid === 'string' && m.Sid)
      .slice(0, 10)
      .map((m) => ({ mediaSid: m.Sid as string, contentType: m.ContentType ?? 'application/octet-stream' }))
  } catch {
    return []
  }
}
