import type { AgentDetail } from '@/app/actions/agents'

type Props = {
  broker: AgentDetail
}

function formatVolume(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)
}

function formatPrice(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return '—'
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)
}

export default function BrokerStats({ broker }: Props) {
  return (
    <section className="bg-white px-4 py-12 sm:px-6 sm:py-16" aria-labelledby="broker-stats-heading">
      <div className="mx-auto max-w-7xl">
        <h2 id="broker-stats-heading" className="sr-only">
          Performance at a glance
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl bg-[var(--gray-bg)] p-6 text-center">
            <p className="text-2xl font-bold text-[var(--brand-navy)]">{broker.soldCount24Mo}</p>
            <p className="text-sm text-[var(--text-secondary)]">Total Transactions (24 mo)</p>
          </div>
          <div className="rounded-xl bg-[var(--gray-bg)] p-6 text-center">
            <p className="text-2xl font-bold text-[var(--brand-navy)]">{formatVolume(broker.soldVolume24Mo)}</p>
            <p className="text-sm text-[var(--text-secondary)]">Total Volume (24 mo)</p>
          </div>
          <div className="rounded-xl bg-[var(--gray-bg)] p-6 text-center">
            <p className="text-2xl font-bold text-[var(--brand-navy)]">{formatPrice(broker.avgSalePrice)}</p>
            <p className="text-sm text-[var(--text-secondary)]">Average Sale Price</p>
          </div>
          <div className="rounded-xl bg-[var(--gray-bg)] p-6 text-center">
            <p className="text-2xl font-bold text-[var(--brand-navy)]">
              {broker.avgDom != null && broker.avgDom > 0 ? Math.round(broker.avgDom) : '—'}
            </p>
            <p className="text-sm text-[var(--text-secondary)]">Avg Days on Market</p>
          </div>
        </div>
      </div>
    </section>
  )
}
