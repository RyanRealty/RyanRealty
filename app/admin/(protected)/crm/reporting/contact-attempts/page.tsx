// @no-parity — internal admin surface
//
// INFERRED: No dedicated CRM frame exists for Contact Attempts as a standalone page.
// CRM surfaces this as a subview of Lead Sources
// (hub href: /admin/crm/reporting/lead-sources?view=attempts).
// Metric semantics — avg outbound contacts per lead by source — are inferred from
// CRM's documentation and the hub card copy. See getContactAttemptsReport.ts.
//
// 11C: migrated to the LOCKED admin v2 language (design_system/admin/ADMIN_UI.md).
// Presentation only. Carried over verbatim: the getCrmAccess guard, the
// superuser/broker scoping, ?broker/?date/?t handling, the DAL call and its
// catch-to-null, every zero default, the prior-period sub-labels, the per-source
// drill hrefs, and the ReportingSubNav sub-nav.
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getCrmAccess } from '@/app/actions/crm'
import { scopeBroker } from '@/lib/crm/scope'
import { getContactAttemptsReport } from '@/lib/data/crm/getContactAttemptsReport'
import type { ContactAttemptsRow, ContactAttemptsTotals } from '@/lib/data/crm/getContactAttemptsReport'
import { CRM_BROKER_DISPLAY, CRM_BROKERS } from '@/lib/crm/constants'
import {
  VerdictLine,
  SectionHead,
  ReportGrid,
  ReportNumbers,
  ReportFreshness,
  ReportError,
  type ReportColumn,
  type ReportGridRow,
} from '@/components/admin/v2'
import ContactAttemptsFilters from './ContactAttemptsFilters'
import { ReportingSubNav } from '../_components/ReportingSubNav'

export const metadata = { title: 'Contact Attempts | Reporting | CRM' }
export const dynamic = 'force-dynamic'

const COLUMNS: ReportColumn[] = [
  { key: 'source', label: 'Source' },
  { key: 'leads', label: 'Leads', numeric: true },
  { key: 'avg', label: 'Avg attempts', numeric: true },
  { key: 'total', label: 'Total attempts', numeric: true },
]

// ── Search params ──────────────────────────────────────────────────────────────

