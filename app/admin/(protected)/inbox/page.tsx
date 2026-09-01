// @no-parity — internal admin surface, no public mockup contract
// @data-free — redirect only, no data fetch.
import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

/**
 * Canonical §B1 route bridge (D9.3, admin rebuild spec 01 §13.2): /admin/inbox
 * is the spec-era canonical Inbox path; the live page is /admin/messages since the 2026-09-01 fold;
 * spec 02 moves it. Menus link the live page directly (no hop) — this bridge
 * keeps canonical deep links working.
 */
export default function InboxBridge() {
  redirect('/admin/messages')
}
