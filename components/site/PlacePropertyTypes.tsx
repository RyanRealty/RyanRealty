import {
  publicSegmentBrowseHref,
  publicSegmentNoun,
} from '@/lib/data/market-truth/public-segments'
import { formatPriceExact } from '@/lib/format/money'
import { formatMonthsOfSupply } from '@/lib/format/months-of-supply'
import { formatPaceShare } from '@/lib/data/market-truth/public-pace'

/**
 * PlacePropertyTypes — one SECTION per property type that exists in a place,
 * and nothing at all for the types that do not.
 *
 * The compact strip this replaces printed nine one-line counts, which reads the
 * same on every page in the county. A buyer looking for a townhome in Redmond
 * and a buyer looking for land in Terrebonne are asking different questions,
 * and each deserves its own answer with its own heading.
 *
 * ABSENCE IS THE POINT. A place with no condos gets no condo section — not an
 * empty one, not a "0 condos" line. `rows` already omits a segment the metric
 * layer withheld, so a missing type simply never reaches this component. That
 * matters twice over: an empty section is thin content on a page whose whole
 * purpose is depth, and "0 condos" read as a claim about the world is exactly
 * the false-absence D13 forbids — the metric layer withholding a figure is not
 * the same as there being none.
 *
 * §0: every number here comes from the row the metric layer published. Nothing
 * is computed, rounded or inferred in this file.
 */

/**
 * The narrowest shape this section can render. Deliberately looser than
 * PublicSegmentRow so the subdivision grain can use the same component: the
 * registry withholds price, months of supply and verdict below neighbourhood,
 * so a plat supplies counts alone. Everything optional simply does not render.
 */
export type PlaceSegmentInput = {
  segment: string
  activeCount: number | null
  pendingCount?: number | null
  closedCount?: number | null
  medianList?: number | null
  monthsOfSupply?: number | null
  daysToContract?: number | null
  saleToOriginal?: number | null
  priceCutShare?: number | null
}

interface Props {
  placeName: string
  citySlug: string | null
  postalCode?: string | null
  rows: readonly PlaceSegmentInput[]
}

/**
 * The lead sentence. Built only from figures that are actually present, so a
 * thin segment gets a short sentence rather than a padded one.
 */
function leadSentence(row: PlaceSegmentInput, placeName: string): string {
  const active = row.activeCount ?? 0
  const parts: string[] = []

  if (active >= 1) {
    parts.push(`${active.toLocaleString('en-US')} ${publicSegmentNoun(row.segment, active)} for sale in ${placeName}`)
  } else if (row.closedCount != null && row.closedCount >= 1) {
    // Nothing listed today, but the type demonstrably exists here.
    parts.push(`No ${publicSegmentNoun(row.segment, 2)} for sale in ${placeName} right now`)
  } else {
    parts.push(`${publicSegmentNoun(row.segment, 2)} in ${placeName}`)
  }

  if (row.medianList != null) parts.push(`asking a median ${formatPriceExact(row.medianList)}`)
  return `${parts.join(', ')}.`
}

function factLine(row: PlaceSegmentInput): Array<{ label: string; value: string }> {
  const out: Array<{ label: string; value: string }> = []
  if (row.pendingCount != null && row.pendingCount >= 1) {
    out.push({ label: 'Pending now', value: row.pendingCount.toLocaleString('en-US') })
  }
  if (row.closedCount != null && row.closedCount >= 1) {
    out.push({ label: 'Closed · 12 months', value: row.closedCount.toLocaleString('en-US') })
  }
  // 0.0 months is not a figure — see public-segments.
  if (row.monthsOfSupply != null && row.monthsOfSupply > 0) {
    out.push({ label: 'Months of supply', value: formatMonthsOfSupply(row.monthsOfSupply) })
  }
  if (row.daysToContract != null && row.daysToContract > 0) {
    out.push({ label: 'Days to contract · 12 months', value: String(Math.round(row.daysToContract)) })
  }
  if (row.saleToOriginal != null) {
    out.push({ label: 'Sale to original list · 12 months', value: formatPaceShare(row.saleToOriginal) })
  }
  if (row.priceCutShare != null) {
    out.push({ label: 'Took a price cut · 12 months', value: formatPaceShare(row.priceCutShare) })
  }
  return out
}

export function PlacePropertyTypes({ placeName, citySlug, postalCode, rows }: Props) {
  if (rows.length === 0) return null

  return (
    <>
      {rows.map((row) => {
        const facts = factLine(row)
        const nounPlural = publicSegmentNoun(row.segment, 2)
        const heading = `${nounPlural.charAt(0).toUpperCase()}${nounPlural.slice(1)} in ${placeName}`
        const href = publicSegmentBrowseHref(citySlug, row.segment, { postalCode })
        const active = row.activeCount ?? 0

        return (
          <section className="section" key={row.segment} id={`type-${row.segment}`} aria-label={heading}>
            <div className="wrap">
              <div className="sec-head" style={{ borderColor: 'var(--navy)' }}>
                <span className="sec-index">
                  {placeName} {'·'} Property types
                </span>
                <h2 className="sec-title display">{heading}</h2>
              </div>

              <p style={{ margin: '0 0 1rem', fontSize: '1rem', maxWidth: '44rem' }}>
                {leadSentence(row, placeName)}
              </p>

              {facts.length > 0 ? (
                <dl
                  style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: '1.5rem 2.5rem',
                    margin: '0 0 1rem',
                  }}
                >
                  {facts.map((f) => (
                    <div key={f.label}>
                      <dt
                        style={{
                          fontSize: '.72rem',
                          letterSpacing: '.08em',
                          textTransform: 'uppercase',
                          color: 'var(--navy-70)',
                        }}
                      >
                        {f.label}
                      </dt>
                      <dd
                        style={{
                          margin: '.25rem 0 0',
                          fontSize: '1.15rem',
                          fontVariantNumeric: 'tabular-nums',
                        }}
                      >
                        {f.value}
                      </dd>
                    </div>
                  ))}
                </dl>
              ) : null}

              {active >= 1 ? (
                <a
                  href={href}
                  style={{
                    color: 'var(--navy)',
                    fontWeight: 600,
                    textDecoration: 'underline',
                    textUnderlineOffset: '3px',
                  }}
                >
                  See {nounPlural} for sale
                </a>
              ) : null}
            </div>
          </section>
        )
      })}
    </>
  )
}
