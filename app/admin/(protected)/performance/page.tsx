// @no-parity — internal admin surface, no public mockup contract
// @data-free — redirect only, no data fetch.
import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

/**
 * Canonical §B1 route bridge (D9.3, admin rebuild spec 01 §13.5):
 * /admin/performance is the spec-era canonical Performance path; the live hub
 * is /admin/analytics until spec 06 moves it. Menus link the live page
 * directly (no hop) — this bridge keeps canonical deep links working.
 */
export default function PerformanceBridge() {
  redirect('/admin/analytics')
}
