import type { SchemaInput } from '@/lib/site/json-ld'
import type { MarketFaqResult } from '@/lib/site/market-faq'

/**
 * The city market-statistics Dataset node for /homes-for-sale/[city].
 *
 * One builder for both branches of the route (the grid and the map/split
 * view) so the Dataset a crawler reads is the same node whichever branch
 * served the URL. Every variable comes from buildMarketFaq's
 * `datasetVariables`, the same array that feeds the visible FAQ and the
 * FAQPage node, so the three surfaces cannot disagree (CLAUDE.md §0). No
 * variables, no node.
 */
export function buildCityMarketDatasetSchema(args: {
  city: string
  searchPagePath: string
  cityMarketFaq: MarketFaqResult | null
}): SchemaInput | undefined {
  const { city, searchPagePath, cityMarketFaq } = args
  if (!cityMarketFaq || cityMarketFaq.datasetVariables.length === 0) return undefined
  return {
    type: 'dataset',
    name: `${city}, Oregon real estate market statistics${cityMarketFaq.asOfLabel ? `, ${cityMarketFaq.asOfLabel}` : ''}`,
    description: `Live single-family home market data for ${city}, Oregon. Includes median list price, active inventory, months of supply, and median days to pending. Sourced from the regional MLS via Ryan Realty.`,
    url: searchPagePath,
    dateModified: cityMarketFaq.asOfIso ?? undefined,
    spatialCoverageName: `${city}, OR`,
    variableMeasured: cityMarketFaq.datasetVariables,
  }
}
