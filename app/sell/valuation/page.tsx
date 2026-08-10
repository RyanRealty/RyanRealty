/**
 * Home valuation page (/sell/valuation) — KB design, conversion-first craft (E5).
 *
 * B3 path (locked):
 *   - Hero primary CTA → #valuation-form (Lenis hash scroll via SmoothScrollProvider)
 *   - Form section id="valuation-form" with scroll-mt-24
 *   - ValuationForm owns FUB lead write + carrier-vetted SMS consent (untouched)
 *
 * Craft bar: form visible without hunting, proof-of-method steps after the ask,
 * clear path to /sell listing plan, mobile sticky re-ask, pageMetadata shell.
 *
 * Brand lock: navy/cream, no invented stats, Layer B body only (no poetry H1).
 */

import type { Metadata } from 'next'
import Link from 'next/link'
import ValuationForm from '@/app/home-valuation/ValuationForm'
import { pageMetadata } from '@/lib/site/page-metadata'
import { MetadataBlock } from '@/components/site/MetadataBlock'
import { H2, H3, Eyebrow, Body, CTAButton } from '@/components/site/primitives'
import { Card, CardContent } from '@/components/ui/card'
import { CONTACT } from '@/lib/brand/contact'
import { SmoothScrollProvider } from '@/components/site/kb/SmoothScrollProvider.client'
import { KbBreadcrumb } from '@/components/site/kb/KbBreadcrumb'
import { KbHero } from '@/components/site/kb/KbHero.client'
import { KbFooter } from '@/components/site/kb/KbFooter.client'
import { KbSectionTracker } from '@/components/site/kb/KbSectionTracker.client'
import '@/components/site/kb/kb.css'

const ROUTE_PATH = '/sell/valuation'
const FORM_ANCHOR = '#valuation-form'
const VALUATION_HERO = '/images/homepage/tetherow-golf-aerial.jpg'

export async function generateMetadata(): Promise<Metadata> {
  return pageMetadata({
    title: 'Home Valuation in Central Oregon',
    description:
      'A written comparative market analysis for your Central Oregon home. Three closed comps, three active comps, and the list-price range those six support. Free, no listing agreement.',
    path: ROUTE_PATH,
    ogImage: VALUATION_HERO,
    keywords: [
      'home valuation Bend Oregon',
      'Central Oregon CMA',
      'what is my home worth Bend',
      'Ryan Realty valuation',
    ],
  })
}

const VALUE_STEPS = [
  {
    n: '01',
    title: 'Local comps',
    body: 'Recent closed sales in your neighborhood and similar subdivisions set the floor and the ceiling.',
  },
  {
    n: '02',
    title: 'Active competition',
    body: 'Days on market, sale-to-list ratios, and what is for sale near you now shape the list-price range.',
  },
  {
    n: '03',
    title: 'Your home',
    body: 'Square footage, beds and baths, lot size, condition, and upgrades adjust the range for your property.',
  },
] as const

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
            { name: "What's your home worth", url: ROUTE_PATH },
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
          cta={{ href: FORM_ANCHOR, label: 'Get the written valuation' }}
          ctaSecondary={{ href: `tel:${CONTACT.phoneDirectTel}`, label: `Call ${CONTACT.phoneDirect}` }}
          videoSrc={null}
          posterSrc={VALUATION_HERO}
        />

        {/* Form first after hero — dominant cream band, tight max width, clear H2. */}
        <section
          id="valuation-form"
          className="section scroll-mt-24 border-b border-border bg-card px-4 py-12 sm:px-6 sm:py-16"
          aria-labelledby="form-heading"
        >
          <div className="wrap mx-auto max-w-xl">
            <Eyebrow>Free · no contract</Eyebrow>
            <H2 id="form-heading" className="mt-2 text-2xl text-primary sm:text-3xl">
              Enter your address
            </H2>
            <Body size="default" tone="muted" className="mt-3 leading-relaxed">
              We look up your property and send a comparative market analysis. If the home is not yet in our system, a broker still follows up with an estimate.
            </Body>
            <Card className="mt-8">
              <CardContent className="p-5 sm:p-6">
                <ValuationForm />
              </CardContent>
            </Card>
            <p className="mt-4 text-sm text-muted-foreground">
              Prefer the full listing plan first?{' '}
              <Link
                href="/sell#get-value"
                className="font-semibold text-primary underline underline-offset-2"
              >
                Sell with Ryan Realty
              </Link>
              .
            </p>
          </div>
        </section>

        {/* Method steps — numbered strip, not three equal floating cards. */}
        <section
          id="how-we-value"
          className="section border-b border-border bg-muted px-4 py-14 sm:px-6 sm:py-16"
          aria-labelledby="how-heading"
        >
          <div className="wrap mx-auto max-w-4xl">
            <div className="mx-auto max-w-2xl text-center">
              <Eyebrow>How the number is built</Eyebrow>
              <H2 id="how-heading" className="mt-2 text-3xl text-primary sm:text-4xl">
                What goes into the number
              </H2>
              <Body size="default" tone="muted" className="mx-auto mt-4 max-w-xl leading-relaxed">
                Closed sales of similar homes nearby, what is for sale now, and adjustments for your home&apos;s size, condition, and upgrades.
              </Body>
            </div>
            <ol className="mt-12 grid list-none gap-0 border border-border sm:grid-cols-3">
              {VALUE_STEPS.map((item, i) => (
                <li
                  key={item.title}
                  className={`bg-card p-6 sm:p-7 ${
                    i < VALUE_STEPS.length - 1 ? 'border-b border-border sm:border-b-0 sm:border-r' : ''
                  }`}
                >
                  <span className="font-display text-3xl tabular-nums text-primary">{item.n}</span>
                  <H3 className="mt-3 text-lg font-semibold text-primary">{item.title}</H3>
                  <Body size="default" tone="muted" className="mt-2 text-sm leading-relaxed">
                    {item.body}
                  </Body>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* Navy close — list path after valuation */}
        <section
          id="ready-to-sell"
          className="section bg-primary px-4 py-14 text-primary-foreground sm:px-6 sm:py-16"
          aria-labelledby="cta-heading"
        >
          <div className="wrap mx-auto max-w-2xl text-center">
            <Eyebrow className="text-primary-foreground/70">Next step</Eyebrow>
            <H2 id="cta-heading" className="mt-2 text-2xl text-primary-foreground sm:text-3xl">
              If you decide to list
            </H2>
            <Body size="default" tone="on-photo" className="mt-4 leading-relaxed">
              The listing fee is 2.5% to 3.5% of the sale price. Photos in 48 hours, on the MLS in 5 to 7 business days, and a written report every week.
            </Body>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <CTAButton href="/sell" tone={'on-navy'} size="lg">
                See the listing plan
              </CTAButton>
              <CTAButton href="/contact?inquiry=Selling" tone={'on-navy-ghost'} size="lg">
                Talk to a broker
              </CTAButton>
            </div>
          </div>
        </section>

        <KbFooter towns={[]} />
      </SmoothScrollProvider>

      {/* Sticky mobile re-ask → form */}
      <div
        className="fixed inset-x-0 bottom-0 z-50 border-t-2 px-3 py-3 sm:hidden"
        style={{
          background: 'var(--cream)',
          borderColor: 'var(--navy)',
        }}
      >
        <a
          href={FORM_ANCHOR}
          className="flex min-h-12 w-full items-center justify-center px-4 py-3 text-center text-sm font-bold uppercase tracking-widest"
          style={{ background: 'var(--navy)', color: 'var(--cream)' }}
        >
          Get the valuation
        </a>
      </div>
    </main>
  )
}
