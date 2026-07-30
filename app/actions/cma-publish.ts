'use server'

/**
 * Publish / unpublish a CMA to its listing page.
 *
 * Publishing puts our opinion of value on a public page, so it is a two-signal
 * decision (see lib/data/cma/getPublishedCma.ts): a human sets the flag AND the
 * document's own pricing audit passed. This action is the human half, and it
 * re-runs the machine half server-side before every write.
 *
 * THE UI IS NOT THE SECURITY BOUNDARY. `publishCmaToListingAction` refuses any
 * document `isPublishable` would reject even when called directly with a slug,
 * which is exactly what a `'use server'` action is: a public POST endpoint.
 * app/actions/cma-publish.test.ts locks that.
 *
 * Unpublishing is a client-confidentiality control, not a content update. It
 * flips the flag back, and because every delivery re-checks the guard
 * (resolveCmaDocumentByToken), it also kills every download link already handed
 * out. The UI says so.
 */

import { revalidatePath, revalidateTag } from 'next/cache'
import { getSession } from '@/app/actions/auth'
import { getAdminRoleForEmail } from '@/app/actions/admin-roles'
import { getCmaAdminRowBySlug, updateCmaRowFieldsBySlug } from '@/lib/data'
import { cmaPublishRefusals } from '@/app/actions/cma-publish-preconditions'

export type CmaPublishResult = {
  error: string | null
  /** Plain-language reasons, present only when the document was refused. */
  blockers?: string[]
}

async function requirePublisher(): Promise<string | null> {
  const session = await getSession()
  const email = session?.user?.email?.trim() || null
  // No session, no publish. The audit stamp records a real person, so this
  // action never falls back to an anonymous 'admin' the way the older CMA
  // actions do.
  if (!email) return null
  const role = await getAdminRoleForEmail(email)
  if (!role || role.role === 'report_viewer') return null
  return email
}

function refresh(slug: string, listingKey: string | null) {
  revalidatePath('/admin/cmas')
  revalidatePath(`/admin/cmas/${slug}`)
  // The listing-page read is cached under this tag with a 60-second TTL. Busting
  // it makes publish and unpublish take effect on the next request instead of
  // up to a minute later.
  revalidateTag('cma:published', 'max')
  if (listingKey) revalidatePath(`/listing/${listingKey}`)
}

export async function publishCmaToListingAction(slug: string): Promise<CmaPublishResult> {
  try {
    const publisher = await requirePublisher()
    if (!publisher) return { error: 'Unauthorized' }

    const safeSlug = String(slug ?? '').trim().toLowerCase()
    if (!safeSlug) return { error: 'Missing CMA slug' }

    const row = await getCmaAdminRowBySlug(safeSlug)
    if (!row) return { error: 'CMA not found' }

    const reasons = cmaPublishRefusals(row)
    if (reasons.length > 0) {
      return { error: 'This CMA cannot go on a listing page.', blockers: reasons }
    }

    const res = await updateCmaRowFieldsBySlug(safeSlug, {
      published_to_listing: true,
      published_at: new Date().toISOString(),
      published_by: publisher,
    })
    if (!res.ok) return { error: res.error ?? 'Publish failed' }

    refresh(safeSlug, String(row.subject_listing_key ?? '') || null)
    return { error: null }
  } catch (e) {
    console.error('[publishCmaToListingAction]', e)
    return { error: 'Publish failed unexpectedly' }
  }
}

export async function unpublishCmaFromListingAction(slug: string): Promise<CmaPublishResult> {
  try {
    const publisher = await requirePublisher()
    if (!publisher) return { error: 'Unauthorized' }

    const safeSlug = String(slug ?? '').trim().toLowerCase()
    if (!safeSlug) return { error: 'Missing CMA slug' }

    const row = await getCmaAdminRowBySlug(safeSlug)
    if (!row) return { error: 'CMA not found' }

    // No eligibility check on the way DOWN. Taking something off the public web
    // must work from any state, including a document that has since been
    // archived or flagged.
    const res = await updateCmaRowFieldsBySlug(safeSlug, {
      published_to_listing: false,
      published_at: null,
      published_by: null,
    })
    if (!res.ok) return { error: res.error ?? 'Unpublish failed' }

    refresh(safeSlug, String(row.subject_listing_key ?? '') || null)
    return { error: null }
  } catch (e) {
    console.error('[unpublishCmaFromListingAction]', e)
    return { error: 'Unpublish failed unexpectedly' }
  }
}
