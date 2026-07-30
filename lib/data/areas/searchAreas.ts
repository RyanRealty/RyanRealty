import 'server-only'
import { unstable_cache } from 'next/cache'
import { makeResilientCached } from '@/lib/data/cache/resilient'
import { createServiceClient } from '@/lib/supabase/service'
import type { AreaShape } from '@/lib/data/areas/validation'

/**
 * DAL for public.search_areas — named saved map areas ("My Areas", Flexmls
 * My-Map-Overlays parity; SEARCH_OPTIMIZATION_PLAN_2026-07-29 §4 Phase 2.4).
 *
 * Migration: supabase/migrations/20260730021000_named_areas.sql. shapes is a
 * jsonb array of {type: polygon|circle, ..., exclude?} objects; geom is
 * trigger-maintained and NEVER selected here (the app consumes raw shapes).
 *
 * Writes go through the service client with an EXPLICIT owner check on every
 * user-scoped call (id + user_id in the same WHERE — same discipline as
 * lib/data/leads/listingAlerts.ts). RLS on the table is defense-in-depth.
 *
 * Caching: PUBLIC reads only (listPublicAreas / getPublicAreaBySlug) wrap in
 * unstable_cache on the 'search-areas' tag. Owner reads are uncached — a user
 * must see their own create/rename/delete instantly.
 */

const TABLE = 'search_areas'

export type SearchAreaOwnerKind = 'user' | 'broker'

export type SearchAreaRow = {
  id: string
  owner_user_id: string | null
  owner_kind: SearchAreaOwnerKind
  name: string
  slug: string | null
  shapes: AreaShape[]
  is_public: boolean
  created_at: string
  updated_at: string
}

/** Everything except geom (trigger-maintained; app never reads it). */
const ROW_COLS = 'id, owner_user_id, owner_kind, name, slug, shapes, is_public, created_at, updated_at'

export const SEARCH_AREAS_CACHE_TAG = 'search-areas'

type WriteResult = { ok: true; id: string } | { ok: false; error: string }

/** Postgres unique_violation → friendly message; anything else passes through. */
function mapWriteError(error: { code?: string; message: string }): string {
  if (error.code === '23505') {
    if (error.message.includes('search_areas_slug_key')) {
      return 'That URL slug is already taken.'
    }
    return 'You already have an area with that name.'
  }
  // The geom trigger raises with a clear message on malformed shapes.
  if (error.message.includes('search_areas.shapes')) return error.message
  return 'Could not save that area. Please try again.'
}

// ── Owner-scoped reads (uncached) ───────────────────────────────────────────

/** All areas the signed-in user owns, most recently updated first. */
export async function listAreasForUser(userId: string): Promise<SearchAreaRow[]> {
  const uid = (userId ?? '').trim()
  if (!uid) return []
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from(TABLE)
    .select(ROW_COLS)
    .eq('owner_user_id', uid)
    .order('updated_at', { ascending: false })
  if (error) {
    console.error('[listAreasForUser]', error.message)
    return []
  }
  return (data ?? []) as SearchAreaRow[]
}

/** One area, only when the given user owns it. */
export async function getAreaForUser(id: string, userId: string): Promise<SearchAreaRow | null> {
  const areaId = (id ?? '').trim()
  const uid = (userId ?? '').trim()
  if (!areaId || !uid) return null
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from(TABLE)
    .select(ROW_COLS)
    .eq('id', areaId)
    .eq('owner_user_id', uid)
    .maybeSingle()
  if (error) {
    console.error('[getAreaForUser]', error.message)
    return null
  }
  return (data as SearchAreaRow | null) ?? null
}

/**
 * Areas by id, no owner scope — the ALERT ENGINE's read (an alert's
 * filters.areaIds must resolve even when the run isn't the owner's session)
 * and the ?areas= search-link resolver. Callers must treat non-public rows
 * as private data: never render a foreign owner's area name to another user.
 */
export async function getAreasByIds(ids: string[]): Promise<SearchAreaRow[]> {
  const clean = Array.from(new Set((ids ?? []).map((v) => (v ?? '').trim()).filter(Boolean))).slice(0, 50)
  if (clean.length === 0) return []
  const supabase = createServiceClient()
  const { data, error } = await supabase.from(TABLE).select(ROW_COLS).in('id', clean)
  if (error) {
    console.error('[getAreasByIds]', error.message)
    return []
  }
  return (data ?? []) as SearchAreaRow[]
}

// ── Owner-scoped writes ─────────────────────────────────────────────────────

export type CreateAreaInput = {
  userId: string
  name: string
  shapes: AreaShape[]
  ownerKind?: SearchAreaOwnerKind
}

export async function createAreaForUser(input: CreateAreaInput): Promise<WriteResult> {
  const uid = (input.userId ?? '').trim()
  if (!uid) return { ok: false, error: 'Not signed in' }
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from(TABLE)
    .insert({
      owner_user_id: uid,
      owner_kind: input.ownerKind ?? 'user',
      name: input.name,
      shapes: input.shapes,
    })
    .select('id')
    .single()
  if (error) {
    console.error('[createAreaForUser]', error.message)
    return { ok: false, error: mapWriteError(error) }
  }
  return { ok: true, id: (data as { id: string }).id }
}

