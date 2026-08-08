// @no-parity — internal admin surface
//
// 11C: migrated to the LOCKED admin v2 language (design_system/admin/ADMIN_UI.md).
// Presentation only. Carried over verbatim: the getCrmAccess guard, scopeBroker
// (a broker sees their own row, the principal sees the roster), the ?year clamp
// (2020–2030, else this year), the DAL call and its catch-to-null, formatPrice
// for GCI, the goal-progress computation, the honest "goal-setting not shipped"
// notice, and the ReportingSubNav sub-nav.
//
// Two deliberate changes the ADMIN_UI acceptance bar requires:
//   - the standalone "<year> Goals" <h1> is gone (no page-title chrome; the nav
//     names the page, and the verdict line carries the year);
//   - the agent's name is now a door to that broker's people list — dead text
//     naming a linkable thing is a defect (bar item 3).
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getCrmAccess } from '@/app/actions/crm'
import { scopeBroker } from '@/lib/crm/scope'
import { getAgentGoalsReport, type AgentGoalsRow } from '@/lib/data/crm/getAgentGoalsReport'
import { formatPrice } from '@/lib/format/money'
import {
  VerdictLine,
  SectionHead,
  ReportGrid,
  GoalMeter,
  ReportFreshness,
  ReportError,
  type ReportColumn,
  type ReportGridRow,
} from '@/components/admin/v2'
import { AgentGoalsYearSelect } from './AgentGoalsYearSelect'
import { ReportingSubNav } from '../_components/ReportingSubNav'

export const metadata = { title: 'Agent Goals | Reporting | CRM' }
export const dynamic = 'force-dynamic'

// ── Helpers ───────────────────────────────────────────────────────────────────

// GCI display rounded to nearest $1,000 per brand voice (§0).
function fmtCurrency(dollars: number): string {
  return formatPrice(dollars)
}

function GoalProgress({ earned, goal }: { earned: number; goal: number | null }) {
  if (goal === null || goal === 0) {
    return <span style={{ color: 'var(--a-text-2)' }}>—</span>
  }
  const pct = Math.min(100, Math.round((earned / goal) * 100))
  return <GoalMeter pct={pct} />
}

function AgentName({ row }: { row: AgentGoalsRow }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
      {row.avatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={row.avatarUrl}
          alt=""
          width={24}
          height={24}
          style={{ width: 24, height: 24, flex: 'none', borderRadius: '50%', objectFit: 'cover', objectPosition: 'top' }}
        />
      ) : (
        <span
          aria-hidden="true"
          style={{
            display: 'inline-flex',
            width: 24,
            height: 24,
            flex: 'none',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: '50%',
            background: 'var(--a-inset)',
            color: 'var(--a-text-2)',
            fontSize: 'var(--a-text-xs)',
            fontWeight: 600,
          }}
        >
          {row.brokerName.charAt(0)}
        </span>
      )}
      <Link href={`/admin/crm?broker=${row.brokerSlug}`} style={{ color: 'var(--a-accent)' }}>
        {row.brokerName}
      </Link>
    </span>
  )
}

const COLUMNS: ReportColumn[] = [
  { key: 'agent', label: 'Agent' },
  { key: 'closed', label: 'Closed deals', numeric: true },
  { key: 'upcoming', label: 'Upcoming deals', numeric: true },
  { key: 'earned', label: 'Commission earned', numeric: true },
  { key: 'goal', label: 'Commission goal', numeric: true },
  { key: 'progress', label: 'Goal progress' },
]

// ── Search params ─────────────────────────────────────────────────────────────

