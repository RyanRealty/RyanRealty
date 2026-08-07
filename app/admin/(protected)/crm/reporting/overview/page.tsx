// @no-parity — internal admin surface, no public mockup contract
//
// 11C: migrated to the LOCKED admin v2 language (design_system/admin/ADMIN_UI.md).
// Presentation only. Carried over verbatim: the getCrmAccess guard, the
// superuser/broker scoping, ?broker/?date/?t handling, the getOverviewReport call
// and its catch-to-null, every zero default, the seven metrics and their delta
// maths (OverviewKpiStrip), the three hub-card groups and every href in them, and
// the ReportingTabStrip sub-nav.
//
// The filter bar is now OverviewFilters — the same two params and the same
// router.push target as the CallsFilters this page borrowed, in a file this page
// owns, because CallsFilters is still shared with four unmigrated report pages.
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
import { VerdictLine, SectionHead, ReportFreshness, ReportError } from '@/components/admin/v2'
import { OverviewKpiStrip } from './OverviewKpiStrip'
import OverviewFilters from './OverviewFilters'
import { ReportingTabStrip } from '@/components/admin/crm/reporting/ReportingTabStrip'

export const metadata = { title: 'Overview | Reporting | CRM' }
export const dynamic = 'force-dynamic'

// ── Report list (the hub cards, as quiet rows — every title is a door) ────────

function ReportLane({ title, cards }: { title: string; cards: ReportHubCard[] }) {
  return (
    <section aria-label={title}>
      <SectionHead>{title}</SectionHead>
      <ul className="av2-quietlist">
        {cards.map((card) => (
          <li key={card.title} className="av2-quiet">
            <span aria-hidden="true" style={{ flex: 'none' }}>
              {card.icon}
            </span>
            <Link href={card.href} className="av2-quiet__name" style={{ color: 'var(--a-accent)' }}>
              {card.title}
            </Link>
            <span style={{ color: 'var(--a-text-2)' }}>{card.description}</span>
          </li>
        ))}
      </ul>
    </section>
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

  const nowMs = Date.now()
  const refreshHref = `/admin/crm/reporting/overview?broker=${currentBroker}&date=${currentDate}&t=${nowMs}`

  return (
    <div className="av2-scope" style={{ maxWidth: 960, margin: '0 auto', padding: 16 }}>
      <ReportingTabStrip active="overview" />

      <div style={{ margin: '0 0 14px' }}>
        <VerdictLine tone={totals.newLeads > 0 ? 'ok' : 'attention'}>
          {totals.newLeads === 0 ? (
            <>
              <b>No new lead in this period.</b> {totals.calls.toLocaleString('en-US')} calls,{' '}
              {totals.texts.toLocaleString('en-US')} texts and{' '}
              {totals.emails.toLocaleString('en-US')} emails still went out.
            </>
          ) : (
            <>
              <b>{totals.newLeads.toLocaleString('en-US')} new leads this period.</b>{' '}
              {totals.calls.toLocaleString('en-US')} calls,{' '}
              {totals.texts.toLocaleString('en-US')} texts,{' '}
              {totals.emails.toLocaleString('en-US')} emails,{' '}
              {totals.appointments.toLocaleString('en-US')} appointments.
            </>
          )}
        </VerdictLine>
      </div>

      {report === null ? <ReportError what="The CRM overview" href={refreshHref} /> : null}

      {/* Filter controls — agent + date (superuser only; others are scoped) */}
      {isSuperuser ? (
        <div className="av2-rfilters">
          <OverviewFilters
            currentBroker={currentBroker}
            currentDate={currentDate}
            brokers={CRM_BROKERS.map((slug) => ({
              slug,
              label: CRM_BROKER_DISPLAY[slug],
            }))}
          />
        </div>
      ) : null}

      <ReportFreshness href={refreshHref} nowMs={nowMs} />

      {/*
        ── The period's figures ──
        7 top-line metrics for the selected period + broker scope.
        Sparklines show per-day shape; totals use COUNT:exact (exact values).
        Honest empty state: figures show 0 when no data exists — never fabricated.
      */}
      <OverviewKpiStrip
        totals={totals}
        previousTotals={previousTotals}
        timeSeries={timeSeries}
      />

      {/* ── The reports behind this one ── */}
      <ReportLane title="Agents" cards={HUB_AGENT_REPORTS} />
      <ReportLane title="Lead sources" cards={HUB_LEAD_SOURCE_REPORTS} />
      <ReportLane title="Marketing" cards={HUB_MARKETING_REPORTS} />
    </div>
  )
}
