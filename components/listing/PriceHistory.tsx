'use client'

import type { ListingDetailPriceHistory } from '@/app/actions/listing-detail'

function formatPrice(n: number | null | undefined): string {
  if (n == null) return '—'
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)
}

function formatDate(s: string): string {
  try {
    return new Date(s).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  } catch {
    return s
  }
}

type Props = {
  priceHistory: ListingDetailPriceHistory[]
}

export default function PriceHistory({ priceHistory }: Props) {
  if (priceHistory.length === 0) return null

  return (
    <section className="space-y-4">
      <h2 className="text-xl font-semibold text-primary">Price History</h2>
      <ul className="space-y-3">
        {priceHistory.map((entry) => {
          const oldP = entry.old_price ?? 0
          const newP = entry.new_price ?? 0
          const change = newP - oldP
          const isDrop = change < 0
          return (
            <li
              key={entry.id}
              className="flex flex-wrap items-center gap-2 text-sm border-b border-border pb-3 last:border-0"
            >
              <span className="text-muted-foreground">{formatDate(entry.changed_at)}</span>
              <span className="text-primary">{formatPrice(entry.old_price)}</span>
              <span className="text-muted-foreground">→</span>
              <span className="text-primary font-medium">{formatPrice(entry.new_price)}</span>
              {change !== 0 && (
                <span className={isDrop ? 'text-success' : 'text-destructive'}>
                  {isDrop ? '' : '+'}{formatPrice(change)}
                  {entry.change_pct != null && ` (${entry.change_pct > 0 ? '+' : ''}${Number(entry.change_pct).toFixed(1)}%)`}
                </span>
              )}
            </li>
          )
        })}
      </ul>
    </section>
  )
}
