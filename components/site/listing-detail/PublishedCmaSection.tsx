// reachability: entry-point — a listing-page section awaiting its mount.
// app/listing/[listingKey]/page.tsx and its parity.json are owned by another
// workstream (2026-07-30), so this ships self-contained and that workstream
// wires it in. See the handoff note at the bottom of this comment block.
import { cn } from '@/lib/utils'
import { Body, Price } from '@/components/site/primitives'
import { formatDate } from '@/lib/format/date'
import type { PublishedCmaHighlight, PublishedCmaSummary } from '@/lib/data/cma/getPublishedCma'
import { PublishedCmaDownload } from './PublishedCmaDownload.client'

/**
 * PublishedCmaSection — our opinion of value, on the public listing page.
 *
 * Renders ONLY when a CMA carries the per-document publish opt-in
 * (`cmas.published_to_listing`). The caller passes `cma={null}` and this
 * returns null, so a listing with nothing published shows nothing at all.
 *
 * What is on the page and what is behind the gate:
 *
 *   Ungated — our opinion of value as a RANGE, the property's capability
 *   facts (zoning, acreage, water, septic, flood, permits, all from county
 *   and FEMA sources), and an aggregate description of the evidence: how many
 *   sales closed, over what window. No individual comparable sale is named,
 *   priced, or dated.
 *
 *   Gated — the full analysis, which names every comparable and shows the
 *   adjustments. Matt asked for the registration as a lead funnel. It also
 *   happens to be the ODS §5-4 C boundary for retrieving sold data on a
 *   website, so one gate serves both.
 *
 * Deliberately NOT rendered: `recommended_list`. That column is our pricing
 * ADVICE TO THE SELLER. On the one document attached to an active Ryan Realty
 * listing on 2026-07-30 it sat below the seller's ask. Publishing a broker's
 * private recommendation against their own client's list price is not a
 * transparency feature, it is a disclosure. The public number is the range,
 * which is what an opinion of value honestly is.
 *
 * Mounting: this component is self-contained and takes everything as props.
 * app/listing/[listingKey]/page.tsx is owned by another workstream, so it is
 * not mounted yet. See the report.
 */

type Props = {
  /** Null when nothing is published for this listing. The section then renders nothing. */
  cma: PublishedCmaSummary | null
  /**
   * Extra sellable facts from elsewhere on the page (DevelopmentOpportunities
   * and RentalPotential emit `marketingHighlights` in this shape). Merged after
   * the CMA's own county-sourced facts. Every entry carries its own basis, so
   * nothing lands on the page without a source.
   */
  extraHighlights?: PublishedCmaHighlight[]
  className?: string
}

/**
 * The comp window, in two joinings.
 *
 * `and` reads inside "closed between X and Y". `to` reads inside the ODS §7-3
 * notice, which is phrased "for the period of X through Y". One formatter with
 * one joiner produced "between February 2026 to May 2026".
 */
function formatWindow(start: string | null, end: string | null): { and: string; to: string } | null {
  if (!start || !end) return null
  // `sold_date` is a calendar date with no time. Anchoring at local noon keeps
  // the brand timezone from rolling a 1st-of-the-month sale back into the
  // previous month, which would misstate the ODS §7-3 period.
  // month + year ONLY. formatDate defaults to including the day, and an exact
  // close date for one sale is per-comp detail, which does not belong on the
  // ungated surface. `day: undefined` drops it from the Intl options.
  const fmt = (iso: string) =>
    formatDate(`${iso}T12:00:00`, { month: 'long', day: undefined, year: 'numeric' })
  const a = fmt(start)
  const b = fmt(end)
  if (a === '—' || b === '—') return null
  if (a === b) return { and: a, to: a }
  return { and: `${a} and ${b}`, to: `${a} through ${b}` }
}

function formatPrepared(iso: string): string | null {
  const out = formatDate(iso, { month: 'long', day: 'numeric', year: 'numeric' })
  return out === '—' ? null : out
}

export function PublishedCmaSection({ cma, extraHighlights, className }: Props) {
  if (!cma) return null

  const highlights = [...cma.highlights, ...(extraHighlights ?? [])]
  const window = formatWindow(cma.evidence.windowStart, cma.evidence.windowEnd)
  const prepared = formatPrepared(cma.preparedOn)
  const sales = cma.evidence.closedSales

  return (
    <section className={cn('section', className)} data-testid="published-cma-section">
      <div className="sec-head">
        <div>
          <div className="eyebrow sec-index">Our opinion of value</div>
          <h2 className="sec-title">What we think this home is worth</h2>
        </div>
      </div>

      <div style={{ marginTop: 'clamp(22px,3vw,36px)', display: 'flex', flexDirection: 'column', gap: 28 }}>
        <div>
          <div
            style={{
              display: 'flex',
              alignItems: 'baseline',
              flexWrap: 'wrap',
              gap: 10,
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            <Price value={cma.valueLow} className="display text-3xl leading-none md:text-4xl" />
            <span className="display" style={{ fontSize: 'clamp(18px,2vw,24px)', opacity: 0.7 }}>
              to
            </span>
            <Price value={cma.valueHigh} className="display text-3xl leading-none md:text-4xl" />
          </div>
          {prepared ? (
            <Body size="small" tone="muted" style={{ marginTop: 8 }}>
              Prepared by Ryan Realty on {prepared}.
            </Body>
          ) : null}
        </div>

        {highlights.length > 0 ? (
          <div>
            <h3 className="display" style={{ fontSize: 'clamp(17px,1.7vw,20px)', marginBottom: 14 }}>
              What stands out about this property
            </h3>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
              {highlights.map((h) => (
                <div
                  key={`${h.headline}::${h.basis}`}
                  style={{
                    flex: '1 1 240px',
                    minWidth: 220,
                    border: '1px solid color-mix(in srgb, var(--v3-navy) 8%, transparent)',
                    borderRadius: 14,
                    padding: '14px 16px',
                  }}
                >
                  <div style={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{h.headline}</div>
                  <Body size="small" tone="muted" style={{ marginTop: 4 }}>
                    {h.basis}
                  </Body>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        <div>
          <h3 className="display" style={{ fontSize: 'clamp(17px,1.7vw,20px)', marginBottom: 10 }}>
            How we got there
          </h3>
          <Body size="small">
            {sales > 0 ? (
              <>
                We started from {sales} nearby {sales === 1 ? 'sale that closed' : 'sales that closed'}
                {window ? ` between ${window.and}` : ''}, then adjusted for the ways this property differs from
                each one. The full analysis names every sale we used and shows the adjustment behind it.
              </>
            ) : (
              <>
                The full analysis names every closed sale we used and shows the adjustment behind it.
              </>
            )}
          </Body>
        </div>

        <PublishedCmaDownload
          listingKey={cma.listingKey}
          subjectAddress={cma.subjectAddress}
          terms={cma.terms}
          termsVersion={cma.termsVersion}
        />

        <div
          style={{
            borderTop: '1px solid color-mix(in srgb, var(--v3-navy) 8%, transparent)',
            paddingTop: 16,
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
          }}
        >
          <Body size="small" tone="muted">
            This is our opinion of value, not an appraisal and not a guarantee of price. It is the same analysis we
            prepare for a seller before we list a home. For a formal valuation, an Oregon licensed appraiser is the
            right call.
          </Body>
          {window ? (
            <Body size="small" tone="muted">
              This representation is based in whole or in part on information supplied and copyrighted by Oregon Data
              Share, LLC for the period of {window.to}.
            </Body>
          ) : null}
        </div>
      </div>
    </section>
  )
}

export default PublishedCmaSection
