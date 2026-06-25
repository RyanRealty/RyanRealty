'use server'

/**
 * CRM newsletter-segment CRUD — the server-action surface over the
 * crm_newsletter_segments config table.
 *
 * Built on makeConfigTable (lib/crm/config-table.ts), the reusable CONFIG-TABLE
 * factory. These actions are the ONLY way the UI mutates newsletter segments:
 * every method is access-guarded (getCrmAccess via the factory) and returns the
 * standard { ok } | { ok:false, error } result.
 *
 * Delete is special: a segment can hold newsletter_subscribers, so
 * deleteCrmNewsletterSegmentAction moves every affected subscriber to a chosen
 * fallback segment FIRST (the factory's reassign callback). The protected segment
 * (general — the coercion fallback) is refused. A failed reassign aborts the
 * delete so no subscriber is ever orphaned on a removed segment.
 *
 * Reads come from the cached DAL (lib/data/crm/getCrmNewsletterSegments);
 * mutations revalidate the admin surfaces so the cache + page refresh.
 */
import { revalidateTag } from 'next/cache'
import { createServiceClient } from '@/lib/supabase/service'
import { getCrmAccess } from '@/app/actions/crm'
import { makeConfigTable, type ConfigResult } from '@/lib/crm/config-table'

const SEGMENTS = makeConfigTable({
  table: 'crm_newsletter_segments',
  revalidatePaths: ['/admin/crm', '/admin/crm/settings', '/admin/newsletter'],
})

/** Drop the cached getCrmNewsletterSegments result after any mutation. */
function bustSegmentCache() {
  revalidateTag('crm-newsletter-segments', 'max')
}

export async function createCrmNewsletterSegmentAction(formData: FormData): Promise<ConfigResult> {
  const label = String(formData.get('label') ?? '').trim()
  // The key is the stable identifier newsletter_subscribers.segment matches.
  // Default it to the label (matches the seed convention) unless one is supplied.
  const key = String(formData.get('key') ?? label).trim()
  if (!label) return { ok: false, error: 'Label is required' }
  const res = await SEGMENTS.create({ key, label })
  if (res.ok) bustSegmentCache()
  return res
}

export async function renameCrmNewsletterSegmentAction(formData: FormData): Promise<ConfigResult> {
  const id = Number(formData.get('id'))
  const label = String(formData.get('label') ?? '').trim()
  if (!id || !label) return { ok: false, error: 'Segment and label are required' }
  const res = await SEGMENTS.rename(id, label)
  if (res.ok) bustSegmentCache()
  return res
}

export async function reorderCrmNewsletterSegmentsAction(orderedIds: number[]): Promise<ConfigResult> {
  if (!Array.isArray(orderedIds) || orderedIds.some((n) => !Number.isFinite(n))) {
    return { ok: false, error: 'Bad order' }
  }
  const res = await SEGMENTS.reorder(orderedIds)
  if (res.ok) bustSegmentCache()
  return res
}

export async function setCrmNewsletterSegmentActiveAction(formData: FormData): Promise<ConfigResult> {
  const id = Number(formData.get('id'))
  const isActive = String(formData.get('isActive') ?? '') === '1'
  if (!id) return { ok: false, error: 'Segment required' }
  const res = await SEGMENTS.setActive(id, isActive)
  if (res.ok) bustSegmentCache()
  return res
}

/**
 * Delete a segment, moving every newsletter_subscribers currently on it to
 * `reassignToKey` first. The reassign runs inside the factory's callback (before
 * the row is removed); if the subscriber-move write fails, the delete is aborted.
 *
 * Refuses if the reassign target is missing or equals the segment being deleted.
 * The factory additionally refuses a protected segment (general).
 */
export async function deleteCrmNewsletterSegmentAction(formData: FormData): Promise<ConfigResult> {
  const id = Number(formData.get('id'))
  const reassignToKey = String(formData.get('reassignToKey') ?? '').trim()
  if (!id) return { ok: false, error: 'Segment required' }
  if (!reassignToKey) return { ok: false, error: 'Pick a segment to move affected subscribers to' }

  const access = await getCrmAccess()
  if (!access) return { ok: false, error: 'Unauthorized' }
  const sb = createServiceClient()
  const { data: target } = await sb
    .from('crm_newsletter_segments')
    .select('key')
    .eq('key', reassignToKey)
    .maybeSingle()
  if (!target) return { ok: false, error: 'Reassign target segment not found' }

  const res = await SEGMENTS.remove(id, async (deleted) => {
    if (deleted.key === reassignToKey) {
      return { ok: false, error: 'Cannot reassign to the segment being deleted' }
    }
    const { error } = await sb
      .from('newsletter_subscribers')
      .update({ segment: reassignToKey, updated_at: new Date().toISOString() })
      .eq('segment', deleted.key)
    if (error) return { ok: false, error: `Could not move subscribers: ${error.message}` }
    return { ok: true }
  })
  if (res.ok) bustSegmentCache()
  return res
}

/** Read passthrough so a settings surface can list segments from one import. */
export async function listCrmNewsletterSegmentsAction() {
  const access = await getCrmAccess()
  if (!access) return []
  return SEGMENTS.list()
}
