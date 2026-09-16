import type { SchemaInput, StatValue } from '@/lib/site/json-ld'

export type PriceDropDatasetInput = {
  pageUrl: string
  placeName: string
  /** The FULL population of cuts in the window. */
  total: number
  /**
   * How many of that population this page actually renders. `totalReducedLabel`
   * and `medianDropPctLabel` are computed from those rows only, so the Dataset
   * names their scope rather than letting a 48-row sum sit beside a
   * 262-listing count reading as if both covered the same set (§0).
   */
  shownCount: number
  totalReducedLabel: string | null
  medianDropPctLabel: string | null
  fetchedAt: string | null
}

/**
 * Dataset + webPage for a non-empty 7-day window. Empty windows omit both so
 * a resilient-cache fallback cannot publish a zero count or a now() stamp as
 * freshness.
 */
export function priceDropDatasetSchemas(input: PriceDropDatasetInput): SchemaInput[] {
  if (input.total <= 0) return []

  const variables: StatValue[] = [
    { name: 'Price reductions (7-day window)', value: input.total, unitText: 'listings' },
  ]
  const scope =
    input.shownCount > 0 && input.shownCount < input.total
      ? ` (${input.shownCount} shown)`
      : ''
  if (input.totalReducedLabel) {
    variables.push({
      name: `Total asking-price cuts${scope}`,
      value: input.totalReducedLabel,
      unitText: 'USD',
    })
  }
  if (input.medianDropPctLabel) {
    variables.push({ name: `Median drop${scope}`, value: input.medianDropPctLabel })
  }

  const schemas: SchemaInput[] = [
    {
      type: 'dataset',
      name: `${input.placeName} price cuts, last 7 days`,
      description: `Active single-family homes in ${input.placeName} where the seller reduced the asking price in the last 7 days. Sourced from the regional MLS (ORMLS).`,
      url: input.pageUrl,
      ...(input.fetchedAt ? { dateModified: input.fetchedAt } : {}),
      spatialCoverageName: input.placeName,
      variableMeasured: variables,
    },
    {
      type: 'webPage',
      name: `Price cuts on ${input.placeName} homes, last 7 days`,
      description: `${input.total} active homes in ${input.placeName} with a price reduction in the last 7 days.`,
      url: input.pageUrl,
    },
  ]
  return schemas
}
