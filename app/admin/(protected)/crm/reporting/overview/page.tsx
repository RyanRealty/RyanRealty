// @no-parity — internal admin surface, no public mockup contract
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getCrmAccess } from '@/app/actions/crm'
import { scopeBroker } from '@/lib/crm/scope'
import { getOverviewReport } from '@/lib/data/crm/getOverviewReport'
import { CRM_BROKER_DISPLAY, CRM_BROKERS } from '@/lib/crm/constants'
import {
  HUB_AGENT_REPORTS,
  HUB_LEAD_SOURCE_REPORTS,
  HUB_MARKETING_REPORTS,
  type ReportHubCard,
} from '@/lib/crm/reporting-constants'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { OverviewKpiStrip } from './OverviewKpiStrip'
import CallsFilters from '../calls/CallsFilters'

export const metadata = { title: 'Overview | Reporting | CRM' }
export const dynamic = 'force-dynamic'

// ── Sub-nav tabs (Overview active at this route) ───────────────────────────────

const REPORTING_TABS = [
  { label: 'Overview',       href: '/admin/crm/reporting/overview', active: true },
  { label: 'Agent Activity', href: '/admin/crm/reporting/agent-activity', active: false },
  { label: 'Properties',     href: '/admin/crm/reporting/properties', active: false },
  { label: 'Lead Sources',   href: '/admin/crm/reporting/lead-sources', active: false },
  { label: 'Calls',          href: '/admin/crm/reporting/calls', active: false },
  { label: 'Texts',          href: '/admin/crm/reporting/texts', active: false },
  { label: 'Batch Emails',   href: '/admin/crm/reporting/batch-emails', active: false },
  { label: 'Marketing',      href: '/admin/crm/reporting/marketing', active: false },
  { label: 'Deals',          href: '/admin/crm/reporting/deals', active: false },
  { label: 'Appointments',   href: '/admin/crm/reporting/appointments', active: false },
  { label: 'Agent Goals',    href: '/admin/crm/reporting/agent-goals', active: false },
]

// ── Report card item (same design as the hub page) ────────────────────────────

function ReportCardItem({ card }: { card: ReportHubCard }) {
  return (
    <Link href={card.href} className="group block">
      <Card className="h-full cursor-pointer p-5 transition-shadow hover:shadow-md">
        <div className="mb-2 text-xl">{card.icon}</div>
        <p className="text-base font-semibold text-foreground group-hover:underline">
          {card.title}
        </p>
        <p className="mt-1 text-sm leading-snug text-muted-foreground">
          {card.description}
        </p>
      </Card>
    </Link>
  )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-3 text-sm font-medium uppercase tracking-wide text-muted-foreground">
      {children}
    </p>
  )
}

// ── Page params ───────────────────────────────────────────────────────────────

type SearchParams = {
  broker?: string
  date?: string
  t?: string
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function CrmOverviewReportPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const access = await getCrmAccess()
  if (!access) redirect('/admin/access-denied')

  const sp = await searchParams
  const scope = scopeBroker(access)
  const isSuperuser = access.role === 'superuser'

  const datePreset = (sp.date ?? 'this_month') as string

  let brokerFilter: string | null = null
  if (isSuperuser) {
    brokerFilter = sp.broker && sp.broker !== 'everyone' ? sp.broker : null
  } else {
    brokerFilter = scope
  }

  const currentBroker = sp.broker ?? 'everyone'
  const currentDate = datePreset

  // Fetch Overview KPI data
  const report = await getOverviewReport({
    brokerSlug: brokerFilter,
    datePreset,
  }).catch(() => null)

  const totals = report?.totals ?? {
    newLeads: 0,
    calls: 0,
    emails: 0,
    texts: 0,
    notes: 0,
    tasksCompleted: 0,
    appointments: 0,
  }
  const previousTotals = report?.previousTotals ?? { ...totals }
  const timeSeries = report?.timeSeries ?? []

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
      {/* Sub-nav tab strip */}
      <div className="mb-6 flex items-center border-b border-border">
        <div className="no-scrollbar flex items-center gap-0 overflow-x-auto">
          {REPORTING_TABS.map((tab) => (
            <Link
              key={tab.href}
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
        <div className="ml-auto shrink-0 pb-0.5 pl-4">
          <Badge variant="outline" className="text-muted-foreground">
            ⓘ How Reporting works
          </Badge>
        </div>
      </div>

      {/* Header row + filter bar */}
      <div className="mb-2 flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-1.5 text-sm">
          <span className="text-muted-foreground">Show me</span>
          <span className="font-medium text-foreground">
            overview of team activity
          </span>
        </div>

        {/* Filter controls — agent + date (superuser only; others are scoped) */}
        {isSuperuser ? (
          <CallsFilters
            currentBroker={currentBroker}
            currentDate={currentDate}
            brokers={CRM_BROKERS.map((slug) => ({
              slug,
              label: CRM_BROKER_DISPLAY[slug],
            }))}
          />
        ) : null}
      </div>

      {/* Cache notice */}
      <p className="mb-6 text-xs text-muted-foreground">
        Reporting results may be cached for up to 10 minutes.{' '}
        <Link
          href={`/admin/crm/reporting/overview?broker=${currentBroker}&date=${currentDate}&t=${Date.now()}`}
          className="text-muted-foreground hover:underline"
        >
          Refresh results.
        </Link>
      </p>

      {/*
        ── KPI tile strip ──
        7 top-line metrics for the selected period + broker scope.
        Sparklines show per-day shape; totals use COUNT:exact (exact values).
        Honest empty state: tiles show 0 when no data exists — never fabricated.
      */}
      <OverviewKpiStrip
        totals={totals}
        previousTotals={previousTotals}
        timeSeries={timeSeries}
      />

      {/*
        ── Report hub cards ──
        Navigable cards grouped by section — matches FUB Screen 2 layout.
        Reuses card data from reporting-constants (HUB_* arrays).
      */}

      {/* Section: Agents */}
      <section className="mb-8">
        <SectionLabel>Agents</SectionLabel>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {HUB_AGENT_REPORTS.map((card) => (
            <ReportCardItem key={card.title} card={card} />
          ))}
        </div>
      </section>

      {/* Section: Lead Sources */}
      <section className="mb-8">
        <SectionLabel>Lead Sources</SectionLabel>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {HUB_LEAD_SOURCE_REPORTS.map((card) => (
            <ReportCardItem key={card.title} card={card} />
          ))}
        </div>
      </section>

      {/* Section: Marketing */}
      <section>
        <SectionLabel>Marketing</SectionLabel>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {HUB_MARKETING_REPORTS.map((card) => (
            <ReportCardItem key={card.title} card={card} />
          ))}
        </div>
      </section>
    </div>
  )
}
