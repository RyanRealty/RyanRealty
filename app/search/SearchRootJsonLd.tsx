import { listingTileHref } from '@/lib/slug'

/**
 * Structured data for the root search page (/homes-for-sale, unslugged
 * filters): WebPage + an ItemList of the listings the page already fetched.
 *
 * Sibling to app/search/[...slug]/SearchPageJsonLd.tsx rather than a shared
 * import: the root page carries no breadcrumb (see the `@no-breadcrumb` note
 * at the top of app/search/page.tsx — the two-item Home > self trail earns no
 * rich result and cost ~11% of the mobile viewport) and no fixed place name,
 * so the BreadcrumbList and Place nodes that component emits do not apply
 * here. This component emits only the two node types that do.
 */
type ListingRow = {
  ListingKey?: string | null
  ListNumber?: string | null
  StreetNumber?: string | null
  StreetName?: string | null
  City?: string | null
  State?: string | null
  PostalCode?: string | null
  SubdivisionName?: string | null
  /** SITE-22 — declared, not read through the index signature, so the ItemList
   *  url is built from the same fields the listing's canonical is. */
  BoundaryCity?: string | null
  BoundaryNeighborhood?: string | null
  [key: string]: unknown
}

type Props = {
  title: string
  description: string
  canonicalUrl: string
  siteUrl: string
  listings: ListingRow[]
  /** Total result count across all pages, not just the rendered slice. */
  totalCount?: number
}

export default function SearchRootJsonLd({
  title,
  description,
  canonicalUrl,
  siteUrl,
  listings,
  totalCount,
}: Props) {
  const webPage = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: title,
    description,
    url: canonicalUrl,
  }

  const listingUrls = listings
    .slice(0, 20)
    .map((l) => {
      const key = l.ListNumber ?? l.ListingKey
      if (!key || !siteUrl) return null
      const href = listingTileHref({
        listingKey: String(key),
        listNumber: l.ListNumber ?? null,
        streetNumber: l.StreetNumber ?? null,
        streetName: l.StreetName ?? null,
        city: l.City ?? null,
        boundaryCity: l.BoundaryCity ?? null,
        boundaryNeighborhood: l.BoundaryNeighborhood ?? null,
        subdivisionName: l.SubdivisionName ?? null,
      })
      return `${siteUrl}${href}`
    })
    .filter(Boolean) as string[]

  const itemList =
    listingUrls.length > 0
      ? {
          '@context': 'https://schema.org',
          '@type': 'ItemList',
          // Real total when available; fall back to the slice length so we
          // never report a number smaller than what is actually shown.
          numberOfItems: totalCount ?? listings.length,
          itemListElement: listingUrls.slice(0, 10).map((url, i) => ({
            '@type': 'ListItem',
            position: i + 1,
            url,
          })),
        }
      : null

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(webPage) }} />
      {itemList && (
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(itemList) }} />
      )}
    </>
  )
}
