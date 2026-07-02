/**
 * ReportingTabStrip — the ONE shared sub-nav tab strip for every
 * /admin/crm/reporting/* page (desktop audit P2-8, 2026-07-02).
 *
 * Every report page previously re-declared its own REPORTING_TABS array
 * inline (13×), which is exactly how Contact Attempts drifted out of sync
 * (audit P1-5: missing Marketing + Deals). This module owns the canonical
 * base strip plus the three "contextual" reports that surface their own tab
 * only while active (Call Logs, Speed to Lead, Contact Attempts — FUB shows
 * these as hub cards, not permanent tabs), and the strip JSX, so the set can
 * never diverge again.
 *
 * Server component (Link only) — usable from every reporting page.
 */
import Link from 'next/link'
import { cn } from '@/lib/utils'
import HowReportingWorks from '@/components/admin/crm/reporting/HowReportingWorks'

export type ReportingTabKey =
  | 'overview'
  | 'agent-activity'
  | 'properties'
  | 'lead-sources'
  | 'calls'
  | 'texts'
  | 'batch-emails'
  | 'marketing'
  | 'deals'
  | 'appointments'
  | 'agent-goals'
  // Contextual (tab renders only while active):
  | 'call-logs'
  | 'speed-to-lead'
  | 'contact-attempts'

type Tab = { key: ReportingTabKey; label: string; href: string }

/** The 11 always-visible tabs, in FUB order. */
const BASE_TABS: Tab[] = [
  { key: 'overview', label: 'Overview', href: '/admin/crm/reporting' },
  { key: 'agent-activity', label: 'Agent Activity', href: '/admin/crm/reporting/agent-activity' },
  { key: 'properties', label: 'Properties', href: '/admin/crm/reporting/properties' },
  { key: 'lead-sources', label: 'Lead Sources', href: '/admin/crm/reporting/lead-sources' },
  { key: 'calls', label: 'Calls', href: '/admin/crm/reporting/calls' },
  { key: 'texts', label: 'Texts', href: '/admin/crm/reporting/texts' },
  { key: 'batch-emails', label: 'Batch Emails', href: '/admin/crm/reporting/batch-emails' },
  { key: 'marketing', label: 'Marketing', href: '/admin/crm/reporting/marketing' },
  { key: 'deals', label: 'Deals', href: '/admin/crm/reporting/deals' },
  { key: 'appointments', label: 'Appointments', href: '/admin/crm/reporting/appointments' },
  { key: 'agent-goals', label: 'Agent Goals', href: '/admin/crm/reporting/agent-goals' },
]

/** Card-only reports: their tab is inserted (active) after an anchor tab. */
const CONTEXTUAL_TABS: Partial<Record<ReportingTabKey, Tab & { after: ReportingTabKey }>> = {
  'call-logs': { key: 'call-logs', label: 'Call Logs', href: '/admin/crm/reporting/call-logs', after: 'calls' },
  'speed-to-lead': { key: 'speed-to-lead', label: 'Speed to Lead', href: '/admin/crm/reporting/speed-to-lead', after: 'lead-sources' },
  'contact-attempts': { key: 'contact-attempts', label: 'Contact Attempts', href: '/admin/crm/reporting/contact-attempts', after: 'batch-emails' },
}

/** Resolve the tab list for a page. `active` null = the hub (no tab active). */
export function reportingTabs(active: ReportingTabKey | null): Array<Tab & { active: boolean }> {
  const tabs: Array<Tab & { active: boolean }> = BASE_TABS.map((t) => ({
    ...t,
    active: t.key === active,
  }))
  const ctx = active ? CONTEXTUAL_TABS[active] : undefined
  if (ctx) {
    const i = tabs.findIndex((t) => t.key === ctx.after)
    tabs.splice(i + 1, 0, { key: ctx.key, label: ctx.label, href: ctx.href, active: true })
  }
  return tabs
}

/** The rendered strip (identical markup previously copy-pasted per page). */
export function ReportingTabStrip({ active }: { active: ReportingTabKey | null }) {
  return (
    <div className="mb-6 flex items-center border-b border-border">
      <div className="no-scrollbar flex items-center gap-0 overflow-x-auto">
        {reportingTabs(active).map((tab) => (
          <Link
            key={tab.key}
            href={tab.href}
            className={cn(
              'shrink-0 border-b-2 px-3 py-2.5 text-sm font-medium transition-colors',
              tab.active
                ? 'border-primary text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
          >
            {tab.label}
          </Link>
        ))}
      </div>
      {/* The working §11.1 explainer dialog on every page (the old copy-pasted
          strips rendered an inert Badge on 11 of 13 pages — zero-inert rule). */}
      <div className="ml-auto shrink-0 pb-0.5 pl-4">
        <HowReportingWorks />
      </div>
    </div>
  )
}
