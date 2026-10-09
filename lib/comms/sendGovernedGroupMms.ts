/**
 * sendGovernedGroupMms — compliance + provider chokepoint for one carrier
 * group thread (Jane + Odessa + Nealon on one text, not three one-offs).
 *
 * Guard order matches sendGovernedSms: hard-stop → suppression → quiet hours
 * for every CRM person on the thread. One refused member blocks the send.
 * Raw numbers (no contact) cannot carry STOP state, but quiet hours hold them:
 * every number's own zone counts, as well as Pacific (Matt 2026-10-04). Then
 * Twilio Conversations.
 */

import 'server-only'
import { createServiceClient } from '@/lib/supabase/service'
import { instrumentSmsLinks } from '@/lib/data/crm/shortLinks'
import { recordConversationMessage } from '@/lib/crm/record-message'
import { sendGroupMms, type GroupMmsMedia } from '@/lib/crm/twilio-conversations'
import { recordSendBlockEvent } from '@/lib/data/crm/recordSendBlockEvent'
import { checkSendGuards, quietHoursRefusal } from './guards'
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
  /** Broker CRM compose: skip consent/STOP (bulk-only). */
  skipSuppression?: boolean
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

/**
 * The quiet-hours hold for a thread: the first number on it that is quiet in
 * Pacific or its own zone, written to the send-block ledger, else null. One
 * held number holds the whole thread (Matt 2026-10-04: a group text waits). A
 * raw number has no person, so its hold is filed on the thread's primary
 * person with the reason 'raw-member', never as that person's own number.
 * Exported for the composer's group attempt, which must ask before it may
 * fall back to one-to-one texts.
 */
export function groupQuietHold(
  members: GovernedGroupMember[],
  primaryPersonId: number,
  source?: string,
  now: Date = new Date(),
): GovernedFailure | null {
  for (const member of members) {
    const error = quietHoursRefusal(member.phone, now)
    if (!error) continue
    void recordSendBlockEvent({
      personId: member.personId ?? primaryPersonId,
      channel: 'sms',
      stage: 'quiet-hours',
      reasons: member.personId === null ? ['quiet-hours', 'raw-member'] : ['quiet-hours'],
      source,
    })
    return { ok: false, error, stage: 'quiet-hours' }
  }
  return null
}

export async function sendGovernedGroupMms(
  req: GovernedGroupMmsRequest,
): Promise<GovernedGroupMmsResult> {
  const slug = req.initiator.broker ?? 'matt'
  for (const member of req.members) {
    if (member.personId === null) continue
    const refused = await checkSendGuards(member.personId, 'sms', {
      overrideQuietHours: req.overrideQuietHours,
      source: req.purpose,
      skipSuppression: req.skipSuppression,
      recipientPhone: member.phone,
    })
    if (refused) return refused
  }
  // A raw number has no person to suppress, but its zone still holds the thread.
  if (!req.overrideQuietHours) {
    const rawHold = groupQuietHold(req.members.filter((m) => m.personId === null), req.primaryPersonId, req.purpose)
    if (rawHold) return rawHold
  }

  const trackedBody = await instrumentSmsLinks(req.mergedBody, {
    personId: req.primaryPersonId,
    broker: slug,
  })
  // Quiet hours again at the POST, for every number on the thread: the guards
  // above can pass at 7:59pm and the send land after 8pm. Suppression was read
  // per member; only the clock moves. One quiet zone holds the whole thread.
  if (!req.overrideQuietHours) {
    const late = groupQuietHold(req.members, req.primaryPersonId, req.purpose)
    if (late) return late
  }
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
  try {
    const { fileCommsToVault } = await import('@/lib/tc/file-comms-write')
    const personIds = req.members
      .map((m) => m.personId)
      .filter((id): id is number => typeof id === 'number' && id > 0)
    await fileCommsToVault({
      personIds,
      channel: 'sms',
      actor: `crm:${slug}`,
      title: 'Group text sent',
      body: req.mergedBody,
      filenames: group.media.map((m) => m.contentType),
      dedupeKey: `sms-out:${group.messageSid}`,
    })
  } catch (e) {
    console.warn('[comms] vault auto-file (group) failed', e)
  }
  return {
    ok: true,
    conversationSid: group.conversationSid,
    messageSid: group.messageSid,
    chatServiceSid: group.chatServiceSid,
    media: group.media,
  }
}
