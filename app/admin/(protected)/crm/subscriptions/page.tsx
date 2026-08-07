// @no-parity — internal admin surface, no public mockup contract
//
// /admin/crm/subscriptions — the Alerts & reports hub. P11D: migrated to the
// LOCKED admin v2 language (design_system/admin/ADMIN_UI.md). PRESENTATION ONLY.
//
// Carried over verbatim: the getCrmAccess() → /admin/access-denied guard, the
// five-read Promise.all and EVERY argument in it (kind/status/limit/offset,
// days:30, the approvals catch), `dynamic = 'force-dynamic'`, the metadata
// title, and all five props handed to SubscriptionsHub including the
// `?? { rows: [], total: 0 }` fallbacks. SubscriptionsHub is MOUNTED UNCHANGED —
// every tab, filter, and bulk mutation still lives inside it.
//
// Shape changed, data did not: the page's own <main> is gone (ConsoleShell owns
// the landmark) and the <h1> with it (acceptance bar rule 1). The standing
// paragraph became the verdict line, which leads with the one thing that needs a
// human — previews held for approval — and otherwise states the counts the tabs
// below already hold. A FAILED read used to arrive as a silently empty tab; it
// now names itself before the hub renders.
import { redirect } from 'next/navigation'
import { getCrmAccess } from '@/app/actions/crm'
import {
  listAlertSubscriptionsAction,
  listReportSubscriptionsAdminAction,
} from '@/app/actions/subscriptions-admin'
import { listPendingAlertApprovalGroups } from '@/lib/data/leads/listingAlertApprovals'
import { getGlobalDeliverySummary } from '@/lib/data/crm/emailDelivery'
import { ReportError, VerdictLine } from '@/components/admin/v2'
import SubscriptionsHub from '@/components/admin/crm/subscriptions/SubscriptionsHub'

export const metadata = { title: 'Alerts & reports | CRM | Admin' }
export const dynamic = 'force-dynamic'

export default async function CrmSubscriptionsPage() {
  const access = await getCrmAccess()
  if (!access) redirect('/admin/access-denied')

  const [guest, user, reports, delivery, approvals] = await Promise.all([
    listAlertSubscriptionsAction({ kind: 'guest', status: 'all', limit: 50, offset: 0 }),
    listAlertSubscriptionsAction({ kind: 'user', status: 'all', limit: 50, offset: 0 }),
    listReportSubscriptionsAdminAction({ status: 'all', limit: 50, offset: 0 }),
    // Direct DAL read — the page is already behind getCrmAccess above, and the
    // reader fails soft (unreadable:true renders an honest empty tab).
    getGlobalDeliverySummary({ days: 30 }),
    // Preview-mode holds waiting for broker approval ("To approve" tab).
    listPendingAlertApprovalGroups().then((data) => ({ data, error: null as string | null })).catch(() => ({ data: null, error: 'Could not load the approval queue' })),
  ])

  // Every read that came back empty BECAUSE it failed, named. An empty tab and a
  // broken tab looked identical before this.
  const failed = [
    guest.error ? 'Guest listing alerts' : null,
    user.error ? 'Saved searches' : null,
    reports.error ? 'Market-report subscriptions' : null,
    delivery.unreadable ? 'Delivery history' : null,
    approvals.error ? 'The approval queue' : null,
  ].filter((s): s is string => s !== null)

  const alertsTotal = (guest.data?.total ?? 0) + (user.data?.total ?? 0)
  const reportsTotal = reports.data?.total ?? 0
  const waiting = approvals.data?.length ?? 0

  return (
    <div className="av2-scope" style={{ maxWidth: 1152, margin: '0 auto', padding: 16 }}>
      <div style={{ margin: '0 0 14px' }}>
        <VerdictLine tone={waiting > 0 || failed.length > 0 ? 'attention' : 'ok'}>
          {waiting > 0 ? (
            <>
              <b>
                {waiting.toLocaleString('en-US')} alert {waiting === 1 ? 'preview is' : 'previews are'}{' '}
                held for your approval.
              </b>{' '}
              Nothing in them sends until you release it.
            </>
          ) : (
            <>
              <b>
                {alertsTotal.toLocaleString('en-US')}{' '}
                {alertsTotal === 1 ? 'listing alert' : 'listing alerts'} and{' '}
                {reportsTotal.toLocaleString('en-US')} market-report{' '}
                {reportsTotal === 1 ? 'subscription' : 'subscriptions'}.
              </b>{' '}
              Nothing is waiting on your approval.
            </>
          )}
        </VerdictLine>
      </div>

      {failed.length > 0 ? (
        <ReportError what={failed.join(', ')} href="/admin/crm/subscriptions" />
      ) : null}

      <SubscriptionsHub
        initialGuest={guest.data ?? { rows: [], total: 0 }}
        initialUser={user.data ?? { rows: [], total: 0 }}
        initialReports={reports.data ?? { rows: [], total: 0 }}
        initialDelivery={delivery}
        initialApprovals={approvals.data ?? []}
      />
    </div>
  )
}
