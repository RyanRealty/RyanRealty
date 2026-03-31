import type { Metadata } from 'next'
import AppreciationCalculator from '@/components/tools/AppreciationCalculator'
import AdUnit from '@/components/AdUnit'
import HomeValuationCta from '@/components/HomeValuationCta'
import ContentPageHero from '@/components/layout/ContentPageHero'

const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://ryan-realty.com').replace(/\/$/, '')

export const metadata: Metadata = {
  title: 'Home Appreciation Calculator',
  description: 'Estimate your future home value with a simple appreciation calculator built for Central Oregon homeowners.',
  alternates: { canonical: `${siteUrl}/tools/appreciation` },
  openGraph: {
    title: 'Home Appreciation Calculator | Ryan Realty',
    description: 'Project home value growth and compare potential appreciation scenarios.',
    url: `${siteUrl}/tools/appreciation`,
    type: 'website',
  },
  twitter: {
    card: 'summary',
    title: 'Home Appreciation Calculator | Ryan Realty',
    description: 'Project home value growth and compare appreciation scenarios.',
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
      <ContentPageHero
        title="Home Appreciation Calculator"
        subtitle="Model different annual appreciation rates to understand long-term equity growth and plan your investment."
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
        <AdUnit slot="1001003001" format="horizontal" />
      </div>
      <div className="mt-8">
        <HomeValuationCta />
      </div>
      </div>
    </main>
  )
}
