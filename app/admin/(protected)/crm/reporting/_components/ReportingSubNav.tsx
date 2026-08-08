/**
 * ReportingSubNav — the ONE shared sub-nav for every /admin/crm/reporting/*
 * page. Migrated to the v2 admin language in 11F (was
 * components/admin/crm/reporting/ReportingTabStrip, which imported
 * components/ui and blocked 15 pages from the token gate).
 *
 * WHY A SUB-NAV EXISTS HERE AT ALL, given §5 gives the rail the destinations:
 * lib/admin/nav.ts exposes this family as a SINGLE child ("Reporting" →
 * /admin/crm/reporting). The other 14 reports have no other door. Deleting the
 * strip would strand them, so it migrates rather than dies — underline-on-
 * current (av2-subnav), not pills, so it reads as navigation and not as the
 * filter chip row acceptance bar #2 bans.
 *
 * The tab SET is owned here and nowhere else: every report page used to
 * re-declare its own array (13×), which is exactly how Contact Attempts drifted
 * out of sync (audit P1-5: missing Marketing + Deals).
 *
 * Server component (Link only) — usable from every reporting page.
 */
import '@/components/admin/v2/admin-v2.css'
import Link from 'next/link'
import { HowReportingWorks } from './HowReportingWorks'
import { ScrollActiveIntoView } from './ScrollActiveIntoView'

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

/** The 11 always-visible tabs. */
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

export function ReportingSubNav({ active }: { active: ReportingTabKey | null }) {
  return (
    <nav className="av2-subnav" aria-label="Reports">
      <div className="av2-subnav__scroll">
        <ScrollActiveIntoView />
        {reportingTabs(active).map((tab) => (
          <Link
            key={tab.key}
            href={tab.href}
            className="av2-subnav__link"
            aria-current={tab.active ? 'page' : undefined}
          >
            {tab.label}
          </Link>
        ))}
      </div>
      <div className="av2-subnav__aside">
        <HowReportingWorks />
      </div>
    </nav>
  )
}
