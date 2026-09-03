import type { Taxlot } from '@/lib/data/geo/getTaxlots'
import { TAXLOT_DISCLAIMER, taxlotSourceFor } from '@/lib/data'

export function ListingLotFigure({
  parcel,
  county,
}: {
  parcel: Taxlot
  county: string | null | undefined
}) {
  const acres =
    parcel.acres != null
      ? `${parcel.acres.toLocaleString('en-US', { maximumFractionDigits: 2 })} acres`
      : null
  return (
    <>
      <p className="listing-detail__lot-figure">
        <strong>{acres ?? 'Lot outlined'}</strong>
        {` on the county assessor's map, tax lot ${parcel.taxlot}`}
        {parcel.dialUrl ? (
          <>
            {' · '}
            <a href={parcel.dialUrl} rel="nofollow noreferrer" target="_blank">
              County record
            </a>
          </>
        ) : null}
        {`. ${taxlotSourceFor(county)}.`}
      </p>
      <p className="listing-detail__lot-note">{TAXLOT_DISCLAIMER}</p>
    </>
  )
}
