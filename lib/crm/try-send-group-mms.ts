import 'server-only'

import type { CrmAttachmentRef } from '@/lib/crm/attachment-limits'
import type { CrmBrokerSlug } from '@/lib/crm/constants'
import {
  decideGroupSmsFallback,
  GROUP_THREAD_FALLBACK_NOTICE,
  GROUP_THREAD_FAILED,
} from '@/lib/crm/compose-group'

type SendResult = { ok: true } | { ok: false; error: string }

export type GroupSmsAccess = {
  email: string
  role: 'superuser' | 'broker' | 'report_viewer'
  brokerSlug: string | null
}

/**
 * Outcome of a group-thread attempt from the CRM composer.
 * - sent: carrier group delivered
 * - failed: hard stop (do not fan out) — reserved; prefer fallback
 * - fallback: group did not form; caller must 1:1 with notice
 * - continue: not a multi-recipient send (or legacy path continues without notice)
 */
export type GroupSmsAttempt =
  | { status: 'sent' }
  | { status: 'failed'; error: string }
  | { status: 'fallback'; notice: string }
  | { status: 'continue' }

/**
 * One carrier group thread for 2+ people.
 *
 * Broker manual compose skips SMS consent / STOP / marketing-opt-in gates
 * (those are bulk-only). Quiet hours still apply via sendGovernedGroupMms.
 * If the carrier group cannot form, return fallback so the composer texts
 * each person — never silent zero-send.
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
  /** Broker compose: skip consent/STOP suppressions (bulk-only). */
  skipSuppression?: boolean
  requirePersonInScope: (
    personId: number,
    access: GroupSmsAccess,
  ) => Promise<SendResult>
  revalidate: (personId: number) => void
}): Promise<GroupSmsAttempt> {
  if (opts.recipientIds.length + opts.rawPhones.length < 2) return { status: 'continue' }

  const { getSendTarget } = await import('@/lib/data/crm/getSendTarget')
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
    return opts.explicitGroupThread
      ? { status: 'fallback', notice: GROUP_THREAD_FALLBACK_NOTICE }
      : { status: 'continue' }
  }

  const members: Array<{ rid: number | null; phone: string }> = []
  for (const rid of opts.recipientIds) {
    if (rid !== opts.personId) {
      const scoped = await opts.requirePersonInScope(rid, opts.access)
      if (!scoped.ok) {
        // Skip out-of-scope extras; still try group/fan-out with the rest.
        continue
      }
    }
    const target = await getSendTarget(rid)
    if (!target?.phone) continue
    // Consent / STOP / opt-in: bulk-only. Manual compose does not drop members
    // for crm_suppressions (skipSuppression). Phone presence is enough here.
    members.push({ rid, phone: target.phone })
  }
  for (const e164 of opts.rawPhones) members.push({ rid: null, phone: e164 })
  if (members.length < 2) {
    return opts.explicitGroupThread
      ? { status: 'fallback', notice: GROUP_THREAD_FALLBACK_NOTICE }
      : { status: 'continue' }
  }

  const groupCtx = await buildMergeContext({ person: primaryTarget.person, senderSlug: slug })
  const mergedBody = attributeSiteLinks(
    renderCrmMerge(opts.body, primaryTarget.person, groupCtx),
    slug,
    null,
    opts.personId,
  )
  const { loadGroupMedia } = await import('@/lib/crm/attachments')
  const gm = await loadGroupMedia(opts.attachments)
  if (!gm.ok) return { status: 'failed', error: gm.error }

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
    skipSuppression: opts.skipSuppression === true,
  })
  if (!group.ok) {
    const fan = decideGroupSmsFallback({
      explicitGroupThread: opts.explicitGroupThread,
      groupFormed: false,
    })
    if (fan.allowFanOut) {
      console.warn('[crm] group MMS failed, falling back to 1:1:', group.error)
      // Explicit group compose: truthful notice. Legacy multi-recipient: continue
      // silently into the existing 1:1 loop (no new toast copy).
      if (opts.explicitGroupThread) {
        return {
          status: 'fallback',
          notice: fan.notice ?? GROUP_THREAD_FALLBACK_NOTICE,
        }
      }
      return { status: 'continue' }
    }
    return { status: 'failed', error: fan.error ?? group.error ?? GROUP_THREAD_FAILED }
  }

  for (const m of members) {
    if (m.rid !== null) opts.revalidate(m.rid)
  }
  return { status: 'sent' }
}
