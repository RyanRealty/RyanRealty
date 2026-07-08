import { notFound, redirect } from 'next/navigation'
import { getPersonIdByFubLegacyId } from '@/lib/data/crm/getPersonIdByFubLegacyId'

/**
 * /admin/people/[fubPersonId] — MERGED into the canonical person page
 * (admin consolidation 2026-07-07, docs/plans/ADMIN_CONSOLIDATION_AUDIT.md).
 *
 * The single-pane-of-glass per-person view this route used to render now
 * lives on /admin/console/leads/[id] (visitor behavior via
 * ContactBehaviorPanel, alerts + reports + delivery in the right rail).
 * Old links (Hot leads, bookmarks) resolve the FUB legacy id to the CRM
 * person and land on the canonical page.
 */
export default async function AdminPeopleFubRedirect({
  params,
}: {
  params: Promise<{ fubPersonId: string }>
}) {
  const { fubPersonId } = await params
  const fubId = Number(fubPersonId)
  if (!Number.isFinite(fubId) || fubId <= 0) notFound()
  const personId = await getPersonIdByFubLegacyId(fubId)
  if (!personId) redirect('/admin/crm')
  redirect(`/admin/console/leads/${personId}`)
}
