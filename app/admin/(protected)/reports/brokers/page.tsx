import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Card, CardContent } from '@/components/ui/card'
import DashboardSummaryStrip from '@/components/admin/DashboardSummaryStrip'
import { TableWithMobileCards } from '@/components/admin/TableWithMobileCards'

function formatUsd(n: number | null | undefined): string {
  return n != null ? `$${Number(n).toLocaleString(undefined, { maximumFractionDigits: 0 })}` : '—'
}

type Yearly = { total_volume?: number; transaction_count?: number; avg_sale_price?: number }
type BrokerRow = { id: string; slug: string; display_name: string; yearly?: Yearly }

export default async function AdminBrokerReportsPage() {
  const supabase = await createClient()
  const { data: brokers } = await supabase.from('brokers').select('id, slug, display_name').eq('is_active', true).order('sort_order')
  const { data: stats } = await supabase.from('broker_stats').select('broker_id, period_type, period_start, metrics')
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

  // 12-month team rollups for the KPI lead.
  const teamVolume = rows.reduce((sum, b) => sum + (Number(b.yearly?.total_volume) || 0), 0)
  const teamTransactions = rows.reduce((sum, b) => sum + (Number(b.yearly?.transaction_count) || 0), 0)
  const teamAvgSale = teamTransactions > 0 ? teamVolume / teamTransactions : null

  return (
    <main className="mx-auto max-w-4xl space-y-6 px-4 py-10 sm:px-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold text-foreground">Broker performance</h1>
        <p className="text-sm text-muted-foreground">
          Pre-computed daily by reporting/compute-broker-stats. Matched by listing agent email.
        </p>
      </header>

      <DashboardSummaryStrip
        stats={[
          { label: 'Active brokers', value: String(rows.length) },
          { label: 'Team volume (12mo)', value: formatUsd(teamVolume) },
          { label: 'Transactions (12mo)', value: String(teamTransactions) },
          { label: 'Avg sale (12mo)', value: formatUsd(teamAvgSale) },
        ]}
      />

      <TableWithMobileCards
        rows={rows}
        cap={12}
        getRowKey={(b) => b.id}
        columns={[
          { key: 'broker', header: 'Broker', className: 'font-medium text-foreground', cell: (b) => b.display_name },
          { key: 'volume', header: 'Volume (12mo)', className: 'text-right tabular-nums', cell: (b) => formatUsd(b.yearly?.total_volume) },
          { key: 'tx', header: 'Transactions (12mo)', className: 'text-right tabular-nums', cell: (b) => b.yearly?.transaction_count ?? '—' },
          { key: 'avg', header: 'Avg sale', className: 'text-right tabular-nums', cell: (b) => formatUsd(b.yearly?.avg_sale_price) },
        ]}
        renderCard={(b) => (
          <Card>
            <CardContent className="space-y-1">
              <p className="text-sm font-medium text-foreground">{b.display_name}</p>
              <p className="text-xs text-muted-foreground tabular-nums">
                {formatUsd(b.yearly?.total_volume)} · {b.yearly?.transaction_count ?? '—'} tx · {formatUsd(b.yearly?.avg_sale_price)} avg
              </p>
            </CardContent>
          </Card>
        )}
        empty={<>No active brokers found. Broker rows come from the brokers table where is_active is true.</>}
      />

      <p className="text-sm text-muted-foreground">
        <Link href="/admin/reports" className="underline hover:no-underline">Back to Reports</Link>
      </p>
    </main>
  )
}
