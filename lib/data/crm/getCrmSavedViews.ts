import 'server-only'
import { createServiceClient } from '@/lib/supabase/service'
import { buildCrmPeopleQuery } from '@/lib/data/crm/buildCrmPeopleQuery'
import { validateSegment, type CrmSegment } from '@/lib/crm/segment-ast'
import { scopeBroker, type ScopeAccess } from '@/lib/crm/scope'
import { canSeeView, isOwnView, isSystemView } from '@/lib/crm/saved-view-visibility'

/**
 * getCrmSavedViews — the read side of the Wave 4 smart-list store.
 *
 * A saved view is a named CrmSegment AST. This reader returns the views the caller
 * may SEE (system views + shared views + the caller's own), each annotated with a
 * LIVE count resolved under the caller's broker scope through the ONE compiler
 * (buildCrmPeopleQuery, countOnly). The count therefore equals exactly what
 * opening the list will show — a restricted broker's count never includes people
 * outside their book, even on a shared view.
 *
 * DAL boundary (G1): the raw .from('crm_saved_views') read + the scoped count both
 * live here, inside lib/data/. NOT cached: the count is per-caller (broker scope)
 * and live against crm_people, so an unstable_cache keyed without the scope would
 * leak one broker's count to another. The list itself is tiny (system + a handful
 * of broker views) so an uncached read is cheap.
 *
 * Visibility rule (mirrors the migration's columns):
 *   - owner_email IS NULL                -> system view (everyone sees it)
 *   - is_shared = true                   -> shared view (everyone sees it)
 *   - owner_email = caller's email       -> the caller's own private view
 * A superuser sees every view regardless (no narrowing); the live count for a
 * superuser is unscoped (all brokers), matching scopeBroker(access) === null.
 */

export type CrmSavedViewWithCount = {
  id: number
  name: string
  description: string | null
  ast: CrmSegment
  ownerEmail: string | null
  isShared: boolean
  isProtected: boolean
  isSystem: boolean
  /** True when the caller owns this private view (can edit / delete it). */
  isOwn: boolean
  position: number
  /** Live count under the caller's broker scope. Null when the AST is unreadable. */
  count: number | null
}

type RawSavedViewRow = {
  id: number
  name: string
  description: string | null
  ast: unknown
  owner_email: string | null
  is_shared: boolean
  is_protected: boolean
  position: number
}

const SAVED_VIEW_SELECT = 'id,name,description,ast,owner_email,is_shared,is_protected,position'

/**
 * Live count for one view's AST under the caller's scope. Validates the AST first
 * (a corrupt stored AST must not crash the whole list); returns null on any error.
 */
async function countForAst(
  sb: ReturnType<typeof createServiceClient>,
  rawAst: unknown,
  brokerScope: string | null,
): Promise<number | null> {
  let ast: CrmSegment
  try {
    ast = validateSegment(rawAst)
  } catch (e) {
    console.error('[getCrmSavedViews] invalid stored AST:', (e as Error).message)
    return null
  }
  const { query } = buildCrmPeopleQuery(sb, ast, brokerScope, { countOnly: true })
  const { count, error } = await query
  if (error) {
    console.error('[getCrmSavedViews] count failed:', error.message)
    return null
  }
  return count ?? 0
}

/**
 * Every view the caller may see, each with a live scoped count. Ordered by
 * position then id (stable). The caller's email + scope come from getCrmAccess().
 */
export async function getCrmSavedViews(access: ScopeAccess & { email: string }): Promise<CrmSavedViewWithCount[]> {
  const sb = createServiceClient()
  const email = access.email.trim().toLowerCase()
  const isSuperuser = access.role === 'superuser'
  const brokerScope = scopeBroker(access)

  let query = sb.from('crm_saved_views').select(SAVED_VIEW_SELECT)
  // A non-superuser sees system (owner_email null) + shared + their own. A
  // superuser sees everything (no row filter). Applied in SQL so we never read a
  // private view the caller cannot see.
  if (!isSuperuser) {
    query = query.or(`owner_email.is.null,is_shared.eq.true,owner_email.eq.${email}`)
  }
  const { data, error } = await query
    .order('position', { ascending: true })
    .order('id', { ascending: true })

  if (error || !data) {
    if (error) console.error('[getCrmSavedViews]', error.message)
    return []
  }

  const rows = data as RawSavedViewRow[]
  return Promise.all(
    rows.map(async (r): Promise<CrmSavedViewWithCount> => {
      const count = await countForAst(sb, r.ast, brokerScope)
      return mapRow(r, count, email)
    }),
  )
}

/** Shape a raw row + its scoped count into the public view, applying own/system flags. */
function mapRow(r: RawSavedViewRow, count: number | null, email: string): CrmSavedViewWithCount {
  const visRow = { ownerEmail: r.owner_email, isShared: r.is_shared, isProtected: r.is_protected }
  return {
    id: r.id,
    name: r.name,
    description: r.description,
    ast: (r.ast ?? { type: 'group', op: 'and', nodes: [] }) as CrmSegment,
    ownerEmail: r.owner_email,
    isShared: r.is_shared,
    isProtected: r.is_protected,
    isSystem: isSystemView(visRow),
    isOwn: isOwnView(visRow, email),
    position: r.position,
    count,
  }
}

/**
 * One saved view by id WITH a live scoped count, OR null when the view does not
 * exist or the caller may not see it. The same visibility rule as getCrmSavedViews
 * is enforced here in code so a direct id lookup can't bypass it.
 */
export async function getCrmSavedView(
  id: number,
  access: ScopeAccess & { email: string },
): Promise<CrmSavedViewWithCount | null> {
  const sb = createServiceClient()
  const email = access.email.trim().toLowerCase()
  const brokerScope = scopeBroker(access)

  const { data, error } = await sb
    .from('crm_saved_views')
    .select(SAVED_VIEW_SELECT)
    .eq('id', id)
    .maybeSingle()
  if (error || !data) {
    if (error) console.error('[getCrmSavedView]', error.message)
    return null
  }
  const r = data as RawSavedViewRow

  // Visibility: a non-superuser may see system + shared + own only.
  const visRow = { ownerEmail: r.owner_email, isShared: r.is_shared, isProtected: r.is_protected }
  if (!canSeeView(visRow, access)) return null

  const count = await countForAst(sb, r.ast, brokerScope)
  return mapRow(r, count, email)
}
