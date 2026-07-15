// @no-parity — internal admin surface, no public mockup contract
// @data-free — redirect only, no data fetch.

/**
 * LEGACY ROUTE → /admin/crm/[id]. The Lead Command Center moved into the
 * (protected) segment (route consolidation 2026-07-15) so the duplicated
 * /admin/console layout could die. This stub keeps bookmarks and older deep
 * links (SMS/email notifications, FUB-era links) working. Every query param
 * (flash, error, tpl, smsTpl, view, …) carries over so server actions that
 * still redirect here surface their flash/error messages on the new route.
 */

import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

export default async function ConsoleLeadRedirect({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const { id } = await params
  const sp = await searchParams
  const qs = new URLSearchParams()
  for (const [k, v] of Object.entries(sp)) {
    if (typeof v === 'string') qs.set(k, v)
    else if (Array.isArray(v)) for (const x of v) qs.append(k, x)
  }
  const q = qs.toString()
  redirect(q ? `/admin/crm/${id}?${q}` : `/admin/crm/${id}`)
}
