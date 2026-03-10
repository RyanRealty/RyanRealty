import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'

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
      <h1 className="text-2xl font-bold text-zinc-900">Broker Performance</h1>
      <p className="mt-2 text-zinc-600">
        Pre-computed daily by reporting/compute-broker-stats. Match by listing agent email.
      </p>
      <div className="mt-6 overflow-x-auto">
        <table className="min-w-full border border-zinc-200">
          <thead>
            <tr className="bg-zinc-100">
              <th className="border-b border-zinc-200 px-4 py-2 text-left text-sm font-semibold">Broker</th>
              <th className="border-b border-zinc-200 px-4 py-2 text-right text-sm font-semibold">Volume (12mo)</th>
              <th className="border-b border-zinc-200 px-4 py-2 text-right text-sm font-semibold">Transactions (12mo)</th>
              <th className="border-b border-zinc-200 px-4 py-2 text-right text-sm font-semibold">Avg Sale</th>
            </tr>
          </thead>
          <tbody>
            {(brokers ?? []).map((b) => {
              const bRow = b as { id: string; slug: string; display_name: string }
              const entry = byBroker.get(bRow.id)
              const yearly = entry?.yearly as { total_volume?: number; transaction_count?: number; avg_sale_price?: number } | undefined
              return (
                <tr key={bRow.id} className="border-b border-zinc-100">
                  <td className="px-4 py-2">
                    <Link href={`/admin/brokers/${bRow.id}`} className="text-[var(--brand-navy)] hover:underline">
                      {bRow.display_name}
                    </Link>
                  </td>
                  <td className="px-4 py-2 text-right">
                    {yearly?.total_volume != null ? `$${Number(yearly.total_volume).toLocaleString(undefined, { maximumFractionDigits: 0 })}` : '—'}
                  </td>
                  <td className="px-4 py-2 text-right">{yearly?.transaction_count ?? '—'}</td>
                  <td className="px-4 py-2 text-right">
                    {yearly?.avg_sale_price != null ? `$${Number(yearly.avg_sale_price).toLocaleString(undefined, { maximumFractionDigits: 0 })}` : '—'}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <p className="mt-8 text-sm text-zinc-500">
        <Link href="/admin/reports" className="underline hover:no-underline">Back to Reports</Link>
      </p>
    </main>
  )
}
