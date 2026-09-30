/**
 * The price cut as one readable line, not a 22px slope (Matt 2026-09-10).
 *
 * SITE-45 drew two dots and a diagonal and hid $from / $to / % / date behind
 * hover. That is a fake chart: two values, one current price already in the
 * headline. Dataviz: do not chart two numbers; print them. Exception ink on
 * the cut because a drop is a decline. Same publisher as the history rail.
 *
 * ONE PRICE (Matt 2026-09-25, "I hate all the wasted space"). The line under
 * the headline price reads "Was $489,000 · Cut $3,000 (−0.6%) on Sep 22, 2026".
 * The dot rides the end of the old price and the date says "on", so where a
 * phone wraps the line (at 375 the date drops) no dot is left hanging.
 * The 2026-09-24 version printed the new price here as well, so a phone showed
 * $486,000 twice in two lines. Both prices of Matt's 2026-09-24 ask ("the two
 * prices, old and new") are still on the face: the new one is the headline
 * directly above, the old one is "Was". PriceCtaStrip draws this line only
 * while the cut set the headline price, so "Was" is never beside a price the
 * cut did not produce.
 *
 * Section 0: from, drop, pct and date are publishListingDropMark's fields off
 * the history row, unchanged; nothing is recomputed here.
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
  const pct = mark.pct.toFixed(1)
  const when = formatDate(mark.date)
  const reading = `${from} to ${to}, ${pct}% on ${when}`
  return (
    <p className="listing-drop" aria-label={`${label}: ${reading}`}>
      <span className="listing-drop__was">
        Was <span className="listing-drop__from">{from}</span>{' '}
        <span className="listing-drop__sep" aria-hidden>
          ·
        </span>
      </span>
      <span className="listing-drop__cut">
        Cut {cut} (−{pct}%)
      </span>
      <span className="listing-drop__meta">on {when}</span>
    </p>
  )
}
