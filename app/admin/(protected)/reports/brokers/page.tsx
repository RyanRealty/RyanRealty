import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

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
  return (
    <main className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <h1 className="text-2xl font-bold text-foreground">Broker Performance</h1>
      <p className="mt-2 text-muted-foreground">
        Pre-computed daily by reporting/compute-broker-stats. Match by listing agent email.
      </p>
      <div className="mt-6 overflow-x-auto">
        <Table className="min-w-full border border-border">
          <TableHeader>
            <TableRow className="bg-muted">
              <TableHead className="border-b border-border px-4 py-2 text-left text-sm font-semibold">Broker</TableHead>
              <TableHead className="border-b border-border px-4 py-2 text-right text-sm font-semibold">Volume (12mo)</TableHead>
              <TableHead className="border-b border-border px-4 py-2 text-right text-sm font-semibold">Transactions (12mo)</TableHead>
              <TableHead className="border-b border-border px-4 py-2 text-right text-sm font-semibold">Avg Sale</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(brokers ?? []).map((b) => {
              const bRow = b as { id: string; slug: string; display_name: string }
              const entry = byBroker.get(bRow.id)
              const yearly = entry?.yearly as { total_volume?: number; transaction_count?: number; avg_sale_price?: number } | undefined
              return (
                <TableRow key={bRow.id} className="border-b border-border">
                  <TableCell className="px-4 py-2">
                    <Link href={`/admin/brokers/${bRow.id}`} className="text-primary hover:underline">
                      {bRow.display_name}
                    </Link>
                  </TableCell>
                  <TableCell className="px-4 py-2 text-right">
                    {yearly?.total_volume != null ? `$${Number(yearly.total_volume).toLocaleString(undefined, { maximumFractionDigits: 0 })}` : '—'}
                  </TableCell>
                  <TableCell className="px-4 py-2 text-right">{yearly?.transaction_count ?? '—'}</TableCell>
                  <TableCell className="px-4 py-2 text-right">
                    {yearly?.avg_sale_price != null ? `$${Number(yearly.avg_sale_price).toLocaleString(undefined, { maximumFractionDigits: 0 })}` : '—'}
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>
      <p className="mt-8 text-sm text-muted-foreground">
        <Link href="/admin/reports" className="underline hover:no-underline">Back to Reports</Link>
      </p>
    </main>
  )
}
