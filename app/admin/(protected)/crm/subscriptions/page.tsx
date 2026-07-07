// @no-parity — internal admin surface, no public mockup contract

/**
 * /admin/crm/subscriptions — the unified Subscriptions hub.
 *
 * One surface to search, filter, and bulk-manage every delivery preference:
 * guest listing alerts (guest_search_alerts), signed-in saved searches
 * (saved_searches), and market report subscriptions
 * (crm_report_subscriptions). The page fetches the first page of each tab
 * server-side (default filters) so the hub renders with data immediately.
 * The client tabs refetch through the admin actions on any filter change.
 *
 * Gate: any CRM admin (getCrmAccess), matching the sibling CRM pages and the
 * actions in app/actions/subscriptions-admin.ts.
 */

import { redirect } from 'next/navigation'
import { getCrmAccess } from '@/app/actions/crm'
import {
  listAlertSubscriptionsAction,
  listReportSubscriptionsAdminAction,
} from '@/app/actions/subscriptions-admin'
import SubscriptionsHub from '@/components/admin/crm/subscriptions/SubscriptionsHub'

export const metadata = { title: 'Subscriptions | CRM | Admin' }
export const dynamic = 'force-dynamic'

export default async function CrmSubscriptionsPage() {
  const access = await getCrmAccess()
  if (!access) redirect('/admin/access-denied')

  const [guest, user, reports] = await Promise.all([
    listAlertSubscriptionsAction({ kind: 'guest', status: 'all', limit: 50, offset: 0 }),
    listAlertSubscriptionsAction({ kind: 'user', status: 'all', limit: 50, offset: 0 }),
    listReportSubscriptionsAdminAction({ status: 'all', limit: 50, offset: 0 }),
  ])

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
      <header className="mb-4">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Subscriptions</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Search, filter, and manage listing alerts, saved searches, and market report subscriptions in one place.
        </p>
      </header>
      <SubscriptionsHub
        initialGuest={guest.data ?? { rows: [], total: 0 }}
        initialUser={user.data ?? { rows: [], total: 0 }}
        initialReports={reports.data ?? { rows: [], total: 0 }}
      />
    </main>
  )
}
