import type { Metadata } from 'next'
import Link from 'next/link'
import AppreciationCalculator from '@/components/tools/AppreciationCalculator'
import AdUnit from '@/components/AdUnit'
import HomeValuationCta from '@/components/HomeValuationCta'
import ContentPageHero from '@/components/layout/ContentPageHero'
import { BreadcrumbNav } from '@/components/site/BreadcrumbNav'
import { Container, H2, Body } from '@/components/site/primitives'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://ryan-realty.com').replace(/\/$/, '')
const ogImage = `${siteUrl}/api/og?type=default`

export const metadata: Metadata = {
  title: 'Home Appreciation Calculator',
  description: 'Estimate your future home value with a simple appreciation calculator built for Central Oregon homeowners.',
  alternates: { canonical: `${siteUrl}/tools/appreciation` },
  openGraph: {
    title: 'Home Appreciation Calculator | Ryan Realty',
    description: 'Project home value growth and compare potential appreciation scenarios.',
    url: `${siteUrl}/tools/appreciation`,
    type: 'website',
    images: [{ url: ogImage, width: 1200, height: 630 }],
  },
  twitter: {
    card: 'summary',
    title: 'Home Appreciation Calculator | Ryan Realty',
    description: 'Project home value growth and compare appreciation scenarios.',
    images: [ogImage],
  },
}

export default function AppreciationToolPage() {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    name: 'Home Appreciation Calculator',
    url: `${siteUrl}/tools/appreciation`,
    applicationCategory: 'FinanceApplication',
    description: 'Estimate future home value with appreciation scenarios.',
  }

  return (
    <main className="min-h-screen bg-background">
      <Container className="pt-3 pb-1">
        <BreadcrumbNav items={[{ label: 'Home', href: '/' }, { label: 'Home appreciation calculator' }]} />
      </Container>
      <ContentPageHero
        title="Home Appreciation Calculator"
        subtitle="Model different annual appreciation rates to understand long-term equity growth and plan your investment."
        imageUrl="/images/hero/hero-old-mill-master-4k.jpg"
        ctas={[
          { label: 'Browse Listings', href: '/homes-for-sale', primary: true },
          { label: 'Mortgage Calculator', href: '/tools/mortgage-calculator', primary: false },
        ]}
      />
      <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <div className="mt-8">
        <AppreciationCalculator />
      </div>
      <div className="mt-8">
        <Card>
          <CardContent className="pt-6 space-y-4">
            <H2 as="h2">How to use this calculator</H2>
            <Body>
              Enter the current value of the home in the purchase price field. Set an annual appreciation
              rate to model different growth scenarios, then adjust the years held to see the projected
              future value and total gain over time.
            </Body>
            <Body>
              The result is a mathematical projection based on a fixed annual rate. It is not an appraisal
              and it is not a Comparative Market Analysis. Actual home values depend on market conditions,
              property condition, location, and buyer demand, none of which a fixed-rate formula captures.
            </Body>
            <Body>
              For an address-specific valuation based on real sales data, request a free home value report.
            </Body>
            <Button asChild variant="outline">
              <Link href="/sell/valuation">Get your home&apos;s actual value</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
      <div className="mt-8">
        <AdUnit slot="1001003001" format="horizontal" />
      </div>
      <div className="mt-8">
        <HomeValuationCta />
      </div>
      </div>
    </main>
  )
}
