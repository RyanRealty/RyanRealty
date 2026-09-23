/**
 * JSON-LD builders for the neighborhood page — extracted verbatim from
 * page.tsx so the route file stays a readable section list under
 * ci:file-size-budget's 600-line floor. Nothing here fetches; the page hands
 * in the already-verified figures.
 *
 * AI-citability: BreadcrumbList + Neighborhood Place + (when live figures
 * exist) a Dataset whose variables come from buildMarketFaq + (when photographed
 * homes exist) an ItemList of canonical listing URLs. The PAGE CONTRACT requires
 * the structured data on every render. (§0: every figure in the dataset is the
 * same verified figure the page prints.)
 */

import {
  listingItemListFromHomes,
  type ListingItemListHome,
  type SchemaInput,
  type StatValue,
} from '@/lib/site/json-ld'
import { reconcileDatasetToFaq, type FaqPair } from '@/lib/site/dataset-faq-contract'

export type NeighborhoodSchemaInput = {
  neighborhoodName: string
  neighborhoodSlug: string
  cityName: string
  citySlug: string
  hasMap: boolean
  geo?: { lat: number; lng: number }
  datasetVariables: StatValue[]
  /**
   * AEO-1. The FAQPage items the page emits beside this markup. When given,
   * a Dataset / Place variable whose FAQ answer prints a different number
   * under the same label is withheld (lib/site/dataset-faq-contract.ts).
   */
  faqItems?: readonly FaqPair[]
  asOfIso: string | null
  asOfLabel: string | null
  /**
   * SITE-176. Photographed homes on #homes (price + street + canonical listing
   * URL). Empty inventory withholds the ItemList.
   */
  homes?: ReadonlyArray<ListingItemListHome>
}

export function buildNeighborhoodSchemas({
  neighborhoodName,
  neighborhoodSlug,
  cityName,
  citySlug,
  hasMap,
  geo,
  datasetVariables: measured,
  faqItems,
  asOfIso,
  asOfLabel,
  homes,
}: NeighborhoodSchemaInput): SchemaInput[] {
  const url = `/cities/${citySlug}/${neighborhoodSlug}`
  const datasetVariables = faqItems ? reconcileDatasetToFaq(measured, faqItems) : measured
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
  const homeList = listingItemListFromHomes(`Homes for sale in ${neighborhoodName}`, homes ?? [])
  if (homeList) schemas.push(homeList)
  return schemas
}
