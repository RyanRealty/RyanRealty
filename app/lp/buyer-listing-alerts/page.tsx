import type { Metadata } from 'next'
import BuyerLPForm from './BuyerLPForm'

export const metadata: Metadata = {
  title: 'Find Your Bend Home — Personalized Listing Alerts | Ryan Realty',
  description:
    'Get matched listings in your inbox within 30 minutes. Real local brokers, not an algorithm. No spam, no pressure.',
  robots: { index: false, follow: false },
  openGraph: {
    title: 'Find Your Bend Home — Personalized Listing Alerts',
    description: 'Get matched listings in your inbox within 30 minutes.',
    type: 'website',
  },
}

const BROKER_PHONE = '(541) 703-3095'
const BROKER_PHONE_TEL = '+15417033095'

export default function BuyerLPPage() {
  return (
    <main className="min-h-screen bg-background">
      <section className="mx-auto max-w-3xl px-4 py-10 sm:py-16">
        <div className="text-center">
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Find your Bend home — first matches in 30 minutes.
          </h1>
          <p className="mt-4 text-lg text-muted-foreground">
            Tell us what you're looking for. A real Ryan Realty broker pulls listings
            that match — within 30 minutes, not the next business day.
          </p>
        </div>

        <div className="mt-8 rounded-2xl border border-border bg-card p-6 shadow-sm sm:p-8">
          <BuyerLPForm />
        </div>

        <div className="mt-8 text-center text-sm text-muted-foreground">
          <p>Talk to a broker now:{' '}
            <a href={`tel:${BROKER_PHONE_TEL}`} className="font-medium text-primary underline">
              {BROKER_PHONE}
            </a>
          </p>
          <p className="mt-2">
            No spam. No pressure. Unsubscribe anytime — that's a tag in our system that
            stops every email immediately.
          </p>
        </div>
      </section>
    </main>
  )
}
