'use server'

/**
 * Read action behind the in-map saved-area picker
 * (components/search/AreaPicker.tsx, SEARCH_OPTIMIZATION_PLAN_2026-07-29
 * §4 Phase 2.4).
 *
 * READ ONLY. Every write on named areas already lives in
 * app/actions/search-areas.ts with its own ownership gate; this action exists
 * so a CLIENT map control can list what the visitor is allowed to pick
 * without the search page having to load areas for every render (the picker
 * fetches on first open).
 *
 * What a visitor may see:
 *   - `mine`   — areas the signed-in user owns (DAL: listAreasForUser, which
 *                filters on owner_user_id). Signed out returns none.
 *   - `shared` — broker-PUBLISHED areas only (DAL: listPublicAreas → is_public
 *                and slug not null). These already render as public
 *                /areas/<slug> landing pages, so their names are public.
 *
 * A private area belonging to someone else is never reachable here: neither
 * DAL call can return one. That matters because getAreasByIds (the alert
 * engine's read) deliberately has no owner scope.
 */

import { getSession } from '@/app/actions/auth'
import { listAreasForUser, listPublicAreas } from '@/lib/data'
import type { PickerArea } from '@/components/search/area-picker'

export type PickerAreasResult = {
  /** True when a session resolved, so the UI can teach the right next step. */
  signedIn: boolean
  /** Owner areas first (most recently updated), then published areas. */
  areas: PickerArea[]
}

/** UI cap. The map control is a picker, not a browser. */
const MAX_PICKER_AREAS = 50

export async function listPickerAreas(): Promise<PickerAreasResult> {
  const session = await getSession()
  const userId = session?.user?.id ?? null

  const [mine, published] = await Promise.all([
    userId ? listAreasForUser(userId) : Promise.resolve([]),
    listPublicAreas(),
  ])

  const seen = new Set<string>()
  const areas: PickerArea[] = []

  for (const row of mine) {
    if (seen.has(row.id)) continue
    seen.add(row.id)
    areas.push({ id: row.id, name: row.name, slug: row.slug, shapes: row.shapes, scope: 'mine' })
  }
  // A user's own published area is already listed above as theirs — the dedupe
  // keeps it out of the shared section so it never appears twice.
  for (const row of published) {
    if (seen.has(row.id)) continue
    seen.add(row.id)
    areas.push({ id: row.id, name: row.name, slug: row.slug, shapes: row.shapes, scope: 'shared' })
  }

  return { signedIn: userId != null, areas: areas.slice(0, MAX_PICKER_AREAS) }
}
