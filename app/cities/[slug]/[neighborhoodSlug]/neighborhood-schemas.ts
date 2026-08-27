/**
 * JSON-LD builders for the neighborhood page — extracted verbatim from
 * page.tsx so the route file stays a readable section list under
 * ci:file-size-budget's 600-line floor. Nothing here fetches; the page hands
 * in the already-verified figures.
 *
 * AI-citability: BreadcrumbList + Neighborhood Place + (when live figures
 * exist) a Dataset whose variables come from buildMarketFaq — the PAGE
 * CONTRACT requires the structured data on every render. (§0: every figure in
 * the dataset is the same verified figure the page prints.)
 */

import type { SchemaInput, StatValue } from '@/lib/site/json-ld'

export type NeighborhoodSchemaInput = {
  neighborhoodName: string
  neighborhoodSlug: string
  cityName: string
  citySlug: string
  hasMap: boolean
  geo?: { lat: number; lng: number }
  datasetVariables: StatValue[]
  asOfIso: string | null
  asOfLabel: string | null
}

export function buildNeighborhoodSchemas({
  neighborhoodName,
  neighborhoodSlug,
  cityName,
  citySlug,
  hasMap,
  geo,
  datasetVariables,
  asOfIso,
  asOfLabel,
}: NeighborhoodSchemaInput): SchemaInput[] {
  const url = `/cities/${citySlug}/${neighborhoodSlug}`
  const schemas: SchemaInput[] = [
    {
      type: 'breadcrumb',
      items: [
        { name: 'Home', url: '/' },
        { name: 'Cities', url: '/cities' },
        { name: cityName, url: `/cities/${citySlug}` },
        { name: neighborhoodName, url },
      ],
    },
    {
      type: 'place',
      placeType: 'Neighborhood',
      name: neighborhoodName,
      description: `Active single-family homes and live market data for ${neighborhoodName} in ${cityName}, Oregon.`,
      url,
      address: { city: cityName, state: 'OR', country: 'US' },
      containedInPlace: cityName,
      geo,
      hasMap: hasMap ? url : undefined,
      additionalProperty: datasetVariables.length > 0 ? datasetVariables : undefined,
    },
  ]
  if (datasetVariables.length > 0) {
    schemas.push({
      type: 'dataset',
      name: `${neighborhoodName} real estate market statistics${asOfLabel ? `, ${asOfLabel}` : ''}`,
      // DERIVED from the variables actually measured (2026-08-27 audit: the
      // fixed sentence promised statistics the Dataset did not always carry,
      // and the contract had already retired it).
      description: `Single-family market statistics for ${neighborhoodName} in ${cityName}, Oregon: ${datasetVariables
        .map((v) => v.name.toLowerCase())
        .join(', ')}. Sourced from the regional MLS through Oregon Data Share via Ryan Realty.`,
      url,
      dateModified: asOfIso ?? undefined,
      spatialCoverageName: `${neighborhoodName}, ${cityName}, OR`,
      variableMeasured: datasetVariables,
    })
  }
  return schemas
}
