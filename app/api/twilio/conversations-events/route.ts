/**
 * Twilio Conversations service webhook (post-event) — records inbound GROUP
 * text traffic. Wired account-wide via `Configuration/Webhooks`
 * (PostWebhookUrl → this route, filter onMessageAdded) by
 * scripts/setup-conversations-webhooks.mjs.
 *
 * WHY THIS ROUTE EXISTS (verified against Twilio docs 2026-07-02):
 * - Programmable Messaging does NOT support group MMS, so an inbound group
 *   text NEVER reaches app/api/twilio/inbound-sms. Without this route (plus
 *   Conversations autocreation on the broker lines), a client's group text —
 *   including replies to phone-era group threads on Matt's ported number —
 *   is silently dropped: no webhook, no log, no CRM row.
 * - CRM-created group threads (lib/crm/twilio-conversations.sendGroupMms)
 *   also deliver replies only through Conversations webhooks.
 *
 * SCOPE — group-MMS conversations ONLY. Proxy-bound (Address+ProxyAddress)
 * 1:1 conversations still fire the per-number Programmable Messaging webhook
 * (inbound-sms records those); recording them here too would double-write.
 *
 * Recording model: one sms_in row per group member who is a CRM person —
 * the author's row is find-or-created (an unknown number in a group with a
 * broker is a hot signal, same as 1:1); other members are looked up only
 * (never auto-created). Every row carries the group context
 * (conversationSid + groupMembers + fromNumber) so each member's thread
 * shows the whole group conversation, mirroring the outbound convention in
 * sendCrmSmsAction.
 *
 * Compliance: STOP/START leading keywords from the author are honored exactly
 * like the 1:1 path (suppression chokepoint). Conversations webhooks cannot
 * return TwiML, so no confirmation reply is sent — the suppression itself
 * still lands, which is the legally-binding part.
 */

import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import {
  DEFAULT_DESK_BROKER,
  MARKETING_NUMBER,
  brokerForTwilioNumber,
  lookupPersonByPhone,
  normalizeTo10,
  toE164,
  verifiedTwilioParams,
} from '@/lib/crm/twilio'
import { fetchConversationParticipants, groupShapeOf, parseConversationMedia } from '@/lib/crm/twilio-conversations'
import { findOrCreatePersonByPhone } from '@/lib/data/crm/findOrCreatePersonByPhone'
import { markConversationUnreadOnInbound } from '@/app/actions/crm-inbox'
import { addSuppression, removeSuppression } from '@/lib/crm/suppressions'
import { newLeadAlertBody, queueBrokerAlert } from '@/lib/crm/broker-alerts'
import { CRM_MAILBOXES, sendCrmEmail } from '@/lib/crm/gmail'
import type { CrmBrokerSlug } from '@/lib/crm/constants'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

const STOP_WORDS = new Set(['stop', 'stopall', 'unsubscribe', 'cancel', 'end', 'quit'])
const START_WORDS = new Set(['start', 'unstop', 'yes', 'resubscribe'])

const ok = () => NextResponse.json({})

