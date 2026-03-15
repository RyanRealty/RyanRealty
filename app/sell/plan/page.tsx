import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowRightHugeIcon } from '@/components/icons/HugeIcons'

const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://ryan-realty.com').replace(/\/$/, '')

export const metadata: Metadata = {
  title: 'Our Plan | How We Sell Your Home | Ryan Realty',
  description:
    'A clear, proven plan to sell your Central Oregon home: marketing, pricing, and local expertise that maximize your sale.',
  alternates: { canonical: `${siteUrl}/sell/plan` },
  openGraph: {
    title: 'Our Plan | Ryan Realty — Selling Your Home',
    url: `${siteUrl}/sell/plan`,
    type: 'website',
  },
}

const PLAN_STEPS = [
  {
    title: 'Consultation & pricing',
    body: 'We review your home, recent sales, and market trends to recommend a listing price and strategy. You get a clear range and the reasoning behind it—no guesswork.',
  },
  {
    title: 'Marketing & presentation',
    body: 'Professional photography, listing copy, and placement across the major sites. We showcase your property so serious buyers find you fast.',
  },
  {
    title: 'Showings & offers',
    body: 'We coordinate showings, manage feedback, and help you evaluate offers. Our goal: a strong offer and a smooth path to closing.',
  },
  {
    title: 'Closing',
    body: 'We stay on top of inspections, appraisals, and paperwork so you can focus on your next chapter. Clear communication every step of the way.',
  },
]

export default function SellPlanPage() {
  return (
    <main className="min-h-screen bg-background">
      <section className="bg-primary px-4 py-16 sm:px-6 sm:py-24">
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-sm font-semibold uppercase tracking-widest text-accent-foreground">
            Our Plan
          </p>
          <h1 className="mt-4 text-4xl font-bold tracking-tight text-primary-foreground sm:text-5xl">
            How We Sell Your Home
          </h1>
          <p className="mt-6 text-lg text-muted/90">
            A clear, proven process—from listing to closing—designed to maximize your home&apos;s
            value and minimize stress. Central Oregon is our backyard; we know how to market it.
          </p>
          <div className="mt-10 flex flex-wrap justify-center gap-4">
            <Link
              href="/sell/valuation"
              className="inline-flex items-center gap-2 rounded-lg bg-accent px-6 py-3.5 text-base font-semibold text-primary shadow-md hover:bg-accent/90"
            >
              Get a home valuation
              <ArrowRightHugeIcon className="h-5 w-5" />
            </Link>
            <Link
              href="/contact?inquiry=Selling"
              className="inline-flex items-center gap-2 rounded-lg border-2 border-primary-foreground/40 bg-card/10 px-6 py-3.5 text-base font-semibold text-primary-foreground backdrop-blur-sm hover:bg-card/20"
            >
              Talk to our team
            </Link>
          </div>
        </div>
      </section>

      <section className="border-b border-border bg-card px-4 py-16 sm:px-6 sm:py-20" aria-labelledby="plan-heading">
        <div className="mx-auto max-w-4xl">
          <h2 id="plan-heading" className="text-center text-3xl font-bold tracking-tight text-primary sm:text-4xl">
            The Ryan Realty Plan
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-center text-muted-foreground">
            Every listing gets the same attention: data-driven pricing, strong marketing, and
            local expertise from day one to closing.
          </p>
          <ul className="mt-14 space-y-12">
            {PLAN_STEPS.map((step, i) => (
              <li key={step.title} className="flex gap-6">
                <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-primary text-2xl font-bold text-accent-foreground">
                  {i + 1}
                </span>
                <div className="rounded-lg border border-border bg-muted p-6 shadow-sm">
                  <h3 className="text-xl font-semibold text-primary">{step.title}</h3>
                  <p className="mt-3 text-muted-foreground">{step.body}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="bg-muted px-4 py-16 sm:px-6 sm:py-20" aria-labelledby="why-heading">
        <div className="mx-auto max-w-4xl text-center">
          <h2 id="why-heading" className="text-3xl font-bold text-primary sm:text-4xl">
            Why list with us?
          </h2>
          <p className="mt-4 text-muted-foreground">
            We combine <strong>data-driven pricing</strong>, <strong>professional marketing</strong>,
            and <strong>local expertise</strong> so your home stands out in Central Oregon&apos;s
            market. No cookie-cutter approach—we tailor the plan to your property and timeline.
          </p>
          <div className="mt-10 flex flex-wrap justify-center gap-4">
            <Link
              href="/sell"
              className="rounded-lg bg-primary px-6 py-3 font-semibold text-primary-foreground hover:bg-accent/90"
            >
              Sell With Us
            </Link>
            <Link
              href="/our-homes"
              className="rounded-lg border-2 border-primary px-6 py-3 font-semibold text-primary hover:bg-primary hover:text-primary-foreground"
            >
              Our Homes
            </Link>
          </div>
        </div>
      </section>
    </main>
  )
}
