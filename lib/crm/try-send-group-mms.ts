import 'server-only'

import { createServiceClient } from '@/lib/supabase/service'
import type { CrmAttachmentRef } from '@/lib/crm/attachment-limits'
import type { CrmBrokerSlug } from '@/lib/crm/constants'
import { decideGroupSmsFallback, GROUP_THREAD_FAILED } from '@/lib/crm/compose-group'

type SendResult = { ok: true } | { ok: false; error: string }

export type GroupSmsAccess = {
  email: string
  role: 'superuser' | 'broker' | 'report_viewer'
  brokerSlug: string | null
}

/**
 * One carrier group thread for 2+ people. Returns a send result when the
 * attempt is finished (sent, or refused so we do not fan out). Returns null
 * when the 1:1 path should continue.
 */
export async function trySendGroupMms(opts: {
  personId: number
  recipientIds: number[]
  rawPhones: string[]
  body: string
  attachments: CrmAttachmentRef[]
  access: GroupSmsAccess
  explicitGroupThread: boolean
  requirePersonInScope: (
    personId: number,
    access: GroupSmsAccess,
  ) => Promise<SendResult>
  revalidate: (personId: number) => void
}): Promise<SendResult | null> {
  if (opts.recipientIds.length + opts.rawPhones.length < 2) return null

  const { getSendTarget } = await import('@/lib/data/crm/getSendTarget')
  const { isSuppressed } = await import('@/lib/crm/suppressions')
  const { renderCrmMerge, attributeSiteLinks } = await import('@/lib/crm/merge')
  const { buildMergeContext } = await import('@/lib/crm/merge-context')
  const { brokerTwilioNumber } = await import('@/lib/crm/twilio')

  const primaryTarget = await getSendTarget(opts.personId)
  const slug =
    opts.access.brokerSlug ??
    (primaryTarget?.person.assigned_broker as CrmBrokerSlug | null) ??
    'matt'
  const proxy = await brokerTwilioNumber(slug)
  if (!proxy || !primaryTarget) {
    return opts.explicitGroupThread ? { ok: false, error: GROUP_THREAD_FAILED } : null
  }

  const members: Array<{ rid: number | null; phone: string }> = []
  for (const rid of opts.recipientIds) {
    if (rid !== opts.personId) {
      const scoped = await opts.requirePersonInScope(rid, opts.access)
      if (!scoped.ok) {
        return opts.explicitGroupThread ? { ok: false, error: GROUP_THREAD_FAILED } : null
      }
    }
    const target = await getSendTarget(rid)
    if (!target?.phone || (await isSuppressed(rid, 'sms')).suppressed) {
      return opts.explicitGroupThread ? { ok: false, error: GROUP_THREAD_FAILED } : null
    }
    members.push({ rid, phone: target.phone })
  }
  for (const e164 of opts.rawPhones) members.push({ rid: null, phone: e164 })
  if (members.length < 2) {
    return opts.explicitGroupThread ? { ok: false, error: GROUP_THREAD_FAILED } : null
  }

  const groupCtx = await buildMergeContext({ person: primaryTarget.person, senderSlug: slug })
  const mergedBody = attributeSiteLinks(
    renderCrmMerge(opts.body, primaryTarget.person, groupCtx),
    slug,
    primaryTarget.person.fub_legacy_id as number | null,
  )
  const { sendGroupMms } = await import('@/lib/crm/twilio-conversations')
  const { loadGroupMedia } = await import('@/lib/crm/attachments')
  const gm = await loadGroupMedia(opts.attachments)
  if (!gm.ok) return gm
  const group = await sendGroupMms({
    projectedAddress: proxy,
    participants: members.map((m) => m.phone),
    body: mergedBody,
    friendlyName: `Group · ${primaryTarget.person.name ?? opts.personId}`,
    media: gm.media,
  })
  if (!group.ok) {
    const fan = decideGroupSmsFallback({
      explicitGroupThread: opts.explicitGroupThread,
      groupFormed: false,
    })
    if (!fan.allowFanOut) return { ok: false, error: fan.error ?? group.error }
    console.warn('[crm] group MMS failed, falling back to broadcast:', group.error)
    return null
  }

  const sb = createServiceClient()
  for (const m of members) {
    if (m.rid === null) continue
    await sb.from('crm_timeline').insert({
      person_id: m.rid,
      kind: 'sms_out',
      title: 'Group text sent',
      body: mergedBody,
      payload: {
        conversationSid: group.conversationSid,
        messageSid: group.messageSid,
        groupTo: members.map((x) => x.phone),
        ...(group.media.length
          ? { sid: group.messageSid, chatServiceSid: group.chatServiceSid, media: group.media }
          : {}),
      },
      broker: slug,
      source: 'app',
      dedupe_key: `twilio:${group.messageSid}:p${m.rid}`,
    })
  }
  try {
    const { recordConversationMessage } = await import('@/lib/crm/record-message')
    await recordConversationMessage({
      sb,
      direction: 'out',
      channel: 'mms',
      body: mergedBody,
      providerSid: group.messageSid,
      sentBy: slug,
      primaryPersonId: opts.personId,
      assignedBroker: slug,
      twilioConversationSid: group.conversationSid,
      conversationSubject: `Group · ${primaryTarget.person.name ?? opts.personId}`,
      media: group.media.length ? group.media : [],
      participants: members.map((m) => ({
        personId: m.rid,
        rawPhone: m.rid === null ? m.phone : null,
        address: m.phone,
      })),
    })
  } catch (e) {
    console.warn('[crm] conversation shadow-write (group) failed', e)
  }
  for (const m of members) {
    if (m.rid !== null) opts.revalidate(m.rid)
  }
  return { ok: true }
}
