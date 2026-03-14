import type { Metadata } from 'next'
import Link from 'next/link'
import ContentPageHero from '@/components/layout/ContentPageHero'
import { CONTENT_HERO_IMAGES } from '@/lib/content-page-hero-images'
import ValuationForm from './ValuationForm'

const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://ryan-realty.com').replace(/\/$/, '')

export const metadata: Metadata = {
  title: 'Free Home Valuation | What\'s My Home Worth? | Ryan Realty',
  description:
    'Get a free, data-driven home value estimate for your Central Oregon property. No obligation. We\'ll send you a Comparative Market Analysis and follow up to answer questions.',
  alternates: { canonical: `${siteUrl}/home-valuation` },
  openGraph: {
    title: 'Free Home Valuation | Ryan Realty',
    description: 'Get a free home value estimate. We use local comps and market data to give you a clear picture of your home\'s worth.',
    url: `${siteUrl}/home-valuation`,
    type: 'website',
  },
}

const heroImage = CONTENT_HERO_IMAGES.sell

export default function HomeValuationPage() {
  return (
    <main className="min-h-screen bg-background">
      <ContentPageHero
        title="What's your home worth?"
        subtitle="Get a free, no-obligation valuation. We'll use recent sales and market data to give you a clear estimate—and send you a CMA you can keep."
        imageUrl={heroImage}
      />

      <section className="border-b border-border bg-card px-4 py-12 sm:px-6 sm:py-16" aria-labelledby="form-heading">
        <div className="mx-auto max-w-xl">
          <h2 id="form-heading" className="text-2xl font-bold text-primary sm:text-3xl">
            Enter your address
          </h2>
          <p className="mt-2 text-muted-foreground">
            We&apos;ll look up your property and send you a Comparative Market Analysis. If your home isn&apos;t in our system yet, we&apos;ll still reach out with an estimate.
          </p>
          <div className="mt-8">
            <ValuationForm />
          </div>
        </div>
      </section>

      <section className="bg-card px-4 py-12 sm:px-6 sm:py-16" aria-labelledby="how-heading">
        <div className="mx-auto max-w-4xl">
          <h2 id="how-heading" className="text-center text-2xl font-bold text-primary sm:text-3xl">
            How we value your home
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-center text-muted-foreground">
            Our valuations are based on recent sales of similar homes in your area, current list-to-sale ratios, and your property&apos;s features.
          </p>
          <ul className="mt-10 grid gap-6 sm:grid-cols-3">
            {[
              { title: 'Local comps', body: 'We pull closed sales in your neighborhood and similar areas to establish a value range.' },
              { title: 'Market trends', body: 'Days on market and inventory in Central Oregon inform our estimate.' },
              { title: 'Your details', body: 'Square footage, beds, baths, lot size, and condition are factored in when we have the data.' },
            ].map((item) => (
              <li key={item.title} className="rounded-lg border border-border bg-muted p-5">
                <h3 className="font-semibold text-primary">{item.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{item.body}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="bg-primary px-4 py-12 sm:px-6 sm:py-16">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-xl font-bold text-white sm:text-2xl">
            Ready to sell?
          </h2>
          <p className="mt-2 text-muted/90">
            See our selling plan and how we market homes across Bend, Redmond, Sisters, and Central Oregon.
          </p>
          <Link
            href="/sell"
            className="mt-6 inline-flex rounded-lg bg-accent px-6 py-3 text-base font-semibold text-primary hover:bg-accent/90"
          >
            Our selling plan
          </Link>
        </div>
      </section>
    </main>
  )
}
