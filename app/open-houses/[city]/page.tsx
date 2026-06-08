import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import OpenHousesClient from '@/components/open-houses/OpenHousesClient'
import ContentPageHero from '@/components/layout/ContentPageHero'
import { CONTENT_HERO_IMAGES } from '@/lib/content-page-hero-images'
import { getOpenHousesWithListings } from '@/app/actions/open-houses'
import { getCityFromSlug } from '@/app/actions/listings'
import { BreadcrumbNav } from '@/components/site/BreadcrumbNav'
import { Container } from '@/components/site/primitives'

const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://ryan-realty.com').replace(/\/$/, '')
const defaultOgImage = `${siteUrl}/api/og?type=default`

type SearchParams = {
  dateFrom?: string
  dateTo?: string
  community?: string
  minPrice?: string
  maxPrice?: string
  beds?: string
  baths?: string
}

export async function generateMetadata({ params }: { params: Promise<{ city: string }> }): Promise<Metadata> {
  const { city: citySlug } = await params
  const cityName = await getCityFromSlug(citySlug)
  if (!cityName) return { title: 'Open Houses | Ryan Realty' }
  const title = `Open houses in ${cityName}, Oregon | Ryan Realty`
  const description = `Browse open houses this weekend and upcoming in ${cityName}, Oregon.`
  return {
    title,
    description,
    alternates: { canonical: `${siteUrl}/open-houses/${citySlug}` },
    openGraph: {
      title,
      description,
      url: `${siteUrl}/open-houses/${citySlug}`,
      siteName: 'Ryan Realty',
      type: 'website',
      images: [{ url: defaultOgImage, width: 1200, height: 630, alt: title }],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [defaultOgImage],
    },
  }
}

export default async function OpenHousesCityPage({
  params,
  searchParams,
}: {
  params: Promise<{ city: string }>
  searchParams: Promise<SearchParams>
}) {
  const { city: citySlug } = await params
  const cityName = await getCityFromSlug(citySlug)
  if (!cityName) notFound()

  const sp = await searchParams
  const filters = {
    dateFrom: sp.dateFrom?.trim(),
    dateTo: sp.dateTo?.trim(),
    community: sp.community ? sp.community.split(',').map((s) => s.trim()).filter(Boolean) : undefined,
    city: cityName,
    minPrice: sp.minPrice ? Number(sp.minPrice) : undefined,
    maxPrice: sp.maxPrice ? Number(sp.maxPrice) : undefined,
    beds: sp.beds ? Number(sp.beds) : undefined,
    baths: sp.baths ? Number(sp.baths) : undefined,
  }
  const openHouses = await getOpenHousesWithListings(filters)

  return (
    <main className="min-h-screen bg-background">
      <Container className="pt-3 pb-1">
        <BreadcrumbNav
          items={[
            { label: 'Home', href: '/' },
            { label: 'Open houses', href: '/open-houses' },
            { label: cityName },
          ]}
        />
      </Container>
      <ContentPageHero
        title={`Open Houses in ${cityName}`}
        subtitle={`This weekend and upcoming in ${cityName}. Browse list, map, and calendar views.`}
        imageUrl={CONTENT_HERO_IMAGES.openHouses}
        ctas={[
          { label: 'All Open Houses', href: '/open-houses', primary: true },
          { label: 'Homes for Sale', href: '/homes-for-sale', primary: false },
        ]}
      />
      <OpenHousesClient initialOpenHouses={openHouses} initialFilters={filters} />
    </main>
  )
}
