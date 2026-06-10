import { getCanonicalSiteUrl } from '@/lib/share-metadata'

/**
 * Typed schema.org JSON-LD builders for the site v2 MetadataBlock.
 *
 * Pages compose <MetadataBlock schemas={[...]} /> with a discriminated
 * union of schema-type inputs. This module owns the typed input shapes
 * + the conversion to schema.org JSON. Keeps the component itself a
 * thin renderer.
 *
 * Conventions:
 *   - Absolute URLs everywhere (schema.org parsers prefer absolute).
 *   - Empty fields omitted (no `undefined` keys in serialized JSON).
 *   - LD type `@id` references the canonical site URL so cross-page
 *     references resolve.
 */

// ─── Public input shapes (discriminated union) ────────────────────────

type AddressInput = {
  street?: string
  city?: string
  state?: string
  postalCode?: string
  country?: string
}

type GeoInput = { lat: number; lng: number }

export type SchemaInput =
  | RealEstateListingInput
  | BreadcrumbInput
  | WebPageInput
  | FaqPageInput
  | PlaceInput
  | DatasetInput
  | ArticleInput

/** A single named, verified statistic — feeds Place.additionalProperty + Dataset.variableMeasured. */
export type StatValue = { name: string; value: string | number; unitText?: string }

export type RealEstateListingInput = {
  type: 'realEstateListing'
  name: string
  description?: string
  url?: string
  address?: AddressInput
  geo?: GeoInput
  beds?: number
  baths?: number
  livingAreaSqft?: number
  lotSizeSqft?: number
  yearBuilt?: number
  listPrice?: number
  photos?: ReadonlyArray<string>
  listingAgent?: { name?: string; email?: string; telephone?: string }
  /**
   * Listing status from the MLS feed. Controls whether an Offer node is
   * emitted and what availability value it carries.
   *
   * Active               -> Offer with InStock availability
   * Active Under Contract
   * Coming Soon          -> Offer with PreOrder availability
   * Pending              -> no Offer (price no longer actionable)
   * Closed / Withdrawn
   * Expired / Canceled   -> no Offer (listing is off-market)
   * undefined            -> behaves like Active (backwards-compatible)
   */
  availability?: string
}

export type BreadcrumbInput = {
  type: 'breadcrumb'
  items: ReadonlyArray<{ name: string; url: string }>
}

export type WebPageInput = {
  type: 'webPage'
  name: string
  description?: string
  url?: string
  /** schema.org WebPage subtype, e.g. 'AboutPage', 'CollectionPage', 'ContactPage'. Defaults to 'WebPage'. */
  pageType?: 'AboutPage' | 'CollectionPage' | 'ContactPage'
  /** Set true to point mainEntity at the sitewide Organization (#organization) — the brand-entity anchor AI engines attribute citations to. */
  aboutOrganization?: boolean
}

export type FaqPageInput = {
  type: 'faqPage'
  items: ReadonlyArray<{ question: string; answer: string }>
}

export type PlaceInput = {
  type: 'place'
  /**
   * schema.org subtype. City for a city page, Neighborhood for a Bend
   * neighborhood, Place (default) for a resort/master-planned community.
   * Educational subtypes (School / ElementarySchool / MiddleSchool /
   * HighSchool) for the /schools pages, Park for the /parks pages — all are
   * schema.org Place subtypes.
   */
  placeType?:
    | 'City'
    | 'Neighborhood'
    | 'Place'
    | 'School'
    | 'ElementarySchool'
    | 'MiddleSchool'
    | 'HighSchool'
    | 'Park'
  name: string
  description?: string
  url?: string
  geo?: GeoInput
  address?: AddressInput
  containedInPlace?: string
  hasMap?: string
  /** Verified live stats (active count, median list price, etc.) surfaced as PropertyValue. */
  additionalProperty?: ReadonlyArray<StatValue>
}

/**
 * Market-statistics dataset for a geography. The single schema type AI engines
 * parse as structured numeric claims (Google Dataset Search understands it).
 * dateModified MUST be the real data-refresh timestamp (market_pulse_live
 * refreshedAt) so freshness is honest — a stale date kills citation trust.
 */
export type DatasetInput = {
  type: 'dataset'
  name: string
  description: string
  url?: string
  dateModified?: string
  temporalCoverage?: string
  spatialCoverageName?: string
  variableMeasured: ReadonlyArray<StatValue>
}

export type ArticleInput = {
  type: 'article'
  headline: string
  description?: string
  url?: string
  image?: string
  datePublished?: string
  dateModified?: string
  authorName?: string
}

// ─── Builder ──────────────────────────────────────────────────────────

