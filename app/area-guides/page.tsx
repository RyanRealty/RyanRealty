import type { Metadata } from 'next'
import Link from 'next/link'
import { getCitiesForIndex } from '@/app/actions/cities'
import { getCommunitiesForIndex } from '@/app/actions/communities'
import { sortCitiesWithPrimaryFirst, getPrimaryCityRank } from '@/lib/cities'
import { sortResortCommunitiesInPrimaryCities } from '@/lib/communities'
import ContentPageHero from '@/components/layout/ContentPageHero'
import { CONTENT_HERO_IMAGES } from '@/lib/content-page-hero-images'
import { RelatedAreas, type RelatedAreaItem } from '@/components/site/RelatedAreas'
import { Section, Container, H2 } from '@/components/site/primitives'
import { MetadataBlock } from '@/components/site/MetadataBlock'
import { Button } from '@/components/ui/button'

const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://ryan-realty.com').replace(/\/$/, '')
const ogImage = `${siteUrl}/api/og?type=default`

export const revalidate = 60

export const metadata: Metadata = {
  title: 'Area Guides | Central Oregon Cities & Communities | Ryan Realty',
  description:
    'Explore Bend, Redmond, Sisters, Sunriver, La Pine, Prineville and more. Neighborhoods, market trends, and homes for sale in every corner of Central Oregon.',
  alternates: { canonical: `${siteUrl}/area-guides` },
  openGraph: {
    title: 'Area Guides | Ryan Realty — Central Oregon',
    url: `${siteUrl}/area-guides`,
    type: 'website',
    images: [{ url: ogImage, width: 1200, height: 630 }],
  },
  twitter: { card: 'summary_large_image', images: [ogImage] },
}

export default async function AreaGuidesPage() {
  const [allCities, allCommunities] = await Promise.all([
    getCitiesForIndex(),
    getCommunitiesForIndex(),
  ])

  const cities = sortCitiesWithPrimaryFirst(allCities)
  const communities = sortResortCommunitiesInPrimaryCities(allCommunities, getPrimaryCityRank)

  const cityItems: RelatedAreaItem[] = cities.map((c) => ({
    name: c.name,
    href: `/cities/${c.slug}`,
    activeCount: c.activeCount,
    imageUrl: c.heroImageUrl,
  }))

  const communityItems: RelatedAreaItem[] = communities.map((c) => ({
    name: c.subdivision,
    href: `/communities/${c.slug}`,
    activeCount: c.activeCount,
    imageUrl: c.heroImageUrl,
  }))

  return (
    <main className="min-h-screen bg-background">
      <MetadataBlock
        schemas={[
          {
            type: 'breadcrumb',
            items: [
              { name: 'Home', url: '/' },
              { name: 'Area guides', url: '/area-guides' },
            ],
          },
          {
            type: 'webPage',
            name: 'Central Oregon area guides',
            description:
              'Explore Central Oregon by city and community — Bend, Redmond, Sisters, Sunriver, and beyond, with market trends and homes for sale in every area.',
            url: '/area-guides',
          },
        ]}
      />
      <ContentPageHero
        title="Discover Central Oregon"
        subtitle="From Bend and Redmond to Sisters, Sunriver, and beyond. Explore neighborhoods, market trends, and homes for sale in every corner of the region we call home."
        imageUrl={CONTENT_HERO_IMAGES.areaGuides}
        ctas={[
          { label: 'View all cities', href: '/cities', primary: true },
          { label: 'Browse communities', href: '/communities', primary: false },
        ]}
      />

      <RelatedAreas
        eyebrow="Explore by city"
        title="Central Oregon cities"
        items={cityItems}
        cols={4}
        tone="default"
        viewAllHref="/cities"
        viewAllLabel="All cities"
      />

      <RelatedAreas
        eyebrow="Resort & master-planned"
        title="Communities"
        items={communityItems}
        cols={4}
        tone="muted"
        viewAllHref="/communities"
        viewAllLabel="All communities"
      />

      <Section padding="default" tone="default" divider>
        <Container className="max-w-2xl text-center">
          <H2>Search on the map</H2>
          <p className="mt-3 text-muted-foreground">
            Use our interactive map to explore listings, schools, and neighborhoods across the region.
          </p>
          <Button asChild size="lg" className="mt-6">
            <Link href="/search">Open map search</Link>
          </Button>
        </Container>
      </Section>
    </main>
  )
}
