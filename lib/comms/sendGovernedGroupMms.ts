/**
 * sendGovernedGroupMms — compliance + provider chokepoint for one carrier
 * group thread (Jane + Odessa + Nealon on one text, not three one-offs).
 *
 * Guard order matches sendGovernedSms: hard-stop → suppression → quiet hours
 * for every CRM person on the thread. One refused member blocks the send.
 * Raw numbers (no contact) cannot carry STOP state. Then Twilio Conversations.
 */

import 'server-only'
import { createServiceClient } from '@/lib/supabase/service'
import { instrumentSmsLinks } from '@/lib/data/crm/shortLinks'
import { recordConversationMessage } from '@/lib/crm/record-message'
import { sendGroupMms, type GroupMmsMedia } from '@/lib/crm/twilio-conversations'
import { checkSendGuards } from './guards'
import type { GovernedFailure, GovernedInitiator } from './types'

export type GovernedGroupMember = {
  personId: number | null
  phone: string
}

export type GovernedGroupMmsRequest = {
  primaryPersonId: number
  members: GovernedGroupMember[]
  projectedAddress: string
  /** Already merge-rendered by the composer (primary person's tokens). */
  mergedBody: string
  friendlyName: string
  media?: GroupMmsMedia[]
  purpose: string
  initiator: GovernedInitiator
  overrideQuietHours?: boolean
  timelineSource?: string
}

export type GovernedGroupMmsResult =
  | {
      ok: true
      conversationSid: string
      messageSid: string
      chatServiceSid: string | null
      media: Array<{ mediaSid: string; contentType: string }>
    }
  | GovernedFailure
  | { ok: false; error: string; stage: 'provider' }

export async function sendGovernedGroupMms(
  req: GovernedGroupMmsRequest,
): Promise<GovernedGroupMmsResult> {
  const slug = req.initiator.broker ?? 'matt'
  for (const member of req.members) {
    if (member.personId === null) continue
    const refused = await checkSendGuards(member.personId, 'sms', {
      overrideQuietHours: req.overrideQuietHours,
      source: req.purpose,
    })
    if (refused) return refused
  }

  const trackedBody = await instrumentSmsLinks(req.mergedBody, {
    personId: req.primaryPersonId,
    broker: slug,
  })
  const group = await sendGroupMms({
    projectedAddress: req.projectedAddress,
    participants: req.members.map((m) => m.phone),
    body: trackedBody,
    friendlyName: req.friendlyName,
    media: req.media,
  })
  if (!group.ok) return { ok: false, error: group.error, stage: 'provider' }

  const sb = createServiceClient()
  for (const m of req.members) {
    if (m.personId === null) continue
    await sb.from('crm_timeline').insert({
      person_id: m.personId,
      kind: 'sms_out',
      title: 'Group text sent',
      body: req.mergedBody,
      payload: {
        conversationSid: group.conversationSid,
        messageSid: group.messageSid,
        groupTo: req.members.map((x) => x.phone),
        ...(group.media.length
          ? { sid: group.messageSid, chatServiceSid: group.chatServiceSid, media: group.media }
          : {}),
      },
      broker: slug,
      source: req.timelineSource ?? 'app',
      dedupe_key: `twilio:${group.messageSid}:p${m.personId}`,
    })
  }
  try {
    await recordConversationMessage({
      sb,
      direction: 'out',
      channel: 'mms',
      body: req.mergedBody,
      providerSid: group.messageSid,
      sentBy: slug,
      primaryPersonId: req.primaryPersonId,
      assignedBroker: slug,
      twilioConversationSid: group.conversationSid,
      conversationSubject: req.friendlyName,
      media: group.media.length ? group.media : [],
      participants: req.members.map((m) => ({
        personId: m.personId,
        rawPhone: m.personId === null ? m.phone : null,
        address: m.phone,
      })),
    })
  } catch (e) {
    console.warn('[comms] conversation shadow-write (group) failed', e)
  }
  return {
    ok: true,
    conversationSid: group.conversationSid,
    messageSid: group.messageSid,
    chatServiceSid: group.chatServiceSid,
    media: group.media,
  }
}
