import type { Metadata } from 'next'
import Link from 'next/link'
import ValuationForm from '@/app/home-valuation/ValuationForm'
import ContentPageHero from '@/components/layout/ContentPageHero'
import { BreadcrumbNav } from '@/components/site/BreadcrumbNav'
import { Container, H2 } from '@/components/site/primitives'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://ryan-realty.com').replace(/\/$/, '')

export const metadata: Metadata = {
  title: 'Home Valuation | Free Estimate | Ryan Realty',
  description:
    'Get a data-driven estimate of your Central Oregon home\'s value. Free, no obligation. See what your home could be worth in today\'s market.',
  alternates: { canonical: `${siteUrl}/sell/valuation` },
  openGraph: {
    title: 'Home Valuation | Ryan Realty',
    url: `${siteUrl}/sell/valuation`,
    type: 'website',
    images: [{ url: `${siteUrl}/api/og?type=default`, width: 1200, height: 630, alt: 'Home Valuation | Ryan Realty' }],
  },
  twitter: {
    card: 'summary_large_image',
    images: [`${siteUrl}/api/og?type=default`],
  },
}

const VALUE_STEPS = [
  { title: 'Local comps', body: 'We pull recent sales in your neighborhood and similar subdivisions to establish a baseline.' },
  { title: 'Market trends', body: 'Days on market, list-to-sale ratios, and inventory in your area inform our range.' },
  { title: 'Your property', body: 'Square footage, beds and baths, lot size, condition, and upgrades are factored into the estimate.' },
]

export default function SellValuationPage() {
  return (
    <main className="min-h-screen bg-background">
      <Container className="pt-3 pb-1">
        <BreadcrumbNav items={[{ label: 'Home', href: '/' }, { label: 'Sell', href: '/sell' }, { label: "What's your home worth" }]} />
      </Container>

      <ContentPageHero
        title="What's your home worth?"
        subtitle="Get a custom valuation from Bend's trusted experts. We use local comps and market trends to give you a clear picture of your home's value, and how to maximize it."
        imageUrl="/images/hero/hero-old-mill-master-4k.jpg"
      />

      <section className="border-b border-border bg-card px-4 py-12 sm:px-6 sm:py-16" aria-labelledby="form-heading">
        <div className="mx-auto max-w-xl">
          <H2 id="form-heading" className="text-2xl text-primary sm:text-3xl">
            Enter your address
          </H2>
          <p className="mt-2 text-muted-foreground">
            We&apos;ll look up your property and send you a Comparative Market Analysis. If your home isn&apos;t in our system yet, we&apos;ll still reach out with an estimate.
          </p>
          <div className="mt-8">
            <ValuationForm />
          </div>
        </div>
      </section>

      <section className="border-b border-border bg-card px-4 py-16 sm:px-6 sm:py-20" aria-labelledby="how-heading">
        <div className="mx-auto max-w-4xl">
          <H2 id="how-heading" className="text-center text-3xl text-primary sm:text-4xl">
            How we value your home
          </H2>
          <p className="mx-auto mt-4 max-w-2xl text-center text-muted-foreground">
            Our estimates are based on recent sales of similar homes in your area, current market
            conditions, and adjustments for your property&apos;s features and condition.
          </p>
          <div className="mt-12 grid gap-8 sm:grid-cols-3">
            {VALUE_STEPS.map((item) => (
              <Card key={item.title} className="text-center">
                <CardContent className="p-6">
                  <h3 className="text-lg font-semibold text-primary">{item.title}</h3>
                  <p className="mt-2 text-sm text-muted-foreground">{item.body}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-muted px-4 py-16 sm:px-6 sm:py-20" aria-labelledby="cta-heading">
        <div className="mx-auto max-w-2xl text-center">
          <H2 id="cta-heading" className="text-2xl text-primary sm:text-3xl">
            Ready to sell?
          </H2>
          <p className="mt-4 text-muted-foreground">
            See our selling plan and how we market homes across Bend, Redmond, Sisters, and Central Oregon.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-4">
            <Button asChild size="lg">
              <Link href="/sell">Our selling plan</Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href="/contact?inquiry=Selling">Contact us to sell</Link>
            </Button>
          </div>
        </div>
      </section>
    </main>
  )
}
