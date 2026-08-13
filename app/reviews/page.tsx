/**
 * /reviews - Google reviews, on the components/site/v3 barrel.
 *
 * // @data-free — TESTIMONIALS is a static verified set, not a DAL read.
 *
 * VISUAL LANGUAGE: design_system/public/PUBLIC_UI.md, locked 2026-08-11.
 * Quiet (every review, verbatim) then Ledger (contact, team, homes).
 *
 * Reviews are quoted as written. Brand-voice laws do not rewrite client text.
 * No aggregateRating on this page (self-serving on our own site).
 *
 * D11: no invented quote. MLS remarks N/A.
 */

import type { Metadata } from 'next'
import { TESTIMONIALS, GOOGLE_REVIEWS_URL } from '@/lib/testimonials'
import { formatDate } from '@/lib/format/date'
import { listingsBrowsePath } from '@/lib/slug'
import { valuationHref } from '@/lib/site/valuation-href'
import {
  V3_ROOT_CLASS,
  v3Text,
  V3Breadcrumb,
  V3Footer,
  V3_FOOTER_COLUMNS,
  V3Ledger,
  V3Quiet,
  type V3QuietItem,
} from '@/components/site/v3'
import { KbSectionTracker } from '@/components/site/kb/KbSectionTracker.client'
import { buildReviewsJsonLd } from './_v3/reviews-jsonld'

const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://ryan-realty.com').replace(/\/$/, '')
const ogImage = `${siteUrl}/api/og?type=default`

export const metadata: Metadata = {
  title: `${TESTIMONIALS.length} client reviews · Ryan Realty`,
  description: `${TESTIMONIALS.length} verified Google reviews from buyers and sellers across Central Oregon. Full text on this page.`,
  alternates: { canonical: `${siteUrl}/reviews` },
  openGraph: {
    title: `${TESTIMONIALS.length} client reviews | Ryan Realty`,
    url: `${siteUrl}/reviews`,
    type: 'website',
    images: [{ url: ogImage, width: 1200, height: 630 }],
  },
  twitter: { card: 'summary_large_image', images: [ogImage] },
}

export default function ReviewsPage() {
  const reviewsJsonLd = buildReviewsJsonLd(siteUrl)

  const reviewItems: V3QuietItem[] = TESTIMONIALS.map((t) => {
    const stamp = formatDate(t.date, { month: 'short', day: undefined, year: 'numeric' })
    const when = stamp && stamp !== '\u2014' ? `Verified ${t.source} review, ${stamp}` : `Verified ${t.source} review`
    return {
      kind: 'prose' as const,
      term: t.author,
      body: [t.quote, when],
    }
  })

  return (
    <>
      <main className={V3_ROOT_CLASS}>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(reviewsJsonLd) }}
        />
        <KbSectionTracker pageType="media" />
        <V3Breadcrumb trail={[{ label: 'Home', href: '/' }, { label: 'Reviews' }]} />

        <V3Quiet
          id="reviews"
          eyebrow="Ryan Realty · Google reviews"
          heading={`${TESTIMONIALS.length} Google reviews`}
          headingLevel={1}
          items={[
            {
              kind: 'prose',
              body: 'From buyers and sellers across Central Oregon. Quoted as written, with names.',
            },
            { label: 'View reviews on Google', href: GOOGLE_REVIEWS_URL },
            ...reviewItems,
            { label: 'Read more on Google', href: GOOGLE_REVIEWS_URL },
            { label: 'Value my home', href: valuationHref('/reviews') },
          ]}
        />

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
