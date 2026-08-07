// @no-parity — internal admin tool (brokerage commission roll-up, TC rung 11)
//
// 11D: migrated to the LOCKED admin v2 language (design_system/admin/ADMIN_UI.md),
// worklist pattern (4). Presentation only — every figure here is money a broker
// gets paid, so nothing about how a number is produced or printed moved.
//
// THE FORMATTER STAYS. `money` and `d10` are NOT routed through lib/format.
// formatPrice rounds to the nearest $1,000 (it would print this page's $15,570
// projection as $16,000). formatPriceExact matches `money` on every positive
// value and on null, but flips the sign placement on negatives ($-4,200 vs
// -$4,200) and breaks .5 the other way (Math.round → $-1,234, Intl → -$1,235).
// `d10` slices the first ten characters of the stored date string; formatDate
// parses a date-only string as UTC and re-projects it to America/Los_Angeles,
// which moves a printed closing day BACK BY ONE. Both are §0 figure changes, not
// presentation changes, so both helpers are carried character for character.
//
// Carried over verbatim: requireAdminPage('commissions.view'),
// getCommissionsRollup(), the earned/projected split on `status !== 'projected'`,
// the byBroker map and its all/YTD buckets, the `closing_date.startsWith(thisYear)`
// YTD window, the office roll-up arithmetic, the ledger's closing-date-descending
// sort and the projected list's ascending one, the per-broker agent-net-descending
// sort, every status word (Projected / Verified / Paid), every side word, the
// /admin/deals/<property_key> hrefs and their encodeURIComponent, the
// /admin/financials href, and the cycle-id fallback for an unnamed deal.
//
// Shape changed, data did not: the page's own <main> is gone (ConsoleShell owns
// the landmark), the KpiStrip became the family's numbers strip (same two
// figures, same labels), and the broker cards / escrow list / shadcn ledger
// table with its phone card deck became three ReportGrids that scroll inside
// their own box.
//
// THREE FALSE DOORS REMOVED. The old page capped the ledger at 6 rows, the
// escrow list at 3 and the broker cards at 6, then offered "See all 22 ledger
// rows →" and "See all N brokers →" pointing at /admin/financials — which
// renders a per-YEAR P&L and holds no commission row and no per-broker line —
// and "See all N in escrow →" pointing at /admin/deals, a redirect bridge to the
// closings board. None of the three destinations could show what its link
// promised, so the caps are gone and every row the reader returns is on the
// page, in the same order, with the same figures. The grid, not the page, owns
// the sideways scroll.
//
// A ZERO-ROW READ IS NOT A MEASUREMENT. getCommissionsRollup returns [] both
// when the table is empty and when the Supabase read errors (`const { data } =
// …` discards the error). The page cannot tell them apart, so it says so rather
// than printing "No commissions on record yet" over a failed read.
import Link from 'next/link'
import {
  ReportGrid,
  ReportNumbers,
  SectionHead,
  StateWord,
  VerdictLine,
  type AdminState,
  type ReportColumn,
  type ReportGridRow,
} from '@/components/admin/v2'
import { getCommissionsRollup, type TcCommissionRollupRow } from '@/app/actions/tc-commissions'
import { requireAdminPage } from '@/lib/admin/require-admin'

export const dynamic = 'force-dynamic'

const money = (v: number | null | undefined) =>
  v == null ? '—' : `$${Math.round(v).toLocaleString('en-US')}`
const d10 = (v: string | null | undefined) => (v ? String(v).slice(0, 10) : '—')

const STATUS_WORD: Record<string, { label: string; state: AdminState }> = {
  projected: { label: 'Projected', state: 'slow' },
  settlement_verified: { label: 'Verified', state: 'ok' },
  paid: { label: 'Paid', state: 'accent' },
}

const SIDE_LABEL: Record<string, string> = {
  listing: 'Listing',
  buyer: 'Buyer',
  both: 'Both',
  unknown: '—',
}

const BROKER_COLUMNS: ReportColumn[] = [
  { key: 'broker', label: 'Broker' },
  { key: 'net', label: 'Net all time', numeric: true },
  { key: 'closings', label: 'Closings', numeric: true },
  { key: 'ytd', label: 'Net YTD', numeric: true },
]

