// @no-parity — internal admin surface, no public mockup contract
// @data-free — redirect only, no data fetch.
import { redirect } from 'next/navigation'
import { getSetupComplete } from '@/app/actions/admin-setup'

export const dynamic = 'force-dynamic'

/**
 * One home, not three (Matt directive 2026-06-16). The admin used to land on a
 * CRM-funnel dashboard here, duplicating /admin/console ("Today") and
 * /admin/broker-dashboard ("Good evening" + live pulse). The broker dashboard
 * is now the single home; this route redirects there (after the one-time setup
 * gate). The funnel counts live on /admin/crm (Contacts) and the dashboard.
 */
export default async function AdminHomeRedirect() {
  const setupComplete = await getSetupComplete()
  if (!setupComplete) redirect('/admin/setup')
  redirect('/admin/broker-dashboard')
}
