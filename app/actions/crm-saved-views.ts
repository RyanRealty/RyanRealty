'use server'

/**
 * CRM saved-view (smart-list) server actions — Wave 4 CRUD for crm_saved_views.
 *
 * A saved view is a named CrmSegment AST that is both (a) a clickable people-list
 * filter and (b) a reusable bulk-action audience (the audience bus loads it by id
 * — see resolveBulkSelection in app/actions/crm-bulk.ts). These actions own the
 * write side: create / save-current-filter / update / delete / set-shared.
 *
 * RBAC + protection (the rules these enforce, mirrored in the PURE helpers in
 * lib/crm/saved-view-visibility.ts so the read DAL + the worker agree):
 *   - A broker-created view is OWNED by the creating broker's email. Only the owner
 *     (or a superuser) may edit / delete / share it.
 *   - A PROTECTED view (the 12 seeded system lists, owner_email null) can never be
 *     deleted by anyone — deleteSavedViewAction refuses outright.
 *   - Every AST is validateSegment'd before it touches the table, so a malformed
 *     segment can never be stored and later crash the resolver.
 *
 * DAL boundary (G1): the raw .from('crm_saved_views') writes live in this
 * 'use server' action file (the sanctioned mutation surface). The cached/scoped
 * read side is lib/data/crm/getCrmSavedViews.ts. UI never imports this module's
 * Supabase calls directly — it invokes these actions.
 */

import { revalidatePath } from 'next/cache'
import { createServiceClient } from '@/lib/supabase/service'
import { getCrmAccess, type CrmAccess } from '@/app/actions/crm'
import {
  validateSegment,
  upgradeLegacyFilters,
  type CrmSegment,
  type LegacyFilters,
} from '@/lib/crm/segment-ast'
import {
  canEditView,
  refuseSavedViewDelete,
  type SavedViewVisibilityRow,
} from '@/lib/crm/saved-view-visibility'

export type SavedViewActionResult = { ok: true; id?: number } | { ok: false; error: string }

const REVALIDATE_PATHS = ['/admin/crm', '/admin/crm/people']

function revalidate() {
  for (const p of REVALIDATE_PATHS) revalidatePath(p)
}

async function requireAccess(): Promise<{ ok: true; access: CrmAccess } | { ok: false; error: string }> {
  const access = await getCrmAccess()
  if (!access) return { ok: false, error: 'Unauthorized' }
  return { ok: true, access }
}

/** Load the protection/owner row for an edit/delete guard. Null when missing. */
async function loadGuardRow(
  id: number,
): Promise<(SavedViewVisibilityRow & { name: string }) | null> {
  const sb = createServiceClient()
  const { data } = await sb
    .from('crm_saved_views')
    .select('name,owner_email,is_shared,is_protected')
    .eq('id', id)
    .maybeSingle()
  if (!data) return null
  const r = data as { name: string; owner_email: string | null; is_shared: boolean; is_protected: boolean }
  return { name: r.name, ownerEmail: r.owner_email, isShared: r.is_shared, isProtected: r.is_protected }
}

// ── Create ───────────────────────────────────────────────────────────────────

/**
 * Create a broker-owned saved view from an explicit AST. The AST is validated
 * first; the new view is owned by the caller (owner_email = their email), private
 * by default (is_shared false), never protected. Returns the new id.
 */
export async function createSavedViewAction(input: {
  name: string
  description?: string
  ast: CrmSegment
}): Promise<SavedViewActionResult> {
  const guard = await requireAccess()
  if (!guard.ok) return guard

  const name = (input.name ?? '').trim()
  if (!name) return { ok: false, error: 'Name is required' }
  const description = (input.description ?? '').trim() || null

  let ast: CrmSegment
  try {
    ast = validateSegment(input.ast)
  } catch (e) {
    return { ok: false, error: `Invalid filter: ${(e as Error).message}` }
  }

  const sb = createServiceClient()
  // New views land at the end of the order.
  const { data: maxRow } = await sb
    .from('crm_saved_views')
    .select('position')
    .order('position', { ascending: false })
    .limit(1)
    .maybeSingle()
  const nextPosition = ((maxRow?.position as number | undefined) ?? -1) + 1

  const { data, error } = await sb
    .from('crm_saved_views')
    .insert({
      name,
      description,
      ast,
      owner_email: guard.access.email,
      is_shared: false,
      is_protected: false,
      position: nextPosition,
    })
    .select('id')
    .maybeSingle()
  if (error) return { ok: false, error: error.message }
  revalidate()
  return { ok: true, id: (data?.id as number | undefined) ?? undefined }
}

/**
 * Save the CURRENT people-list filter bag ({stage, tagsAny, broker, q}) as a named
 * view — the "save this filter" affordance. Upgrades the legacy filter shape to a
 * CrmSegment AST (upgradeLegacyFilters) so it stores the same AST a fresh view
 * would, then delegates to createSavedViewAction.
 */
export async function saveCurrentFilterAsViewAction(input: {
  name: string
  description?: string
  filters: LegacyFilters
}): Promise<SavedViewActionResult> {
  const ast = upgradeLegacyFilters(input.filters ?? {})
  return createSavedViewAction({ name: input.name, description: input.description, ast })
}

