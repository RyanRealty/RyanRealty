import { redirect } from 'next/navigation'

// @no-parity — internal admin tool, no public mockup contract.
/**
 * /admin/expired-listings/[key] — retired (admin rebuild spec 07 §3 step 3,
 * 2026-07-18). The per-listing review detail now lives inside the unified
 * prospecting worklist at /admin/prospecting?kind=expired&id=<key>.
 */
export const dynamic = 'force-dynamic'

export default async function ExpiredListingDetailRedirect(props: { params: Promise<{ key: string }> }) {
  const { key } = await props.params
  redirect(`/admin/prospecting?kind=expired&id=${encodeURIComponent(key)}`)
}
