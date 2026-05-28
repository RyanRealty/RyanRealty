import { CTAButton, Eyebrow, H3, Price, Stack, TabularNumber } from '@/components/site/primitives'

/**
 * VacationRentalPotential — short-term rental projection for resort-
 * community listings. Per DESIGN_DIRECTIVES.md D77 (Zillow Showcase
 * parity), this block is shown ONLY when the listing sits in a
 * community that allows short-term rentals: Tetherow, Sunriver,
 * Eagle Crest, Caldera Springs, Crosswater, Black Butte Ranch,
 * Pronghorn, Brasada Ranch, Awbrey Glen, Broken Top, Vandevert Ranch,
 * Three Rivers, Mt Bachelor Village, Widgi Creek.
 *
 * Wave 3 minimum: takes projection numbers as props. The
 * listing-detail page passes `null` when STR data isn't available
 * (which renders the "ask for a projection" CTA), and a real
 * projection object when we can compute one. Wave 4 wires AirDNA's
 * vacation-rental API.
 *
 * Per CLAUDE.md §0 Data Accuracy: nightly rate + occupancy must trace
 * to a primary source (similar STRs from AirDNA). Vague claims
 * forbidden — the component renders no number unless the caller
 * passes one.
 */

export type VacationRentalProjection = {
  /** Estimated nightly rate at peak (July–Aug + winter holidays). */
  peakNightly: number
  /** Estimated nightly rate at off-peak (shoulder seasons). */
  offPeakNightly: number
  /** Estimated annual occupancy as a 0–1 fraction. */
  occupancyRate: number
  /** Estimated annual gross rental income. */
  annualGross: number
  /** How many comparable STRs back this projection. */
  compCount: number
  /** Provenance per CLAUDE.md §0. */
  source?: string
}

type Props = {
  projection: VacationRentalProjection | null
  className?: string
}

export function VacationRentalPotential({ projection, className }: Props) {
  return (
    <Stack gap="default" className={className}>
      <div>
        <Eyebrow>Investment</Eyebrow>
        <H3 className="mt-1.5">Vacation rental potential</H3>
      </div>

      {projection ? (
        <>
          <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
            <div className="rounded-[14px] border border-border bg-card p-4 shadow-sm">
              <div className="text-[11px] uppercase tracking-[0.08em] text-muted-foreground">
                Peak nightly
              </div>
              <div className="mt-1.5 text-[22px] font-bold tabular-nums text-foreground">
                <Price value={projection.peakNightly} />
              </div>
              <div className="mt-0.5 text-xs text-muted-foreground">July to August</div>
            </div>
            <div className="rounded-[14px] border border-border bg-card p-4 shadow-sm">
              <div className="text-[11px] uppercase tracking-[0.08em] text-muted-foreground">
                Off-peak nightly
              </div>
              <div className="mt-1.5 text-[22px] font-bold tabular-nums text-foreground">
                <Price value={projection.offPeakNightly} />
              </div>
              <div className="mt-0.5 text-xs text-muted-foreground">Shoulder months</div>
            </div>
            <div className="rounded-[14px] border border-border bg-card p-4 shadow-sm">
              <div className="text-[11px] uppercase tracking-[0.08em] text-muted-foreground">
                Occupancy
              </div>
              <div className="mt-1.5 text-[22px] font-bold tabular-nums text-foreground">
                <TabularNumber value={Math.round(projection.occupancyRate * 100)} />%
              </div>
              <div className="mt-0.5 text-xs text-muted-foreground">Annual average</div>
            </div>
            <div className="rounded-[14px] border border-border bg-card p-4 shadow-sm">
              <div className="text-[11px] uppercase tracking-[0.08em] text-muted-foreground">
                Annual gross
              </div>
              <div className="mt-1.5 text-[22px] font-bold tabular-nums text-foreground">
                <Price value={projection.annualGross} />
              </div>
              <div className="mt-0.5 text-xs text-muted-foreground">
                Based on <TabularNumber value={projection.compCount} /> comps
              </div>
            </div>
          </div>
          {projection.source ? (
            <div className="text-[11px] uppercase tracking-[0.08em] text-muted-foreground">
              Source: {projection.source}
            </div>
          ) : null}
        </>
      ) : (
        <div className="rounded-[14px] border border-border bg-card p-5 shadow-sm">
          <p className="text-sm text-foreground">
            We compute vacation rental projections from comparable short-term rentals in the same community, weighted by bed count, view, and amenities. A custom projection for this property is on request.
          </p>
          <CTAButton
            href={`/contact?intent=vacation-rental-projection`}
            tone="primary"
            size="md"
            className="mt-4"
          >
            Get the rental projection
          </CTAButton>
        </div>
      )}
    </Stack>
  )
}
