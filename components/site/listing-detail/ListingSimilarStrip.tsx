import Link from 'next/link'
import { V3ListingRow, V3_ROOT_CLASS, v3Text, type V3ListingRowData } from '@/components/site/v3'

export function ListingSimilarStrip({
  rows,
  placeName,
  viewMoreHref,
}: {
  rows: readonly V3ListingRowData[]
  placeName: string
  viewMoreHref: string
}) {
  if (rows.length === 0) return null
  const where = placeName.trim() || 'this place'
  return (
    <section
      id="similar"
      className={`${V3_ROOT_CLASS} listing-detail__similar`}
      aria-labelledby="similar-heading"
    >
      <header className="listing-detail__similar-head">
        <div>
          <p className="listing-detail__similar-kicker">Similar homes</p>
          <h2 id="similar-heading" className="listing-detail__similar-title">
            Nearby in {where}
          </h2>
        </div>
        <Link href={viewMoreHref} className="listing-detail__similar-more">
          {v3Text('View more homes')}
        </Link>
      </header>
      <div className="v3-lrow-list">
        {rows.map((row, i) => (
          <V3ListingRow key={row.listingKey} listing={row} priority={i < 2} />
        ))}
      </div>
    </section>
  )
}
