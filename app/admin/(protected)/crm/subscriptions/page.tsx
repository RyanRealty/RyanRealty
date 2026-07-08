// @no-parity — internal admin surface, no public mockup contract

/**
 * /admin/crm/subscriptions — the Alerts & reports hub.
 *
 * One surface to search, filter, and bulk-manage every delivery preference:
 * listing alerts (the canonical listing_alerts table, unified 2026-07-07 —
 * guest and signed-in rows are one model split by user_id), market report
 * subscriptions (crm_report_subscriptions), and the Delivery tab (what went
 * out, who opened it, what failed). The page fetches the first page of each
 * tab server-side (default filters) so the hub renders with data immediately.
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
import { getGlobalDeliverySummary } from '@/lib/data/crm/emailDelivery'
import SubscriptionsHub from '@/components/admin/crm/subscriptions/SubscriptionsHub'

export const metadata = { title: 'Alerts & reports | CRM | Admin' }
export const dynamic = 'force-dynamic'

export default async function CrmSubscriptionsPage() {
  const access = await getCrmAccess()
  if (!access) redirect('/admin/access-denied')

  const [guest, user, reports, delivery] = await Promise.all([
    listAlertSubscriptionsAction({ kind: 'guest', status: 'all', limit: 50, offset: 0 }),
    listAlertSubscriptionsAction({ kind: 'user', status: 'all', limit: 50, offset: 0 }),
    listReportSubscriptionsAdminAction({ status: 'all', limit: 50, offset: 0 }),
    // Direct DAL read — the page is already behind getCrmAccess above, and the
    // reader fails soft (unreadable:true renders an honest empty tab).
    getGlobalDeliverySummary({ days: 30 }),
  ])

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
      <header className="mb-4">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Alerts &amp; reports</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Search, filter, and manage listing alerts, saved searches, and market report subscriptions in one place. The Delivery tab shows what actually went out, who opened it, and what needs a fix.
        </p>
      </header>
      <SubscriptionsHub
        initialGuest={guest.data ?? { rows: [], total: 0 }}
        initialUser={user.data ?? { rows: [], total: 0 }}
        initialReports={reports.data ?? { rows: [], total: 0 }}
        initialDelivery={delivery}
      />
    </main>
  )
}
