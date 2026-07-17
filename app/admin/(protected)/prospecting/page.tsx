// @no-parity — internal admin surface, no public mockup contract
// @data-free — redirect only, no data fetch.
import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

/**
 * Canonical §B1 route bridge (D9.3, admin rebuild spec 07): /admin/prospecting
 * is the spec-era canonical Prospecting path; the live surface is the Expireds
 * dashboard until spec 07 builds its hub. Menus link the live pages directly
 * (no hop) — this bridge keeps canonical deep links working.
 */
export default function ProspectingBridge() {
  redirect('/admin/expireds')
}
