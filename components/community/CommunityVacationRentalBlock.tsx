/**
 * Community-level vacation rental potential indicator (SITE_SPEC line 107).
 *
 * Shows the typical short-term rental band for a resort community based on
 * the median list price + median beds/baths of active listings. Renders only
 * when the community is flagged as a resort (`isResort=true`) and there is
 * enough active inventory to produce a meaningful average.
 *
 * This is a community-level summary. Per-listing potential is computed
 * separately by `lib/vacation-rental-potential.ts` and rendered on the
 * listing detail page via `VacationRentalPotentialCard`.
 *
 * Voice: brand-voice compliant (sentence case, no banned words, no
 * em-dashes, no exclamation marks). Numbers carry units. Currency rounded
 * to the nearest hundred.
 */

import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

type Listing = {
  ListPrice?: number | null
  BedroomsTotal?: number | null
  BathroomsTotal?: number | null
}

type Props = {
  communityName: string
  isResort: boolean
  listings: Listing[]
}

function medianOf(values: number[]): number | null {
  if (values.length === 0) return null
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0 ? (sorted[mid - 1]! + sorted[mid]!) / 2 : sorted[mid]!
}

function formatCurrencyHundred(n: number): string {
  const rounded = Math.round(n / 100) * 100
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(rounded)
}

/**
 * Heuristic monthly revenue band, anchored to the same gross-yield model
 * used by `lib/vacation-rental-potential.ts`. We widen by ±15% to express
 * a realistic range rather than a single point estimate.
 */
function estimateMonthlyBand(listPrice: number, beds: number, baths: number): { low: number; high: number } {
  const bedsFactor = Math.max(1, beds)
  const bathsFactor = Math.max(1, baths)
  const grossYield = 0.058
  const annualMid = listPrice * grossYield * (0.9 + bedsFactor * 0.06 + bathsFactor * 0.03)
  const monthly = annualMid / 12
  return {
    low: monthly * 0.85,
    high: monthly * 1.15,
  }
}

function suitabilityLabel(beds: number): 'high' | 'medium' | 'low' {
  if (beds >= 3) return 'high'
  if (beds >= 2) return 'medium'
  return 'low'
}

export default function CommunityVacationRentalBlock({ communityName, isResort, listings }: Props) {
  if (!isResort) return null

  const prices = listings
    .map((l) => (typeof l.ListPrice === 'number' ? l.ListPrice : null))
    .filter((n): n is number => n != null && Number.isFinite(n) && n > 0)
  const medianPrice = medianOf(prices)

  const beds = listings
    .map((l) => (typeof l.BedroomsTotal === 'number' ? l.BedroomsTotal : null))
    .filter((n): n is number => n != null && n > 0)
  const medianBeds = medianOf(beds) ?? 3

  const baths = listings
    .map((l) => (typeof l.BathroomsTotal === 'number' ? l.BathroomsTotal : null))
    .filter((n): n is number => n != null && n > 0)
  const medianBaths = medianOf(baths) ?? 2

  // Need at least a median price to estimate. Otherwise hide the module.
  if (medianPrice == null) return null

  const band = estimateMonthlyBand(medianPrice, medianBeds, medianBaths)
  const suitability = suitabilityLabel(medianBeds)
  const suitabilityVariant: 'default' | 'secondary' | 'outline' =
    suitability === 'high' ? 'default' : suitability === 'medium' ? 'secondary' : 'outline'

  return (
    <section
      className="bg-card px-4 py-10 sm:px-6"
      aria-labelledby="community-vacation-rental-heading"
    >
      <div className="mx-auto max-w-7xl">
        <Card>
          <CardContent className="p-6 sm:p-8">
            <div className="flex flex-wrap items-baseline justify-between gap-3">
              <h2
                id="community-vacation-rental-heading"
                className="text-2xl font-semibold text-foreground sm:text-3xl"
              >
                Short-term rental potential in {communityName}
              </h2>
              <Badge variant={suitabilityVariant} className="text-xs uppercase tracking-wide">
                {suitability} suitability
              </Badge>
            </div>
            <p className="mt-3 max-w-3xl text-muted-foreground">
              {communityName} is a resort community where short-term rentals are common.
              The range below is a planning estimate based on the median list price and
              typical bedroom count of active listings, not a guaranteed return. HOA
              rules, seasonal demand, and individual property condition will move the
              real number up or down.
            </p>
            <div className="mt-6 grid gap-4 sm:grid-cols-3">
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                  Estimated monthly revenue
                </p>
                <p className="mt-1 text-2xl font-semibold tabular-nums text-foreground">
                  {formatCurrencyHundred(band.low)} to {formatCurrencyHundred(band.high)}
                </p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                  Typical bedrooms
                </p>
                <p className="mt-1 text-2xl font-semibold tabular-nums text-foreground">
                  {medianBeds}
                </p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                  Median list price
                </p>
                <p className="mt-1 text-2xl font-semibold tabular-nums text-foreground">
                  {new Intl.NumberFormat('en-US', {
                    style: 'currency',
                    currency: 'USD',
                    maximumFractionDigits: 0,
                  }).format(Math.round(medianPrice / 1000) * 1000)}
                </p>
              </div>
            </div>
            <p className="mt-6 text-xs text-muted-foreground">
              Estimates use a 5.8% gross-yield model adjusted for bedroom and bathroom
              count. For a property-specific projection that accounts for the actual
              HOA, lot, and condition, ask a Ryan Realty broker for a free analysis.
            </p>
          </CardContent>
        </Card>
      </div>
    </section>
  )
}
