/**
 * saved-view-visibility — the PURE decision helpers behind the saved-view DAL +
 * actions. Factored out (no Supabase, no server-only) so the visibility rule and
 * the protected/owner edit rules are unit-tested without a DB.
 *
 * The rules here are the single source for "who can see / edit / delete a saved
 * view." getCrmSavedViews (read) and app/actions/crm-saved-views.ts (write) both
 * call these so the surfaces can't drift.
 */

import type { ScopeAccess } from '@/lib/crm/scope'

/** The minimal saved-view shape the decision helpers need. */
export type SavedViewVisibilityRow = {
  ownerEmail: string | null
  isShared: boolean
  isProtected: boolean
}

function normEmail(email: string | null | undefined): string {
  return (email ?? '').trim().toLowerCase()
}

/** True when `email` owns the row (case-insensitive, owner present). */
export function isOwnView(row: { ownerEmail: string | null }, email: string): boolean {
  const owner = normEmail(row.ownerEmail)
  return owner.length > 0 && owner === normEmail(email)
}

/** A system view has no owner (seeded). */
export function isSystemView(row: { ownerEmail: string | null }): boolean {
  return row.ownerEmail === null
}

/**
 * Can the caller SEE this view?
 *   - superuser                  -> always
 *   - system view (no owner)     -> always
 *   - shared view                -> always
 *   - the caller's own view      -> always
 *   - someone else's private view -> no
 */
export function canSeeView(
  row: SavedViewVisibilityRow,
  access: ScopeAccess & { email: string },
): boolean {
  if (access.role === 'superuser') return true
  if (isSystemView(row)) return true
  if (row.isShared) return true
  return isOwnView(row, access.email)
}

/**
 * Can the caller EDIT (rename / update ast / share) this view?
 *   - superuser            -> any view
 *   - non-superuser        -> only their OWN view
 * (A system view is never owner-editable by a non-superuser — only the owner Matt,
 * who is a superuser, may touch the seeds.)
 */
export function canEditView(
  row: SavedViewVisibilityRow,
  access: ScopeAccess & { email: string },
): boolean {
  if (access.role === 'superuser') return true
  return isOwnView(row, access.email)
}

export type SavedViewActionRefusal = { ok: true } | { ok: false; error: string }

/**
 * The delete rule. A PROTECTED view (the seeded system lists) can never be deleted
 * by anyone. Otherwise the caller must be able to edit it (own it, or superuser).
 * Returns ok:false with a stable message the action surfaces verbatim.
 */
export function refuseSavedViewDelete(
  row: SavedViewVisibilityRow & { name: string },
  access: ScopeAccess & { email: string },
): SavedViewActionRefusal {
  if (row.isProtected) {
    return { ok: false, error: `${row.name} is a protected list and cannot be deleted` }
  }
  if (!canEditView(row, access)) {
    return { ok: false, error: 'Not authorized to delete this list' }
  }
  return { ok: true }
}
