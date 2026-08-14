'use server'

/**
 * Today (P9 roll:today) — thin wrappers over the existing CRM actions so every
 * mutation made from /admin/today revalidates THIS surface. The underlying
 * actions keep their own auth (requireCrmAccess/scope) — nothing is re-implemented.
 */
import { revalidatePath } from 'next/cache'
import {
  confirmNextStepAction,
  skipNextStepAction,
  dismissTriageItemAction,
  completeCrmTaskAction,
  sendCrmSmsAction,
} from '@/app/actions/crm'
import { checkAdminAction } from '@/lib/admin/require-admin'
import { generateBannerImage } from '@/lib/grok-image'
import { generateImageToVideo } from '@/lib/grok-video'
import { getMarketPulse } from '@/lib/data/market/getMarketPulse'
import {
  findLiveListingForImagine,
  insertImagineDraftPending,
  killImagineDraft,
  markImagineDraftReady,
  storeImagineMedia,
} from '@/lib/data/social/imagine-drafts'
import { produceImagineDraft, type ImagineProduceAdapters } from '@/lib/social/imagine-produce'
import { approveNowAction } from '../approval-queue/actions'

export async function confirmParkedStepToday(formData: FormData): Promise<void> {
  const id = Number(formData.get('enrollmentId'))
  await confirmNextStepAction(id)
  revalidatePath('/admin/today')
}

export async function skipParkedStepToday(formData: FormData): Promise<void> {
  const id = Number(formData.get('enrollmentId'))
  await skipNextStepAction(id)
  revalidatePath('/admin/today')
}

export async function dismissTriageToday(formData: FormData): Promise<void> {
  await dismissTriageItemAction({
    personId: Number(formData.get('personId')),
    kind: String(formData.get('kind') ?? ''),
    taskId: formData.get('taskId') ? Number(formData.get('taskId')) : null,
  })
  revalidatePath('/admin/today')
}

export async function completeTaskToday(formData: FormData): Promise<void> {
  await completeCrmTaskAction(formData)
  revalidatePath('/admin/today')
}

/**
 * Today inbound Yes-path. Matt's tap is the stamp. Routes through the existing
 * composer action → sendGovernedSms. Never Twilio-direct. Never quiet-hours override.
 */
export async function sendTodayInboundReply(formData: FormData): Promise<{ error: string | null }> {
  const auth = await checkAdminAction('today.view')
  if (!auth.ok) return { error: auth.error }
  const personId = Number(formData.get('personId'))
  const body = String(formData.get('body') ?? '').trim()
  if (!Number.isFinite(personId) || personId <= 0 || !body) {
    return { error: 'A contact and message are required.' }
  }
  try {
    const sendData = new FormData()
    sendData.set('personId', String(personId))
    sendData.set('body', body)
    const idempotencyKey = String(formData.get('idempotencyKey') ?? '').trim()
    if (idempotencyKey) sendData.set('idempotencyKey', idempotencyKey)
    const sent = await sendCrmSmsAction(sendData)
    if (!sent.ok) return { error: sent.error }
    const dismissed = await dismissTriageItemAction({ personId, kind: 'reply' })
    if (!dismissed.ok) {
      console.error('[sendTodayInboundReply]', dismissed.error)
    }
    revalidatePath('/admin/today')
    return { error: null }
  } catch (err) {
    console.error('[sendTodayInboundReply]', err)
    return { error: 'Could not send the text.' }
  }
}

async function downloadImagineUrl(url: string): Promise<Buffer> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Failed to download Imagine output: ${res.status}`)
  return Buffer.from(await res.arrayBuffer())
}

function todayImagineAdapters(): ImagineProduceAdapters {
  return {
    generateImageToVideo,
    generateBannerImage,
    downloadUrl: downloadImagineUrl,
    storeMedia: storeImagineMedia,
    findLiveListing: findLiveListingForImagine,
    getPulse: () => getMarketPulse({ geoType: 'region', geoSlug: 'central-oregon' }),
    insertPending: insertImagineDraftPending,
    markReady: markImagineDraftReady,
    killDraft: killImagineDraft,
  }
}

/**
 * Today Yes on a ready content draft. Matt's tap is the stamp.
 * Reuses approveNowAction (same stamp as /admin/approval-queue).
 * Does not publish. Does not send SMS.
 */
export async function approveReadyDraftToday(
  formData: FormData,
): Promise<{ error: string | null }> {
  const auth = await checkAdminAction('today.view')
  if (!auth.ok) return { error: auth.error }
  const actionId = String(formData.get('actionId') ?? '').trim()
  if (!actionId) return { error: 'A draft is required.' }
  try {
    const result = await approveNowAction(actionId)
    if (result.error) return { error: result.error }
    revalidatePath('/admin/today')
    return { error: null }
  } catch (err) {
    console.error('[approveReadyDraftToday]', err)
    return { error: 'Could not approve the draft.' }
  }
}

/** G2: Imagine produce → ready draft on Today. Does not stamp yes. Does not post. */
export async function produceImagineDraftToday(input: {
  kind: string
  query: string
}): Promise<{ error: string | null; draftId?: string }> {
  const auth = await checkAdminAction('today.view')
  if (!auth.ok) return { error: auth.error }
  const kind = input.kind === 'gbp' ? 'gbp' : 'listing'
  try {
    const result = await produceImagineDraft(
      {
        kind,
        query: input.query,
        brokerSlug: auth.ctx.brokerSlug ?? 'matt',
        requestedBy: auth.ctx.email,
      },
      todayImagineAdapters(),
    )
    if (!result.ok) return { error: result.error }
    revalidatePath('/admin/today')
    revalidatePath('/admin/approval-queue')
    return { error: null, draftId: result.draftId }
  } catch (err) {
    console.error('[produceImagineDraftToday]', err)
    return { error: 'Could not produce the draft.' }
  }
}
