// @no-parity — internal admin surface, no public mockup contract
import { notFound } from 'next/navigation'
import { requireAdminPage } from '@/lib/admin/require-admin'
import { getClientPortalView } from '@/lib/data/crm/getClientPortalView'
import { ClientPortalReadOnlyView } from '@/components/admin/crm/portal-view/ClientPortalReadOnlyView'

export const metadata = { title: 'Portal view · Console' }

/**
 * Read-only broker mirror of a client's signed-in portal
 * (docs/plans/SEARCH_OPTIMIZATION_PLAN_2026-07-29.md, Phase 4 acceptance:
 * "Matt can open any client's view read-only from the CRM person page").
 *
 * Relocated under /admin/people/[id]/portal (Phase 11B sub-unit B1,
 * 2026-08-06) alongside the rest of the person workspace.
 * /admin/crm/[id]/portal stays alive as a redirect bridge.
 *
 * ── AUTHORIZATION ───────────────────────────────────────────────────────────
 * This route hands ONE person's private data to a DIFFERENT user, so it is
 * gated the same way every other person surface is, in-body and not only by
 * the (protected) layout: requireAdminPage('people.view') resolves the verified
 * session through getAdminContext, projects the role through the ONE capability
 * map, redirects an unauthenticated caller to sign-in with this destination
 * preserved, and redirects a signed-in caller without the capability to
 * /admin/access-denied. A non-admin cannot reach this by typing the URL.
 *
 * ── READ-ONLY ───────────────────────────────────────────────────────────────
 * There is no impersonation: the page never assumes the client's session, and
 * it never mints one. The data comes from a service-role READER
 * (getClientPortalView) whose module contains no write verb, and the rendered
 * tree contains no server action, no <form>, and no submit control. Both halves
 * are pinned by lib/data/crm/clientPortalView.test.ts.
 *
 * force-dynamic for the same reason the person workspace uses it: the read is
 * auth-scoped and per-contact, so it must never land in a shared cache.
 */
export const dynamic = 'force-dynamic'

export default async function ClientPortalViewPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  await requireAdminPage('people.view')

  const { id: idRaw } = await params
  const id = Number(idRaw)
  if (!Number.isFinite(id) || id <= 0) notFound()

  const view = await getClientPortalView({ crmPersonId: id })
  if (!view) notFound()

  return <ClientPortalReadOnlyView view={view} personHref={`/admin/people/${id}`} />
}
