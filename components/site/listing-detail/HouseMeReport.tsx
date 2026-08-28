import { cn } from '@/lib/utils'
import { Body } from '@/components/site/primitives'
import type { ListingPricingReadRow } from '@/lib/data/pricing/reads'
import { CMA_DOCUMENT_TERMS, CMA_DOCUMENT_TERMS_VERSION } from '@/lib/data/cma/getPublishedCma'
import {
  HOUSEME_EYEBROW,
  HOUSEME_LABEL_COMPS,
  HOUSEME_LABEL_DOM,
  HOUSEME_LABEL_INVESTMENT,
  HOUSEME_LABEL_PPSF,
  HOUSEME_LABEL_READ,
  HOUSEME_LABEL_READ_REFUSE,
  HOUSEME_LABEL_READ_UNLISTED,
  HOUSEME_LABEL_TRUE_COST,
  HOUSEME_TITLE_FACTS,
  PUBLIC_READ_DISCLAIMER,
  PUBLIC_READ_TITLE,
  PUBLIC_READ_TITLE_REFUSE,
  PUBLIC_READ_TITLE_UNLISTED,
  housemeRefuseCopy,
  overUnderPhrase,
} from '@/lib/pricing/public-read-copy'
import { formatListingHoa, publishListingHoa } from '@/lib/listing/publish-listing-hoa'
import { publishListingSharePricePerSqft } from '@/lib/listing/publish-listing-share'
import { PublishedCmaDownload } from './PublishedCmaDownload.client'

export type HouseMeRowId = 'read' | 'comps' | 'ppsf' | 'dom' | 'true-cost' | 'investment'

export type HouseMeRowSource = 'listing_pricing_reads' | 'listing' | 'listing+pulse'

export type HouseMeRow = {
  id: HouseMeRowId
  label: string
  value: string
  detail?: string
  source: HouseMeRowSource
  emphasis?: boolean
}

export type HouseMeReportFacts = {
  read: ListingPricingReadRow | null
  listPrice: number | null
  sqft: number | null
  dom: number | null
  placeMedianDays: number | null
  placeName: string | null
  hoaMonthly: number | null
  associationFee: number | null
  associationFeeFrequency: string | null
  taxAnnualAmount: number | null
  /** Only a rent figure already on the listing. Never HUD or a 0.5% guess. */
  monthlyRent: number | null
  /**
   * Which listing this is. REQUIRED, not optional: this row divides ListPrice
   * by the WHOLE dwelling's living area, so it must be able to ask whether the
   * price buys the dwelling. An optional field reads `undefined` at the call
   * site that forgets it, which is a guard that always passes. `null` is a
   * legitimate value; leaving the key out is not.
   */
  propertySubType: string | null
  /** MLS PropertyType code (A–H) — 'G' is a lease, where the price field is
   *  rent and no sale-shaped $/sq ft may publish. */
  propertyType: string | null
  subdivisionName: string | null
  listNumber: string | null
  /** The listing's city, which with the subdivision keys the registry. */
  city: string | null
}

function isFiniteNumber(v: number | null | undefined): v is number {
  return typeof v === 'number' && Number.isFinite(v)
}

function isPositive(v: number | null | undefined): v is number {
  return isFiniteNumber(v) && v > 0
}

function usdExact(n: number): string {
  return `$${Math.round(n).toLocaleString('en-US')}`
}

function stampAskMatches(read: ListingPricingReadRow, listPrice: number | null): boolean {
  if (read.listPrice == null || listPrice == null) return true
  return Math.round(read.listPrice) === Math.round(listPrice)
}

function daysPhrase(n: number): string {
  const days = Math.max(0, Math.round(n))
  return `${days.toLocaleString('en-US')} ${days === 1 ? 'day' : 'days'}`
}