// ── Update ───────────────────────────────────────────────────────────────────

/**
 * Update an existing view's name / description / ast. The caller must be able to
 * edit it (own it, or superuser). Only the provided fields change.
 */
export async function updateSavedViewAction(input: {
  id: number
  name?: string
  description?: string | null
  ast?: CrmSegment
}): Promise<SavedViewActionResult> {
  const guard = await requireAccess()
  if (!guard.ok) return guard
  const id = Number(input.id)
  if (!Number.isFinite(id) || id <= 0) return { ok: false, error: 'A view is required' }

  const row = await loadGuardRow(id)
  if (!row) return { ok: false, error: 'That list no longer exists' }
  if (!canEditView(row, guard.access)) {
    return { ok: false, error: 'Not authorized to edit this list' }
  }

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (input.name !== undefined) {
    const name = input.name.trim()
    if (!name) return { ok: false, error: 'Name is required' }
    patch.name = name
  }
  if (input.description !== undefined) {
    patch.description = input.description ? input.description.trim() || null : null
  }
  if (input.ast !== undefined) {
    try {
      patch.ast = validateSegment(input.ast)
    } catch (e) {
      return { ok: false, error: `Invalid filter: ${(e as Error).message}` }
    }
  }

  const sb = createServiceClient()
  const { error } = await sb.from('crm_saved_views').update(patch).eq('id', id)
  if (error) return { ok: false, error: error.message }
  revalidate()
  return { ok: true, id }
}

/**
 * §9.8 "Update List": commit the CURRENT people-list filter bag as the smart
 * list's saved definition. Writes BOTH representations kept in lockstep:
 *   - `filter` — the legacy {stage, tagsAny, q} bag listCrmPeople applies
 *   - `ast`    — the upgraded CrmSegment the audience bus / counts resolve
 * The broker scope is deliberately NOT saved into the list (it is a view-level
 * overlay per §7, not part of the smart list's definition).
 */
export async function updateSavedViewFilterAction(input: {
  id: number
  filters: LegacyFilters
}): Promise<SavedViewActionResult> {
  const guard = await requireAccess()
  if (!guard.ok) return guard
  const id = Number(input.id)
  if (!Number.isFinite(id) || id <= 0) return { ok: false, error: 'A view is required' }

  const row = await loadGuardRow(id)
  if (!row) return { ok: false, error: 'That list no longer exists' }
  if (!canEditView(row, guard.access)) {
    return { ok: false, error: 'Not authorized to edit this list' }
  }

  const bag: LegacyFilters = {
    stage: input.filters?.stage || undefined,
    tagsAny: input.filters?.tagsAny?.filter(Boolean),
    q: input.filters?.q || undefined,
  }
  let ast: CrmSegment
  try {
    ast = validateSegment(upgradeLegacyFilters(bag))
  } catch (e) {
    return { ok: false, error: `Invalid filter: ${(e as Error).message}` }
  }

  const sb = createServiceClient()
  const { error } = await sb
    .from('crm_saved_views')
    .update({ filter: bag, ast, updated_at: new Date().toISOString() })
    .eq('id', id)
  if (error) return { ok: false, error: error.message }
  revalidate()
  return { ok: true, id }
}

// ── Delete ───────────────────────────────────────────────────────────────────

/**
 * Delete a view. Refuses a PROTECTED (seeded system) view outright, and refuses a
 * caller who cannot edit it. The pure rule lives in refuseSavedViewDelete.
 */
export async function deleteSavedViewAction(input: { id: number }): Promise<SavedViewActionResult> {
  const guard = await requireAccess()
  if (!guard.ok) return guard
  const id = Number(input.id)
  if (!Number.isFinite(id) || id <= 0) return { ok: false, error: 'A view is required' }

  const row = await loadGuardRow(id)
  if (!row) return { ok: false, error: 'That list no longer exists' }

  const refusal = refuseSavedViewDelete(row, guard.access)
  if (!refusal.ok) return refusal

  const sb = createServiceClient()
  const { error } = await sb.from('crm_saved_views').delete().eq('id', id)
  if (error) return { ok: false, error: error.message }
  revalidate()
  return { ok: true, id }
}

// ── Share toggle ──────────────────────────────────────────────────────────────

/**
 * Share / unshare a view with the rest of the brokers. The caller must be able to
 * edit it. Sharing a private view makes it visible (and usable as an audience) to
 * every broker; the live count each broker sees is still clamped to their book.
 */
export async function setSavedViewSharedAction(input: {
  id: number
  shared: boolean
}): Promise<SavedViewActionResult> {
  const guard = await requireAccess()
  if (!guard.ok) return guard
  const id = Number(input.id)
  if (!Number.isFinite(id) || id <= 0) return { ok: false, error: 'A view is required' }

  const row = await loadGuardRow(id)
  if (!row) return { ok: false, error: 'That list no longer exists' }
  if (!canEditView(row, guard.access)) {
    return { ok: false, error: 'Not authorized to share this list' }
  }

  const sb = createServiceClient()
  const { error } = await sb
    .from('crm_saved_views')
    .update({ is_shared: !!input.shared, updated_at: new Date().toISOString() })
    .eq('id', id)
  if (error) return { ok: false, error: error.message }
  revalidate()
  return { ok: true, id }
}