type SearchParams = {
  broker?: string
  date?: string
  t?: string
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default async function ContactAttemptsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const access = await getCrmAccess()
  if (!access) redirect('/admin/access-denied')

  const sp = await searchParams
  const scope = scopeBroker(access)
  const isSuperuser = access.role === 'superuser'

  const datePreset = (sp.date ?? 'this_month') as
    | 'today'
    | 'this_week'
    | 'this_month'
    | 'this_year'
    | 'custom'

  let brokerFilter: string | null = null
  if (isSuperuser) {
    brokerFilter = sp.broker && sp.broker !== 'everyone' ? sp.broker : null
  } else {
    brokerFilter = scope
  }

  const currentBroker = sp.broker ?? 'everyone'
  const currentDate = datePreset

  // Fetch report data — failure returns null and renders the honest failed-read state
  const report = await getContactAttemptsReport({
    brokerSlug: brokerFilter,
    datePreset,
  }).catch(() => null)

  const rows: ContactAttemptsRow[] = report?.rows ?? []
  const totals: ContactAttemptsTotals = report?.totals ?? {
    leads: 0,
    totalAttempts: 0,
    avgAttempts: 0,
  }
  const previousTotals: ContactAttemptsTotals = report?.previousTotals ?? {
    leads: 0,
    totalAttempts: 0,
    avgAttempts: 0,
  }

  const nowMs = Date.now()
  const refreshHref = `/admin/crm/reporting/contact-attempts?broker=${currentBroker}&date=${currentDate}&t=${nowMs}`

  const gridRows: ReportGridRow[] = rows.map((row) => {
    const sourceParam = row.sourceKey
      ? encodeURIComponent(row.sourceKey)
      : '__unspecified__'
    const drillHref = `/admin/crm?source=${sourceParam}&date=${currentDate}`
    return {
      key: row.sourceName,
      cells: [
        // Source name — links to the People list filtered by source
        <Link key="s" href={drillHref} style={{ color: 'var(--a-accent)' }}>
          {row.sourceName}
        </Link>,
        row.leads === 0 ? (
          <span key="l" style={{ color: 'var(--a-text-2)' }}>
            0
          </span>
        ) : (
          row.leads.toLocaleString('en-US')
        ),
        // Avg attempts — em-dash when no leads (data unavailable placeholder)
        row.leads === 0 ? (
          <span key="a" style={{ color: 'var(--a-text-2)' }}>
            —
          </span>
        ) : row.avgAttempts === 0 ? (
          <span key="a" style={{ color: 'var(--a-text-2)' }}>
            0.0
          </span>
        ) : (
          <span key="a" style={{ fontWeight: 600 }}>
            {row.avgAttempts.toFixed(1)}
          </span>
        ),
        row.totalAttempts === 0 ? (
          <span key="t" style={{ color: 'var(--a-text-2)' }}>
            0
          </span>
        ) : (
          row.totalAttempts.toLocaleString('en-US')
        ),
      ],
    }
  })

  return (
    <div className="av2-scope" style={{ maxWidth: 960, margin: '0 auto', padding: 16 }}>
      <ReportingSubNav active="contact-attempts" />

      <div style={{ margin: '0 0 14px' }}>
        <VerdictLine tone={totals.leads > 0 && totals.avgAttempts > 0 ? 'ok' : 'attention'}>
          {totals.leads === 0 ? (
            <>
              <b>No lead came in this period.</b> There is nothing to follow up on yet.
            </>
          ) : (
            <>
              <b>{totals.avgAttempts.toFixed(1)} contact attempts per lead.</b>{' '}
              {totals.totalAttempts.toLocaleString('en-US')} attempts across{' '}
              {totals.leads.toLocaleString('en-US')} leads.
            </>
          )}
        </VerdictLine>
      </div>

      {report === null ? (
        <ReportError what="Contact attempts" href={refreshHref} />
      ) : null}

      {/* Filter controls — superuser only; non-superuser is broker-scoped via RBAC */}
      {isSuperuser ? (
        <div className="av2-rfilters">
          <ContactAttemptsFilters
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
        TOTAL LEADS      — leads with a lead_created event in period for scoped brokers
        TOTAL ATTEMPTS   — outbound contact events on those leads (call, voicemail, email, text)
        AVG / LEAD       — totalAttempts / leads; the headline metric
        Sub-lines show the equivalent figure from the prior period.
      */}
      <ReportNumbers
        items={[
          {
            key: 'leads',
            label: 'Total leads',
            value: totals.leads.toLocaleString('en-US'),
            delta:
              previousTotals.leads > 0
                ? {
                    text: `vs ${previousTotals.leads.toLocaleString('en-US')} prior period`,
                    direction: 'flat',
                  }
                : undefined,
          },
          {
            key: 'attempts',
            label: 'Total attempts',
            value: totals.totalAttempts.toLocaleString('en-US'),
            delta:
              previousTotals.totalAttempts > 0
                ? {
                    text: `vs ${previousTotals.totalAttempts.toLocaleString('en-US')} prior period`,
                    direction: 'flat',
                  }
                : undefined,
          },
          {
            key: 'avg',
            label: 'Avg / lead',
            value: totals.leads > 0 ? totals.avgAttempts.toFixed(1) : '—',
            delta:
              previousTotals.leads > 0
                ? {
                    text: `vs ${previousTotals.avgAttempts.toFixed(1)} prior period`,
                    direction: 'flat',
                  }
                : undefined,
          },
        ]}
      />

      <SectionHead>By lead source</SectionHead>
      <ReportGrid
        label="Average contact attempts by lead source"
        columns={COLUMNS}
        template="minmax(150px, 1.7fr) repeat(3, minmax(96px, 1fr))"
        minWidth={560}
        rows={gridRows}
        empty={
          <>
            No contact attempt was logged against a lead created in this period.{' '}
            <Link href="/admin/crm" style={{ color: 'var(--a-accent)' }}>
              Open the people list
            </Link>{' '}
            or widen the date range above.
          </>
        }
      />

      {/* Footer note — absorbs the column tooltip the legacy table hid behind a
          `title` attribute (ADMIN_UI bans title-attribute tooltips). */}
      <p style={{ fontSize: 'var(--a-text-xs)', color: 'var(--a-text-2)', marginTop: 16 }}>
        Contact attempts include outbound calls, voicemails, emails, and texts logged by
        scoped brokers on leads created in the selected period. Automated drip sequences
        are excluded. Sources are ordered by lead volume, highest first.
      </p>
    </div>
  )
}
