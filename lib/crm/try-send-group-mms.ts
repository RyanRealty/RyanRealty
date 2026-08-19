import 'server-only'

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
 *
 * The Twilio call lives in sendGovernedGroupMms (G56). This file only
 * assembles members, checks broker scope, and decides fan-out.
 */
export async function trySendGroupMms(opts: {
  personId: number
  recipientIds: number[]
  rawPhones: string[]
  body: string
  attachments: CrmAttachmentRef[]
  access: GroupSmsAccess
  explicitGroupThread: boolean
  overrideQuietHours?: boolean
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
  const { loadGroupMedia } = await import('@/lib/crm/attachments')
  const gm = await loadGroupMedia(opts.attachments)
  if (!gm.ok) return gm

  const { sendGovernedGroupMms } = await import('@/lib/comms/sendGovernedGroupMms')
  const group = await sendGovernedGroupMms({
    primaryPersonId: opts.personId,
    members: members.map((m) => ({ personId: m.rid, phone: m.phone })),
    projectedAddress: proxy,
    mergedBody,
    friendlyName: `Group · ${primaryTarget.person.name ?? opts.personId}`,
    media: gm.media,
    purpose: 'crm:manual-group-sms',
    initiator: { kind: 'broker', broker: slug },
    overrideQuietHours: opts.overrideQuietHours,
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

  for (const m of members) {
    if (m.rid !== null) opts.revalidate(m.rid)
  }
  return { ok: true }
}
