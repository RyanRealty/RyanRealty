'use server'

/**
 * Server actions for the photo/video curation board (`/admin/photos`).
 *
 * Reads happen in the page (inline service client). Writes go through here so
 * they can be guarded by admin role, validated against the asset_library
 * `approval` CHECK constraint, and revalidate the `assets` cache tag that
 * getGeoTileImages / getSurfaceImage depend on — so an approval flips the live
 * site imagery on the next request.
 */

import { revalidatePath, updateTag } from 'next/cache'
import { createServiceClient } from '@/lib/supabase/service'
import { cacheTag } from '@/lib/data/cache/unstable-cache'
import { getSession } from '@/app/actions/auth'
import { getAdminRoleForEmail } from '@/app/actions/admin-roles'

const APPROVALS = new Set(['approved', 'rejected', 'intake'])
const SURFACES = new Set(['hero', 'card'])

export type CurationPatch = {
  approval?: 'approved' | 'rejected' | 'intake'
  surfaceTags?: string[]
  geoTags?: string[]
}

async function requireAdmin(): Promise<void> {
  const session = await getSession()
  if (!session?.user?.email) throw new Error('Not authenticated')
  const role = await getAdminRoleForEmail(session.user.email)
  if (!role) throw new Error('Not authorized')
}

/**
 * Apply a curation patch to one or more assets. Returns the number updated.
 * Only the fields present in `patch` are written.
 */
export async function curateAssets(
  ids: string[],
  patch: CurationPatch,
): Promise<{ updated: number }> {
  await requireAdmin()

  const cleanIds = (ids ?? []).filter((id) => typeof id === 'string' && id.length > 0)
  if (cleanIds.length === 0) return { updated: 0 }

  const update: Record<string, unknown> = {}
  if (patch.approval) {
    if (!APPROVALS.has(patch.approval)) throw new Error(`invalid approval: ${patch.approval}`)
    update.approval = patch.approval
  }
  if (patch.surfaceTags) {
    update.surface_tags = patch.surfaceTags.filter((s) => SURFACES.has(s))
  }
  if (patch.geoTags) {
    update.geo_tags = patch.geoTags.map((g) => g.trim().toLowerCase()).filter(Boolean)
  }
  if (Object.keys(update).length === 0) return { updated: 0 }

  const sb = createServiceClient()
  const { data, error } = await sb
    .from('asset_library')
    .update(update)
    .in('id', cleanIds)
    .select('id')
  if (error) throw new Error(`curateAssets failed: ${error.message}`)

  // updateTag = read-your-own-writes: expires the `assets` tag (getGeoTileImages /
  // getSurfaceImage) immediately so an approval shows on the next site request.
  updateTag(cacheTag.assets)
  revalidatePath('/admin/photos')
  return { updated: data?.length ?? 0 }
}
