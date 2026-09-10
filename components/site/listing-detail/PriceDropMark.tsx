/**
 * The price cut as two readable prices, not a 22px slope (Matt 2026-09-10).
 *
 * SITE-45 drew two dots and a diagonal and hid $from / $to / % / date behind
 * hover. That is a fake chart: two values, one current price already in the
 * H1. Dataviz: do not chart two numbers; print them. Exception ink on the cut
 * because a drop is a decline. Same publisher as the history rail.
 */
import { formatDate } from '@/lib/format/date'
import type { PublishedListingDropMark } from '@/lib/listing/publish-listing-drop-mark'

function dollars(n: number): string {
  return `$${n.toLocaleString('en-US')}`
}

export function PriceDropMark({ mark, label }: { mark: PublishedListingDropMark; label: string }) {
  const from = dollars(mark.from)
  const to = dollars(mark.to)
  const cut = dollars(mark.drop)
  const when = formatDate(mark.date)
  const reading = `${from} to ${to}, ${mark.pct.toFixed(1)}% on ${when}`
  return (
    <p className="listing-drop" aria-label={`${label}: ${reading}`}>
      <s className="listing-drop__from">{from}</s>
      <span className="listing-drop__cut">Cut {cut}</span>
      <span className="listing-drop__meta">
        −{mark.pct.toFixed(1)}% · {when}
      </span>
    </p>
  )
}