const ESCROW_COLUMNS: ReportColumn[] = [
  { key: 'deal', label: 'Deal' },
  { key: 'broker', label: 'Broker' },
  { key: 'gross', label: 'Gross', numeric: true },
  { key: 'closes', label: 'Closes' },
]

const LEDGER_COLUMNS: ReportColumn[] = [
  { key: 'deal', label: 'Deal' },
  { key: 'broker', label: 'Broker' },
  { key: 'side', label: 'Side' },
  { key: 'sale_price', label: 'Sale price', numeric: true },
  { key: 'gci', label: 'Gross', numeric: true },
  { key: 'agent', label: 'Agent net', numeric: true },
  { key: 'brokerage', label: 'Brokerage net', numeric: true },
  { key: 'closed', label: 'Closed' },
  { key: 'status', label: 'Status' },
]

type Totals = { n: number; gci: number; agent: number; brokerage: number }
const zero = (): Totals => ({ n: 0, gci: 0, agent: 0, brokerage: 0 })
function addTo(t: Totals, r: TcCommissionRollupRow) {
  t.n += 1
  t.gci += r.gci ?? 0
  t.agent += r.agent_net ?? 0
  t.brokerage += r.brokerage_net ?? 0
}

/** The deal's address is the door to the deal (acceptance bar rule 3). */
function dealCell(r: TcCommissionRollupRow) {
  return (
    <Link
      key="deal"
      href={`/admin/deals/${encodeURIComponent(r.property_key ?? '')}`}
      title={r.address ?? undefined}
      style={{ color: 'var(--a-accent)' }}
    >
      {r.address ?? r.cycle_id.slice(0, 8)}
    </Link>
  )
}

