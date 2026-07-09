// @no-parity — pure server-side redirect shim, no rendered UI, no mockup contract.
import { notFound, redirect } from 'next/navigation'
import { getPersonIdByLegacyId } from '@/lib/data/crm/getPersonIdByLegacyId'

/**
 * /admin/people/[legacyId] — MERGED into the canonical person page
 * (admin consolidation 2026-07-07, docs/plans/ADMIN_CONSOLIDATION_AUDIT.md).
 * Renamed from [fubPersonId] 2026-07-09.
 *
 * The single-pane-of-glass per-person view this route used to render now
 * lives on /admin/console/leads/[id] (visitor behavior via
 * ContactBehaviorPanel, alerts + reports + delivery in the right rail).
 * Old links (Hot leads, bookmarks) resolve the legacy id to the CRM
 * person and land on the canonical page.
 */
export default async function AdminPeopleLegacyRedirect({
  params,
}: {
  params: Promise<{ legacyId: string }>
}) {
  const { legacyId } = await params
  const id = Number(legacyId)
  if (!Number.isFinite(id) || id <= 0) notFound()
  const personId = await getPersonIdByLegacyId(id)
  if (!personId) redirect('/admin/crm')
  redirect(`/admin/console/leads/${personId}`)
}
