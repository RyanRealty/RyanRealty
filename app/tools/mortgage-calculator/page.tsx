import type { Metadata } from 'next'
import Link from 'next/link'
import MortgageCalculator from './MortgageCalculator'
import ContentPageHero from '@/components/layout/ContentPageHero'
import { PageBreadcrumb } from '@/components/site/PageBreadcrumb'
import { H2, Body } from '@/components/site/primitives'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://ryan-realty.com').replace(/\/$/, '')
const ogImage = `${siteUrl}/api/og?type=default`

export const metadata: Metadata = {
  title: 'Mortgage Calculator',
  description: 'Estimate your monthly payment. Home price, down payment, interest rate, and loan term.',
  alternates: { canonical: `${siteUrl}/tools/mortgage-calculator` },
  openGraph: {
    title: 'Mortgage Calculator | Ryan Realty',
    description: 'Estimate your monthly payment. Home price, down payment, interest rate, and loan term.',
    url: `${siteUrl}/tools/mortgage-calculator`,
    type: 'website',
    images: [{ url: ogImage, width: 1200, height: 630 }],
  },
  twitter: { card: 'summary_large_image', images: [ogImage] },
}

type Props = {
  searchParams: Promise<{
    price?: string
    down?: string
    rate?: string
    term?: string
  }>
}

const softwareLd = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'Mortgage Calculator',
  applicationCategory: 'FinanceApplication',
  operatingSystem: 'Web',
  url: `${siteUrl}/tools/mortgage-calculator`,
  description:
    'Free mortgage calculator for Central Oregon home buyers. Estimate monthly payment from home price, down payment, interest rate, and loan term.',
  offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
  provider: { '@type': 'RealEstateAgent', name: 'Ryan Realty', url: siteUrl },
}

export default async function MortgageCalculatorPage({ searchParams }: Props) {
  const sp = await searchParams
  const initialPrice = sp.price ? parseInt(sp.price, 10) : undefined
  const initialDown = sp.down != null ? parseInt(sp.down, 10) : undefined
  const initialRate = sp.rate != null ? parseFloat(sp.rate) : undefined
  const initialTerm = sp.term != null ? parseInt(sp.term, 10) : undefined
  return (
    <main className="min-h-screen bg-background">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(softwareLd) }} />
      <PageBreadcrumb trail={[{ label: 'Mortgage calculator' }]} />
      <ContentPageHero
        title="Mortgage Calculator"
        subtitle="Estimate your monthly payment. Adjust home price, down payment, interest rate, and loan term to plan your purchase."
        imageUrl="/images/hero/hero-old-mill-master-4k.jpg"
        ctas={[
          { label: 'Browse Listings', href: '/homes-for-sale', primary: true },
          { label: 'Get a Home Valuation', href: '/sell/valuation', primary: false },
        ]}
      />
      <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 space-y-8">
      <MortgageCalculator
        initialHomePrice={initialPrice}
        initialDownPaymentPct={initialDown}
        initialInterestRate={initialRate}
        initialLoanTermYears={initialTerm}
      />
      <Card>
        <CardContent className="pt-6 space-y-4">
          <H2 as="h2">How to use this calculator</H2>
          <Body>
            Enter the home price and down payment percentage to set the loan amount. Adjust the interest
            rate and loan term to match the scenario you want to model. The property tax field defaults to
            $5,000 per year and the home insurance field defaults to $1,500 per year. Both are editable
            assumptions. PMI applies automatically when the down payment is below 20 percent and is
            calculated at 0.5 percent of the loan amount per year.
          </Body>
          <Body>
            The monthly total is an estimate, not a lender quote. Your actual payment will reflect the
            rate your lender offers, the exact tax assessment on the property, your insurance policy
            premium, and any HOA dues not included here.
          </Body>
          <Body>
            If you want to know what a specific home is worth before running the numbers, start with a
            free home value report.
          </Body>
          <Button asChild variant="outline">
            <Link href="/sell/valuation">Get your home&apos;s actual value</Link>
          </Button>
        </CardContent>
      </Card>
      </div>
    </main>
  )
}
