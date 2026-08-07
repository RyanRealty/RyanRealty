// @no-parity — internal admin surface, no public mockup contract
// @data-free — redirect only, no data fetch.

/**
 * LEGACY ROUTE → /admin/people/[id]/portal. Relocated with the rest of the
 * person workspace (Phase 11B sub-unit B1, 2026-08-06). Bookmarks and links
 * into the old /admin/crm/[id]/portal path keep working.
 */

import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

export default async function ConsoleLeadPortalRedirect({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  redirect(`/admin/people/${id}/portal`)
}
