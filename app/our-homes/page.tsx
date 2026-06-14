import type { Metadata } from 'next'
import Link from 'next/link'
import { getListingsWithAdvanced, type ListingTileRow } from '@/app/actions/listings'
import { ArrowRightHugeIcon } from '@/components/icons/HugeIcons'
import { listingDetailPath, listingsBrowsePath } from '@/lib/slug'
import { Container, Eyebrow, H2, Body, Section, Stack, Grid } from '@/components/site/primitives'
import { PageBreadcrumb } from '@/components/site/PageBreadcrumb'
import { HeroBlock } from '@/components/site/HeroBlock'
import ListingCard, { type ListingCardData } from '@/components/site/ListingCard'

const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://ryan-realty.com').replace(/\/$/, '')
const ogImage = `${siteUrl}/api/og?type=default`

export const metadata: Metadata = {
  title: 'Our Homes | Listings by Ryan Realty | Ryan Realty',
  description:
    'Browse homes listed for sale by Ryan Realty. Our current listings across Bend, Redmond, Sisters, Sunriver and Central Oregon.',
  alternates: { canonical: `${siteUrl}/our-homes` },
  openGraph: {
    title: 'Our Homes | Ryan Realty',
    url: `${siteUrl}/our-homes`,
    type: 'website',
    images: [{ url: ogImage, width: 1200, height: 630 }],
  },
  twitter: { card: 'summary_large_image', images: [ogImage] },
}

export const dynamic = 'force-dynamic'

/** Map a ListingTileRow (PascalCase, from getListingsWithAdvanced) to ListingCardData. */
function tileToCardData(listing: ListingTileRow): ListingCardData {
  const addressLine =
    [listing.StreetNumber ?? '', listing.StreetName ?? ''].filter(Boolean).join(' ') ||
    'Address on request'
  const cityParts: string[] = []
  if (listing.City) cityParts.push(`${listing.City}, ${listing.State ?? 'OR'}`)
  if (listing.PostalCode) cityParts.push(listing.PostalCode)
  if (listing.SubdivisionName) cityParts.push(listing.SubdivisionName)
  const href = listingDetailPath(
    listing.ListingKey ?? '',
    {
      streetNumber: listing.StreetNumber,
      streetName: listing.StreetName,
      city: listing.City,
    },
  )
  return {
    listingKey: listing.ListingKey ?? '',
    href,
    photoUrl: listing.PhotoURL ?? null,
    price: listing.ListPrice ?? null,
    addressLine,
    cityLine: cityParts.join(' · '),
    beds: listing.BedroomsTotal ?? null,
    baths: listing.BathroomsTotal ?? null,
    sqft: listing.TotalLivingAreaSqFt ?? null,
  }
}

const SHOWN_LISTINGS = 12

export default async function OurHomesPage() {
  const { listings } = await getListingsWithAdvanced({
    limit: 24,
    sort: 'newest',
  })

  const cards = listings.map(tileToCardData)
  const shownCards = cards.slice(0, SHOWN_LISTINGS)

  return (
    <main className="min-h-screen bg-background">
      <PageBreadcrumb trail={[{ label: 'Our homes' }]} />

      <HeroBlock
        headline="Homes Listed by Ryan Realty"
        lede="Browse homes for sale across Bend, Redmond, Sisters, Sunriver, and Central Oregon. Professional presentation, targeted outreach, and one broker accountable from listing to closing."
        photo={{
          src: '/brand/hero/hero-old-mill-master-4k.jpg',
          alt: 'Old Mill District drone view with the American flag, the Deschutes River, and the Cascade mountains.',
          priority: true,
        }}
        chips={[
          { label: 'View all listings', href: listingsBrowsePath() },
          { label: 'Sell with us', href: '/sell' },
        ]}
        minHeight={520}
      />

      <Section padding="default" tone="default" divider>
        <Container>
          <div className="mb-6 flex items-end justify-between gap-4">
            <Stack gap="tight" className="max-w-prose">
              <Eyebrow>Available now</Eyebrow>
              <H2>Featured homes for sale</H2>
              {listings.length > 0 ? (
                <Body size="small" tone="muted">
                  {listings.length} home{listings.length !== 1 ? 's' : ''} for sale in Central
                  Oregon.
                </Body>
              ) : null}
            </Stack>
            <Link
              href={listingsBrowsePath()}
              className="shrink-0 text-sm font-medium text-primary underline-offset-2 hover:underline"
            >
              <span className="flex items-center gap-1.5">
                All listings
                <ArrowRightHugeIcon className="h-4 w-4" />
              </span>
            </Link>
          </div>

          {listings.length === 0 ? (
            <div className="rounded-xl border border-border bg-muted p-10 text-center">
              <Body tone="muted">
                No listings are available right now. Browse all Central Oregon listings or get in
                touch to list your home with us.
              </Body>
              <div className="mt-6 flex flex-wrap justify-center gap-4">
                <Link
                  href={listingsBrowsePath()}
                  className="rounded-lg bg-primary px-5 py-2.5 font-semibold text-primary-foreground hover:bg-accent/90"
                >
                  Browse all listings
                </Link>
                <Link
                  href="/contact?inquiry=Selling"
                  className="rounded-lg border-2 border-primary px-5 py-2.5 font-semibold text-primary hover:bg-primary hover:text-primary-foreground"
                >
                  Contact us
                </Link>
              </div>
            </div>
          ) : (
            <>
              <Grid cols={3} gap="default">
                {shownCards.map((c) => (
                  <ListingCard key={c.listingKey} listing={c} />
                ))}
              </Grid>
              {listings.length > SHOWN_LISTINGS && (
                <div className="mt-10 text-center">
                  <Link
                    href={listingsBrowsePath()}
                    className="inline-flex items-center gap-2 rounded-lg border-2 border-primary px-6 py-3 font-semibold text-primary hover:bg-primary hover:text-primary-foreground"
                  >
                    View all {listings.length} listings
                    <ArrowRightHugeIcon className="h-5 w-5" />
                  </Link>
                </div>
              )}
            </>
          )}
        </Container>
      </Section>

      <Section padding="default" tone="muted">
        <Container>
          <div className="mx-auto max-w-2xl text-center">
            <H2>Ready to list your home?</H2>
            <Body tone="muted" className="mt-3">
              Get our full plan: pricing, marketing, and local expertise from day one.
            </Body>
            <Link
              href="/sell"
              className="mt-6 inline-block rounded-lg bg-primary px-6 py-3 font-semibold text-primary-foreground hover:bg-accent/90"
            >
              Sell with us
            </Link>
          </div>
        </Container>
      </Section>
    </main>
  )
}
