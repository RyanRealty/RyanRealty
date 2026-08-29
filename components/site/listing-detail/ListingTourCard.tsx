/**
 * Desktop sticky tour card. Starts below the mosaic. Actions only —
 * no second price. Same .btn register as PriceCtaStrip.
 */
export function ListingTourCard({
  tourHref,
  askHref,
  tel,
  sms,
}: {
  tourHref: string
  askHref: string
  tel?: string | null
  sms?: string | null
}) {
  return (
    <div className="listing-tour-card">
      <a href={tourHref} className="btn alt">
        Schedule a tour
      </a>
      <a href={askHref} className="btn">
        Ask
      </a>
      {tel ? (
        <a href={`tel:${tel}`} className="btn">
          Call
        </a>
      ) : null}
      {sms ? (
        <a href={`sms:${sms}`} className="btn">
          Text
        </a>
      ) : null}
    </div>
  )
}
