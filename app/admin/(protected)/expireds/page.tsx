import { redirect } from 'next/navigation'

// @no-parity — internal admin tool, no public mockup contract.
/**
 * /admin/expireds — retired (admin rebuild spec 07 §3 step 3, 2026-07-18).
 * Folded into the unified prospecting worklist at /admin/prospecting
 * (?kind=expired is the default view).
 */
export const dynamic = 'force-dynamic'

export default function ExpiredsDashboardRedirect() {
  redirect('/admin/prospecting')
}