export type UpdateAreaPatch = {
  name?: string
  shapes?: AreaShape[]
}

export async function updateAreaForUser(
  id: string,
  userId: string,
  patch: UpdateAreaPatch,
): Promise<WriteResult> {
  const areaId = (id ?? '').trim()
  const uid = (userId ?? '').trim()
  if (!areaId || !uid) return { ok: false, error: 'Area not found' }
  const update: Record<string, unknown> = {}
  if (patch.name !== undefined) update.name = patch.name
  if (patch.shapes !== undefined) update.shapes = patch.shapes
  if (Object.keys(update).length === 0) return { ok: true, id: areaId }
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from(TABLE)
    .update(update)
    .eq('id', areaId)
    .eq('owner_user_id', uid)
    .select('id')
    .maybeSingle()
  if (error) {
    console.error('[updateAreaForUser]', error.message)
    return { ok: false, error: mapWriteError(error) }
  }
  if (!data) return { ok: false, error: 'Area not found' }
  return { ok: true, id: areaId }
}

export async function deleteAreaForUser(id: string, userId: string): Promise<{ ok: boolean; error?: string }> {
  const areaId = (id ?? '').trim()
  const uid = (userId ?? '').trim()
  if (!areaId || !uid) return { ok: false, error: 'Area not found' }
  const supabase = createServiceClient()
  const { error } = await supabase.from(TABLE).delete().eq('id', areaId).eq('owner_user_id', uid)
  if (error) {
    console.error('[deleteAreaForUser]', error.message)
    return { ok: false, error: 'Could not delete that area' }
  }
  return { ok: true }
}

/**
 * Publish / unpublish an area as a public landing surface. NO role check
 * here — the caller (app/actions/search-areas.ts setAreaPublic) is the broker
 * gate, and it has already verified ownership. Publishing stamps
 * owner_kind='broker' (the table CHECK requires it) and requires a slug;
 * unpublishing clears the slug so the URL is freed.
 */
export async function setAreaPublicById(
  id: string,
  args: { isPublic: boolean; slug?: string | null },
): Promise<WriteResult> {
  const areaId = (id ?? '').trim()
  if (!areaId) return { ok: false, error: 'Area not found' }
  const update: Record<string, unknown> = args.isPublic
    ? { is_public: true, slug: (args.slug ?? '').trim() || null, owner_kind: 'broker' }
    : { is_public: false, slug: null }
  if (args.isPublic && !update.slug) return { ok: false, error: 'A public area needs a URL slug.' }
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from(TABLE)
    .update(update)
    .eq('id', areaId)
    .select('id')
    .maybeSingle()
  if (error) {
    console.error('[setAreaPublicById]', error.message)
    return { ok: false, error: mapWriteError(error) }
  }
  if (!data) return { ok: false, error: 'Area not found' }
  return { ok: true, id: areaId }
}

// ── Public reads (cached) ───────────────────────────────────────────────────

async function fetchPublicAreas(): Promise<SearchAreaRow[]> {
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from(TABLE)
    .select(ROW_COLS)
    .eq('is_public', true)
    .not('slug', 'is', null)
    .order('name', { ascending: true })
  if (error) {
    // THROW so a transient DB error is never cached as "no public areas" for
    // the whole TTL — makeResilientCached serves the last good value instead.
    throw new Error(`[listPublicAreas] ${error.message}`)
  }
  return (data ?? []) as SearchAreaRow[]
}

/** All broker-published areas (the /areas landing surfaces). Cached 300s,
 *  resilient: transient errors serve the last good list, never a cached []. */
export const listPublicAreas = makeResilientCached(
  fetchPublicAreas,
  ['search-areas-public-list-v1'],
  { revalidate: 300, tags: [SEARCH_AREAS_CACHE_TAG] },
  [] as SearchAreaRow[],
)

async function fetchPublicAreaBySlug(slug: string): Promise<SearchAreaRow | null> {
  const clean = (slug ?? '').trim().toLowerCase()
  if (!clean) return null
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from(TABLE)
    .select(ROW_COLS)
    .eq('slug', clean)
    .eq('is_public', true)
    .maybeSingle()
  if (error) {
    // THROW (never cache a poison null) — resilient wrapper serves last good.
    throw new Error(`[getPublicAreaBySlug] ${error.message}`)
  }
  return (data as SearchAreaRow | null) ?? null
}

/** One PUBLIC area by slug (the /areas/[slug] page). Cached 300s. */
export async function getPublicAreaBySlug(slug: string): Promise<SearchAreaRow | null> {
  const clean = (slug ?? '').trim().toLowerCase()
  if (!clean) return null
  const cached = unstable_cache(
    () => fetchPublicAreaBySlug(clean),
    ['search-areas-public-slug', clean],
    { revalidate: 300, tags: [SEARCH_AREAS_CACHE_TAG] },
  )
  return cached()
}
