import type { SchemaInput, StatValue } from '@/lib/site/json-ld'

export type PriceDropDatasetInput = {
  pageUrl: string
  placeName: string
  total: number
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
  if (input.totalReducedLabel) {
    variables.push({
      name: 'Total asking-price cuts',
      value: input.totalReducedLabel,
      unitText: 'USD',
    })
  }
  if (input.medianDropPctLabel) {
    variables.push({ name: 'Median drop', value: input.medianDropPctLabel })
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
