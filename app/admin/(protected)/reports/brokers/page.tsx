// @no-parity — internal admin surface, no public mockup contract.
//
// Broker performance — 11C: migrated to the LOCKED admin v2 language
// (design_system/admin/ADMIN_UI.md) through the reporting family's shared
// presentation kit (@/components/admin/v2). Presentation only.
//
// Carried over verbatim: both reads (brokers where is_active, ordered by
// sort_order; broker_stats' broker_id/period_type/period_start/metrics), the
// monthly/yearly split into byBroker, the BrokerRow projection, the
// hasVolumeData test, all three team rollups (teamVolume, teamTransactions,
// teamAvgSale) character for character, the 12-row cap the old table applied,
// the four figures and their labels, the four columns and their labels, and the
// /admin/analytics back link. No metric, date window, filter default, sort
// order, unit or rounding moved.
//
// Shape changed, data did not: the page's own <main> is gone (ConsoleShell owns
// the landmark), the page-title <h1> is gone (the nav names the page), the KPI
// strip became the family's typographic numbers strip, and the shadcn table
// became the family's grid.
//
// THREE truth corrections (§0), none of which touches a figure:
//   1. formatUsd built its string with `Number(n).toLocaleString(undefined, …)`.
//      With no locale, Node and the browser can resolve DIFFERENT locales and
//      emit different digit grouping for the same number ($1,234,567 vs
//      $1.234.567 vs $12,34,567) — a measured React hydration mismatch on this
//      route. It now formats through lib/format/money. formatPriceExact, NOT
//      formatPrice: formatPrice rounds to the nearest $1,000 ($894,750 →
//      $895,000), which would move a number. formatPriceExact is byte-identical
//      to the old output on every finite value (verified across 1234567, 0,
//      475000, 894750, 999, 1234.6, "123456", null, undefined and 1e21); only
//      NaN/Infinity change, from "$NaN"/"$∞" to the family's dash.
//   2. The subhead claimed these figures are "Pre-computed daily by
//      reporting/compute-broker-stats". There is no such job — no route under
//      app/api, no cron in vercel.json, no reference anywhere in the repo
//      outside that sentence — and nothing in this codebase writes broker_stats
//      at all. An invented schedule is a fabricated number (§0). It is gone, and
//      the page now says what is true: no closed-volume figure has been recorded.
//   3. Both reads discarded their error. A failed brokers read rendered "0
//      active brokers" as a fact; a failed broker_stats read was logged and then
//      presented as "no volume recorded". A failed read now says it failed.
//
// Wall-of-dashes probe (ADMIN_UI §3 acceptance bar rule 6, run 2026-08-07
// against dwvlophlbvvygjfxcrhm before shipping): broker_stats = 0 rows,
// broker_stats where period_type='yearly' = 0 rows, brokers where is_active =
// 3 rows. The column of dashes is the real distribution, not a broken read.
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { formatPriceExact } from '@/lib/format/money'
import {
  SectionHead,
  VerdictLine,
  ReportGrid,
  ReportNumbers,
  ReportError,
  type ReportColumn,
  type ReportGridRow,
  type ReportNumberItem,
} from '@/components/admin/v2'

/**
 * Whole dollars, no thousand-rounding — the exact figure the row carries.
 * Number(n) preserves the coercion the previous formatter applied to a JSONB
 * value that arrives as a numeric string.
 */
function formatUsd(n: number | null | undefined): string {
  return formatPriceExact(n == null ? null : Number(n))
}

/** The old table capped both surfaces at 12 rows. Carried over. */
const ROW_CAP = 12

type Yearly = { total_volume?: number; transaction_count?: number; avg_sale_price?: number }
type BrokerRow = { id: string; slug: string; display_name: string; yearly?: Yearly }

