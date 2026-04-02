import type { Metadata } from 'next'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import AdUnit from '@/components/AdUnit'
import HomeValuationCta from '@/components/HomeValuationCta'
import ContentPageHero from '@/components/layout/ContentPageHero'
import { CONTENT_HERO_IMAGES } from '@/lib/content-page-hero-images'
import { listingsBrowsePath } from '@/lib/slug'

const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://ryan-realty.com').replace(/\/$/, '')
const ogImage = `${siteUrl}/api/og?type=default`

const resources = [
  {
    title: 'Market reports',
    description: 'City and community trends with pricing, inventory, and pace insights.',
    href: '/housing-market/reports',
  },
  {
    title: 'Housing market hub',
    description: 'Evergreen market pages and regional Central Oregon market context.',
    href: '/housing-market',
  },
  {
    title: 'Area guides',
    description: 'Neighborhood and relocation guides for buyers planning a move.',
    href: '/guides',
  },
  {
    title: 'Property comparison',
    description: 'Compare up to four listings side by side before scheduling tours.',
    href: '/compare',
  },
  {
    title: 'Appreciation calculator',
    description: 'Project potential value growth and equity over time.',
    href: '/tools/appreciation',
  },
  {
    title: 'Live market activity',
    description: 'Follow new listings, pending updates, and closed activity in real time.',
    href: '/activity',
  },
]

export const metadata: Metadata = {
  title: 'Buyer and Seller Resources',
  description: 'Explore guides, market tools, and report resources for Central Oregon real estate decisions.',
  alternates: { canonical: `${siteUrl}/resources` },
  openGraph: {
    title: 'Buyer and Seller Resources | Ryan Realty',
    description: 'Guides, market tools, and report resources for Central Oregon buyers and sellers.',
    url: `${siteUrl}/resources`,
    type: 'website',
    images: [{ url: ogImage, width: 1200, height: 630 }],
  },
  twitter: {
    card: 'summary',
    title: 'Buyer and Seller Resources | Ryan Realty',
    description: 'Guides, market tools, and report resources for Central Oregon buyers and sellers.',
    images: [ogImage],
  },
}

export default function ResourcesPage() {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: 'Buyer and Seller Resources',
    url: `${siteUrl}/resources`,
    description: 'Guides, reports, and planning tools for Central Oregon real estate decisions.',
  }

  return (
    <main className="min-h-screen bg-background">
      <ContentPageHero
        title="Buyer and Seller Resources"
        subtitle="Tools, market data, and guides to help you make confident decisions in Central Oregon real estate."
        imageUrl={CONTENT_HERO_IMAGES.reports}
        ctas={[
          { label: 'View Market Reports', href: '/housing-market/reports', primary: true },
          { label: 'Search Listings', href: listingsBrowsePath(), primary: false },
        ]}
      />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {resources.map((resource) => (
          <Card key={resource.href}>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">{resource.title}</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <p className="text-sm text-muted-foreground">{resource.description}</p>
              <Link href={resource.href} className="mt-3 inline-flex text-sm font-medium text-primary hover:underline">
                Open resource
              </Link>
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="mt-8">
        <AdUnit slot="1001003003" format="horizontal" />
      </div>
      <div className="mt-8">
        <HomeValuationCta />
      </div>
      </div>
    </main>
  )
}
