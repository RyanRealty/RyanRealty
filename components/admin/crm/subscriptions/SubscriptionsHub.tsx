'use client'

/**
 * SubscriptionsHub — the client shell of /admin/crm/subscriptions. Three tabs
 * over the two subscription families: guest listing alerts
 * (guest_search_alerts), signed-in saved searches (saved_searches), and
 * market report subscriptions (crm_report_subscriptions). Each tab manages
 * its own filters, pagination, selection, and bulk actions.
 *
 * Toasts render through the global Toaster mounted in RootProvider.
 */

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import type {
  ListAlertSubscriptionsResult,
  AdminReportSubscriptionRow,
} from '@/lib/data/crm/subscriptionsAdmin'
import AlertSubscriptionsTab from '@/components/admin/crm/subscriptions/AlertSubscriptionsTab'
import ReportSubscriptionsTab from '@/components/admin/crm/subscriptions/ReportSubscriptionsTab'

export default function SubscriptionsHub({
  initialGuest,
  initialUser,
  initialReports,
}: {
  initialGuest: ListAlertSubscriptionsResult
  initialUser: ListAlertSubscriptionsResult
  initialReports: { rows: AdminReportSubscriptionRow[], total: number }
}) {
  return (
      <Tabs defaultValue="alerts">
        <TabsList className="w-full sm:w-auto">
          <TabsTrigger value="alerts">Listing alerts</TabsTrigger>
          <TabsTrigger value="saved">Saved searches</TabsTrigger>
          <TabsTrigger value="reports">Market reports</TabsTrigger>
        </TabsList>
        <TabsContent value="alerts" className="pt-2">
          <AlertSubscriptionsTab kind="guest" initial={initialGuest} />
        </TabsContent>
        <TabsContent value="saved" className="pt-2">
          <AlertSubscriptionsTab kind="user" initial={initialUser} />
        </TabsContent>
        <TabsContent value="reports" className="pt-2">
          <ReportSubscriptionsTab initial={initialReports} />
        </TabsContent>
      </Tabs>
  )
}
