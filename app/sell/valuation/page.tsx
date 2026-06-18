/**
 * Home valuation page (/sell/valuation) — KB (kinetic-brutalist) design,
 * Phase 9 of the KB convergence program (docs/KB_CONVERGENCE_ROADMAP.md).
 * Restyled in place: the live ValuationForm (server action + FUB lead write +
 * SMS consent disclosure), every value-step card, the "Ready to sell?" CTA,
 * the breadcrumb, and the metadata are all preserved. KB shell (KbNav +
 * KbFooter) carries the chrome; the form + content sit inside .kb-root.
 *
 * Section stack: KbNav · MetadataBlock (Breadcrumb JSON-LD) · KbBreadcrumb ·
 *   KbHero · address-form section (ValuationForm) · "How we value your home"
 *   value-step section · "Ready to sell?" CTA · KbFooter.
 *
 * The ValuationForm owns the lead path and the carrier-vetted SMS consent
 * surface (A2P consent lock) — its markup and logic are untouched.
 */

import type { Metadata } from 'next'
import Link from 'next/link'
import ValuationForm from '@/app/home-valuation/ValuationForm'
import { MetadataBlock } from '@/components/site/MetadataBlock'
import { H2, H3 } from '@/components/site/primitives'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { SmoothScrollProvider } from '@/components/site/kb/SmoothScrollProvider.client'
import { KbNav } from '@/components/site/kb/KbNav.client'
import { KbBreadcrumb } from '@/components/site/kb/KbBreadcrumb'
import { KbHero } from '@/components/site/kb/KbHero.client'
import { KbFooter } from '@/components/site/kb/KbFooter.client'
import { KbSectionTracker } from '@/components/site/kb/KbSectionTracker.client'
import '@/components/site/kb/kb.css'

const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://ryan-realty.com').replace(/\/$/, '')
const VALUATION_HERO = '/images/hero/hero-old-mill-master-4k.jpg'

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
    <main className="kb-root">
      <KbNav />
      <KbSectionTracker pageType="sell-valuation" />
      <MetadataBlock
        schema={{
          type: 'breadcrumb',
          items: [
            { name: 'Home', url: '/' },
            { name: 'Sell', url: '/sell' },
            { name: "What's your home worth", url: '/sell/valuation' },
          ],
        }}
      />
      <KbBreadcrumb
        overlay
        trail={[
          { label: 'Home', href: '/' },
          { label: 'Sell', href: '/sell' },
          { label: "What's your home worth" },
        ]}
      />

      <SmoothScrollProvider>
        <KbHero
          data={{ activeCount: null, medianListPrice: null, medianDaysToPending: null }}
          eyebrow="Free home valuation"
          titleTop="What's your"
          titleBottom="home worth?"
          lead="A custom valuation built from recent comparable sales and current market trends in your neighborhood, with the comps behind the number."
          videoSrc={null}
          posterSrc={VALUATION_HERO}
        />

        {/* Address-capture form — owns the FUB lead write + carrier-vetted SMS
            consent disclosure. Markup + logic untouched; only the surrounding
            section is restyled into the KB cream surface. */}
        <section
          id="valuation-form"
          className="section border-b border-border bg-card px-4 py-12 sm:px-6 sm:py-16"
          aria-labelledby="form-heading"
        >
          <div className="wrap mx-auto max-w-xl">
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

        <section
          id="how-we-value"
          className="section border-b border-border bg-card px-4 py-16 sm:px-6 sm:py-20"
          aria-labelledby="how-heading"
        >
          <div className="wrap mx-auto max-w-4xl">
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
                    <H3 className="text-lg font-semibold text-primary">{item.title}</H3>
                    <p className="mt-2 text-sm text-muted-foreground">{item.body}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        <section
          id="ready-to-sell"
          className="section bg-muted px-4 py-16 sm:px-6 sm:py-20"
          aria-labelledby="cta-heading"
        >
          <div className="wrap mx-auto max-w-2xl text-center">
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

        <KbFooter towns={[]} />
      </SmoothScrollProvider>
    </main>
  )
}
