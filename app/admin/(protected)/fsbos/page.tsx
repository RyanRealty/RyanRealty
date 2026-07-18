import { redirect } from 'next/navigation'

// @no-parity — internal admin tool, no public mockup contract.
/**
 * /admin/fsbos — retired (admin rebuild spec 07 §3 step 3, 2026-07-18).
 * Folded into the unified prospecting worklist at /admin/prospecting
 * (?kind=fsbo toggles the FSBO view).
 */
export const dynamic = 'force-dynamic'

export default function FsboDashboardRedirect() {
  redirect('/admin/prospecting?kind=fsbo')
}
