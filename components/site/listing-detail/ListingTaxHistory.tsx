import { cn } from '@/lib/utils'
import { formatPriceExact } from '@/lib/format/money'

/**
 * One assessed figure from the MLS row, plus the county record when we have
 * a real URL. Do not invent prior-year rows.
 */

type Props = {
  taxYear?: number | null
  taxAssessedValue?: number | null
  taxAnnualAmount?: number | null
  county?: string | null
  parcelNumber?: string | null
  countyRecordHref?: string | null
  className?: string
}

function positive(n: number | null | undefined): n is number {
  return typeof n === 'number' && Number.isFinite(n) && n > 0
}

function txt(v: string | null | undefined): string | null {
  const s = v?.trim() ?? ''
  if (!s || s.startsWith('*')) return null
  return s
}

/** Deschutes DIAL search only when the parcel id is leftover. Other counties: recorded URL or omit. */
export function listingCountyRecordHref(input: {
  county?: string | null
  parcelNumber?: string | null
  dialUrl?: string | null
}): string | null {
  const recorded = txt(input.dialUrl)
  if (recorded) return recorded
  const parcel = txt(input.parcelNumber)?.replace(/\s+/g, '') ?? null
  const county = (input.county ?? '').trim().toLowerCase()
  if (parcel && county.includes('deschutes')) {
    return `https://dial.deschutes.org/results/taxlot?value=${encodeURIComponent(parcel)}`
  }
  return null
}

export function ListingTaxHistory({
  taxYear,
  taxAssessedValue,
  taxAnnualAmount,
  county,
  parcelNumber,
  countyRecordHref,
  className,
}: Props) {
  const year = positive(taxYear) ? taxYear : null
  const assessed = positive(taxAssessedValue) ? taxAssessedValue : null
  const annual = positive(taxAnnualAmount) ? taxAnnualAmount : null
  const record = txt(countyRecordHref)
  const parcel = txt(parcelNumber)
  const countyName = txt(county)

  if (assessed == null && annual == null && year == null && !record) return null

  return (
    <section className={cn('section', className)}>
      <div className="sec-head">
        <div>
          <h2 className="sec-title">Tax history</h2>
        </div>
      </div>
      {year != null || assessed != null || annual != null ? (
        <table className="listing-hist">
          <thead>
            <tr>
              {year != null ? <th>Year</th> : null}
              {assessed != null ? <th>Assessed</th> : null}
              {annual != null ? <th className="listing-hist__price">Tax</th> : null}
            </tr>
          </thead>
          <tbody>
            <tr>
              {year != null ? (
                <td>
                  <span className="tabular-nums">{year}</span>
                </td>
              ) : null}
              {assessed != null ? (
                <td>
                  <span className="tabular-nums">{formatPriceExact(assessed)}</span>
                </td>
              ) : null}
              {annual != null ? (
                <td className="listing-hist__price">
                  <span className="tabular-nums">{formatPriceExact(annual)}</span>
                </td>
              ) : null}
            </tr>
          </tbody>
        </table>
      ) : null}
      <p className="listing-pay__note">
        {assessed != null ? 'One assessed figure from the listing.' : 'Tax as filed on the listing.'}
        {countyName ? ` ${countyName} County.` : null}
        {parcel ? ` Parcel ${parcel}.` : null}{' '}
        {record ? (
          <a href={record} rel="nofollow noreferrer" target="_blank">
            County assessor
          </a>
        ) : null}
      </p>
    </section>
  )
}
