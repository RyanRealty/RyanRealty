/**
 * /reviews - Google reviews as written, on the components/site/v3 barrel.
 *
 * VISUAL LANGUAGE: design_system/public/PUBLIC_UI.md, locked 2026-08-11.
 * Look (2026-08-13): Reviews = Google quotes first. The first viewport is
 * live GBP text as written (V3Proof: figures, the record strip, year chips, the quotes), then Ledger (contact, team, homes),
 * then Quiet (Google + Value my home). PUBLIC_UI.md opens About on Quiet +
 * Sheet. Quotes are Quiet's job (verbatim proof) at inventory weight, compact
 * like AboutFaces so a quote is on screen at 390. The family's Sheet stays on
 * /contact and /team/[slug].
 *
 * Reviews are quoted as written. Brand-voice laws do not rewrite client text.
 * No aggregateRating on this page (self-serving on our own site).
 * No star HUD, no paraphrase, no ticker.
 *
 * D11: no invented quote. MLS remarks N/A.
 */

import type { Metadata } from 'next'
import { getReviews } from '@/lib/data'
import { GOOGLE_REVIEWS_URL } from '@/lib/testimonials'
import { listingsBrowsePath } from '@/lib/slug'
import { valuationHref } from '@/lib/site/valuation-href'
import {
  V3_ROOT_CLASS,
  v3Text,
  V3Breadcrumb,
  V3Footer,
  V3_FOOTER_COLUMNS,
  V3Ledger,
  V3Proof,
  V3Quiet,
  V3SectionTracker,
} from '@/components/site/v3'
import { formatDate } from '@/lib/format/date'
import { buildReviewsJsonLd } from './_v3/reviews-jsonld'
import { toReviewQuotes } from '@/lib/reviews/review-quotes'

const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://ryan-realty.com').replace(/\/$/, '')
const ogImage = `${siteUrl}/api/og?type=default`
const ROUTE_PATH = '/reviews'

export const revalidate = 3600

export async function generateMetadata(): Promise<Metadata> {
  const quotes = toReviewQuotes((await getReviews(50)).reviews)
  const n = quotes.length
  return {
    title: `${n} client reviews · Ryan Realty`,
    description: `${n} verified Google reviews from buyers and sellers across Central Oregon. Full text on this page.`,
    alternates: { canonical: `${siteUrl}${ROUTE_PATH}` },
    openGraph: {
      title: `${n} client reviews | Ryan Realty`,
      url: `${siteUrl}${ROUTE_PATH}`,
      type: 'website',
      images: [{ url: ogImage, width: 1200, height: 630 }],
    },
    twitter: { card: 'summary_large_image', images: [ogImage] },
  }
}

export default async function ReviewsPage() {
  const summary = await getReviews(50)
  const quotes = toReviewQuotes(summary.reviews)
  const reviewsJsonLd = buildReviewsJsonLd(siteUrl, quotes)
  const heading = `${quotes.length} Google reviews`
  // Every figure below is the source's own: count and average from the
  // reviews table (all non-hidden Google rows), first and newest from the
  // dates on the quotes printed. A live read that returned nothing falls back
  // to the recorded testimonials, whose count and 5.0 are what they carry.
  const count = summary.count > 0 ? summary.count : quotes.length
  const average = summary.count > 0 ? summary.averageRating : 5
  const dated = quotes.filter((q) => q.date).sort((a, b) => (a.date! < b.date! ? -1 : 1))
  const firstDate = dated[0]?.date ?? null
  const newestDate = dated[dated.length - 1]?.date ?? null
  const firstYear = dated[0]?.year
  const newestYear = dated[dated.length - 1]?.year
  const thisYear = new Date().getFullYear()
  const thisYearCount = quotes.filter((q) => q.year === thisYear).length
  const claim =
    firstYear && newestYear && firstYear !== newestYear
      ? `${average.toFixed(1)} of 5 across ${count} reviews, ${firstYear} to ${newestYear}. Every one in full, as written.`
      : `${average.toFixed(1)} of 5 across ${count} reviews. Every one in full, as written.`
  const figures = [
    { value: String(count), label: 'Google reviews' },
    { value: average.toFixed(1), label: 'average of 5' },
    ...(thisYearCount > 0 ? [{ value: String(thisYearCount), label: `in ${thisYear}` }] : []),
    ...(firstDate ? [{ value: formatDate(firstDate, { month: 'short', day: undefined, year: 'numeric' }), label: 'first review' }] : []),
    ...(newestDate ? [{ value: formatDate(newestDate, { month: 'short', day: undefined, year: 'numeric' }), label: 'newest' }] : []),
  ]

  return (
    <>
      <main className={V3_ROOT_CLASS}>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(reviewsJsonLd) }}
        />
        <V3SectionTracker />
        <V3Breadcrumb trail={[{ label: 'Home', href: '/' }, { label: 'Reviews' }]} />

        {quotes.length > 0 ? (
          <V3Proof
            id="reviews"
            eyebrow="Ryan Realty · Google"
            headline={heading}
            headingLevel={1}
            claim={claim}
            figures={figures}
            quotes={quotes}
            source={{ label: 'View every review on Google', href: GOOGLE_REVIEWS_URL }}
          />
        ) : (
          <V3Quiet
            id="reviews"
            eyebrow="Ryan Realty · Google"
            heading="Google reviews"
            headingLevel={1}
            items={[{ label: 'View reviews on Google', href: GOOGLE_REVIEWS_URL }]}
          />
        )}

        <V3Ledger
          id="next"
          eyebrow={v3Text('Next step')}
          heading={v3Text('Talk to a broker')}
          rows={[
            {
              href: '/contact',
              when: v3Text('Write'),
              what: v3Text('Call, text, or write'),
              detail: v3Text('A broker replies within one business day'),
            },
            {
              href: '/team',
              when: v3Text('People'),
              what: v3Text('Broker profiles'),
              detail: v3Text('Matt Ryan, Paul Stevenson, Rebecca Peterson'),
            },
            {
              href: listingsBrowsePath(),
              when: v3Text('Homes'),
              what: v3Text('Homes for sale'),
              detail: v3Text('Central Oregon listings'),
            },
          ]}
        />

        <V3Quiet
          id="edges"
          ariaLabel="Reviews and valuation"
          items={[
            { label: 'View reviews on Google', href: GOOGLE_REVIEWS_URL },
            { label: 'Value my home', href: valuationHref(ROUTE_PATH) },
          ]}
        />
      </main>

      {/* Outside <main> on purpose. HTML-AAM maps <footer> to role=contentinfo only
          when it is NOT nested in sectioning content, and <main> is sectioning
          content, so inside it the element is a generic and the page ships no
          contentinfo landmark. ci:default-chrome-footer counts footers without
          checking placement. */}
      <V3Footer columns={V3_FOOTER_COLUMNS} />
    </>
  )
}
