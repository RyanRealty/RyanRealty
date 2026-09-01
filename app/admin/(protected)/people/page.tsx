// @no-parity — internal admin surface, no public mockup contract
// @data-free — redirect only, no data fetch.
import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

/**
 * People-list fold (Matt lock 2026-09-01, decisions.md "UX CONSOLIDATION
 * LOCKS" #2): one list surface. The search-first quick lookup and the full
 * list served the same job from two routes; /admin/crm (search on top, saved
 * views, bulk actions) survives. Person ENTITY pages stay under
 * /admin/people/[id]* — this bridge covers only the list route, and carries
 * the search query across.
 */
export default async function PeopleListBridge({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>
}) {
  const q = ((await searchParams).q ?? '').trim()
  redirect(q ? `/admin/crm?q=${encodeURIComponent(q)}` : '/admin/crm')
}
