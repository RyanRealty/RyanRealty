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
