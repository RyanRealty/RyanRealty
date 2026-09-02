'use server'

/**
 * Named saved areas — self-management server actions ("My Areas",
 * SEARCH_OPTIMIZATION_PLAN_2026-07-29 §4 Phase 2.4).
 *
 * Auth model (mirrors app/actions/saved-searches.ts): every action resolves
 * the session up front (getSession) and every DAL write carries BOTH the row
 * id AND the session user id, so a user can only ever touch their own rows.
 * setAreaPublic additionally gates on the admin-roles broker check
 * (getAdminRoleForEmail — 'superuser' | 'broker'), the same pattern the admin
 * actions use: publishing an area creates a public SEO landing page at
 * /areas/<slug>, which is a brokerage-authored surface, never consumer-authored.
 *
 * "Save this area from the current drawn shapes" = createArea(name, shapes) —
 * the map picker (later wave) passes its live shape array straight in.
 */

import { revalidatePath, revalidateTag } from 'next/cache'
import { getSession } from '@/app/actions/auth'
import { getAdminRoleForEmail } from '@/app/actions/admin-roles'
import {
  createAreaForUser,
  updateAreaForUser,
  deleteAreaForUser,
  getAreaForUser,
  setAreaPublicById,
  SEARCH_AREAS_CACHE_TAG,
} from '@/lib/data'
import {
  validateAreaName,
  validateAreaShapes,
  validateAreaSlug,
} from '@/lib/data/areas/validation'

export type AreaActionResult = { error: string | null; id?: string }

const AREAS_PATH = '/account/areas'

/** True when the signed-in session belongs to a broker (or the superuser). */
async function isBrokerSession(email: string | null | undefined): Promise<boolean> {
  const role = await getAdminRoleForEmail(email ?? null)
  return role?.role === 'superuser' || role?.role === 'broker'
}

function refreshOwnerViews() {
  revalidatePath(AREAS_PATH)
}

function refreshPublicViews(slug?: string | null) {
  revalidateTag(SEARCH_AREAS_CACHE_TAG, 'max')
  revalidatePath('/areas')
  if (slug) revalidatePath(`/areas/${slug}`)
}

/** Create a named area from a drawn shape set. */
export async function createArea(name: string, shapes: unknown): Promise<AreaActionResult> {
  const session = await getSession()
  if (!session) return { error: 'Not signed in' }

  const validName = validateAreaName(name)
  if (!validName.ok) return { error: validName.error }
  const validShapes = validateAreaShapes(shapes)
  if (!validShapes.ok) return { error: validShapes.error }

  const broker = await isBrokerSession(session.user.email)
  const result = await createAreaForUser({
    userId: session.user.id,
    name: validName.value,
    shapes: validShapes.value,
    ownerKind: broker ? 'broker' : 'user',
  })
  if (!result.ok) return { error: result.error }
  refreshOwnerViews()
  return { error: null, id: result.id }
}

/** Rename an area the signed-in user owns. */
export async function renameArea(id: string, name: string): Promise<AreaActionResult> {
  const session = await getSession()
  if (!session) return { error: 'Not signed in' }
  const validName = validateAreaName(name)
  if (!validName.ok) return { error: validName.error }

  const result = await updateAreaForUser(id, session.user.id, { name: validName.value })
  if (!result.ok) return { error: result.error }
  refreshOwnerViews()
  // A rename of a published area changes its landing page's H1 — refresh it.
  const row = await getAreaForUser(id, session.user.id)
  if (row?.is_public) refreshPublicViews(row.slug)
  return { error: null }
}

/** Delete an area the signed-in user owns. */
export async function deleteArea(id: string): Promise<AreaActionResult> {
  const session = await getSession()
  if (!session) return { error: 'Not signed in' }
  // Capture publish state BEFORE the delete so the public page revalidates.
  const row = await getAreaForUser(id, session.user.id)
  const result = await deleteAreaForUser(id, session.user.id)
  if (!result.ok) return { error: result.error ?? 'Could not delete that area' }
  refreshOwnerViews()
  if (row?.is_public) refreshPublicViews(row.slug)
  return { error: null }
}

/**
 * Publish (or unpublish) an area as a public /areas/<slug> landing page.
 * BROKER-ONLY: gated on admin_roles ('superuser' | 'broker'), and the broker
 * must own the row — brokers publish their own authored areas, not clients'.
 */
export async function setAreaPublic(
  id: string,
  isPublic: boolean,
  slug?: string,
): Promise<AreaActionResult> {
  const session = await getSession()
  if (!session) return { error: 'Not signed in' }
  if (!(await isBrokerSession(session.user.email))) {
    return { error: 'Only brokers can publish an area' }
  }

  const row = await getAreaForUser(id, session.user.id)
  if (!row) return { error: 'Area not found' }

  let cleanSlug: string | null = null
  if (isPublic) {
    const validSlug = validateAreaSlug(slug ?? row.slug ?? '')
    if (!validSlug.ok) return { error: validSlug.error }
    cleanSlug = validSlug.value
  }

  const result = await setAreaPublicById(id, { isPublic, slug: cleanSlug })
  if (!result.ok) return { error: result.error }
  refreshOwnerViews()
  // Refresh the new slug and, on unpublish/rename-slug, the old one.
  refreshPublicViews(cleanSlug)
  if (row.slug && row.slug !== cleanSlug) refreshPublicViews(row.slug)
  return { error: null }
}
