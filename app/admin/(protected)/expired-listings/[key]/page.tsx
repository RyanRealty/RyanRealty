import { redirect } from 'next/navigation'

// @no-parity — internal admin tool, no public mockup contract.
/**
 * /admin/expired-listings/[key] — retired (admin rebuild spec 07 §3 step 3,
 * 2026-07-18). The per-listing review detail now lives at its own route,
 * /admin/prospecting/expired/<key>.
 *
 * This used to forward to `/admin/prospecting?kind=expired&id=<key>`. That
 * `?id=` drawer was deleted 2026-07-28 when the detail became a real page, so
 * the redirect had been landing on the worklist with an inert query param — a
 * dead end reached from an old bookmark. Second instance of the same stale
 * link; the first was in lib/data/crm/getContactProspectStory.ts.
 */
export const dynamic = 'force-dynamic'

export default async function ExpiredListingDetailRedirect(props: { params: Promise<{ key: string }> }) {
  const { key } = await props.params
  redirect(`/admin/prospecting/expired/${encodeURIComponent(key)}`)
}
