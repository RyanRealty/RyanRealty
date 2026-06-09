import type { SparkListingHistoryItem } from '../../lib/spark'
import { H3 } from '@/components/site/primitives'

type Props = {
  items: SparkListingHistoryItem[] | null
}

function formatDate(s: string | undefined): string {
  if (!s) return ''
  try {
    const d = new Date(s)
    return isNaN(d.getTime()) ? s : d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
  } catch {
    return s ?? ''
  }
}

export default function ListingHistory({ items }: Props) {
  if (items == null) {
    return (
      <section className="rounded-lg border border-border bg-card p-6 shadow-sm">
        <H3 as="h2" className="mb-3 text-lg">Listing history</H3>
        <p className="text-muted-foreground">Listing history is not available for this property.</p>
      </section>
    )
  }

  if (items.length === 0) {
    return (
      <section className="rounded-lg border border-border bg-card p-6 shadow-sm">
        <H3 as="h2" className="mb-3 text-lg">Listing history</H3>
        <p className="text-muted-foreground">No history recorded yet.</p>
      </section>
    )
  }

  return (
    <section className="rounded-lg border border-border bg-card p-6 shadow-sm">
      <H3 as="h2" className="mb-4 text-lg">Listing history</H3>
      <ul className="space-y-3">
        {items.map((item, i) => {
          const date = formatDate(item.Date)
          const event = item.Event ?? item.Description ?? 'Update'
          const price = item.Price ?? item.PriceChange
          const line = [
            date && <span key="date">{date}</span>,
            event && <span key="event">{event}</span>,
            price != null && <span key="price">${Number(price).toLocaleString()}</span>,
          ].filter(Boolean)
          return (
            <li key={i} className="flex flex-wrap items-baseline gap-x-2 border-b border-border pb-2 last:border-0 last:pb-0">
              {line.length ? line : <span className="text-muted-foreground">—</span>}
            </li>
          )
        })}
      </ul>
    </section>
  )
}
