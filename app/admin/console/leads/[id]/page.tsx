// @no-parity — internal admin surface, no public mockup contract
// @data-free — redirect only, no data fetch.

/**
 * LEGACY ROUTE → /admin/people/[id]. The Lead Command Center moved into the
 * (protected) segment (route consolidation 2026-07-15), then the person page
 * moved again to the v2 /admin/people/[id] surface (Phase 11B/B3) — this stub
 * now points straight at the v2 page rather than bouncing through the
 * /admin/crm/[id] bridge redirect. This stub keeps bookmarks and older deep
 * links (SMS/email notifications, CRM-era links) working. Every query param
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
  redirect(q ? `/admin/people/${id}?${q}` : `/admin/people/${id}`)
}
