'use client'

/**
 * SubscriptionsHub — the client shell of the Alerts & reports hub
 * (/admin/crm/subscriptions). Four tabs: listing alerts + saved searches
 * (both rows of the canonical listing_alerts table, split by user_id),
 * market report subscriptions (crm_report_subscriptions), and Delivery
 * (what actually went out). Each tab manages its own filters, pagination,
 * selection, and bulk actions.
 *
 * Toasts render through the global Toaster mounted in RootProvider.
 */

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import type {
  ListAlertSubscriptionsResult,
  AdminReportSubscriptionRow,
} from '@/lib/data/crm/subscriptionsAdmin'
import type { GlobalDeliverySummary } from '@/lib/data/crm/emailDelivery'
import AlertSubscriptionsTab from '@/components/admin/crm/subscriptions/AlertSubscriptionsTab'
import ReportSubscriptionsTab from '@/components/admin/crm/subscriptions/ReportSubscriptionsTab'
import DeliveryTab from '@/components/admin/crm/subscriptions/DeliveryTab'

export default function SubscriptionsHub({
  initialGuest,
  initialUser,
  initialReports,
  initialDelivery,
}: {
  initialGuest: ListAlertSubscriptionsResult
  initialUser: ListAlertSubscriptionsResult
  initialReports: { rows: AdminReportSubscriptionRow[], total: number }
  initialDelivery: GlobalDeliverySummary
}) {
  return (
      <Tabs defaultValue="alerts">
        <TabsList data-tour="subs-tabs" className="w-full sm:w-auto">
          <TabsTrigger value="alerts">Listing alerts</TabsTrigger>
          <TabsTrigger value="saved">Saved searches</TabsTrigger>
          <TabsTrigger value="reports">Market reports</TabsTrigger>
          <TabsTrigger value="delivery">Delivery</TabsTrigger>
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
        <TabsContent value="delivery" className="pt-2">
          <DeliveryTab initial={initialDelivery} />
        </TabsContent>
      </Tabs>
  )
}
