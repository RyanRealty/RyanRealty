/**
 * The city node's JSON-LD, built once from the same arrays the page renders.
 *
 * BreadcrumbList + City Place + Dataset + FAQPage. V3Breadcrumb and V3Quiet carry
 * no structured data of their own, on purpose, so one derivation feeds the visible
 * copy and the markup and the two cannot disagree (CLAUDE.md section 0).
 *
 * `hasMap` ships because PlaceSplitView always mounts the flagship map.
 *
 * It lives beside the route rather than inside it for the reason city-constants.ts
 * states: ci:file-size-budget's instruction when a route file approaches the floor is
 * to split, not to re-baseline. Nothing here fetches or formats a figure.
 */

import type { SchemaInput } from '@/lib/site/json-ld'
import type { buildMarketFaq } from '@/lib/site/market-faq'

type MarketFaq = ReturnType<typeof buildMarketFaq>


/**
 * The Dataset description names the metrics the payload ACTUALLY carries. A hardcoded
 * sentence outran its payload on the degraded branches: a city whose pulse row dropped
 * months of supply still published a description promising it, which is a machine-readable
 * claim with nothing behind it (CLAUDE.md section 0, same defect class as a wrong number).
 */
const VARIABLE_PHRASE: Record<string, string> = {
  'Median List Price': 'median list price',
  'Active Listings': 'active inventory',
  'Months of Supply': 'months of supply',
  'Median Days to Pending': 'median days to pending',
  'Median Days on Market': 'median days on market',
  'Homes Sold (12 months)': 'homes sold in the last 12 months',
}

function datasetDescription(
  cityName: string,
  variables: ReadonlyArray<{ name: string }>,
): string {
  const phrases = variables.map((v) => VARIABLE_PHRASE[v.name] ?? v.name.toLowerCase())
  if (phrases.length === 0) {
    return `Live single-family home market data for ${cityName}, Oregon. Sourced from the regional MLS via Ryan Realty.`
  }
  const list =
    phrases.length === 1
      ? phrases[0]
      : phrases.length === 2
        ? `${phrases[0]} and ${phrases[1]}`
        : `${phrases.slice(0, -1).join(', ')}, and ${phrases[phrases.length - 1]}`
  const sentence = list.charAt(0).toUpperCase() + list.slice(1)
  return `Live single-family home market data for ${cityName}, Oregon. ${sentence}. Sourced from the regional MLS via Ryan Realty.`
}

export function buildCitySchemas(input: {
  cityName: string
  slug: string
  faq: MarketFaq
  /** True when PlaceSplitView mounts the flagship map. */
  hasMap: boolean
}): SchemaInput[] {
  const { cityName, slug, faq } = input
  const { faqs, datasetVariables, asOfIso, asOfLabel } = faq

  const schemas: SchemaInput[] = [
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
      hasMap: input.hasMap ? `/cities/${slug}` : undefined,
      additionalProperty: datasetVariables.length > 0 ? datasetVariables : undefined,
    },
  ]

  if (datasetVariables.length > 0) {
    schemas.push({
      type: 'dataset',
      name: `${cityName}, Oregon real estate market statistics${asOfLabel ? `, ${asOfLabel}` : ''}`,
      description: datasetDescription(cityName, datasetVariables),
      url: `/cities/${slug}`,
      // The real refresh timestamp, never now().
      dateModified: asOfIso ?? undefined,
      spatialCoverageName: `${cityName}, OR`,
      variableMeasured: datasetVariables,
    })
  }

  if (faqs.length > 0) schemas.push({ type: 'faqPage', items: faqs })

  return schemas
}