export async function POST(request: Request) {
  const verified = await verifiedTwilioParams(request)
  if (!verified.ok) return NextResponse.json({ error: 'invalid signature' }, { status: 403 })
  const params = verified.params

  if (params.EventType !== 'onMessageAdded') return ok()

  const conversationSid = params.ConversationSid ?? ''
  const messageSid = params.MessageSid ?? ''
  if (!conversationSid || !messageSid) return ok()

  // Author must be an SMS address (E.164). Chat identities (non-phone authors)
  // and our own lines (REST-posted outbound, already recorded at send time by
  // sendCrmSmsAction) are skipped.
  const author = params.Author ?? ''
  const authorTen = normalizeTo10(author)
  if (!authorTen || !/^\+?1?\d{10}$/.test(author.replace(/[\s().-]/g, ''))) return ok()
  if (normalizeTo10(MARKETING_NUMBER) === authorTen) return ok()
  if (await brokerForTwilioNumber(author)) return ok()

  // Block gate: a blocked/spam number's texts are dropped silently.
  const { isNumberBlocked } = await import('@/lib/data/crm/getBlockedNumber')
  if (await isNumberBlocked(author)) return ok()

  // Group-MMS conversations only (see header). 1:1/proxy conversations are the
  // inbound-sms webhook's job.
  const participants = await fetchConversationParticipants(conversationSid)
  const shape = groupShapeOf(participants)
  if (!shape.isGroupMms) return ok()

  const body = (params.Body ?? '').trim()
  const media = parseConversationMedia(params.Media)
  const displayBody = body || (media.length ? `[${media.length} attachment${media.length > 1 ? 's' : ''}]` : '')
  const groupMembers = [...shape.smsAddresses, ...shape.projectedAddresses]

  // The broker whose line is projected into this group owns the thread.
  let broker: CrmBrokerSlug | null = null
  for (const line of shape.projectedAddresses) {
    broker = await brokerForTwilioNumber(line)
    if (broker) break
  }
  const alertBroker = broker ?? DEFAULT_DESK_BROKER

  // Author: find-or-create (a group text from an unknown number is a hot
  // signal, same as the 1:1 inbound path).
  const { match, created } = await findOrCreatePersonByPhone({
    phone: author,
    source: 'inbound-sms',
    assignBroker: alertBroker,
  })
  if (!match) return ok()

  // Other group members: lookup only — never auto-create passive members.
  const memberPersons: Array<{ personId: number; broker: CrmBrokerSlug | null }> = [
    { personId: match.personId, broker: match.broker },
  ]
  // Address → contact map for the conversation-model participant list (below).
  const contactByTen = new Map<string, number>([[authorTen, match.personId]])
  for (const addr of shape.smsAddresses) {
    const ten = normalizeTo10(addr)
    if (!ten || ten === authorTen) continue
    const found = await lookupPersonByPhone(addr)
    if (found) {
      contactByTen.set(ten, found.personId)
      if (!memberPersons.some((m) => m.personId === found.personId)) {
        memberPersons.push({ personId: found.personId, broker: found.broker })
      }
    }
  }

  const sb = createServiceClient()
  const chatServiceSid = params.ChatServiceSid ?? null
  for (const member of memberPersons) {
    await sb.from('crm_timeline').upsert(
      {
        person_id: member.personId,
        kind: 'sms_in',
        title: 'Group text received',
        body: displayBody,
        payload: {
          sid: messageSid,
          messageSid,
          conversationSid,
          ...(chatServiceSid ? { chatServiceSid } : {}),
          fromNumber: toE164(author) ?? author,
          group: true,
          groupMembers,
          ...(media.length ? { media } : {}),
        },
        broker: member.broker ?? alertBroker,
        source: 'twilio',
        dedupe_key: `twilio:${messageSid}:p${member.personId}`,
      },
      { onConflict: 'dedupe_key', ignoreDuplicates: true },
    )
  }

  // Shadow-write ONE inbound message into the conversation model (RC1), keyed on
  // the Twilio Conversation SID with every sms member a participant (contact or
  // raw). Non-fatal. The trigger sets needs_reply + reopens the thread to unread.
  try {
    const { recordConversationMessage } = await import('@/lib/crm/record-message')
    await recordConversationMessage({
      sb, direction: 'in', channel: media.length ? 'mms' : 'sms', body: displayBody,
      providerSid: messageSid, primaryPersonId: match.personId, assignedBroker: alertBroker,
      twilioConversationSid: conversationSid, media: media.length ? media : [],
      participants: shape.smsAddresses.map((addr) => {
        const ten = normalizeTo10(addr)
        const pid = ten ? contactByTen.get(ten) : undefined
        return pid ? { personId: pid, address: addr } : { rawPhone: addr, address: addr }
      }),
    })
  } catch (e) { console.warn('[twilio/conversations-events] conversation shadow-write failed', e) }

  // Surface the author's thread in the triage queue.
  await markConversationUnreadOnInbound(match.personId)

  // STOP/START keywords from the author — same suppression chokepoint as 1:1.
  const firstToken = body.toLowerCase().split(/\s+/)[0] ?? ''
  if (STOP_WORDS.has(firstToken)) {
    await addSuppression({ personId: match.personId, channel: 'sms', reason: 'stop-keyword', source: 'twilio' })
    await sb.from('crm_timeline').upsert(
      {
        person_id: match.personId, kind: 'system',
        title: 'SMS opt-out (STOP, via group text) — sms channel suppressed', source: 'twilio',
        dedupe_key: `twilio-stop:${messageSid}`,
      },
      { onConflict: 'dedupe_key', ignoreDuplicates: true },
    )
    return ok()
  }
  if (START_WORDS.has(firstToken)) {
    await removeSuppression({ personId: match.personId, channel: 'sms', reason: 'stop-keyword' })
    await sb.from('crm_timeline').upsert(
      {
        person_id: match.personId, kind: 'system',
        title: 'SMS opt-in (START, via group text) — sms stop-keyword suppression removed', source: 'twilio',
        dedupe_key: `twilio-start:${messageSid}`,
      },
      { onConflict: 'dedupe_key', ignoreDuplicates: true },
    )
    return ok()
  }

  // New-lead alert only on a real create (a known group texter never re-alerts).
  if (created) {
    await queueBrokerAlert({
      broker: alertBroker,
      personId: match.personId,
      kind: 'new-lead',
      body: newLeadAlertBody({
        name: match.name,
        source: 'inbound-sms',
        stage: 'Lead',
        personId: match.personId,
        detail: `Group text from ${toE164(author) ?? author}: ${body.slice(0, 120)}`,
      }),
    })
  }

  // Alert the owning broker: reply task + email, mirroring the 1:1 path. Upsert
  // on a per-message dedupe_key so a Conversations webhook RETRY can't stack
  // duplicate reply tasks for the same group message.
  await sb.from('crm_tasks').upsert(
    {
      person_id: match.personId,
      name: `Reply to group text from ${match.name ?? author}`,
      type: 'Text',
      due_at: new Date(Date.now() + 15 * 60000).toISOString(),
      assigned_broker: alertBroker,
      origin: 'twilio',
      dedupe_key: `twilio-grouptask:${messageSid}:p${match.personId}`,
    },
    { onConflict: 'dedupe_key', ignoreDuplicates: true },
  )
  const mailbox = CRM_MAILBOXES.find((m) => m.slug === alertBroker) ?? CRM_MAILBOXES[0]
  // AWAITED: a bare void here is dropped when Vercel freezes the invocation on
  // response, so the broker never gets the group-text alert. try/catch keeps a
  // mail failure from 500-ing the webhook (which would make Twilio retry).
  try {
    await sendCrmEmail({
      fromMailbox: mailbox.email,
      to: mailbox.email,
      subject: `New group text from ${match.name ?? author}`,
      bodyText: `${displayBody}\n\nGroup: ${groupMembers.join(', ')}\nFrom ${toE164(author) ?? author}\nOpen the contact: https://ryan-realty.com/admin/crm/${match.personId}`,
    })
  } catch (err) {
    console.error('[conversations-events] alert email failed', err)
  }

  return ok()
}
