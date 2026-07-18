import { redirect } from 'next/navigation'

// @no-parity — internal admin tool, no public mockup contract.
/**
 * /admin/expired-outreach — retired (admin rebuild spec 07 §3 step 3,
 * 2026-07-18). The send queue is now part of the unified prospecting
 * worklist at /admin/prospecting.
 */
export const dynamic = 'force-dynamic'

export default function ExpiredOutreachRedirect() {
  redirect('/admin/prospecting')
}