type SearchParams = {
  year?: string
  t?: string
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function AgentGoalsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const access = await getCrmAccess()
  if (!access) redirect('/admin/access-denied')

  const sp = await searchParams
  const scope = scopeBroker(access)

  const currentYear = (() => {
    const raw = parseInt(sp.year ?? '', 10)
    if (!isNaN(raw) && raw >= 2020 && raw <= 2030) return raw
    return new Date().getFullYear()
  })()

  // Goals report is always shown for the full roster (no per-agent filter —
  // a year selector only). For non-superusers, scope them to their own row.
  const brokerSlug = scope // null = superuser sees everyone

  const report = await getAgentGoalsReport({ year: currentYear, brokerSlug }).catch(() => null)
  const rows: AgentGoalsRow[] = report?.rows ?? []

  const nowMs = Date.now()
  const refreshHref = `/admin/crm/reporting/agent-goals?year=${currentYear}&t=${nowMs}`

  // The V1 state the legacy page stated in a notice box: no commission-goal
  // store exists, so every row's goal comes back null. Read it rather than
  // assert it, so the line stops being a lie the day goal-setting ships.
  const goalsSet = rows.filter((r) => r.commissionGoal !== null).length

  const gridRows: ReportGridRow[] = rows.map((row) => ({
    key: row.brokerSlug,
    cells: [
      <AgentName key="a" row={row} />,
      row.closedDeals === 0 ? (
        <span key="c" style={{ color: 'var(--a-text-2)' }}>
          0
        </span>
      ) : (
        row.closedDeals.toLocaleString('en-US')
      ),
      row.upcomingDeals === 0 ? (
        <span key="u" style={{ color: 'var(--a-text-2)' }}>
          0
        </span>
      ) : (
        row.upcomingDeals.toLocaleString('en-US')
      ),
      <span key="e" style={{ color: row.commissionEarned === 0 ? 'var(--a-text-2)' : 'var(--a-text)' }}>
        {fmtCurrency(row.commissionEarned)}
      </span>,
      // Commission goal — honest deferred state when unset. Goal-setting
      // persistence is a future increment (no commission-goal store exists in
      // V1). The prior "Set goal" link pointed at a route that does not exist
      // and 404'd (2026-07-02 audit), so this stays a non-navigating word.
      row.commissionGoal === null ? (
        <span key="g" style={{ color: 'var(--a-text-2)' }}>
          Not set
        </span>
      ) : (
        fmtCurrency(row.commissionGoal)
      ),
      <GoalProgress key="p" earned={row.commissionEarned} goal={row.commissionGoal} />,
    ],
  }))

  return (
    <div className="av2-scope" style={{ maxWidth: 960, margin: '0 auto', padding: 16 }}>
      <ReportingSubNav active="agent-goals" />

      <div style={{ margin: '0 0 14px' }}>
        <VerdictLine tone={goalsSet > 0 ? 'ok' : 'attention'}>
          {goalsSet > 0 ? (
            <>
              <b>
                {currentYear} goals: {goalsSet} of {rows.length} agent
                {rows.length === 1 ? '' : 's'} set.
              </b>{' '}
              Closed deals, upcoming deals, and commission earned are live.
            </>
          ) : (
            <>
              <b>No annual commission goal is configured for {currentYear}.</b> Closed deals,
              upcoming deals, and commission earned below are live; goal progress cannot be
              scored until per-agent goal-setting ships.
            </>
          )}
        </VerdictLine>
      </div>

      {report === null ? <ReportError what="Agent goals" href={refreshHref} /> : null}

      <div className="av2-rfilters">
        <AgentGoalsYearSelect currentYear={currentYear} />
      </div>

      <ReportFreshness href={refreshHref} nowMs={nowMs} />

      <SectionHead>Per agent — {currentYear}</SectionHead>
      <ReportGrid
        label={`${currentYear} agent goals`}
        columns={COLUMNS}
        template="minmax(150px, 1.5fr) repeat(4, minmax(92px, 1fr)) minmax(120px, 1.2fr)"
        minWidth={760}
        rows={gridRows}
        empty={
          <>
            No CRM-active broker has a roster row, so there is nothing to score.{' '}
            <Link href="/admin/crm/settings/brokers" style={{ color: 'var(--a-accent)' }}>
              Open broker settings
            </Link>
            .
          </>
        }
      />

      <p style={{ fontSize: 'var(--a-text-xs)', color: 'var(--a-text-2)', marginTop: 16 }}>
        Commission earned is the sum of stored deal commission on deals that closed inside{' '}
        {currentYear}. Upcoming deals are open-pipeline deals. Agents are listed in roster
        order.
      </p>
    </div>
  )
}
