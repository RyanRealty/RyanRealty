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
 *
 * P11F: on the LOCKED admin v2 language. Radix <Tabs> is replaced by a real
 * hand-wired tablist — role=tablist/tab/tabpanel, aria-selected, the
 * aria-controls pairing and Left/Right/Home/End roving — the same shape
 * NewsletterComposeForm uses, because v2's TabBar is a <nav> of links for
 * page-level navigation and is the wrong primitive for in-page views. Only the
 * inactive panel is skipped, which is what Radix's Content already did.
 *
 * The selected tab is marked with the accent BORDER and text, never an inline
 * background: .av2-btn--quiet carries its hover in the stylesheet, and an
 * inline background would outrank it and leave every tab dead on hover.
 */

import { useState } from 'react'
import { Button } from '@/components/admin/v2'
import type {
  ListAlertSubscriptionsResult,
  AdminReportSubscriptionRow,
} from '@/lib/data/crm/subscriptionsAdmin'
import type { GlobalDeliverySummary } from '@/lib/data/crm/emailDelivery'
import type { PendingApprovalGroup } from '@/lib/data/leads/listingAlertApprovals'
import AlertSubscriptionsTab from '@/components/admin/crm/subscriptions/AlertSubscriptionsTab'
import ReportSubscriptionsTab from '@/components/admin/crm/subscriptions/ReportSubscriptionsTab'
import DeliveryTab from '@/components/admin/crm/subscriptions/DeliveryTab'
import ApprovalQueueTab from '@/components/admin/crm/subscriptions/ApprovalQueueTab'

type TabKey = 'alerts' | 'saved' | 'approve' | 'reports' | 'delivery'

const TAB_ORDER: readonly TabKey[] = ['alerts', 'saved', 'approve', 'reports', 'delivery']

export default function SubscriptionsHub({
  initialGuest,
  initialUser,
  initialReports,
  initialDelivery,
  initialApprovals,
}: {
  initialGuest: ListAlertSubscriptionsResult
  initialUser: ListAlertSubscriptionsResult
  initialReports: { rows: AdminReportSubscriptionRow[], total: number }
  initialDelivery: GlobalDeliverySummary
  initialApprovals: PendingApprovalGroup[]
}) {
  const approvalCount = initialApprovals.reduce((n, g) => n + g.items.length, 0)
  const [tab, setTab] = useState<TabKey>('alerts')

  const tabs: ReadonlyArray<{ key: TabKey, label: string }> = [
    { key: 'alerts', label: 'Listing alerts' },
    { key: 'saved', label: 'Saved searches' },
    {
      key: 'approve',
      label: `To approve${approvalCount > 0 ? ` (${approvalCount.toLocaleString('en-US')})` : ''}`,
    },
    { key: 'reports', label: 'Market reports' },
    { key: 'delivery', label: 'Delivery' },
  ]

  return (
    <div>
      <div
        data-tour="subs-tabs"
        className="flex w-full flex-wrap gap-1.5 sm:w-auto"
        role="tablist"
        aria-label="Alerts & reports views"
        onKeyDown={(e) => {
          const i = TAB_ORDER.indexOf(tab)
          let next: TabKey | null = null
          if (e.key === 'ArrowRight') next = TAB_ORDER[(i + 1) % TAB_ORDER.length]
          else if (e.key === 'ArrowLeft') next = TAB_ORDER[(i - 1 + TAB_ORDER.length) % TAB_ORDER.length]
          else if (e.key === 'Home') next = TAB_ORDER[0]
          else if (e.key === 'End') next = TAB_ORDER[TAB_ORDER.length - 1]
          if (!next) return
          e.preventDefault()
          setTab(next)
          document.getElementById(`subs-tab-${next}`)?.focus()
        }}
      >
        {tabs.map((t) => (
          <Button
            key={t.key}
            id={`subs-tab-${t.key}`}
            variant="quiet"
            role="tab"
            aria-selected={tab === t.key}
            aria-controls={`subs-panel-${t.key}`}
            // Roving tabindex: only the selected tab is in the tab order, which
            // is what makes Left/Right the way you move between them.
            tabIndex={tab === t.key ? 0 : -1}
            onClick={() => setTab(t.key)}
            style={
              tab === t.key
                ? { borderColor: 'var(--a-accent)', color: 'var(--a-accent)' }
                : { color: 'var(--a-text-2)' }
            }
          >
            {t.label}
          </Button>
        ))}
      </div>

      {tab === 'alerts' ? (
        <div id="subs-panel-alerts" role="tabpanel" aria-labelledby="subs-tab-alerts" className="pt-2">
          <AlertSubscriptionsTab kind="guest" initial={initialGuest} />
        </div>
      ) : null}
      {tab === 'saved' ? (
        <div id="subs-panel-saved" role="tabpanel" aria-labelledby="subs-tab-saved" className="pt-2">
          <AlertSubscriptionsTab kind="user" initial={initialUser} />
        </div>
      ) : null}
      {tab === 'approve' ? (
        <div id="subs-panel-approve" role="tabpanel" aria-labelledby="subs-tab-approve" className="pt-2">
          <ApprovalQueueTab initial={initialApprovals} />
        </div>
      ) : null}
      {tab === 'reports' ? (
        <div id="subs-panel-reports" role="tabpanel" aria-labelledby="subs-tab-reports" className="pt-2">
          <ReportSubscriptionsTab initial={initialReports} />
        </div>
      ) : null}
      {tab === 'delivery' ? (
        <div id="subs-panel-delivery" role="tabpanel" aria-labelledby="subs-tab-delivery" className="pt-2">
          <DeliveryTab initial={initialDelivery} />
        </div>
      ) : null}
    </div>
  )
}
