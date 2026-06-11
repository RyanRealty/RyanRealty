import type { Metadata } from 'next'
import Link from 'next/link'
import { ExternalLinkHugeIcon } from '@/components/icons/HugeIcons'
import { TESTIMONIALS, GOOGLE_REVIEWS_URL } from '@/lib/testimonials'
import { PageBreadcrumb } from '@/components/site/PageBreadcrumb'
import { DisplayHeading, H2 } from '@/components/site/primitives'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://ryan-realty.com').replace(/\/$/, '')
const ogImage = `${siteUrl}/api/og?type=default`

export const metadata: Metadata = {
  title: 'Client Reviews | Ryan Realty',
  description:
    'See what buyers and sellers say about working with Ryan Realty. Real testimonials from clients across Central Oregon.',
  alternates: { canonical: `${siteUrl}/reviews` },
  openGraph: {
    title: 'Client Reviews | Ryan Realty',
    url: `${siteUrl}/reviews`,
    type: 'website',
    images: [{ url: ogImage, width: 1200, height: 630 }],
  },
  twitter: { card: 'summary_large_image', images: [ogImage] },
}

export default function ReviewsPage() {
  return (
    <main className="min-h-screen bg-background">
      <PageBreadcrumb trail={[{ label: 'Reviews' }]} />
      <section className="bg-primary px-4 py-16 sm:px-6 sm:py-24">
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-sm font-semibold uppercase tracking-widest text-accent-foreground">
            Read Our Reviews
          </p>
          <DisplayHeading
            as="h1"
            className="mt-4 text-4xl text-primary-foreground sm:text-5xl"
          >
            What Our Clients Say
          </DisplayHeading>
          <p className="mt-6 text-lg text-muted/90">
            Real reviews from buyers and sellers across Central Oregon. Read what clients say about
            the process, the communication, and how deals came together.
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
              <li key={t.author + t.quote.slice(0, 40)}>
                <Card className="p-6">
                  <CardContent className="p-0">
                    <blockquote className="text-foreground">
                      <p className="text-lg leading-relaxed">&ldquo;{t.quote}&rdquo;</p>
                      <footer className="mt-4 flex items-center justify-between">
                        <cite className="not-italic font-semibold text-primary">
                          {t.author}
                        </cite>
                        <span className="text-sm text-muted-foreground">{t.source}</span>
                      </footer>
                    </blockquote>
                  </CardContent>
                </Card>
              </li>
            ))}
          </ul>
          <div className="mt-12 text-center">
            <a
              href={GOOGLE_REVIEWS_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-lg border-2 border-primary px-6 py-3 font-semibold text-primary hover:bg-primary hover:text-primary-foreground"
            >
              Read more on Google
              <ExternalLinkHugeIcon className="h-5 w-5" />
            </a>
          </div>
        </div>
      </section>

      <section className="bg-muted px-4 py-14 sm:px-6" aria-labelledby="cta-heading">
        <div className="mx-auto max-w-2xl text-center">
          <H2 id="cta-heading" className="text-2xl text-primary">
            Ready to work with us?
          </H2>
          <p className="mt-3 text-muted-foreground">
            See why clients choose Ryan Realty for buying and selling in Central Oregon.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-4">
            <Button asChild size="lg">
              <Link href="/contact">Contact us</Link>
            </Button>
            <Button asChild variant="outline" size="lg">
              <Link href="/team">Meet the team</Link>
            </Button>
          </div>
        </div>
      </section>
    </main>
  )
}
