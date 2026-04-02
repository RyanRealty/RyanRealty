import type { Metadata } from 'next'
import Link from 'next/link'
import ValuationForm from '@/app/home-valuation/ValuationForm'

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

export default function SellValuationPage() {
  return (
    <main className="min-h-screen bg-background">
      <section className="bg-primary px-4 py-16 sm:px-6 sm:py-24">
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-sm font-semibold uppercase tracking-widest text-accent-foreground">
            Home Valuation
          </p>
          <h1 className="mt-4 text-4xl font-bold tracking-tight text-primary-foreground sm:text-5xl">
            What&apos;s Your Home Worth?
          </h1>
          <p className="mt-6 text-lg text-muted/90">
            Get a custom valuation from Bend&apos;s trusted experts. We use local comps and market
            trends to give you a clear picture of your home&apos;s value—and how to maximize it.
          </p>
        </div>
      </section>

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

      <section className="border-b border-border bg-card px-4 py-16 sm:px-6 sm:py-20" aria-labelledby="how-heading">
        <div className="mx-auto max-w-4xl">
          <h2 id="how-heading" className="text-center text-3xl font-bold text-primary sm:text-4xl">
            How We Value Your Home
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-center text-muted-foreground">
            Our estimates are based on recent sales of similar homes in your area, current market
            conditions, and adjustments for your property&apos;s features and condition.
          </p>
          <div className="mt-12 grid gap-8 sm:grid-cols-3">
            {[
              {
                title: 'Local comps',
                body: 'We pull recent sales in your neighborhood and similar subdivisions to establish a baseline.',
              },
              {
                title: 'Market trends',
                body: 'Days on market, list-to-sale ratios, and inventory in your area inform our range.',
              },
              {
                title: 'Your property',
                body: 'Square footage, beds/baths, lot size, condition, and upgrades are factored into the estimate.',
              },
            ].map((item) => (
              <div
                key={item.title}
                className="rounded-xl border border-border bg-muted p-6 text-center shadow-sm"
              >
                <h3 className="text-lg font-semibold text-primary">{item.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{item.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-muted px-4 py-16 sm:px-6 sm:py-20" aria-labelledby="cta-heading">
        <div className="mx-auto max-w-2xl text-center">
          <h2 id="cta-heading" className="text-2xl font-bold text-primary sm:text-3xl">
            Ready to sell?
          </h2>
          <p className="mt-4 text-muted-foreground">
            See our selling plan and how we market homes across Bend, Redmond, Sisters, and Central Oregon.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-4">
            <Link
              href="/sell"
              className="rounded-lg bg-primary px-6 py-3 font-semibold text-primary-foreground hover:bg-accent/90"
            >
              Our selling plan
            </Link>
            <Link
              href="/contact?inquiry=Selling"
              className="rounded-lg border-2 border-primary px-6 py-3 font-semibold text-primary hover:bg-primary hover:text-primary-foreground"
            >
              Contact us to sell
            </Link>
          </div>
        </div>
      </section>
    </main>
  )
}
