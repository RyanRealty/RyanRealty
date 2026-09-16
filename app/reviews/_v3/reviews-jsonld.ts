/**
 * Review JSON-LD for /reviews, built from the SAME quotes the page
 * renders so SERP rich results match what is on screen.
 *
 * Deliberately NO aggregateRating: an aggregate rating of the business,
 * published on the business's own site, is a self-serving review under
 * Google's structured-data policy.
 */

import type { ReviewQuote } from '@/lib/reviews/review-quotes'

function ratingValue(rating: number): number {
  if (!Number.isFinite(rating)) return 5
  return Math.min(5, Math.max(1, Math.round(rating)))
}

/**
 * The Review items alone — one per quote actually rendered — for any page that
 * prints reviews (SITE-90: /about prints the newest four in V3Proof and had no
 * Review markup for them). Same policy as above: no aggregateRating.
 */
export function reviewItemsJsonLd(quotes: readonly ReviewQuote[]): Array<Record<string, unknown>> {
  return quotes.map((t) => ({
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
}

export function buildReviewsJsonLd(
  siteUrl: string,
  quotes: readonly ReviewQuote[],
): Record<string, unknown> {
  const reviews = reviewItemsJsonLd(quotes)

  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: `${siteUrl}/` },
          { '@type': 'ListItem', position: 2, name: 'Reviews', item: `${siteUrl}/reviews` },
        ],
      },
      {
        '@type': 'WebPage',
        '@id': `${siteUrl}/reviews#webpage`,
        name: `${quotes.length} Google reviews of Ryan Realty`,
        url: `${siteUrl}/reviews`,
        description: `${quotes.length} verified Google reviews of Ryan Realty, each in full on this page.`,
      },
      {
        '@type': 'ItemList',
        '@id': `${siteUrl}/reviews#list`,
        name: 'Google reviews of Ryan Realty',
        numberOfItems: quotes.length,
        itemListElement: quotes.map((t, i) => ({
          '@type': 'ListItem',
          position: i + 1,
          name: t.author,
          url: `${siteUrl}/reviews#reviews`,
        })),
      },
      {
        '@type': 'RealEstateAgent',
        '@id': `${siteUrl}#organization`,
        name: 'Ryan Realty',
        url: `${siteUrl}/reviews`,
        review: reviews,
      },
    ],
  }
}