export default async function AdminBrokerReportsPage() {
  const supabase = await createClient()
  const { data: brokers, error: brokersError } = await supabase
    .from('brokers')
    .select('id, slug, display_name')
    .eq('is_active', true)
    .order('sort_order')
  const { data: stats, error: statsError } = await supabase
    .from('broker_stats')
    .select('broker_id, period_type, period_start, metrics')
  if (brokersError) console.error('[reports/brokers] brokers read failed:', brokersError.message)
  if (statsError) console.error('[reports/brokers] broker_stats read failed:', statsError.message)

  const byBroker = new Map<string, { monthly?: Record<string, unknown>; yearly?: Record<string, unknown> }>()
  for (const row of stats ?? []) {
    const r = row as { broker_id: string; period_type: string; period_start: string; metrics: Record<string, unknown> }
    let entry = byBroker.get(r.broker_id)
    if (!entry) {
      entry = {}
      byBroker.set(r.broker_id, entry)
    }
    if (r.period_type === 'monthly') entry.monthly = r.metrics
    if (r.period_type === 'yearly') entry.yearly = r.metrics
  }

  const rows: BrokerRow[] = (brokers ?? []).map((b: { id: string; slug: string; display_name: string }) => ({
    ...b,
    yearly: byBroker.get(b.id)?.yearly as Yearly | undefined,
  }))

  // 12-month team rollups for the figures. broker_stats currently has no writer,
  // so there is genuinely NO closed-volume data to sum. Render "—", never a
  // fabricated "$0" — a licensed broker's report must not assert the brokerage
  // closed $0 (data-accuracy §0). The real closed volume gets wired through the
  // one metric layer (rebuild spec 06).
  const hasVolumeData = rows.some((b) => b.yearly?.total_volume != null || b.yearly?.transaction_count != null)
  const teamVolume = hasVolumeData ? rows.reduce((sum, b) => sum + (Number(b.yearly?.total_volume) || 0), 0) : null
  const teamTransactions = hasVolumeData ? rows.reduce((sum, b) => sum + (Number(b.yearly?.transaction_count) || 0), 0) : null
  const teamAvgSale = teamVolume != null && teamTransactions ? teamVolume / teamTransactions : null

  const readFailed = Boolean(brokersError) || Boolean(statsError)

  const figures: ReportNumberItem[] = [
    { key: 'brokers', label: 'Active brokers', value: String(rows.length) },
    { key: 'volume', label: 'Team volume (12mo)', value: formatUsd(teamVolume) },
    {
      key: 'tx',
      label: 'Transactions (12mo)',
      value: teamTransactions != null ? String(teamTransactions) : '—',
    },
    { key: 'avg', label: 'Avg sale (12mo)', value: formatUsd(teamAvgSale) },
  ]

  const columns: ReportColumn[] = [
    { key: 'broker', label: 'Broker' },
    { key: 'volume', label: 'Volume (12mo)', numeric: true },
    { key: 'tx', label: 'Transactions (12mo)', numeric: true },
    { key: 'avg', label: 'Avg sale', numeric: true },
  ]

  const gridRows: ReportGridRow[] = rows.slice(0, ROW_CAP).map((b) => ({
    key: b.id,
    cells: [
      b.display_name,
      formatUsd(b.yearly?.total_volume),
      b.yearly?.transaction_count ?? '—',
      formatUsd(b.yearly?.avg_sale_price),
    ],
  }))

  return (
    <div className="av2-scope" style={{ maxWidth: 900, margin: '0 auto', padding: 16 }}>
      <div style={{ margin: '0 0 14px' }}>
        <VerdictLine tone={readFailed || !hasVolumeData ? 'attention' : 'ok'}>
          {readFailed ? (
            <>
              <b>Broker production could not be read.</b> Nothing below is a measurement.
            </>
          ) : !hasVolumeData ? (
            <>
              <b>
                {rows.length} active {rows.length === 1 ? 'broker' : 'brokers'}, and no closed
                volume on file for any of them.
              </b>{' '}
              Volume, transactions and average sale read as a dash rather than $0.
            </>
          ) : (
            <>
              <b>
                {formatUsd(teamVolume)} closed across {teamTransactions}{' '}
                {teamTransactions === 1 ? 'transaction' : 'transactions'}
              </b>{' '}
              in the last 12 months, over {rows.length} active{' '}
              {rows.length === 1 ? 'broker' : 'brokers'}.
            </>
          )}
        </VerdictLine>
      </div>

      {readFailed ? <ReportError what="Broker production" href="/admin/reports/brokers" /> : null}

      <ReportNumbers items={figures} />

      {!hasVolumeData && !readFailed ? (
        <p style={{ fontSize: 'var(--a-text-sm)', color: 'var(--a-text-2)', margin: '0 0 16px' }}>
          broker_stats holds no rows, and nothing in this codebase writes it — so every
          closed-volume figure here is a dash, not a zero. The roster below is live.
        </p>
      ) : null}

      <SectionHead>The roster</SectionHead>
      <ReportGrid
        label="Broker production, last 12 months"
        columns={columns}
        template="minmax(160px, 1.6fr) minmax(110px, 1fr) minmax(110px, 1fr) minmax(100px, 1fr)"
        minWidth={560}
        rows={gridRows}
        empty={
          <>
            No active brokers found. Broker rows come from the brokers table where is_active is
            true.
          </>
        }
      />

      {rows.length > ROW_CAP ? (
        <p
          style={{
            fontSize: 'var(--a-text-xs)',
            color: 'var(--a-text-2)',
            fontVariantNumeric: 'tabular-nums',
            marginTop: 10,
          }}
        >
          Showing {ROW_CAP} of {rows.length}.
        </p>
      ) : null}

      <p style={{ fontSize: 'var(--a-text-xs)', color: 'var(--a-text-2)', marginTop: 16 }}>
        Ordered by the roster&apos;s own sort_order. Production is matched to a broker by listing
        agent email.{' '}
        <Link href="/admin/analytics" style={{ color: 'var(--a-accent)' }}>
          Back to Performance
        </Link>
      </p>
    </div>
  )
}
