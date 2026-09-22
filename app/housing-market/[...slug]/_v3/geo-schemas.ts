/**
 * JSON-LD for /housing-market/[...slug]: BreadcrumbList, WebPage, Dataset,
 * FAQPage, and an ItemList of photographed live homes when the city view
 * renders them (SITE-176).
 */

import {
  listingItemListFromHomes,
  type ListingItemListHome,
  type SchemaInput,
  type StatValue,
} from '@/lib/site/json-ld'

export function buildGeoMarketSchemas(input: {
  geoName: string
  cityName: string
  citySlug: string
  communityName?: string | null
  canonicalPath: string
  datasetVariables: ReadonlyArray<StatValue>
  insightVariables: ReadonlyArray<StatValue>
  asOfIso: string | null
  asOfLabel: string | null
  refreshedAt: string | null
  faqs: ReadonlyArray<{ question: string; answer: string }>
  homes: ReadonlyArray<ListingItemListHome>
}): SchemaInput[] {
  const {
    geoName,
    cityName,
    citySlug,
    communityName,
    canonicalPath,
    datasetVariables,
    insightVariables,
    asOfIso,
    asOfLabel,
    refreshedAt,
    faqs,
    homes,
  } = input

  const schemas: SchemaInput[] = [
    {
      type: 'breadcrumb',
      items: [
        { name: 'Home', url: '/' },
        { name: 'Housing market', url: '/housing-market' },
        ...(communityName
          ? [
              { name: cityName, url: `/housing-market/${citySlug}` },
              { name: communityName, url: canonicalPath },
            ]
          : [{ name: geoName, url: canonicalPath }]),
      ],
    },
    {
      type: 'webPage',
      name: `${geoName} housing market`,
      description: `Live ${geoName} market data: active inventory, median list price, months of supply, and pace. Single-family homes only.`,
      url: canonicalPath,
    },
  ]

  if (datasetVariables.length > 0 && refreshedAt) {
    const publishedVariables = [...datasetVariables, ...insightVariables]
    const metricNames = publishedVariables.map((variable) => variable.name.toLowerCase())
    const metricList =
      metricNames.length === 1
        ? metricNames[0]
        : `${metricNames.slice(0, -1).join(', ')}, and ${metricNames[metricNames.length - 1]}`
    schemas.push({
      type: 'dataset',
      name: `${geoName}, Oregon real estate market statistics${asOfLabel ? `, ${asOfLabel}` : ''}`,
      description:
        `Live single-family home market data for ${geoName}, Oregon. ` +
        `Includes ${metricList}. ` +
        `Sourced from Oregon Data Share via Ryan Realty.`,
      url: canonicalPath,
      dateModified: asOfIso ?? undefined,
      spatialCoverageName: `${geoName}, OR`,
      variableMeasured: publishedVariables,
    })
  }

  if (faqs.length > 0) {
    schemas.push({ type: 'faqPage', items: faqs })
  }

  const homeList = listingItemListFromHomes(`Homes for sale in ${geoName}`, homes)
  if (homeList) schemas.push(homeList)

  return schemas
}
