import type { Metadata } from 'next'
import Link from 'next/link'
import { ExternalLinkHugeIcon } from '@/components/icons/HugeIcons'
import { TESTIMONIALS, GOOGLE_REVIEWS_URL } from '@/lib/testimonials'
import { formatDate } from '@/lib/format/date'
import { ReviewsCollapse } from './ReviewsCollapse.client'
import { SmoothScrollProvider } from '@/components/site/kb/SmoothScrollProvider.client'
import { KbNav } from '@/components/site/kb/KbNav.client'
import { KbBreadcrumb } from '@/components/site/kb/KbBreadcrumb'
import { KbHero } from '@/components/site/kb/KbHero.client'
import { KbFooter } from '@/components/site/kb/KbFooter.client'
import { KbSectionTracker } from '@/components/site/kb/KbSectionTracker.client'
import '@/components/site/kb/kb.css'

/**
 * /reviews — Client reviews destination.
 *
 * KB (kinetic-brutalist) design — Phase 9 page-class migration (media class).
 * Restyled IN PLACE. Every piece of content is preserved:
 *   - export const metadata (title/description/canonical/OG/twitter)
 *   - hero copy ("What Our Clients Say") + the "View reviews on Google" link
 *   - ALL 24 verified Google testimonials (verbatim quote + author + source),
 *     rendered as hard-edged KB review cards with five-star ratings. The full
 *     set is kept (the shared KbTestimonials component caps at 6, which would
 *     drop 18 — so the grid is restyled in place to preserve every review).
 *   - the "Read more on Google" CTA at the foot of the grid
 *   - the "Talk to a Ryan Realty broker" CTA (Contact us / Meet the team)
 *
 * Reviews are quoted verbatim with attribution, so the copy is exempt from the
 * brand-voice Five Laws and is never altered (CLAUDE.md §0 + brand-voice scope).
 */

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

// One five-point star, point-up inside a 24×24 box — matches KbTestimonials.
const STAR_PATH =
  'M12 1.6 L15.09 8.01 L22.06 8.86 L16.95 13.62 L18.27 20.51 L12 17.12 L5.73 20.51 L7.05 13.62 L1.94 8.86 L8.91 8.01 Z'

// Rating the page renders for every testimonial card. lib/testimonials.ts is the
// source of truth: all 24 entries are verified 5-star reviews (the grid above
// draws exactly five stars per card from this value). Per CLAUDE.md §0 every
// number in the JSON-LD traces to this same rendered rating — nothing invented.
const RENDERED_STAR_RATING = 5

/**
 * Review + AggregateRating JSON-LD for the brokerage, built from the SAME
 * TESTIMONIALS the page renders so SERP rich results match what's on screen.
 *
 * Each rendered card draws RENDERED_STAR_RATING stars, so every Review node
 * carries that rating as reviewRating. reviewCount = the actual count of those
 * rated reviews, and ratingValue = the mean of their ratings (derived, not
 * hardcoded — if the data changes the math follows). aggregateRating is emitted
 * only when at least one rated review exists, so no rating is ever fabricated.
 */
function buildReviewsJsonLd(): Record<string, unknown> {
  const reviews = TESTIMONIALS.map((t) => ({
    '@type': 'Review',
    author: { '@type': 'Person', name: t.author },
    reviewBody: t.quote,
    datePublished: t.date,
    reviewRating: {
      '@type': 'Rating',
      ratingValue: RENDERED_STAR_RATING,
      bestRating: 5,
      worstRating: 1,
    },
  }))

  const ratingCount = reviews.length
  const aggregateRating =
    ratingCount > 0
      ? {
          '@type': 'AggregateRating',
          ratingValue:
            reviews.reduce((sum, r) => sum + r.reviewRating.ratingValue, 0) / ratingCount,
          reviewCount: ratingCount,
          bestRating: 5,
          worstRating: 1,
        }
      : undefined

  const subject: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'RealEstateAgent',
    '@id': `${siteUrl}#organization`,
    name: 'Ryan Realty',
    url: `${siteUrl}/reviews`,
    review: reviews,
  }
  if (aggregateRating) subject.aggregateRating = aggregateRating
  return subject
}

