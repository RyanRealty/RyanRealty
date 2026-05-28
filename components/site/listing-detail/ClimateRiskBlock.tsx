import { CTAButton, Eyebrow, H3, Stack, TabularNumber } from '@/components/site/primitives'
import { cn } from '@/lib/utils'

/**
 * ClimateRiskBlock — Central Oregon climate risk surface per
 * DESIGN_DIRECTIVES.md D77 (Zillow Showcase parity).
 *
 * Four risk dimensions: flood, wildfire, heat, drought. Each is a
 * 1 to 10 integer or null. When the entire risk object is null we
 * render a "Get the climate report" CTA. We never render a fake
 * number — per CLAUDE.md §0 Data Accuracy every score must trace to
 * a verified primary source.
 *
 * Wave 3 minimum: accepts data as a prop. The listing-detail page
 * passes data when available (FEMA flood zone + Deschutes County WUI
 * wildfire map + NOAA heat trends + drought index). Wave 4 wires the
 * First Street Foundation API for parity with Zillow Showcase.
 */

export type ClimateRiskScore = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10

export type ClimateRisk = {
  flood: ClimateRiskScore | null
  wildfire: ClimateRiskScore | null
  heat: ClimateRiskScore | null
  drought: ClimateRiskScore | null
  source?: string
}

type Props = {
  risk: ClimateRisk | null
  className?: string
}

function scoreLabel(s: ClimateRiskScore | null): string {
  if (s == null) return ''
  if (s <= 3) return 'Minimal'
  if (s <= 5) return 'Minor'
  if (s <= 7) return 'Moderate'
  if (s <= 8) return 'Major'
  return 'Severe'
}

function scoreToneClass(s: ClimateRiskScore | null): string {
  if (s == null) return 'text-muted-foreground'
  if (s <= 7) return 'text-foreground'
  if (s <= 8) return 'text-warning-foreground'
  return 'text-destructive'
}

function RiskCell({
  label,
  score,
}: {
  label: string
  score: ClimateRiskScore | null
}) {
  const hasScore = score != null
  return (
    <div className="rounded-[14px] border border-border bg-card p-4 shadow-sm">
      <div className="text-[11px] uppercase tracking-[0.08em] text-muted-foreground">
        {label}
      </div>
      <div className={cn('mt-1.5 text-[22px] font-bold tabular-nums', scoreToneClass(score))}>
        {hasScore ? (
          <>
            <TabularNumber value={score} /> of 10
          </>
        ) : (
          'Pending'
        )}
      </div>
      {hasScore ? (
        <div className="mt-0.5 text-xs text-muted-foreground">{scoreLabel(score)}</div>
      ) : null}
    </div>
  )
}

export function ClimateRiskBlock({ risk, className }: Props) {
  const hasAnyScore =
    risk != null && [risk.flood, risk.wildfire, risk.heat, risk.drought].some((s) => s != null)

  return (
    <Stack gap="default" className={className}>
      <div>
        <Eyebrow>Climate risk</Eyebrow>
        <H3 className="mt-1.5">Long-term climate exposure</H3>
      </div>

      {hasAnyScore && risk ? (
        <>
          <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
            <RiskCell label="Flood" score={risk.flood} />
            <RiskCell label="Wildfire" score={risk.wildfire} />
            <RiskCell label="Heat" score={risk.heat} />
            <RiskCell label="Drought" score={risk.drought} />
          </div>
          {risk.source ? (
            <div className="text-[11px] uppercase tracking-[0.08em] text-muted-foreground">
              Source: {risk.source}
            </div>
          ) : null}
        </>
      ) : (
        <div className="rounded-[14px] border border-border bg-card p-5 shadow-sm">
          <p className="text-sm text-foreground">
            We pull climate risk data from FEMA flood maps, the Deschutes County wildland-urban interface map, and NOAA heat trends. Detailed scoring for this property is on request.
          </p>
          <CTAButton
            href="/contact?intent=climate-report"
            tone="primary"
            size="md"
            className="mt-4"
          >
            Get the climate report
          </CTAButton>
        </div>
      )}
    </Stack>
  )
}
