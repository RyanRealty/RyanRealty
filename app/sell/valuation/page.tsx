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
import { KbBreadcrumb } from '@/components/site/kb/KbBreadcrumb'
import { KbHero } from '@/components/site/kb/KbHero.client'
import { KbFooter } from '@/components/site/kb/KbFooter.client'
import { KbSectionTracker } from '@/components/site/kb/KbSectionTracker.client'
import '@/components/site/kb/kb.css'

const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://ryan-realty.com').replace(/\/$/, '')
const VALUATION_HERO = '/images/homepage/tetherow-golf-aerial.jpg'

export const metadata: Metadata = {
  title: 'Home valuation · Ryan Realty, Central Oregon',
  description:
    'A written comparative market analysis for your Central Oregon home. Three closed comps, three active comps, and the list-price range those six support. Free, no listing agreement.',
  alternates: { canonical: `${siteUrl}/sell/valuation` },
  openGraph: {
    title: 'Home valuation · Ryan Realty',
    url: `${siteUrl}/sell/valuation`,
    type: 'website',
    images: [{ url: `${siteUrl}/api/og?type=default`, width: 1200, height: 630, alt: 'Home valuation · Ryan Realty' }],
  },
  twitter: {
    card: 'summary_large_image',
    images: [`${siteUrl}/api/og?type=default`],
  },
}

const VALUE_STEPS = [
  { title: 'Local comps', body: 'Recent closed sales in your neighborhood and similar subdivisions set the floor and the ceiling.' },
  { title: 'Active competition', body: 'Days on market, sale-to-list ratios, and what is for sale near you now shape the list-price range.' },
  { title: 'Your home', body: 'Square footage, beds and baths, lot size, condition, and upgrades adjust the range for your property.' },
]

export default function SellValuationPage() {
  return (
    <main className="kb-root">
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
          eyebrow="Written valuation · no listing agreement"
          titleTop="Your address,"
          titleBottom="the comps behind it."
          lead="We send a comparative market analysis built from closed sales near you and the homes yours would compete against. It costs nothing. It is not a listing agreement."
          showSearch={false}
          // B3: hero primary scrolls to the form section (not a second page).
          // Form element also keeps id=home_valuation for legacy anchors.
          cta={{ href: '#valuation-form', label: 'Get the written valuation' }}
          ctaSecondary={null}
          videoSrc={null}
          posterSrc={VALUATION_HERO}
        />

        {/* Address-capture form — owns the FUB lead write + carrier-vetted SMS
            consent disclosure. Markup + logic untouched; only the surrounding
            section is restyled into the KB cream surface. */}
        <section
          id="valuation-form"
          className="section scroll-mt-24 border-b border-border bg-card px-4 py-12 sm:px-6 sm:py-16"
          aria-labelledby="form-heading"
        >
          <div className="wrap mx-auto max-w-xl">
            <H2 id="form-heading" className="text-2xl text-primary sm:text-3xl">
              Enter your address
            </H2>
            <p className="mt-2 text-muted-foreground">
              We look up your property and send a comparative market analysis. If the home is not yet in our system, a broker still follows up with an estimate.
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
              What goes into the number
            </H2>
            <p className="mx-auto mt-4 max-w-2xl text-center text-muted-foreground">
              Closed sales of similar homes nearby, what is for sale now, and adjustments for your home&apos;s size, condition, and upgrades.
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
              If you decide to list
            </H2>
            <p className="mt-4 text-muted-foreground">
              The listing fee is 2.5% to 3.5% of the sale price. Photos in 48 hours, on the MLS in 5 to 7 business days, and a written report every week.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-4">
              <Button asChild size="lg">
                <Link href="/sell">See the listing plan</Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link href="/contact?inquiry=Selling">Talk to a broker</Link>
              </Button>
            </div>
          </div>
        </section>

        <KbFooter towns={[]} />
      </SmoothScrollProvider>
    </main>
  )
}