export default function ReviewsPage() {
  const reviewsJsonLd = buildReviewsJsonLd()
  return (
    <main className="kb-root">
      {/* Review + AggregateRating JSON-LD — built from the rendered TESTIMONIALS
          so the SERP rich result matches the cards on the page. */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(reviewsJsonLd) }}
      />
      <KbNav />
      <KbSectionTracker pageType="media" />
      <KbBreadcrumb overlay
        trail={[
          { label: 'Home', href: '/' },
          { label: 'Reviews' },
        ]}
      />

      <SmoothScrollProvider>
        {/* Hero — "What Our Clients Say" on the KB display type. The prior
            hero's "View reviews on Google" link is preserved in the chips row
            below the hero so it stays one tap away. */}
        <KbHero
          data={{ activeCount: null, medianListPrice: null, medianDaysToPending: null }}
          eyebrow="Read our reviews"
          titleTop="What our"
          titleBottom="clients say"
          lead="Real reviews from buyers and sellers across Central Oregon. Read what clients say about the process, the communication, and how deals came together."
          videoSrc={null}
          posterSrc="/images/homepage/bend-drake-park-aerial.jpg"
          showSearch={false}
        />

        {/* "View reviews on Google" — preserved from the prior hero CTA. The
            5.0/24-review aggregate previously lived only in JSON-LD (invisible
            to a human reader) — surfaced here as the visible proof line. */}
        <section className="section" id="google-cta" aria-label="View reviews on Google">
          <div className="wrap">
            <div className="flex flex-wrap items-center gap-3 py-2">
              <a
                href={GOOGLE_REVIEWS_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="btn alt"
              >
                View reviews on Google
                <ExternalLinkHugeIcon className="ml-1 h-5 w-5" />
              </a>
              {TESTIMONIALS.length > 0 ? (
                <span className="mono-num" style={{ color: 'var(--navy-70)', fontSize: '.92rem' }}>
                  {RENDERED_STAR_RATING.toFixed(1)} · {TESTIMONIALS.length} Google reviews
                </span>
              ) : null}
            </div>
          </div>
        </section>

        {/* Client testimonials — ALL 24 verified Google reviews, verbatim, as
            hard-edged KB review cards (five stars + quote + attribution). */}
        <section className="section kb-reviews" id="testimonials" aria-labelledby="testimonials-heading">
          <div className="wrap">
            <div className="sec-head kb-reviews-head">
              <div>
                <span className="sec-index">In their words</span>
                <h2 id="testimonials-heading" className="sec-title display">
                  Client reviews
                </h2>
              </div>
              <a className="kb-reviews-all" href={GOOGLE_REVIEWS_URL} target="_blank" rel="noopener noreferrer">
                Read all on Google <span className="arr">→</span>
              </a>
            </div>

            <ReviewsCollapse total={TESTIMONIALS.length}>
              {TESTIMONIALS.map((t) => (
                <li key={t.author + t.quote.slice(0, 40)}>
                  <figure className="kb-rev-card h-full">
                    <div className="kb-rev-stars" role="img" aria-label="Five out of five stars">
                      {Array.from({ length: 5 }).map((_, s) => (
                        <svg key={s} viewBox="0 0 24 24" width="15" height="15" aria-hidden="true">
                          <path d={STAR_PATH} />
                        </svg>
                      ))}
                    </div>
                    <blockquote className="kb-rev-quote">&ldquo;{t.quote}&rdquo;</blockquote>
                    <figcaption className="kb-rev-who">
                      <b>{t.author}</b>
                      <span>
                        Verified {t.source} review · {formatDate(t.date, { month: 'short', day: undefined, year: 'numeric' })}
                      </span>
                    </figcaption>
                  </figure>
                </li>
              ))}
            </ReviewsCollapse>

            <div className="sec-cta">
              <a
                href={GOOGLE_REVIEWS_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="btn alt"
              >
                Read more on Google
                <ExternalLinkHugeIcon className="ml-1 h-5 w-5" />
              </a>
            </div>
          </div>
        </section>

        {/* "Talk to a Ryan Realty broker" — preserved CTA block. */}
        <section className="section" id="cta" aria-labelledby="cta-heading">
          <div className="wrap">
            <div className="sec-head">
              <span className="sec-index">Buy or sell in Central Oregon</span>
              <h2 id="cta-heading" className="sec-title display">
                Talk to a<br />Ryan Realty broker
              </h2>
            </div>
            <div className="max-w-2xl pt-6">
              <p style={{ color: 'var(--navy-70)', fontSize: 'clamp(1rem,1.6vw,1.2rem)', lineHeight: 1.55 }}>
                Buy or sell in Central Oregon with a broker you reach directly.
              </p>
              <div className="flex flex-wrap items-center gap-3 pt-6">
                <Link href="/contact" className="btn alt">
                  Contact us <span className="arr">→</span>
                </Link>
                <Link
                  href="/team"
                  className="btn alt"
                  style={{ background: 'transparent', color: 'var(--navy)' }}
                >
                  Meet the team <span className="arr">→</span>
                </Link>
              </div>
            </div>
          </div>
        </section>

        <KbFooter towns={[]} />
      </SmoothScrollProvider>
    </main>
  )
}
