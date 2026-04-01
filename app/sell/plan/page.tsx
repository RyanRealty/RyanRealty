import type { Metadata } from 'next'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import BrokerSocialProofCta from '@/components/broker/BrokerSocialProofCta'

const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://ryan-realty.com').replace(/\/$/, '')
const ogImage = `${siteUrl}/api/og?type=default`

export const metadata: Metadata = {
  title: 'Our Plan | How We Sell Your Home | Ryan Realty',
  description:
    'A clear, proven plan to sell your Central Oregon home: marketing, pricing, and local expertise that maximize your sale.',
  alternates: { canonical: `${siteUrl}/sell/plan` },
  openGraph: {
    title: 'Our Plan | Ryan Realty — Selling Your Home',
    url: `${siteUrl}/sell/plan`,
    type: 'website',
    images: [{ url: ogImage, width: 1200, height: 630 }],
  },
  twitter: { card: 'summary_large_image', images: [ogImage] },
}

const PLAN_STEPS = [
  {
    title: 'Hyper-Local Marketing (Not Just Zillow)',
    body: "Anyone can put a house on the internet. We put your home in front of the right people. We leverage a deep network of local Bend buyers, relocation agents, and premium presentation (drone videography, staging consults) to create emotional urgency. We don't just list it. We launch it.",
  },
  {
    title: 'The Negotiation Shield',
    body: 'FSBO sellers are magnets for bargain hunters and sharks. We act as your buffer. We vet the buyers, verify the funds, and fight for your price. We keep the emotion out of the transaction so you do not make concessions that cost you thousands.',
  },
  {
    title: 'The Net Proceeds Focus',
    body: "Our job is not to take a cut of your money. It is to grow the pie. Selling a home for $700k on your own is worse than selling it for $760k with us. We focus entirely on your bottom line check.",
  },
]

export default function SellPlanPage() {
  return (
    <main className="min-h-screen bg-background">
      <section className="bg-primary px-4 py-16 sm:px-6 sm:py-24">
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-sm font-semibold uppercase tracking-widest text-primary-foreground/80">
            Our Plan
          </p>
          <h1 className="mt-4 text-4xl font-bold tracking-tight text-primary-foreground sm:text-5xl">
            Is Saving the Commission Actually Costing You Your Equity?
          </h1>
          <p className="mt-6 text-lg text-primary-foreground/90">
            Most Bend homeowners try FSBO to maximize profit. But data shows that self-listed homes in
            Central Oregon often sell for 10% to 26% less than agent-listed homes. Do not step over
            dollars to pick up pennies.
          </p>
          <div className="mt-10 flex flex-wrap justify-center gap-4">
            <Button asChild size="lg">
              <Link href="/sell/valuation">Get a Home Valuation</Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href="/contact?inquiry=Selling">Talk to Our Team</Link>
            </Button>
          </div>
        </div>
      </section>

      <section className="border-b border-border bg-card px-4 py-16 sm:px-6 sm:py-20" aria-labelledby="plan-heading">
        <div className="mx-auto max-w-4xl">
          <h2 id="plan-heading" className="text-center text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            We Get It, Why Pay a Fee If You Can Do It Yourself?
          </h2>
          <p className="mx-auto mt-4 max-w-3xl text-center text-muted-foreground">
            It is the right mindset. You want to protect your equity. But in today&apos;s complex market,
            avoiding a commission often results in a lower final sales price. We believe you should make
            decisions based on math, not sales pitches.
          </p>
          <p className="mx-auto mt-3 max-w-3xl text-center text-muted-foreground">
            Before you commit to the solo route, take a look at what the current market data says about
            your true bottom line.
          </p>
          <Separator className="mt-10" />
          <h3 className="mt-10 text-center text-2xl font-semibold text-foreground">
            How We Bridge the Gap And Pay for Ourselves
          </h3>
          <ul className="mt-10 space-y-6">
            {PLAN_STEPS.map((step, i) => (
              <li key={step.title}>
                <Card>
                  <CardHeader>
                    <CardTitle className="text-xl">
                      {i + 1}. {step.title}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-muted-foreground">{step.body}</p>
                  </CardContent>
                </Card>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <BrokerSocialProofCta
        title="Trusted in Bend"
        subtitle="From first-time buyers to seasoned sellers, our clients share how Ryan Realty turned Central Oregon goals into real results."
        primaryCtaHref="/contact?inquiry=Selling"
        primaryCtaLabel="Book a Listing Consultation"
        secondaryCtaHref="/sell"
        secondaryCtaLabel="See Sell With Us"
        ctaContext="sell_plan"
      />
    </main>
  )
}
