import 'server-only'

/**
 * Native group MMS via the Twilio Conversations API. When a broker texts 2+
 * people from one lead, we create a Conversation, bind every participant's phone
 * to the broker's MMS-capable proxy number, and post one message — Twilio sends
 * it as a real group MMS so the recipients see ONE group thread and replies fan
 * out at the carrier level (everyone sees everyone).
 *
 * Caller is responsible for the fallback: if this returns ok:false (e.g. a
 * participant is already bound to another conversation on the same proxy, a hard
 * Twilio constraint), send the message 1:1 to each recipient instead.
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
 * MessagingBinding.Address and ProxyAddress. getSendTarget returns bare 10-digit
 * phones (e.g. "5416109091"), which the plain SMS API tolerates but Conversations
 * rejects — so without this every participant binding silently fails and the
 * caller falls back to 1:1 broadcast. Normalize here at the Twilio boundary.
 */
function toE164(phone: string | null | undefined): string | null {
  const digits = String(phone ?? '').replace(/\D/g, '')
  const ten = digits.length >= 10 ? digits.slice(-10) : null
  return ten ? `+1${ten}` : null
}

async function deleteConversation(sid: string): Promise<void> {
  try {
    await fetch(`${BASE}/Conversations/${sid}`, { method: 'DELETE', headers: { Authorization: authHeader() } })
  } catch {
    /* best-effort cleanup */
  }
}

export type GroupMmsResult =
  | { ok: true; conversationSid: string; messageSid: string }
  | { ok: false; error: string }

export async function sendGroupMms(params: {
  /** The broker's MMS-capable Twilio number (proxy for every participant). */
  proxy: string
  /** E.164 phones of every group member (the lead + the added people). */
  participants: string[]
  body: string
  friendlyName?: string
}): Promise<GroupMmsResult> {
  const proxy = toE164(params.proxy)
  const participants = [...new Set(params.participants.map(toE164).filter((p): p is string => Boolean(p)))]
  if (!proxy) return { ok: false, error: 'invalid proxy number' }
  if (participants.length < 2) return { ok: false, error: 'group needs 2+ valid participant numbers' }
  if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN) {
    return { ok: false, error: 'twilio credentials missing' }
  }

  try {
    // 1. Create the conversation.
    const convRes = await fetch(`${BASE}/Conversations`, {
      method: 'POST',
      headers: headers(),
      body: new URLSearchParams({ FriendlyName: params.friendlyName ?? 'Group text' }),
    })
    const conv = (await convRes.json()) as { sid?: string; message?: string }
    if (!conv.sid) return { ok: false, error: conv.message ?? 'failed to create conversation' }
    const conversationSid = conv.sid

    // 2. Bind every participant to the broker's proxy number. Any failure
    //    (e.g. number already in another conversation) aborts + cleans up so the
    //    caller can fall back to 1:1 broadcast.
    for (const phone of participants) {
      const partRes = await fetch(`${BASE}/Conversations/${conversationSid}/Participants`, {
        method: 'POST',
        headers: headers(),
        body: new URLSearchParams({ 'MessagingBinding.Address': phone, 'MessagingBinding.ProxyAddress': proxy }),
      })
      const part = (await partRes.json()) as { sid?: string; message?: string }
      if (!part.sid) {
        await deleteConversation(conversationSid)
        return { ok: false, error: `participant ${phone}: ${part.message ?? 'failed to add'}` }
      }
    }

    // 3. Post the message — Twilio fans it out as a group MMS.
    const msgRes = await fetch(`${BASE}/Conversations/${conversationSid}/Messages`, {
      method: 'POST',
      headers: headers(),
      body: new URLSearchParams({ Author: proxy, Body: params.body }),
    })
    const msg = (await msgRes.json()) as { sid?: string; message?: string }
    if (!msg.sid) {
      await deleteConversation(conversationSid)
      return { ok: false, error: msg.message ?? 'failed to send group message' }
    }

    return { ok: true, conversationSid, messageSid: msg.sid }
  } catch (e) {
    return { ok: false, error: String(e) }
  }
}
