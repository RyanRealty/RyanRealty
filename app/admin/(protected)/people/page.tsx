import { redirect } from 'next/navigation'

/**
 * /admin/people — MERGED into the contacts list + person page
 * (admin consolidation 2026-07-07, docs/plans/ADMIN_CONSOLIDATION_AUDIT.md).
 *
 * The standalone people index duplicated the CRM contacts mental model, and
 * its per-person visitor intel now lives on the canonical person page
 * (ContactBehaviorPanel + website activity). A search carries over.
 */
export default async function AdminPeopleRedirect({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>
}) {
  const { q } = await searchParams
  redirect(q?.trim() ? `/admin/crm?q=${encodeURIComponent(q.trim())}` : '/admin/crm')
}
