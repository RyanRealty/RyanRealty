/**
 * The price cut as two points on one slope (site queue SITE-45).
 *
 * A small mark beside the price: the price before the cut at the top left,
 * the price it set at the bottom right, one line between them. At rest it
 * carries the label the strip always printed ("Price drop $76K"); on hover,
 * keyboard focus, or a tap it shows the two prices, the percent and the date,
 * from lib/listing/publish-listing-drop-mark, which reads the same history row
 * the rail under the page renders. The dataviz house order for a change
 * between two values is a two-point mark the reader can hover for the date
 * and the percent; a bare sentence was the floor the evaluator named.
 *
 * Pure markup + CSS (listing-detail.css `.listing-drop`): the reading opens on
 * :hover and :focus-within, and the whole mark is one button so a phone tap
 * focuses it. No state, no client code. Colors from tokens only.
 */
import { formatDate } from '@/lib/format/date'
import type { PublishedListingDropMark } from '@/lib/listing/publish-listing-drop-mark'

const W = 64
const H = 22
const PAD = 4

export function PriceDropMark({ mark, label }: { mark: PublishedListingDropMark; label: string }) {
  const x1 = PAD
  const y1 = PAD
  const x2 = W - PAD
  const y2 = H - PAD
  const from = `$${mark.from.toLocaleString('en-US')}`
  const to = `$${mark.to.toLocaleString('en-US')}`
  const when = formatDate(mark.date)
  const reading = `${from} to ${to}, ${mark.pct.toFixed(1)}% on ${when}`
  return (
    <button type="button" className="listing-drop" aria-label={`${label}: ${reading}`}>
      <svg
        className="listing-drop__mark"
        viewBox={`0 0 ${W} ${H}`}
        width={W}
        height={H}
        aria-hidden="true"
        focusable="false"
      >
        <line x1={x1} y1={y1} x2={x2} y2={y2} />
        <circle cx={x1} cy={y1} r="3" className="listing-drop__from" />
        <circle cx={x2} cy={y2} r="3" />
      </svg>
      <span className="listing-drop__label">{label}</span>
      <span className="listing-drop__reading" aria-hidden="true">
        <span className="listing-drop__prices">
          <s>{from}</s> <span className="listing-drop__to">{to}</span>
        </span>
        <span className="listing-drop__pct">−{mark.pct.toFixed(1)}%</span>
        <span className="listing-drop__date">{when}</span>
      </span>
    </button>
  )
}
