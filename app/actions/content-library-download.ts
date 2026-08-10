'use server'

import { requireAdminAction } from '@/lib/admin/require-admin'
import { getBrokerSelfRecordByEmail } from '@/lib/data'
import { signDeliverableDownload } from '@/lib/marketing-brain/deliverable-library'

/**
 * On-demand signed download for the content library (P12 chrome debt).
 * Replaces signing every row at page render.
 */
export async function signDeliverableForDownload(input: {
  actionId: string
  filename: string
}): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  try {
    const ctx = await requireAdminAction('content.view')
    const broker = (await getBrokerSelfRecordByEmail(ctx.email)) as { slug?: string } | null
    const brokerSlug = broker?.slug
    if (!brokerSlug) return { ok: false, error: 'No broker record for this login' }
    const url = await signDeliverableDownload(brokerSlug, input.actionId, input.filename)
    if (!url) return { ok: false, error: 'Sign failed' }
    return { ok: true, url }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Sign failed' }
  }
}
