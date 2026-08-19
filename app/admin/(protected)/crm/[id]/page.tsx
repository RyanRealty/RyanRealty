// @no-parity — internal admin surface, no public mockup contract
// @data-free — redirect only, no data fetch.

/**
 * LEGACY ROUTE → /admin/people/[id]/tools. The person workspace relocated off
 * this route and under the v2 person page's tools door (Phase 11B sub-unit
 * B1, 2026-08-06) — the legacy Lead Command Center is now one tap under
 * /admin/people/[id] instead of owning the primary person route. This stub
 * keeps bookmarks and older deep links (SMS/email notifications, CRM-era
 * links, server-action redirects still pointed here) working. Every query
 * param (flash, error, tpl, smsTpl, view, reply, …) carries over so those
 * flash/error messages surface on the new route.
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
  redirect(q ? `/admin/people/${id}/tools?${q}` : `/admin/people/${id}/tools`)
}