export function buildJsonLd(input: SchemaInput): Record<string, unknown> {
  const site = getCanonicalSiteUrl()
  const absoluteUrl = (u?: string): string | undefined => {
    if (!u) return undefined
    if (u.startsWith('http://') || u.startsWith('https://')) return u
    return `${site}${u.startsWith('/') ? '' : '/'}${u}`
  }

  switch (input.type) {
    case 'realEstateListing':
      return prune({
        '@context': 'https://schema.org',
        '@type': 'SingleFamilyResidence',
        name: input.name,
        description: input.description,
        url: absoluteUrl(input.url),
        address: input.address ? prune({
          '@type': 'PostalAddress',
          streetAddress: input.address.street,
          addressLocality: input.address.city,
          addressRegion: input.address.state,
          postalCode: input.address.postalCode,
          addressCountry: input.address.country ?? 'US',
        }) : undefined,
        geo: input.geo ? {
          '@type': 'GeoCoordinates',
          latitude: input.geo.lat,
          longitude: input.geo.lng,
        } : undefined,
        numberOfRooms: input.beds,
        numberOfBathroomsTotal: input.baths,
        floorSize: input.livingAreaSqft != null ? {
          '@type': 'QuantitativeValue',
          value: input.livingAreaSqft,
          unitCode: 'FTK',
        } : undefined,
        lotSize: input.lotSizeSqft != null ? {
          '@type': 'QuantitativeValue',
          value: input.lotSizeSqft,
          unitCode: 'FTK',
        } : undefined,
        yearBuilt: input.yearBuilt,
        offers: buildOffer(input.listPrice, input.availability),
        image: input.photos && input.photos.length > 0 ? input.photos.slice(0, 5).map(absoluteUrl) : undefined,
        listingAgent: input.listingAgent ? prune({
          '@type': 'RealEstateAgent',
          name: input.listingAgent.name,
          email: input.listingAgent.email,
          telephone: input.listingAgent.telephone,
        }) : undefined,
      })

    case 'breadcrumb':
      return {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: input.items.map((item, i) => ({
          '@type': 'ListItem',
          position: i + 1,
          name: item.name,
          item: absoluteUrl(item.url),
        })),
      }

    case 'webPage':
      return prune({
        '@context': 'https://schema.org',
        '@type': input.pageType ?? 'WebPage',
        name: input.name,
        description: input.description,
        url: absoluteUrl(input.url),
        mainEntity: input.aboutOrganization ? { '@id': `${site}#organization` } : undefined,
      })

    case 'faqPage':
      return {
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        mainEntity: input.items.map(({ question, answer }) => ({
          '@type': 'Question',
          name: question,
          acceptedAnswer: { '@type': 'Answer', text: answer },
        })),
      }

    case 'place':
      return prune({
        '@context': 'https://schema.org',
        '@type': input.placeType ?? 'Place',
        name: input.name,
        description: input.description,
        url: absoluteUrl(input.url),
        hasMap: absoluteUrl(input.hasMap),
        geo: input.geo ? {
          '@type': 'GeoCoordinates',
          latitude: input.geo.lat,
          longitude: input.geo.lng,
        } : undefined,
        address: input.address ? prune({
          '@type': 'PostalAddress',
          streetAddress: input.address.street,
          addressLocality: input.address.city,
          addressRegion: input.address.state,
          postalCode: input.address.postalCode,
          addressCountry: input.address.country ?? 'US',
        }) : undefined,
        containedInPlace: input.containedInPlace ? {
          '@type': 'Place',
          name: input.containedInPlace,
        } : undefined,
        additionalProperty: input.additionalProperty && input.additionalProperty.length > 0
          ? input.additionalProperty.map((p) => prune({
              '@type': 'PropertyValue',
              name: p.name,
              value: p.value,
              unitText: p.unitText,
            }))
          : undefined,
      })

    case 'dataset':
      return prune({
        '@context': 'https://schema.org',
        '@type': 'Dataset',
        name: input.name,
        description: input.description,
        url: absoluteUrl(input.url),
        dateModified: input.dateModified,
        temporalCoverage: input.temporalCoverage,
        creator: { '@id': `${getCanonicalSiteUrl()}#organization` },
        spatialCoverage: input.spatialCoverageName
          ? { '@type': 'Place', name: input.spatialCoverageName }
          : undefined,
        variableMeasured: input.variableMeasured.map((v) => prune({
          '@type': 'PropertyValue',
          name: v.name,
          value: v.value,
          unitText: v.unitText,
        })),
      })

    case 'article':
      return prune({
        '@context': 'https://schema.org',
        '@type': 'Article',
        headline: input.headline,
        description: input.description,
        url: absoluteUrl(input.url),
        image: absoluteUrl(input.image),
        datePublished: input.datePublished,
        dateModified: input.dateModified,
        author: input.authorName ? {
          '@type': 'Person',
          name: input.authorName,
        } : undefined,
      })
  }
}

/**
 * Build a schema.org Offer node for a real-estate listing.
 *
 * Off-market statuses (Closed, Withdrawn, Expired, Canceled, Pending) must
 * not advertise a live list price as a purchasable offer — a sold home at
 * $X is not for sale at $X. Active and Coming Soon listings are on-market
 * so an Offer makes sense. Active Under Contract is a stretch but Google
 * accepts PreOrder for it (property is under contract, not yet sold).
 *
 * When availability is undefined we fall back to InStock so existing
 * callers that do not pass the field keep the same behaviour.
 */
function buildOffer(
  listPrice: number | undefined,
  availability: string | undefined,
): Record<string, unknown> | undefined {
  if (listPrice == null) return undefined

  const status = availability ?? 'Active'

  // Off-market statuses: no Offer at all.
  if (['Closed', 'Withdrawn', 'Expired', 'Canceled', 'Pending'].includes(status)) {
    return undefined
  }

  // Active Under Contract / Coming Soon: price is visible but not freely buyable.
  if (['Active Under Contract', 'Coming Soon'].includes(status)) {
    return {
      '@type': 'Offer',
      price: listPrice,
      priceCurrency: 'USD',
      availability: 'https://schema.org/PreOrder',
    }
  }

  // Active (default) — in-stock, purchasable.
  return {
    '@type': 'Offer',
    price: listPrice,
    priceCurrency: 'USD',
    availability: 'https://schema.org/InStock',
  }
}

function prune<T extends Record<string, unknown>>(obj: T): T {
  const out = {} as Record<string, unknown>
  for (const [k, v] of Object.entries(obj)) {
    if (v == null) continue
    if (typeof v === 'object' && !Array.isArray(v) && Object.keys(v as object).length === 0) continue
    out[k] = v
  }
  return out as T
}
