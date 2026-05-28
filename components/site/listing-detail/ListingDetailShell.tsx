import type { ReactNode } from 'react'
import { Container, Section } from '@/components/site/primitives'
import { BreadcrumbNav, type BreadcrumbNavItem } from '@/components/site/BreadcrumbNav'
import { MetadataBlock } from '@/components/site/MetadataBlock'
import type { ListingDetail } from '@/lib/data/types/listing'
import type { SchemaInput } from '@/lib/site/json-ld'
import { cn } from '@/lib/utils'

/**
 * Listing-detail page shell — owns the page chrome (breadcrumb + JSON-LD
 * + main grid). Inner sections (PriceBlock, PropertySpecs, etc.) get
 * passed in as the `main` / `sidebar` slot children so the page route
 * file stays declarative.
 *
 * Layout (responsive):
 *   - Mobile: stacked, sidebar slot rendered after main slot.
 *   - Desktop: 2-column grid with main on the left + sticky sidebar on
 *     the right.
 *
 * JSON-LD per CLAUDE.md §0 + §0.5: a RealEstateListing block + a
 * BreadcrumbList block (the BreadcrumbNav also emits its own
 * BreadcrumbList; we deduplicate by suppressing the BreadcrumbNav's
 * `includeJsonLd` and emitting both schemas from this shell instead).
 *
 * Per plan §9 Layer 4.
 */

type Props = {
  listing: Pick<
    ListingDetail,
    | 'listingKey'
    | 'streetNumber'
    | 'streetName'
    | 'city'
    | 'citySlug'
    | 'postalCode'
    | 'listPrice'
    | 'beds'
    | 'baths'
    | 'sqft'
    | 'totalLivingAreaSqFt'
    | 'lotSizeAcres'
    | 'yearBuilt'
    | 'photos'
    | 'lat'
    | 'lng'
    | 'listAgentName'
    | 'listAgentEmail'
    | 'publicRemarks'
  >
  breadcrumbs: ReadonlyArray<BreadcrumbNavItem>
  /** Full-width hero — renders edge-to-edge above the main+sidebar grid
   * per Zillow Showcase parity. The photo grid / autoplay video lives
   * here, NOT inside the main column. */
  hero?: ReactNode
  /** Main content column children (price, specs, description, etc.). */
  main: ReactNode
  /** Sidebar column children (agent card, mortgage calc, contact CTA). */
  sidebar?: ReactNode
  className?: string
}

function buildAddressLine(
  l: Props['listing'],
): { street: string; city: string; full: string } {
  const street = [l.streetNumber, l.streetName].filter(Boolean).join(' ').trim()
  // Ryan Realty is Oregon-only; state hardcoded so the address line has a
  // canonical "City, OR ZIP" form even though the ListingTile type does
  // not expose a `state` field.
  const cityState = l.city ? `${l.city}, OR` : ''
  const full = [street, cityState, l.postalCode ?? ''].filter(Boolean).join(' ').trim()
  return { street, city: cityState, full }
}

export function ListingDetailShell({
  listing,
  breadcrumbs,
  hero,
  main,
  sidebar,
  className,
}: Props) {
  const addr = buildAddressLine(listing)
  const livingArea = listing.sqft ?? listing.totalLivingAreaSqFt ?? null

  const schemas: SchemaInput[] = [
    {
      type: 'breadcrumb',
      items: breadcrumbs
        .filter((item) => item.href)
        .map((item) => ({ name: item.label, url: item.href as string })),
    },
    {
      type: 'realEstateListing',
      name: addr.full || `Listing ${listing.listingKey}`,
      description: listing.publicRemarks ?? undefined,
      url: `/listing/${listing.listingKey}`,
      address: {
        street: addr.street,
        city: listing.city ?? undefined,
        state: 'OR',
        postalCode: listing.postalCode ?? undefined,
      },
      geo: listing.lat != null && listing.lng != null
        ? { lat: listing.lat, lng: listing.lng }
        : undefined,
      beds: listing.beds ?? undefined,
      baths: listing.baths ?? undefined,
      livingAreaSqft: livingArea ?? undefined,
      lotSizeSqft: listing.lotSizeAcres != null ? Math.round(listing.lotSizeAcres * 43560) : undefined,
      yearBuilt: listing.yearBuilt ?? undefined,
      listPrice: listing.listPrice ?? undefined,
      photos: listing.photos.slice(0, 5).map((p) => p.url),
      listingAgent: listing.listAgentName
        ? { name: listing.listAgentName, email: listing.listAgentEmail ?? undefined }
        : undefined,
    },
  ]

  return (
    <>
      <MetadataBlock schemas={schemas} />
      <Section padding="tight" tone="muted">
        <Container>
          <BreadcrumbNav items={breadcrumbs} includeJsonLd={false} />
        </Container>
      </Section>
      {hero ? (
        // Hero band: edge-to-edge full-viewport-width, no Container
        // constraint. Zillow Showcase parity — immersive photo / video
        // hero spans the page above the main+sidebar grid.
        <section aria-label="Listing hero" className="w-full px-4 sm:px-6 lg:px-8 pt-2">
          {hero}
        </section>
      ) : null}
      <Section padding="default">
        <Container className={cn('grid gap-10', sidebar ? 'lg:grid-cols-[1.6fr_360px]' : '', className)}>
          <div className="min-w-0 flex flex-col gap-10">{main}</div>
          {sidebar ? (
            <aside className="lg:sticky lg:top-24 lg:self-start flex flex-col gap-6">
              {sidebar}
            </aside>
          ) : null}
        </Container>
      </Section>
    </>
  )
}