export default async function CommissionsPage() {
  // Brokerage-wide commissions are superuser-only (D4 — brokers see own rows via
  // row scope, not this all-broker rollup). Nav hides it; the page must enforce
  // it (a broker typing /admin/commissions otherwise reads every broker's GCI +
  // compensation — audit HIGH, RC5 class).
  await requireAdminPage('commissions.view')
  const rows = await getCommissionsRollup()
  const earned = rows.filter((r) => r.status !== 'projected')
  const projected = rows.filter((r) => r.status === 'projected')

  const thisYear = String(new Date().getFullYear())
  const byBroker = new Map<string, { all: Totals; ytd: Totals }>()
  for (const r of earned) {
    const e = byBroker.get(r.broker_name) ?? { all: zero(), ytd: zero() }
    addTo(e.all, r)
    if ((r.closing_date ?? '').startsWith(thisYear)) addTo(e.ytd, r)
    byBroker.set(r.broker_name, e)
  }
  const officeAll = zero()
  const officeYtd = zero()
  for (const e of byBroker.values()) {
    officeAll.n += e.all.n
    officeAll.gci += e.all.gci
    officeAll.agent += e.all.agent
    officeAll.brokerage += e.all.brokerage
    officeYtd.n += e.ytd.n
    officeYtd.gci += e.ytd.gci
    officeYtd.agent += e.ytd.agent
    officeYtd.brokerage += e.ytd.brokerage
  }

  const sorted = [...rows].sort((a, b) => (b.closing_date ?? '').localeCompare(a.closing_date ?? ''))

  const projectedSorted = [...projected].sort(
    (a, b) => (a.closing_date ?? '').localeCompare(b.closing_date ?? ''),
  )
  const projectedGci = projected.reduce((s, r) => s + (r.gci ?? 0), 0)

  const brokerEntries = [...byBroker.entries()].sort((a, b) => b[1].all.agent - a[1].all.agent)

  const brokerRows: ReportGridRow[] = brokerEntries.map(([name, e]) => ({
    key: name,
    cells: [name, money(e.all.agent), e.all.n, money(e.ytd.agent)],
  }))

  const escrowRows: ReportGridRow[] = projectedSorted.map((r) => ({
    key: r.id,
    cells: [dealCell(r), r.broker_name, money(r.gci), d10(r.closing_date)],
  }))

  const ledgerRows: ReportGridRow[] = sorted.map((r) => {
    const st = STATUS_WORD[r.status] ?? STATUS_WORD.projected
    return {
      key: r.id,
      cells: [
        dealCell(r),
        r.broker_name,
        SIDE_LABEL[r.side],
        money(r.sale_price),
        money(r.gci),
        money(r.agent_net),
        money(r.brokerage_net),
        d10(r.closing_date),
        <StateWord key="st" state={st.state}>
          {st.label}
        </StateWord>,
      ],
    }
  })

  return (
    <div className="av2-scope" style={{ maxWidth: 1100, margin: '0 auto', padding: 16 }}>
      <div style={{ margin: '0 0 14px' }}>
        <VerdictLine tone={rows.length === 0 ? 'attention' : 'ok'}>
          {rows.length === 0 ? (
            <>
              <b>No commission row came back.</b> The reader returns an empty list both when the
              ledger is empty and when the read fails, so this is not proof there are none.
            </>
          ) : (
            <>
              <b>
                {money(officeYtd.gci)} gross commission income in {thisYear},{' '}
                {money(officeAll.gci)} all time.
              </b>{' '}
              {earned.length} settled{projected.length ? `, ${projected.length} still in escrow` : ''}
              . Every deal name opens its file.
            </>
          )}
        </VerdictLine>
      </div>

      <ReportNumbers
        items={[
          { key: 'ytd', label: `Office · ${thisYear} YTD`, value: money(officeYtd.gci) },
          { key: 'all', label: 'Office · all time', value: money(officeAll.gci) },
        ]}
      />

      <p style={{ fontSize: 'var(--a-text-xs)', color: 'var(--a-text-2)', margin: '-12px 0 20px' }}>
        Gross commission income on rows past projection. Projections stay separate and never roll
        up.{' '}
        <Link href="/admin/financials" style={{ color: 'var(--a-accent)' }}>
          Financials →
        </Link>
      </p>

      <SectionHead>By broker — agent net, settled rows only</SectionHead>
      <ReportGrid
        label="Commission net by broker"
        columns={BROKER_COLUMNS}
        template="minmax(140px, 1.6fr) minmax(110px, 1fr) minmax(80px, 0.6fr) minmax(110px, 1fr)"
        minWidth={520}
        rows={brokerRows}
        empty={<>No settled commission is attributed to a broker yet.</>}
      />

      <SectionHead>In escrow — projected, not counted above</SectionHead>
      <ReportGrid
        label="Commissions in escrow"
        columns={ESCROW_COLUMNS}
        template="minmax(200px, 2.4fr) minmax(120px, 1fr) minmax(96px, 0.8fr) minmax(96px, 0.8fr)"
        minWidth={560}
        rows={
          escrowRows.length
            ? [
                ...escrowRows,
                {
                  key: '__total',
                  total: true,
                  cells: ['Gross in escrow', '', money(projectedGci), ''],
                },
              ]
            : []
        }
        empty={<>Nothing is in escrow right now.</>}
      />

      <SectionHead>Ledger — every commission row, newest close first</SectionHead>
      <ReportGrid
        label="Commission ledger"
        columns={LEDGER_COLUMNS}
        template="minmax(190px, 2.2fr) minmax(110px, 1fr) minmax(64px, 0.5fr) repeat(4, minmax(96px, 0.9fr)) minmax(92px, 0.8fr) minmax(84px, 0.7fr)"
        minWidth={1080}
        rows={ledgerRows}
        empty={
          <>
            No commission row came back.{' '}
            <Link href="/admin/deals" style={{ color: 'var(--a-accent)' }}>
              Open the deals board
            </Link>{' '}
            — a row appears here once a cycle has a settlement statement entered.
          </>
        }
      />

      <p style={{ fontSize: 'var(--a-text-xs)', color: 'var(--a-text-2)', marginTop: 16 }}>
        Sorted by closing date, newest first. Closing date is the actual close when one is recorded,
        otherwise the scheduled escrow close. The office figures above count rows past projection;
        the ledger shows every row including projections.
      </p>
    </div>
  )
}
