/**
 * Recent office closings, one card per home. Modeled on Stellar's "client
 * results" section: real sold outcomes a seller can scan, not a brochure.
 *
 * Real MLS closed data only (getOfficeRecentClosings): city, bedrooms, the
 * close price, days to contract and sale to FINAL list price. No street, no
 * month, no names, and the cards are not links. A record whose contract was
 * entered before its market date prints "Entered after contract" instead of a
 * day count, never a zero. With no rows the section does not render.
 */
import { V3_ROOT_CLASS, V3Eyebrow, V3Heading, V3SourceDisclosure } from '@/components/site/v3'
import { formatPriceExact } from '@/lib/format/money'
import type { OfficeRecentClosings } from '@/lib/data'

function pct(ratio: number): string {
  return `${(Math.round(ratio * 1000) / 10).toFixed(1)}%`
}

function days(n: number): string {
  return n === 1 ? '1 day to contract' : `${n} days to contract`
}

export function SellClosings({ closings }: { closings: OfficeRecentClosings }) {
  if (closings.rows.length === 0) return null
  return (
    <section
      id="recent-closings"
      className={`${V3_ROOT_CLASS} sell-closings`}
      aria-labelledby="recent-closings-title"
    >
      <header className="sell-closings__head">
        <V3Eyebrow>Last 12 months · MLS closed</V3Eyebrow>
        <V3Heading level={2} id="recent-closings-title">
          Homes we sold for sellers like you
        </V3Heading>
        <p className="sell-closings__lead">
          City, beds, sale price, days to contract, and sale to final list.
          No streets and no names. Just what closed.
        </p>
      </header>
      <ol className="sell-closings__list">
        {closings.rows.map((row) => (
          <li key={row.key} className="sell-closings__card">
            <p className="sell-closings__where">
              {row.city}
              {row.bedrooms != null ? ` · ${row.bedrooms} bed` : ''}
            </p>
            <p className="sell-closings__price">{formatPriceExact(row.closePrice)}</p>
            <dl className="sell-closings__facts">
              <div>
                <dt>Time to contract</dt>
                <dd>
                  {row.daysToContract != null
                    ? days(row.daysToContract)
                    : row.enteredAfterContract
                      ? 'Entered after contract'
                      : 'Not recorded'}
                </dd>
              </div>
              {row.saleToList != null ? (
                <div>
                  <dt>Sale to list</dt>
                  <dd>{pct(row.saleToList)} of final list price</dd>
                </div>
              ) : null}
            </dl>
          </li>
        ))}
      </ol>
      <div className="sell-closings__trace">
        <V3SourceDisclosure source={closings.trace} sourceName="Oregon Data Share MLS" />
      </div>
    </section>
  )
}
