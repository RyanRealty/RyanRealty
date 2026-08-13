/**
 * Review JSON-LD for /reviews, built from the SAME quotes the page
 * renders so SERP rich results match what is on screen.
 *
 * Deliberately NO aggregateRating: an aggregate rating of the business,
 * published on the business's own site, is a self-serving review under
 * Google's structured-data policy.
 */

import type { ReviewQuote } from './review-quotes'

function ratingValue(rating: number): number {
  if (!Number.isFinite(rating)) return 5
  return Math.min(5, Math.max(1, Math.round(rating)))
}

export function buildReviewsJsonLd(
  siteUrl: string,
  quotes: readonly ReviewQuote[],
): Record<string, unknown> {
  const reviews = quotes.map((t) => ({
    '@type': 'Review',
    author: { '@type': 'Person', name: t.author },
    reviewBody: t.quote,
    ...(t.date ? { datePublished: t.date } : {}),
    reviewRating: {
      '@type': 'Rating',
      ratingValue: ratingValue(t.rating),
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
