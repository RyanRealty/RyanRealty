/**
 * JSON-LD builders for the city page — extracted verbatim from page.tsx so the
 * route file stays a readable section list under ci:file-size-budget's 600-line
 * floor. Nothing here fetches; the page hands in the already-verified figures.
 *
 * AI-citability: BreadcrumbList + City Place + (when live figures exist) a
 * Dataset whose variables come from buildMarketFaq — the PAGE CONTRACT
 * requires the structured data on every render. (§0: every figure in the
 * dataset is the same verified figure the page prints.)
 */

import type { SchemaInput, StatValue } from '@/lib/site/json-ld'

export type CitySchemaInput = {
  cityName: string
  slug: string
  hasMap: boolean
  datasetVariables: StatValue[]
  asOfIso: string | null
  asOfLabel: string | null
}

export function buildCitySchemas({
  cityName,
  slug,
  hasMap,
  datasetVariables,
  asOfIso,
  asOfLabel,
}: CitySchemaInput): SchemaInput[] {
  const citySchemas: SchemaInput[] = [
    {
      type: 'breadcrumb',
      items: [
        { name: 'Home', url: '/' },
        { name: 'Cities', url: '/cities' },
        { name: cityName, url: `/cities/${slug}` },
      ],
    },
    {
      type: 'place',
      placeType: 'City',
      name: cityName,
      description: `Active single-family homes and live market data for ${cityName}, Oregon.`,
      url: `/cities/${slug}`,
      address: { city: cityName, state: 'OR', country: 'US' },
      containedInPlace: 'Central Oregon',
      hasMap: hasMap ? `/cities/${slug}` : undefined,
      additionalProperty: datasetVariables.length > 0 ? datasetVariables : undefined,
    },
  ]
  if (datasetVariables.length > 0) {
    citySchemas.push({
      type: 'dataset',
      name: `${cityName}, Oregon real estate market statistics${asOfLabel ? `, ${asOfLabel}` : ''}`,
      description: `Live single-family home market data for ${cityName}, Oregon. Median list price, active inventory, months of supply, and median days to pending. Sourced from the regional MLS via Ryan Realty.`,
      url: `/cities/${slug}`,
      dateModified: asOfIso ?? undefined,
      spatialCoverageName: `${cityName}, OR`,
      variableMeasured: datasetVariables,
    })
  }
  return citySchemas
}
