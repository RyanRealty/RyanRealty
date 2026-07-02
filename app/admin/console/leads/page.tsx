// @no-parity — internal admin surface
//
// LEGACY ROUTE → /admin/crm. Matt's mobile punch list #3 (2026-07-02): "basically
// I have what looks like 2 crms." This page was the pre-rebuild site-styled Leads
// list ("Leads · 18,018 in your book") living alongside the §05/§24 People surface
// at /admin/crm — the literal second CRM. The lead DETAIL stays at
// /admin/console/leads/[id]; the LIST is one surface only: /admin/crm.
// Filters carry over (q / stage / view / page share the same names).

import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

export default async function ConsoleLeadsRedirect({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; stage?: string; page?: string; view?: string }>
}) {
  const sp = await searchParams
  const params = new URLSearchParams()
  for (const k of ['q', 'stage', 'view', 'page'] as const) {
    if (sp[k]) params.set(k, sp[k]!)
  }
  const qs = params.toString()
  redirect(qs ? `/admin/crm?${qs}` : '/admin/crm')
}
