/**
 * /reviews - Google reviews as written, on the components/site/v3 barrel.
 *
 * VISUAL LANGUAGE: design_system/public/PUBLIC_UI.md, locked 2026-08-11.
 * Look (SITE-48, 2026-09-09): the page opens ON THE RATING. V3Proof is the
 * whole opening — the Google score face (5.0 drawn as stars, the count), the
 * span as context figures, one client's words in full, then the reach as a
 * slim action row, then the strip of every review on its month with the year
 * chips and the full-text archive. The reach was a V3Quiet list ABOVE all of
 * that until this pass, which meant four identical arrow rows were the first
 * thing a reader judging us met, with a blank band above them. Doors close
 * the page. The family's Sheet stays on /contact and /team/[slug].
 *
 * Reviews are quoted as written. Brand-voice laws do not rewrite client text.
 * No aggregateRating on this page (self-serving on our own site).
 * No star HUD, no paraphrase, no ticker.
 *
 * D11: no invented quote. MLS remarks N/A.
 *
 * Parity: design_system/ryan-realty/ui_kits/reviews/parity.json
 */

import type { Metadata } from 'next'
import { getReviews } from '@/lib/data'
import { GOOGLE_REVIEWS_URL } from '@/lib/testimonials'
import { valuationHref } from '@/lib/site/valuation-href'
import { CONTACT } from '@/lib/brand/contact'
import {
  V3_ROOT_CLASS,
  v3Text,
  V3Breadcrumb,
  V3Footer,
  V3_FOOTER_COLUMNS,
  V3Doors,
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
  /* The claim no longer restates the score. The headline carries the count and
     the score face under it carries the average drawn as stars, so a claim of
     "5.0 of 5 across 25 reviews" printed the same two numbers a third and a
     fourth time in one screen. What the sentence is FOR is the promise the
     figures cannot make: nothing here is picked, cut, or rewritten. */
  const claim =
    firstYear && newestYear && firstYear !== newestYear
      ? `Every review Ryan Realty has, ${firstYear} to ${newestYear}, in full and exactly as it was written. Nothing picked, nothing trimmed.`
      : 'Every review Ryan Realty has, in full and exactly as it was written. Nothing picked, nothing trimmed.'
  const figures = [
    { value: String(count), label: 'Google reviews' },
    { value: average.toFixed(1), label: 'average of 5' },
    ...(thisYearCount > 0 ? [{ value: String(thisYearCount), label: `in ${thisYear}` }] : []),
    ...(firstDate ? [{ value: formatDate(firstDate, { month: 'short', day: undefined, year: 'numeric' }), label: 'first review' }] : []),
    ...(newestDate ? [{ value: formatDate(newestDate, { month: 'short', day: undefined, year: 'numeric' }), label: 'newest' }] : []),
  ]

  /* The reach, folded into the Proof band as one slim row under the opening
     (SITE-48). It was a V3Quiet section of its own ABOVE the instrument, and
     the taste table's dullest-thing finding was exactly that: "a person
     landing on a reviews page to judge trustworthiness meets four identical
     arrow-tipped rows of contact info before seeing a single star or quote".
     Same four destinations, one row, after the score and the lead quote. */
  const reachActions = [
    { label: `Call ${CONTACT.phoneDirect}`, href: `tel:${CONTACT.phoneDirectTel}` },
    { label: 'Text us', href: `sms:${CONTACT.phoneDirectTel}` },
    { label: 'Email', href: `mailto:${CONTACT.email.primary}` },
    { label: 'Book a time', href: '/book' },
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
            archive
            face
            actions={reachActions}
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

        <V3Doors
          id="next"
          name={v3Text('Talk to a broker')}
          doors={[
            {
              kicker: v3Text('Call'),
              label: v3Text(CONTACT.phoneDirect),
              fact: v3Text('Local experts. Exceptional customer service.'),
              href: `tel:${CONTACT.phoneDirectTel}`,
            },
            {
              kicker: v3Text('Schedule'),
              label: v3Text('Book a broker'),
              fact: v3Text('Pick a time on the calendar'),
              href: '/book',
            },
            {
              kicker: v3Text('People'),
              label: v3Text('Broker profiles'),
              fact: v3Text('Licensed Oregon brokers'),
              href: '/team',
            },
            {
              kicker: v3Text('Sell'),
              label: v3Text('Value my home'),
              fact: v3Text('From recent comparable sales'),
              href: valuationHref(ROUTE_PATH),
            },
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
