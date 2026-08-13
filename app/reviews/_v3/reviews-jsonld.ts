/**
 * Review JSON-LD for /reviews, built from the SAME TESTIMONIALS the page
 * renders so SERP rich results match what is on screen.
 *
 * Deliberately NO aggregateRating: an aggregate rating of the business,
 * published on the business's own site, is a self-serving review under
 * Google's structured-data policy.
 */

import { TESTIMONIALS } from '@/lib/testimonials'

export const RENDERED_STAR_RATING = 5

export function buildReviewsJsonLd(siteUrl: string): Record<string, unknown> {
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

  return {
    '@context': 'https://schema.org',
    '@type': 'RealEstateAgent',
    '@id': `${siteUrl}#organization`,
    name: 'Ryan Realty',
    url: `${siteUrl}/reviews`,
    review: reviews,
  }
}
