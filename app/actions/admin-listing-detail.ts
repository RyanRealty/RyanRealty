'use server'

import { getSession } from '@/app/actions/auth'
import { getAdminRoleForEmail } from '@/app/actions/admin-roles'
import { logAdminAction } from '@/app/actions/log-admin-action'
import {
  getAdminEditableListingRow,
  updateAdminEditableListingRow,
  getListingPhotosForKey,
  appendListingPhoto,
  deleteListingPhoto as deletePhotoDAL,
  setListingHeroPhoto as setHeroDAL,
  reorderListingPhotos as reorderPhotosDAL,
  type AdminListingPhotoRow,
  type AdminListingDetailsJson,
} from '@/lib/data'

type ListingPhotoRow = AdminListingPhotoRow

export type AdminListingEditable = {
  listingKey: string
  listPrice: number | null
  standardStatus: string | null
  publicRemarks: string | null
  adminNotes: string | null
  marketingHeadline: string | null
  featured: boolean
  photos: ListingPhotoRow[]
}

type ListingDetailsJson = AdminListingDetailsJson

async function requireSuperuser() {
  const session = await getSession()
  const adminRole = await getAdminRoleForEmail(session?.user?.email ?? null)
  if (adminRole?.role !== 'superuser') {
    return { ok: false as const, error: 'Only superuser can edit listings.', adminEmail: '', role: null as string | null }
  }
  return { ok: true as const, adminEmail: session?.user?.email ?? '', role: adminRole.role }
}

function normalizeListingKey(key: string) {
  return String(key ?? '').trim()
}

export async function getAdminListingEditableData(listingKey: string): Promise<AdminListingEditable | null> {
  const key = normalizeListingKey(listingKey)
  if (!key) return null

  const listing = await getAdminEditableListingRow(key)
  if (!listing) return null

  const resolvedKey = listing.ListingKey || listing.ListNumber || key
  const details = (listing.details ?? {}) as ListingDetailsJson
  const overrides = details.admin_overrides ?? {}
  const photos = await getListingPhotosForKey(resolvedKey)

  return {
    listingKey: resolvedKey,
    listPrice: listing.ListPrice ?? null,
    standardStatus: listing.StandardStatus ?? null,
    publicRemarks: typeof details.PublicRemarks === 'string' ? details.PublicRemarks : null,
    adminNotes: typeof overrides.admin_notes === 'string' ? overrides.admin_notes : null,
    marketingHeadline: typeof overrides.marketing_headline === 'string' ? overrides.marketing_headline : null,
    featured: overrides.featured === true,
    photos,
  }
}

export async function updateAdminListingEditableData(input: {
  listingKey: string
  listPrice: number | null
  standardStatus: string | null
  publicRemarks: string | null
  adminNotes: string | null
  marketingHeadline: string | null
  featured: boolean
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const access = await requireSuperuser()
  if (!access.ok) return { ok: false, error: access.error }

  const listing = await getAdminEditableListingRow(input.listingKey)
  if (!listing) return { ok: false, error: 'Listing not found.' }

  const details = (listing.details ?? {}) as ListingDetailsJson
  const nextDetails: ListingDetailsJson = {
    ...details,
    PublicRemarks: input.publicRemarks?.trim() || undefined,
    admin_overrides: {
      ...(details.admin_overrides ?? {}),
      admin_notes: input.adminNotes?.trim() || null,
      marketing_headline: input.marketingHeadline?.trim() || null,
      featured: input.featured,
    },
  }

  const key = listing.ListingKey || listing.ListNumber || normalizeListingKey(input.listingKey)
  const res = await updateAdminEditableListingRow(key, {
    ListPrice: input.listPrice,
    StandardStatus: input.standardStatus,
    details: nextDetails,
  })
  if (!res.ok) return { ok: false, error: res.error ?? 'update failed' }

  await logAdminAction({
    adminEmail: access.adminEmail,
    role: access.role,
    actionType: 'update',
    resourceType: 'listing',
    resourceId: key,
    details: {
      list_price: input.listPrice,
      standard_status: input.standardStatus ?? null,
      featured: input.featured,
    },
  })
  return { ok: true }
}

export async function addAdminListingPhoto(input: {
  listingKey: string
  photoUrl: string
  caption?: string | null
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const access = await requireSuperuser()
  if (!access.ok) return { ok: false, error: access.error }

  const key = normalizeListingKey(input.listingKey)
  const url = input.photoUrl.trim()
  if (!key || !url) return { ok: false, error: 'Listing key and photo URL are required.' }

  const res = await appendListingPhoto({ listingKey: key, photoUrl: url, caption: input.caption })
  if (!res.ok) return { ok: false, error: res.error ?? 'insert failed' }

  await logAdminAction({
    adminEmail: access.adminEmail,
    role: access.role,
    actionType: 'create',
    resourceType: 'listing_photo',
    resourceId: key,
    details: { photo_url: url },
  })
  return { ok: true }
}

export async function deleteAdminListingPhoto(input: {
  listingKey: string
  photoId: string
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const access = await requireSuperuser()
  if (!access.ok) return { ok: false, error: access.error }

  const res = await deletePhotoDAL({
    listingKey: normalizeListingKey(input.listingKey),
    photoId: input.photoId,
  })
  if (!res.ok) return { ok: false, error: res.error ?? 'delete failed' }

  await logAdminAction({
    adminEmail: access.adminEmail,
    role: access.role,
    actionType: 'delete',
    resourceType: 'listing_photo',
    resourceId: input.photoId,
    details: { listing_key: input.listingKey },
  })
  return { ok: true }
}

export async function setAdminListingHeroPhoto(input: {
  listingKey: string
  photoId: string
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const access = await requireSuperuser()
  if (!access.ok) return { ok: false, error: access.error }

  const key = normalizeListingKey(input.listingKey)
  const res = await setHeroDAL({ listingKey: key, photoId: input.photoId })
  if (!res.ok) return { ok: false, error: res.error ?? 'set-hero failed' }

  await logAdminAction({
    adminEmail: access.adminEmail,
    role: access.role,
    actionType: 'update',
    resourceType: 'listing_photo',
    resourceId: input.photoId,
    details: { listing_key: key, set_hero: true },
  })
  return { ok: true }
}

export async function reorderAdminListingPhotos(input: {
  listingKey: string
  orderedPhotoIds: string[]
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const access = await requireSuperuser()
  if (!access.ok) return { ok: false, error: access.error }
  if (input.orderedPhotoIds.length === 0) return { ok: true }

  const key = normalizeListingKey(input.listingKey)
  const res = await reorderPhotosDAL({ listingKey: key, orderedPhotoIds: input.orderedPhotoIds })
  if (!res.ok) return { ok: false, error: res.error ?? 'reorder failed' }

  await logAdminAction({
    adminEmail: access.adminEmail,
    role: access.role,
    actionType: 'update',
    resourceType: 'listing_photo',
    resourceId: key,
    details: { reordered_count: input.orderedPhotoIds.length },
  })
  return { ok: true }
}
