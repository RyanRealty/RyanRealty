/**
 * Pure decision logic for the unified saved-home heart/bookmark.
 *
 * A home shown on /account/saved-homes is the UNION of two stores:
 *   - `saved_listings` (the bookmark / "Save home" button)
 *   - `likes`          (the heart)
 *
 * The remove bug: the page renders the union, but the old remove only deleted
 * from `saved_listings`. A home that lived ONLY in `likes` (the common path,
 * since the heart writes `likes`) was a silent no-op on remove. The delete
 * matched zero rows, the action still returned success, and the home re-rendered.
 *
 * These helpers decide, from a home's membership, which stores a remove must hit
 * so the home is actually gone for the signed-in user. They are pure (no I/O) so
 * the decision is unit-tested independently of Supabase + auth.
 */

/** Where a saved home currently lives for a given user. */
export type SavedHomeMembership = {
  /** Present in `saved_listings` (bookmark). */
  inSaved: boolean
  /** Present in `likes` (heart). */
  inLiked: boolean
}

/** Which stores a remove operation must delete from. */
export type SavedHomeRemovalPlan = {
  removeSaved: boolean
  removeLiked: boolean
}

/**
 * Decide which stores to delete from so a saved home is fully removed.
 *
 * The correct behavior is to clear EVERY store the home lives in. Deleting from
 * only one store is exactly the no-op bug. When membership is unknown (the page
 * does not always tell us which store a row came from), removing from both is the
 * safe default. A delete against a store with no matching row is a harmless
 * zero-row delete, never an error.
 */
export function planSavedHomeRemoval(
  membership?: Partial<SavedHomeMembership>
): SavedHomeRemovalPlan {
  // Unknown membership -> clear both stores (safe, idempotent).
  if (!membership || (membership.inSaved == null && membership.inLiked == null)) {
    return { removeSaved: true, removeLiked: true }
  }
  return {
    removeSaved: membership.inSaved === true,
    removeLiked: membership.inLiked === true,
  }
}

/**
 * Decide the next state for the heart/bookmark toggle.
 *
 * If the home is in EITHER store it counts as saved, so a toggle removes it
 * (from both). Otherwise the toggle saves it.
 */
export function nextSavedHomeState(
  membership?: Partial<SavedHomeMembership>
): { willBeSaved: boolean; removal: SavedHomeRemovalPlan } {
  const currentlySaved =
    membership?.inSaved === true || membership?.inLiked === true
  if (currentlySaved) {
    return { willBeSaved: false, removal: planSavedHomeRemoval(membership) }
  }
  return { willBeSaved: true, removal: { removeSaved: false, removeLiked: false } }
}

/** Normalize a listing key the same way the server actions do (trim, string). */
export function normalizeListingKey(listingKey: string | null | undefined): string {
  return (listingKey ?? '').toString().trim()
}
