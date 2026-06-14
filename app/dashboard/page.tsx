import { redirect } from 'next/navigation'

/**
 * The standalone /dashboard overview is superseded by the redesigned /account
 * hub (Matt 2026-06-14, "make /account the one home" — Option A). The hub merges
 * everything this page showed (liked + saved homes, recent views, saved searches)
 * plus more (places, your agent, settings). Send the orphaned root to it; the
 * /dashboard/* feature subpages still resolve and are linked from the hub.
 */
export default function DashboardPage() {
  redirect('/account')
}
