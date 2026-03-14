import type { Metadata } from 'next'
import Link from 'next/link'
import { ExternalLinkHugeIcon } from '@/components/icons/HugeIcons'

const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://ryan-realty.com').replace(/\/$/, '')

export const metadata: Metadata = {
  title: 'Client Reviews | Ryan Realty | Ryan Realty',
  description:
    'See what buyers and sellers say about working with Ryan Realty. Real testimonials from clients across Central Oregon.',
  alternates: { canonical: `${siteUrl}/reviews` },
  openGraph: {
    title: 'Client Reviews | Ryan Realty',
    url: `${siteUrl}/reviews`,
    type: 'website',
  },
}

/** Testimonials from ryan-realty.com (Google reviews). */
const TESTIMONIALS = [
  {
    quote:
      "We had an excellent experience working with Matt! He was smart, understood our needs right away, and acted quickly while staying calm and patient throughout the process. Even in a tough market, he sold our home faster than we expected. Truly the best — highly recommend!",
    author: "Audra Hedberg",
    source: "Google",
  },
  {
    quote:
      "From the start of our journey to the end, Matt was right at every turn. Selling a house is an emotional roller coaster and Matt helped manage the downs while predicting the ups. I highly recommend Ryan Realty for both buying and selling!",
    author: "Doug Millard",
    source: "Google",
  },
  {
    quote:
      "Matt did a great job helping us sell our home. His presentation and marketing were professional and thorough. He was patient, low pressure with us and provided expert guidance. We would not hesitate to recommend or use Matt's services again.",
    author: "Gary Timms",
    source: "Google",
  },
  {
    quote:
      "Matt was invaluable in guiding us through our purchase. He is responsive, professional, and above all, a trustworthy person. Matt was always willing to assist us no matter the numerous questions we asked, connecting us with local resources, arranging contractors, and generally helping us jump through the various hoops that it takes to buy a house from out-of-state. We highly recommend Matt!",
    author: "Stephen Graham",
    source: "Google",
  },
  {
    quote:
      "Matt was amazing to work with. He went the extra mile to help us out while selling our house while we were out of the country. He is prompt to respond and very proactive for getting things done.",
    author: "SwankHQ",
    source: "Google",
  },
  {
    quote:
      "Matt Ryan is the man!!!!! We worked with Matt over a long time in deciding to rent or sell our home. Matt worked diligently in providing information for both options and gave excellent advice to our current situation. Even after choosing to rent the property Matt continued to work for us in helping get the home ready to rent. I am extremely grateful for his help and guidance. So So Grateful!!!! Thank you",
    author: "David Town",
    source: "Google",
  },
  {
    quote:
      "Our experience with Realtor Broker Matt Ryan has been superior. Matt provided Realtor expertise and much more to guide our sales transaction to the finish line. Realtor Matt has vital local knowledge, pays attention to detail and has excellent communication skills. It's a tall order fulfilled when a Realtor can successfully provide all of these services. How do I know this? As a Realtor Broker with 23 years of full time service of my own…. I know what it takes to be a top notch professional Realtor. Bravo Matt, we'll gladly continue recommend you!",
    author: "Helen Luna Fess",
    source: "Google",
  },
  {
    quote:
      "Looked at many realtors and interviewed several. Matt was the one we decided on and were 100% happy with the process",
    author: "Kim Anderson",
    source: "Google",
  },
  {
    quote:
      "Matt with Ryan Realty was great to work with. He consistently kept us in the loop & and worked hard representing in the selling of our property. We plan to use Matt again when we need a realtor.",
    author: "D Detweiler",
    source: "Google",
  },
  {
    quote:
      "Fantastic professional service. Goes the extra mile to cover the needs of his customers. Always prompt with replies and providing up to date information. Highly recommended.",
    author: "Paul Robinson",
    source: "Google",
  },
]

const GOOGLE_REVIEWS_URL = "https://www.google.com/maps/search/?api=1&query=Ryan+Realty+Bend+OR"

export default function ReviewsPage() {
  return (
    <main className="min-h-screen bg-background">
      <section className="bg-primary px-4 py-16 sm:px-6 sm:py-24">
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-sm font-semibold uppercase tracking-widest text-accent-foreground">
            Read Our Reviews
          </p>
          <h1 className="mt-4 text-4xl font-bold tracking-tight text-white sm:text-5xl">
            What Our Clients Say
          </h1>
          <p className="mt-6 text-lg text-muted/90">
            From first-time buyers to seasoned sellers, our clients share how Ryan Realty turned
            their Central Oregon dreams into reality. We&apos;re proud to be the team Bend counts on.
          </p>
          <a
            href={GOOGLE_REVIEWS_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-10 inline-flex items-center gap-2 rounded-lg bg-accent px-6 py-3.5 text-base font-semibold text-primary shadow-md hover:bg-accent/90"
          >
            View reviews on Google
            <ExternalLinkHugeIcon className="h-5 w-5" />
          </a>
        </div>
      </section>

      <section className="border-b border-border bg-card px-4 py-16 sm:px-6 sm:py-20" aria-labelledby="testimonials-heading">
        <div className="mx-auto max-w-5xl">
          <h2 id="testimonials-heading" className="sr-only">
            Client testimonials
          </h2>
          <ul className="grid gap-8 sm:grid-cols-2">
            {TESTIMONIALS.map((t) => (
              <li
                key={t.author + t.quote.slice(0, 40)}
                className="rounded-xl border border-border bg-card p-6 shadow-sm"
              >
                <blockquote className="text-foreground">
                  <p className="text-lg leading-relaxed">&ldquo;{t.quote}&rdquo;</p>
                  <footer className="mt-4 flex items-center justify-between">
                    <cite className="not-italic font-semibold text-primary">
                      — {t.author}
                    </cite>
                    <span className="text-sm text-muted-foreground">{t.source}</span>
                  </footer>
                </blockquote>
              </li>
            ))}
          </ul>
          <div className="mt-12 text-center">
            <a
              href={GOOGLE_REVIEWS_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-lg border-2 border-primary px-6 py-3 font-semibold text-primary hover:bg-primary hover:text-white"
            >
              Read more on Google
              <ExternalLinkHugeIcon className="h-5 w-5" />
            </a>
          </div>
        </div>
      </section>

      <section className="bg-muted px-4 py-14 sm:px-6" aria-labelledby="cta-heading">
        <div className="mx-auto max-w-2xl text-center">
          <h2 id="cta-heading" className="text-2xl font-bold text-primary">
            Ready to work with us?
          </h2>
          <p className="mt-3 text-muted-foreground">
            See why clients choose Ryan Realty for buying and selling in Central Oregon.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-4">
            <Link
              href="/contact"
              className="rounded-lg bg-primary px-6 py-3 font-semibold text-white hover:bg-accent/90"
            >
              Contact us
            </Link>
            <Link
              href="/team"
              className="rounded-lg border-2 border-primary px-6 py-3 font-semibold text-primary hover:bg-primary hover:text-white"
            >
              Meet the team
            </Link>
          </div>
        </div>
      </section>
    </main>
  )
}