export function buildHouseMeRows(facts: HouseMeReportFacts): HouseMeRow[] {
  const rows: HouseMeRow[] = []
  const read = facts.read

  if (read && stampAskMatches(read, facts.listPrice)) {
    if (read.kind === 'refuse') {
      const copy = read.refuseReason ? housemeRefuseCopy(read.refuseReason) : null
      if (copy) {
        rows.push({
          id: 'read',
          label: HOUSEME_LABEL_READ_REFUSE,
          value: copy,
          source: 'listing_pricing_reads',
        })
      }
    } else if (read.rangeLow != null && read.rangeHigh != null) {
      const range = `${usdExact(read.rangeLow)} to ${usdExact(read.rangeHigh)}`
      if (read.kind === 'listed-over-under' && read.deltaPct != null) {
        rows.push({
          id: 'read',
          label: HOUSEME_LABEL_READ,
          value: overUnderPhrase(read.deltaPct),
          detail: range,
          source: 'listing_pricing_reads',
          emphasis: true,
        })
      } else if (read.kind === 'unlisted-range') {
        rows.push({
          id: 'read',
          label: HOUSEME_LABEL_READ_UNLISTED,
          value: range,
          source: 'listing_pricing_reads',
          emphasis: true,
        })
      }
    }
  }

  if (read && isFiniteNumber(read.n) && read.n >= 0) {
    const sales = read.n === 1 ? 'sale' : 'sales'
    rows.push({
      id: 'comps',
      label: HOUSEME_LABEL_COMPS,
      value: `${read.n} closed ${sales}`,
      source: 'listing_pricing_reads',
    })
  }

  if (isPositive(facts.listPrice) && isPositive(facts.sqft)) {
    const ppsf = publishListingSharePricePerSqft({
      propertyType: facts.propertyType,
      propertySubType: facts.propertySubType,
      subdivisionName: facts.subdivisionName,
      city: facts.city,
      listNumber: facts.listNumber,
      pricePerSqft: facts.listPrice / facts.sqft,
    })
    if (ppsf != null) {
      rows.push({
        id: 'ppsf',
        label: HOUSEME_LABEL_PPSF,
        value: `${usdExact(ppsf)} per sq ft`,
        source: 'listing',
      })
    }
  }

  if (isFiniteNumber(facts.dom) && facts.dom >= 0 && isFiniteNumber(facts.placeMedianDays) && facts.placeMedianDays >= 0) {
    const place = facts.placeName?.trim()
    const median = place
      ? `${place} median to pending is ${daysPhrase(facts.placeMedianDays)}`
      : `Median to pending here is ${daysPhrase(facts.placeMedianDays)}`
    rows.push({
      id: 'dom',
      label: HOUSEME_LABEL_DOM,
      value: `${daysPhrase(facts.dom)} on market. ${median}.`,
      source: 'listing+pulse',
    })
  }

  const costParts: string[] = []
  const hoa = publishListingHoa({
    hoaMonthly: facts.hoaMonthly,
    associationFee: facts.associationFee,
    associationFeeFrequency: facts.associationFeeFrequency,
  })
  if (hoa) {
    costParts.push(`HOA ${formatListingHoa(hoa)}`)
  }
  if (isPositive(facts.taxAnnualAmount)) {
    costParts.push(`Tax ${usdExact(facts.taxAnnualAmount)} per year`)
  }
  if (costParts.length > 0) {
    rows.push({
      id: 'true-cost',
      label: HOUSEME_LABEL_TRUE_COST,
      value: costParts.join('. ') + '.',
      source: 'listing',
    })
  }

  if (isPositive(facts.monthlyRent)) {
    rows.push({
      id: 'investment',
      label: HOUSEME_LABEL_INVESTMENT,
      value: `${usdExact(facts.monthlyRent)} per month`,
      source: 'listing',
    })
  }

  return rows
}

export function housemeTitle(read: ListingPricingReadRow | null, rows: HouseMeRow[]): string {
  const readRow = rows.find((r) => r.id === 'read')
  if (readRow && read?.kind === 'refuse') return PUBLIC_READ_TITLE_REFUSE
  if (readRow && read?.kind === 'unlisted-range') return PUBLIC_READ_TITLE_UNLISTED
  if (readRow && read?.kind === 'listed-over-under') return PUBLIC_READ_TITLE
  return HOUSEME_TITLE_FACTS
}

export function housemeSourceLine(rows: HouseMeRow[]): string {
  const sources = new Set(rows.map((r) => r.source))
  const parts: string[] = []
  if (sources.has('listing_pricing_reads')) parts.push('Pricing stamp for this listing')
  if (sources.has('listing') || sources.has('listing+pulse')) parts.push('Listing fields from the MLS')
  if (sources.has('listing+pulse')) parts.push('Place median from the live market')
  return parts.length > 0 ? `${parts.join('. ')}.` : PUBLIC_READ_DISCLAIMER
}

type Props = HouseMeReportFacts & {
  listingKey: string
  subjectAddress: string
  hideCmaRequest?: boolean
  className?: string
}

export function HouseMeReport({
  listingKey,
  subjectAddress,
  hideCmaRequest,
  className,
  ...facts
}: Props) {
  const rows = buildHouseMeRows(facts)
  if (rows.length === 0) return null

  const title = housemeTitle(facts.read, rows)
  const source = housemeSourceLine(rows)

  return (
    <section className={cn('section', className)} data-testid="houseme-report">
      <div className="sec-head">
        <div>
          <div className="eyebrow sec-index">{HOUSEME_EYEBROW}</div>
          <h2 className="sec-title display">{title}</h2>
        </div>
      </div>
      {/* houseme-rows: kb.css re-inks .mono-lab for this cream ledger — the
          shared kb class paints labels cream-on-navy, which left every row
          label invisible (cream on cream) on the listing surface. */}
      <dl className="houseme-rows mt-6 border-t border-border">
        {rows.map((row) => (
          <div
            key={row.id}
            className="flex flex-col gap-1 border-b border-border py-3 md:flex-row md:items-baseline md:justify-between md:gap-8 md:py-4"
            data-houseme-row={row.id}
            data-houseme-source={row.source}
          >
            <dt className="mono-lab text-muted-foreground">{row.label}</dt>
            <dd className="min-w-0 md:text-right">
              <p
                className={cn(
                  'text-foreground',
                  row.emphasis && 'display text-2xl leading-none md:text-3xl',
                )}
              >
                {row.value}
              </p>
              {row.detail ? (
                <Body size="small" className="mt-1">
                  {row.detail}
                </Body>
              ) : null}
            </dd>
          </div>
        ))}
      </dl>
      <div className="mt-7 flex flex-col gap-7">
        {hideCmaRequest ? null : (
          <PublishedCmaDownload
            listingKey={listingKey}
            subjectAddress={subjectAddress}
            terms={CMA_DOCUMENT_TERMS}
            termsVersion={CMA_DOCUMENT_TERMS_VERSION}
            mode="request"
          />
        )}
        <Body size="small" tone="muted">
          {source} {PUBLIC_READ_DISCLAIMER} See our <a href="/terms">terms</a>.
        </Body>
      </div>
    </section>
  )
}

export default HouseMeReport
