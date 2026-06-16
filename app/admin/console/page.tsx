// @no-parity — internal admin surface, no public mockup contract
// @data-free — redirect only, no data fetch.
import { redirect } from 'next/navigation'

/**
 * The "Today" launchpad was one of three redundant dashboards. Matt directive
 * 2026-06-16: the broker dashboard is the single home. This route redirects
 * there; the lead-search + tiles it offered are all reachable from the nav and
 * the dashboard itself.
 */
export default function ConsoleHomeRedirect() {
  redirect('/admin/broker-dashboard')
}
