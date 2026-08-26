'use server'

/**
 * Studio server actions — the only runtime wiring between the pure pipeline
 * (lib/studio/*) and the outside world (xAI, Supabase).
 *
 * Everything above this file is adapter-injected and unit-testable; this file
 * is where the real generators and the real DAL get bound in. Keeping the
 * binding in one small place is what lets the pipeline be tested without a
 * network and lets the cron reuse the exact same code path Matt's button does.
 */
import { revalidatePath } from 'next/cache'
import { checkAdminAction } from '@/lib/admin/require-admin'
import { produceStudioDraft, type StudioProduceResult } from '@/lib/studio/produce'
import { studioAdapters } from './adapters'
import { approveStudioDraft, killStudioDraft } from '@/lib/data/studio/drafts'
import type { StudioFormatId } from '@/lib/studio/formats'

/** Produce one draft on demand. Lands as ready. Never posts. */
export async function produceStudioDraftAction(input: {
  formatId: string
  subjectQuery?: string
}): Promise<{ error: string | null; draftId?: string }> {
  const auth = await checkAdminAction('content.view')
  if (!auth.ok) return { error: auth.error }

  try {
    const result: StudioProduceResult = await produceStudioDraft(
      {
        formatId: input.formatId as StudioFormatId,
        subjectQuery: input.subjectQuery,
        brokerSlug: auth.ctx.brokerSlug ?? 'matt',
        requestedBy: auth.ctx.email,
        origin: 'console',
      },
      studioAdapters(),
    )
    if (!result.ok) return { error: result.error }
    revalidatePath('/admin/studio')
    return { error: null, draftId: result.draftId }
  } catch (err) {
    console.error('[produceStudioDraftAction]', err)
    return { error: 'Could not produce the draft.' }
  }
}

/**
 * Approve. This is the human stamp of CLAUDE.md §1: it is what authorises a
 * post, and publisher-sweep will pick the row up on its next pass.
 */
export async function approveStudioDraftAction(input: {
  draftId: string
  platforms?: string[]
}): Promise<{ error: string | null }> {
  const auth = await checkAdminAction('content.view')
  if (!auth.ok) return { error: auth.error }

  const result = await approveStudioDraft({
    id: input.draftId,
    approvedBy: auth.ctx.brokerSlug ?? auth.ctx.email,
    platforms: input.platforms,
  })
  if (!result.ok) return { error: result.error }
  revalidatePath('/admin/studio')
  revalidatePath('/admin/approval-queue')
  return { error: null }
}

export async function killStudioDraftAction(input: {
  draftId: string
  reason?: string
}): Promise<{ error: string | null }> {
  const auth = await checkAdminAction('content.view')
  if (!auth.ok) return { error: auth.error }

  const result = await killStudioDraft(input.draftId, input.reason?.trim() || 'Killed from the studio.')
  if (!result.ok) return { error: result.error }
  revalidatePath('/admin/studio')
  return { error: null }
}
